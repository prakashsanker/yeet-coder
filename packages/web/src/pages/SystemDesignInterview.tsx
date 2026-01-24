import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import FloatingInterviewer from '@/components/interview/FloatingInterviewer'
import AppHeader from '@/components/common/AppHeader'
import { useRealtimeVoice } from '@/hooks/useRealtimeVoice'
import { api, API_URL, type InterviewSession, type TranscriptEntry } from '@/lib/api'

export default function SystemDesignInterview() {
  const navigate = useNavigate()
  const { id: interviewIdParam } = useParams<{ id: string }>()

  // Interview state
  const [interview, setInterview] = useState<InterviewSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Drawing state - use unknown[] to avoid type conflicts with Excalidraw's complex types
  const [elements, setElements] = useState<readonly unknown[]>([])

  // Notes state
  const [notes, setNotes] = useState('')

  // Timer state
  const [timeSpentMs, setTimeSpentMs] = useState(0)
  const [hasIntroduced, setHasIntroduced] = useState(() => {
    if (interviewIdParam) {
      return localStorage.getItem(`intro_played_${interviewIdParam}`) === 'true'
    }
    return false
  })
  const [isResumedSession, setIsResumedSession] = useState(false)

  // Introduction caching state
  const [cachedIntro, setCachedIntro] = useState<{ text: string; audio?: string } | null>(null)
  const [isPreloading, setIsPreloading] = useState(false)

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGivingUp, setIsGivingUp] = useState(false)

  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedRef = useRef<{ elements: string; notes: string }>({ elements: '[]', notes: '' })

  // Format question for voice context
  const questionContext = useMemo(() => {
    if (!interview?.question) return ''
    const q = interview.question
    return `${q.title}\n\n${q.description}`
  }, [interview])

  // Voice interaction hook - using Realtime API for low-latency
  const {
    voiceState,
    currentTranscript,
    isConnected: isWsConnected,
    isGeneratingIntro,
    startListening,
    stopListening,
    playRealtimeIntroduction,
    isAlwaysListening,
    isSpeechDetected,
    enableAlwaysListening,
    disableAlwaysListening,
  } = useRealtimeVoice({
    interviewId: interviewIdParam || '',
    currentQuestion: questionContext,
    userCode: notes, // Use notes as context
    onTranscriptUpdate: (newTranscript: TranscriptEntry[]) => {
      const lastEntry = newTranscript[newTranscript.length - 1]
      if (lastEntry) {
        // Fire-and-forget save to backend
        if (interviewIdParam) {
          api.interviews.update(interviewIdParam, {
            transcript_entry: lastEntry,
          }).catch(console.error)
        }
      }
    },
    onInterviewerResponse: () => {},
  })

  // Load interview on mount
  useEffect(() => {
    async function loadInterview() {
      if (!interviewIdParam) {
        setLoadError('No interview ID provided')
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setLoadError(null)

        const { interview: loadedInterview } = await api.interviews.get(interviewIdParam)

        // Redirect to coding interview if not system design
        if (loadedInterview.session_type !== 'system_design') {
          navigate(`/interview/${interviewIdParam}`, { replace: true })
          return
        }

        setInterview(loadedInterview)

        // Load existing data
        if (loadedInterview.drawing_data?.elements) {
          setElements(loadedInterview.drawing_data.elements)
        }
        if (loadedInterview.notes) {
          setNotes(loadedInterview.notes)
        }
        setTimeSpentMs((loadedInterview.time_spent_seconds || 0) * 1000)

        // Check if this is a resumed session
        const isResumed = (loadedInterview.time_spent_seconds || 0) > 5 ||
                          loadedInterview.drawing_data?.elements?.length ||
                          loadedInterview.notes
        if (isResumed) {
          setIsResumedSession(true)
          setHasIntroduced(true)
          localStorage.setItem(`intro_played_${interviewIdParam}`, 'true')
          console.log('[SYSTEM_DESIGN] Resumed session - skipping intro')
        }

        setIsLoading(false)
      } catch (err) {
        console.error('Error loading interview:', err)
        setLoadError('Failed to load interview')
        setIsLoading(false)
      }
    }

    loadInterview()
  }, [interviewIdParam, navigate])

  // Timer tick
  useEffect(() => {
    if (!interview || interview.status !== 'in_progress') return

    timerRef.current = setInterval(() => {
      setTimeSpentMs(prev => prev + 1000)
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [interview])

  // Auto-save every 10 seconds
  useEffect(() => {
    if (!interviewIdParam || !interview || interview.status !== 'in_progress') return

    autoSaveRef.current = setInterval(async () => {
      const currentElements = JSON.stringify(elements)
      const currentNotes = notes

      const hasChanges =
        currentElements !== lastSavedRef.current.elements ||
        currentNotes !== lastSavedRef.current.notes

      if (hasChanges) {
        try {
          await api.interviews.update(interviewIdParam, {
            drawing_data: { elements: elements as unknown[] },
            notes,
            time_spent_seconds: Math.floor(timeSpentMs / 1000),
          })
          lastSavedRef.current = { elements: currentElements, notes: currentNotes }
          console.log('[AUTO-SAVE] Saved drawing and notes')
        } catch (err) {
          console.error('[AUTO-SAVE] Failed:', err)
        }
      }
    }, 10000)

    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current)
    }
  }, [interviewIdParam, interview, elements, notes, timeSpentMs])

  // Generate and play introduction using Realtime API voice (same as conversation)
  // This is triggered when WebSocket connects and question is loaded
  useEffect(() => {
    // Skip if intro was already played or this is a resumed session
    if (hasIntroduced || isResumedSession) {
      return
    }

    // Need WebSocket connection and question data
    if (!isWsConnected || !interview?.question || !questionContext) {
      return
    }

    // Already generating or have cached intro
    if (isPreloading || isGeneratingIntro || cachedIntro) {
      return
    }

    // First, generate the introduction text via REST API (fast, text-only)
    // Then generate audio via Realtime API WebSocket for voice consistency
    console.log('[INTRO] Generating system design introduction text...')
    setIsPreloading(true)

    fetch(`${API_URL}/api/voice/introduce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_question: questionContext,
        include_audio: false, // Don't use TTS - we'll use Realtime API for audio
      }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}: ${res.statusText}`)
        }
        return res.json()
      })
      .then((data) => {
        if (data.success && data.text) {
          console.log('[INTRO] Got introduction text, generating audio via Realtime API...')
          // Store the text, audio will be generated via Realtime API
          setCachedIntro({ text: data.text })
        } else {
          console.error('[INTRO] API returned unsuccessful response:', data)
        }
      })
      .catch((err) => {
        console.error('[INTRO] Failed to generate introduction text:', err)
      })
      .finally(() => {
        setIsPreloading(false)
      })
  }, [interview, questionContext, isWsConnected, cachedIntro, isPreloading, isGeneratingIntro, hasIntroduced, isResumedSession])

  // Play intro when text is ready - use Realtime API for audio
  useEffect(() => {
    if (cachedIntro && !hasIntroduced && interview?.question && !isResumedSession && isWsConnected) {
      setHasIntroduced(true)
      // Persist to localStorage so refresh doesn't replay intro
      if (interviewIdParam) {
        localStorage.setItem(`intro_played_${interviewIdParam}`, 'true')
      }

      // Use Realtime API to generate and play audio (same voice as conversation)
      setTimeout(() => {
        console.log('[INTRO] Playing introduction with Realtime API voice...')
        playRealtimeIntroduction(cachedIntro.text)
      }, 500)
    }
  }, [cachedIntro, hasIntroduced, interview, playRealtimeIntroduction, interviewIdParam, isResumedSession, isWsConnected])

  // Handle drawing changes
  const handleExcalidrawChange = useCallback((newElements: readonly unknown[]) => {
    setElements(newElements)
  }, [])

  // Handle notes changes
  const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value)
  }, [])

  // Submit interview
  const handleSubmit = async () => {
    if (!interviewIdParam || !interview || isSubmitting) return

    setIsSubmitting(true)

    try {
      // Save final state
      await api.interviews.update(interviewIdParam, {
        drawing_data: { elements: elements as unknown[] },
        notes,
        time_spent_seconds: Math.floor(timeSpentMs / 1000),
      })

      // End interview
      await api.interviews.end(interviewIdParam, {
        reason: 'submit',
        time_spent_seconds: Math.floor(timeSpentMs / 1000),
      })

      // Create evaluation
      const { evaluation } = await api.evaluations.create({ interview_id: interviewIdParam })

      // Navigate to evaluation page
      navigate(`/evaluation/${evaluation.id}`)
    } catch (err) {
      console.error('Error submitting interview:', err)
      alert('Failed to submit interview. Please try again.')
      setIsSubmitting(false)
    }
  }

  // Give up
  const handleGiveUp = async () => {
    if (!interviewIdParam || !interview || isGivingUp) return

    const confirmed = window.confirm('Are you sure you want to give up? Your progress will be saved but marked as abandoned.')
    if (!confirmed) return

    setIsGivingUp(true)

    try {
      await api.interviews.update(interviewIdParam, {
        drawing_data: { elements: elements as unknown[] },
        notes,
        time_spent_seconds: Math.floor(timeSpentMs / 1000),
      })

      await api.interviews.end(interviewIdParam, {
        reason: 'give_up',
        time_spent_seconds: Math.floor(timeSpentMs / 1000),
      })

      navigate('/')
    } catch (err) {
      console.error('Error ending interview:', err)
      setIsGivingUp(false)
    }
  }

  // Format time for display
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading interview...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (loadError || !interview) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-red-400 mb-4">{loadError || 'Interview not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  // Waiting for intro to generate (skip for resumed sessions)
  if (!cachedIntro && (isPreloading || isGeneratingIntro || !isWsConnected) && !isResumedSession && !hasIntroduced) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p>
            {!isWsConnected ? 'Connecting to voice service...' : isGeneratingIntro ? 'Generating introduction...' : 'Preparing AI interviewer...'}
          </p>
        </div>
      </div>
    )
  }

  const question = interview.question
  const timeLimitMs = (interview.time_limit_seconds || 3600) * 1000
  const remainingSeconds = Math.max(0, Math.floor((timeLimitMs - timeSpentMs) / 1000))

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Loading overlay for submit/give up */}
      {(isSubmitting || isGivingUp) && (
        <div className="absolute inset-0 z-50 bg-gray-900/90 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p className="text-lg font-medium">
              {isSubmitting ? 'Generating evaluation...' : 'Saving your progress...'}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              {isSubmitting ? 'This may take a moment' : 'Please wait'}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <AppHeader
        rightContent={
          <div className="flex items-center gap-4">
            {/* Timer */}
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-lc-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className={`font-mono text-lg font-semibold ${remainingSeconds <= 300 ? 'text-red-400' : 'text-lc-text-primary'}`}>
                {formatTime(timeSpentMs)} / {formatTime(timeLimitMs)}
              </span>
            </div>
            <button
              onClick={handleGiveUp}
              disabled={isSubmitting || isGivingUp}
              className="px-3 py-1.5 text-sm text-lc-text-muted hover:text-lc-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGivingUp ? 'Saving...' : 'Give Up'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || isGivingUp}
              className="px-4 py-1.5 bg-lc-green hover:bg-lc-green-dark rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        }
      >
        {/* Center: Question title and badge */}
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium text-lc-text-secondary truncate max-w-md">{question?.title || 'System Design'}</h1>
          <span className="px-2 py-0.5 text-xs bg-purple-600 text-white rounded">System Design</span>
        </div>
      </AppHeader>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel: Question */}
        <div className="w-80 p-4 border-r border-gray-700 overflow-y-auto flex-shrink-0">
          <h2 className="text-xl font-bold mb-4">{question?.title}</h2>
          <div className="prose prose-invert prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-gray-300">{question?.description}</div>
          </div>
        </div>

        {/* Center panel: Excalidraw */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 bg-white min-h-0">
            <Excalidraw
              initialData={{ elements: elements as any }}
              onChange={(newElements) => handleExcalidrawChange(newElements)}
              theme="light"
            />
          </div>
        </div>

        {/* Right panel: Notes */}
        <div className="w-80 flex flex-col border-l border-gray-700 flex-shrink-0">
          <div className="p-3 border-b border-gray-700">
            <h3 className="font-semibold text-sm">Notes</h3>
            <p className="text-xs text-gray-400 mt-1">Write down your thoughts, calculations, and decisions</p>
          </div>
          <textarea
            value={notes}
            onChange={handleNotesChange}
            placeholder="- Requirements clarification&#10;- Capacity estimates&#10;- API endpoints&#10;- Data model&#10;- Trade-offs..."
            className="flex-1 p-4 bg-gray-800 text-white text-sm resize-none focus:outline-none font-mono"
          />
        </div>
      </div>

      {/* Floating interviewer */}
      <FloatingInterviewer
        state={voiceState}
        transcript={currentTranscript}
        onStartListening={startListening}
        onStopListening={stopListening}
        hasIntroduced={hasIntroduced}
        isAlwaysListening={isAlwaysListening}
        isSpeechDetected={isSpeechDetected}
        onEnableAlwaysListening={enableAlwaysListening}
        onDisableAlwaysListening={disableAlwaysListening}
      />
    </div>
  )
}
