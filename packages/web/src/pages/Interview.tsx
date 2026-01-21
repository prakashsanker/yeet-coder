import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import InterviewLayout from '@/components/interview/InterviewLayout'
import QuestionPanel from '@/components/interview/QuestionPanel'
import CodeEditor from '@/components/interview/CodeEditor'
import TestCasesPanel, { type TestResult } from '@/components/interview/TestCasesPanel'
import InterviewTimer from '@/components/interview/InterviewTimer'
import FloatingInterviewer from '@/components/interview/FloatingInterviewer'
import { useVoiceInteraction } from '@/hooks/useVoiceInteraction'
import { useInterviewStore } from '@/store/interviewStore'
import type { QuestionData, TranscriptEntry } from '@/types'
import type { SupportedLanguage } from '@/hooks/useCodeEditor'
import { api, type Difficulty } from '@/lib/api'

type StarterCodeLanguage = keyof QuestionData['starter_code']

export default function Interview() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Zustand store
  const {
    interviewId,
    status: _interviewStatus,
    question,
    code,
    language,
    runCount,
    timeSpentSeconds: _timeSpentSeconds,
    startInterview,
    setCode,
    setLanguage,
    incrementRunCount,
    addTranscriptEntry,
    submitInterview,
    endInterview,
    updateTimeSpent,
    setError: _setError,
    resetInterview: _resetInterview,
  } = useInterviewStore()

  // Local UI state
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(true)
  const [questionError, setQuestionError] = useState<string | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const [hasIntroduced, setHasIntroduced] = useState(false)
  const [interviewStarted, setInterviewStarted] = useState(false)
  const [cachedIntro, setCachedIntro] = useState<{ text: string; audio?: string } | null>(null)
  const [isPreloading, setIsPreloading] = useState(false)
  const [localQuestion, setLocalQuestion] = useState<QuestionData | null>(null)

  // Time tracking interval
  const timeIntervalRef = useRef<number | null>(null)

  // Get topic and difficulty from URL params
  const topicSlug = searchParams.get('topic') || 'arrays'
  const difficulty = (searchParams.get('difficulty') as Difficulty) || 'medium'
  const existingInterviewId = searchParams.get('id')

  // Get topic ID from URL or use a placeholder
  const topicId = searchParams.get('topicId') || '00000000-0000-0000-0000-000000000000'

  // Use question from store or local state
  const currentQuestion = question || localQuestion

  // Format question for voice context
  const questionContext = useMemo(() => {
    if (!currentQuestion) return ''
    return `${currentQuestion.title}\n\n${currentQuestion.description}\n\nConstraints:\n${currentQuestion.constraints.join('\n')}`
  }, [currentQuestion])

  // Voice interaction hook
  const {
    voiceState,
    currentTranscript,
    isConnected: _isConnected,
    error: _voiceError,
    startListening,
    stopListening,
    sendTextInput: _sendTextInput,
    requestHint: _requestHint,
    requestIntroduction,
    playCachedIntroduction,
    isAlwaysListening,
    isSpeechDetected,
    enableAlwaysListening,
    disableAlwaysListening,
  } = useVoiceInteraction({
    interviewId: interviewId || `temp-${Date.now()}`,
    currentQuestion: questionContext,
    userCode: code,
    onTranscriptUpdate: (transcript: TranscriptEntry[]) => {
      // Add new transcript entries to store
      const lastEntry = transcript[transcript.length - 1]
      if (lastEntry) {
        addTranscriptEntry(lastEntry)
      }
    },
    onInterviewerResponse: () => {},
  })

  // Start time tracking when interview starts
  useEffect(() => {
    if (interviewStarted && !timeIntervalRef.current) {
      timeIntervalRef.current = window.setInterval(() => {
        updateTimeSpent()
      }, 1000)
    }

    return () => {
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current)
        timeIntervalRef.current = null
      }
    }
  }, [interviewStarted, updateTimeSpent])

  // Handle starting the interview
  const handleStartInterview = useCallback(async () => {
    if (!localQuestion) return

    setInterviewStarted(true)
    setHasIntroduced(true)

    // Create interview in backend
    const newInterviewId = await startInterview({
      topicId,
      topicSlug,
      question: localQuestion,
      language: 'python',
    })

    if (newInterviewId) {
      // Update URL with interview ID
      const newParams = new URLSearchParams(searchParams)
      newParams.set('id', newInterviewId)
      navigate(`/interview?${newParams.toString()}`, { replace: true })
    }

    // Play cached intro immediately if available
    if (cachedIntro) {
      setTimeout(() => {
        playCachedIntroduction(cachedIntro)
      }, 100)
    } else {
      setTimeout(() => {
        requestIntroduction()
      }, 100)
    }
  }, [localQuestion, topicId, topicSlug, startInterview, searchParams, navigate, cachedIntro, playCachedIntroduction, requestIntroduction])

  // Pre-cache introduction when question is loaded
  useEffect(() => {
    if (currentQuestion && questionContext && !cachedIntro && !isPreloading) {
      setIsPreloading(true)
      fetch(`/api/voice/introduce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_question: questionContext,
          include_audio: true,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setCachedIntro({ text: data.text, audio: data.audio })
            console.log('[PRELOAD] Introduction cached successfully')
          }
        })
        .catch((err) => {
          console.error('[PRELOAD] Failed to cache introduction:', err)
        })
        .finally(() => {
          setIsPreloading(false)
        })
    }
  }, [currentQuestion, questionContext, cachedIntro, isPreloading])

  // Generate question on mount (or load existing interview)
  useEffect(() => {
    async function loadOrGenerateQuestion() {
      setIsLoadingQuestion(true)
      setQuestionError(null)

      try {
        // If we have an existing interview ID, try to load it
        if (existingInterviewId) {
          const { interview } = await api.interviews.get(existingInterviewId)
          setLocalQuestion(interview.question_data)
          setCode(interview.final_code || interview.question_data.starter_code.python || '')
          setEditorKey((k) => k + 1)
          setInterviewStarted(true)
          setHasIntroduced(true)
          return
        }

        // Generate a new question
        const topicName = topicSlug
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')

        const { question: generatedQuestion } = await api.questions.generate({
          topic: topicName,
          difficulty,
          topicId,
        })

        setLocalQuestion(generatedQuestion)

        // Set initial code from starter code
        if (generatedQuestion.starter_code) {
          const starterCode = generatedQuestion.starter_code.python
          if (starterCode) {
            setCode(starterCode)
          }
        }
        setEditorKey((k) => k + 1)
      } catch (error) {
        console.error('Failed to generate question:', error)
        setQuestionError(error instanceof Error ? error.message : 'Failed to generate question')
      } finally {
        setIsLoadingQuestion(false)
      }
    }

    loadOrGenerateQuestion()

    // Cleanup on unmount
    return () => {
      // Don't reset if navigating to evaluation
    }
  }, [topicSlug, difficulty, existingInterviewId, topicId, setCode])

  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode)
  }, [setCode])

  const handleLanguageChange = useCallback(
    (newLanguage: SupportedLanguage) => {
      setLanguage(newLanguage)
      // Update code to starter code for new language
      if (currentQuestion?.starter_code) {
        const starterCode = currentQuestion.starter_code[newLanguage as StarterCodeLanguage]
        if (starterCode) {
          setCode(starterCode)
          setEditorKey((k) => k + 1)
        }
      }
    },
    [currentQuestion, setLanguage, setCode]
  )

  const handleRun = useCallback(async () => {
    if (!currentQuestion) return

    setIsRunning(true)
    setTestResults([])

    // Increment run count in store
    incrementRunCount()

    // Sync run count to backend
    if (interviewId && !interviewId.startsWith('temp-')) {
      api.interviews.update(interviewId, {
        code,
        increment_run_count: true,
      }).catch(console.error)
    }

    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language,
          test_cases: currentQuestion.visible_test_cases,
          execution_type: 'run',
          interview_id: interviewId,
        }),
      })

      const data = await response.json()

      if (data.success && data.results) {
        const results: TestResult[] = data.results.map(
          (result: {
            status: string
            actual_output?: string
            expected_output: string
            execution_time_ms?: number
            error?: string
            test_case_index: number
          }) => ({
            testCase: currentQuestion.visible_test_cases[result.test_case_index],
            passed: result.status === 'Accepted',
            actualOutput: result.actual_output,
            error: result.error,
            executionTime: result.execution_time_ms,
          })
        )
        setTestResults(results)
      }
    } catch (error) {
      console.error('Execution failed:', error)
      const results: TestResult[] = currentQuestion.visible_test_cases.map((tc) => ({
        testCase: tc,
        passed: false,
        error: error instanceof Error ? error.message : 'Failed to execute code',
      }))
      setTestResults(results)
    } finally {
      setIsRunning(false)
    }
  }, [code, language, currentQuestion, incrementRunCount, interviewId])

  const handleSubmit = useCallback(async () => {
    if (!currentQuestion) return

    setIsRunning(true)

    try {
      // Run against both visible and hidden test cases
      const allTestCases = [...currentQuestion.visible_test_cases, ...currentQuestion.hidden_test_cases]

      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language,
          test_cases: allTestCases,
          execution_type: 'submit',
          interview_id: interviewId,
        }),
      })

      const data = await response.json()
      const allPassed = data.success && data.summary.all_passed

      // Submit interview to backend
      await submitInterview(allPassed)

      if (allPassed) {
        // Navigate to evaluation page on success
        navigate(`/evaluation${interviewId ? `?interviewId=${interviewId}` : ''}`)
      } else {
        // Show results
        const results: TestResult[] = data.results.map(
          (result: {
            status: string
            actual_output?: string
            expected_output: string
            execution_time_ms?: number
            error?: string
            test_case_index: number
          }) => ({
            testCase: allTestCases[result.test_case_index],
            passed: result.status === 'Accepted',
            actualOutput: result.actual_output,
            error: result.error,
            executionTime: result.execution_time_ms,
          })
        )
        setTestResults(results)
      }
    } catch (error) {
      console.error('Submit failed:', error)
    } finally {
      setIsRunning(false)
    }
  }, [code, language, currentQuestion, interviewId, submitInterview, navigate])

  const handleTimerComplete = useCallback(() => {
    // End interview due to timeout
    endInterview('timeout').then(() => {
      navigate(`/evaluation${interviewId ? `?interviewId=${interviewId}` : ''}`)
    })
  }, [endInterview, interviewId, navigate])

  const handleGiveUp = useCallback(() => {
    if (confirm('Are you sure you want to give up? Your progress will be saved.')) {
      endInterview('give_up').then(() => {
        navigate(`/evaluation${interviewId ? `?interviewId=${interviewId}` : ''}`)
      })
    }
  }, [endInterview, interviewId, navigate])

  // Loading state
  if (isLoadingQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Generating your interview question...</p>
          <p className="text-gray-500 text-sm mt-2">Topic: {topicSlug.replace(/-/g, ' ')}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (questionError || !currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <p className="text-red-400 mb-4">{questionError || 'Failed to load question'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  // Ready to start state - question loaded, waiting for user to begin
  if (!interviewStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center max-w-lg mx-auto px-6">
          {/* Ready indicator */}
          <div className="mb-8">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          {/* Status text */}
          <h1 className="text-2xl font-bold text-white mb-2">Interview Ready</h1>
          <p className="text-gray-400 mb-2">Your coding challenge has been prepared</p>

          {/* Question preview */}
          <div className="bg-gray-800 rounded-xl p-4 mb-6 text-left border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
                difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
              </span>
              <span className="text-gray-500 text-sm">{topicSlug.replace(/-/g, ' ')}</span>
            </div>
            <h2 className="text-white font-semibold">{currentQuestion.title}</h2>
          </div>

          {/* AI Interviewer ready indicator */}
          <div className="flex items-center justify-center gap-3 mb-8 text-gray-400">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-sm">AI Interviewer is ready</span>
          </div>

          {/* Start button */}
          <button
            onClick={handleStartInterview}
            disabled={!cachedIntro && isPreloading}
            className="px-8 py-4 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white text-lg font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {cachedIntro ? 'Start Interview' : 'Preparing...'}
          </button>

          {/* Tips */}
          <div className="mt-8 text-left">
            <p className="text-gray-500 text-sm mb-2">Tips:</p>
            <ul className="text-gray-500 text-sm space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-primary-400">•</span>
                Think out loud - the AI interviewer can help guide you
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-400">•</span>
                Ask clarifying questions if anything is unclear
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-400">•</span>
                You have 60 minutes to complete the challenge
              </li>
            </ul>
          </div>

          {/* Back button */}
          <button
            onClick={() => navigate('/')}
            className="mt-6 text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            ← Choose a different topic
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <InterviewLayout
        header={
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <h1
                onClick={() => navigate('/')}
                className="text-lg font-semibold text-white cursor-pointer hover:text-primary-400 transition-colors"
              >
                YeetCoder
              </h1>
              <span className="text-gray-400">|</span>
              <span className="text-gray-300">{currentQuestion.title}</span>
              {/* Run count badge */}
              <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-400 rounded">
                Runs: {runCount}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <InterviewTimer durationSeconds={3600} onComplete={handleTimerComplete} />
              <button
                onClick={handleGiveUp}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Give Up
              </button>
            </div>
          </div>
        }
        leftPanel={<QuestionPanel question={currentQuestion} />}
        rightTopPanel={
          <CodeEditor
            key={editorKey}
            initialCode={code}
            initialLanguage={language as SupportedLanguage}
            onChange={handleCodeChange}
            onLanguageChange={handleLanguageChange}
          />
        }
        rightBottomPanel={
          <TestCasesPanel
            testCases={currentQuestion.visible_test_cases}
            results={testResults}
            isRunning={isRunning}
            onRun={handleRun}
            onSubmit={handleSubmit}
          />
        }
      />

      {/* Floating Google Meet-style interviewer box */}
      <FloatingInterviewer
        state={voiceState}
        transcript={currentTranscript}
        onStartListening={startListening}
        onStopListening={stopListening}
        hasIntroduced={hasIntroduced || !currentQuestion}
        isAlwaysListening={isAlwaysListening}
        isSpeechDetected={isSpeechDetected}
        onEnableAlwaysListening={enableAlwaysListening}
        onDisableAlwaysListening={disableAlwaysListening}
      />
    </>
  )
}
