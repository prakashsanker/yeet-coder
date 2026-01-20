import { useState, useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import InterviewLayout from '@/components/interview/InterviewLayout'
import QuestionPanel from '@/components/interview/QuestionPanel'
import CodeEditor from '@/components/interview/CodeEditor'
import TestCasesPanel, { type TestResult } from '@/components/interview/TestCasesPanel'
import InterviewTimer from '@/components/interview/InterviewTimer'
import FloatingInterviewer from '@/components/interview/FloatingInterviewer'
import { useVoiceInteraction } from '@/hooks/useVoiceInteraction'
import type { QuestionData, StarterCode, TranscriptEntry } from '@/types'
import type { SupportedLanguage } from '@/hooks/useCodeEditor'
import { api, type Difficulty } from '@/lib/api'

// Map language to starter code key
type StarterCodeLanguage = keyof StarterCode

export default function Interview() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState<string>('')
  const [language, setLanguage] = useState<SupportedLanguage>('python')
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [question, setQuestion] = useState<QuestionData | null>(null)
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(true)
  const [questionError, setQuestionError] = useState<string | null>(null)
  const [editorKey, setEditorKey] = useState(0) // Force re-render when question changes
  const [_interviewTranscript, setInterviewTranscript] = useState<TranscriptEntry[]>([])
  const [_lastInterviewerMessage, setLastInterviewerMessage] = useState<string>('')
  const [hasIntroduced, setHasIntroduced] = useState(false)
  const [interviewStarted, setInterviewStarted] = useState(false)
  const [cachedIntro, setCachedIntro] = useState<{ text: string; audio?: string } | null>(null)
  const [isPreloading, setIsPreloading] = useState(false)

  // Get topic and difficulty from URL params
  const topicSlug = searchParams.get('topic') || 'arrays'
  const difficulty = (searchParams.get('difficulty') as Difficulty) || 'medium'

  // Get interview ID from URL or generate a temporary one
  const interviewId = useMemo(() => {
    return searchParams.get('id') || `temp-${Date.now()}`
  }, [searchParams])

  // Format question for voice context
  const questionContext = useMemo(() => {
    if (!question) return ''
    return `${question.title}\n\n${question.description}\n\nConstraints:\n${question.constraints.join('\n')}`
  }, [question])

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
    // Always-listening mode
    isAlwaysListening,
    isSpeechDetected,
    enableAlwaysListening,
    disableAlwaysListening,
  } = useVoiceInteraction({
    interviewId,
    currentQuestion: questionContext,
    userCode: code,
    onTranscriptUpdate: setInterviewTranscript,
    onInterviewerResponse: setLastInterviewerMessage,
  })

  // Start interview with cached intro (plays immediately)
  const handleStartInterview = useCallback(() => {
    setInterviewStarted(true)
    setHasIntroduced(true)

    // Play cached intro immediately if available
    if (cachedIntro) {
      // Small delay to let the UI render first
      setTimeout(() => {
        playCachedIntroduction(cachedIntro)
      }, 100)
    } else {
      // Fallback to fetching if not cached
      setTimeout(() => {
        requestIntroduction()
      }, 100)
    }
  }, [cachedIntro, playCachedIntroduction, requestIntroduction])

  // Pre-cache introduction when question is loaded
  useEffect(() => {
    if (question && questionContext && !cachedIntro && !isPreloading) {
      setIsPreloading(true)
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      fetch(`${API_URL}/api/voice/introduce`, {
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
  }, [question, questionContext, cachedIntro, isPreloading])

  // Generate question on mount
  useEffect(() => {
    async function generateQuestion() {
      setIsLoadingQuestion(true)
      setQuestionError(null)

      try {
        // Convert slug to readable topic name (e.g., "two-pointers" -> "Two Pointers")
        const topicName = topicSlug
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')

        const { question: generatedQuestion } = await api.questions.generate({
          topic: topicName,
          difficulty,
        })
        setQuestion(generatedQuestion)
        // Set initial code from starter code (default to python)
        if (generatedQuestion.starter_code) {
          const starterCode = generatedQuestion.starter_code.python
          if (starterCode) {
            setCode(starterCode)
          }
        }
        setEditorKey((k) => k + 1) // Force editor re-render with new code
      } catch (error) {
        console.error('Failed to generate question:', error)
        setQuestionError(error instanceof Error ? error.message : 'Failed to generate question')
      } finally {
        setIsLoadingQuestion(false)
      }
    }

    generateQuestion()
  }, [topicSlug, difficulty])

  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode)
  }, [])

  const handleLanguageChange = useCallback(
    (newLanguage: SupportedLanguage) => {
      setLanguage(newLanguage)
      // Update code to starter code for new language
      if (question?.starter_code) {
        const starterCode = question.starter_code[newLanguage as StarterCodeLanguage]
        if (starterCode) {
          setCode(starterCode)
          setEditorKey((k) => k + 1) // Force editor re-render
        }
      }
    },
    [question],
  )

  const handleRun = useCallback(async () => {
    if (!question) return

    setIsRunning(true)
    setTestResults([])

    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language,
          test_cases: question.visible_test_cases,
          execution_type: 'run',
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
            testCase: question.visible_test_cases[result.test_case_index],
            passed: result.status === 'Accepted',
            actualOutput: result.actual_output,
            error: result.error,
            executionTime: result.execution_time_ms,
          }),
        )
        setTestResults(results)
      }
    } catch (error) {
      console.error('Execution failed:', error)
      // Create mock failed results
      const results: TestResult[] = question.visible_test_cases.map((tc) => ({
        testCase: tc,
        passed: false,
        error: error instanceof Error ? error.message : 'Failed to execute code',
      }))
      setTestResults(results)
    } finally {
      setIsRunning(false)
    }
  }, [code, language, question])

  const handleSubmit = useCallback(async () => {
    if (!question) return

    setIsRunning(true)

    try {
      // Run against both visible and hidden test cases
      const allTestCases = [...question.visible_test_cases, ...question.hidden_test_cases]

      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language,
          test_cases: allTestCases,
          execution_type: 'submit',
        }),
      })

      const data = await response.json()

      if (data.success && data.summary.all_passed) {
        // Navigate to evaluation page on success
        navigate('/evaluation')
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
          }),
        )
        setTestResults(results)
      }
    } catch (error) {
      console.error('Submit failed:', error)
    } finally {
      setIsRunning(false)
    }
  }, [code, language, question, navigate])

  const handleTimerComplete = useCallback(() => {
    // Auto-submit when time runs out
    handleSubmit()
  }, [handleSubmit])

  const handleGiveUp = useCallback(() => {
    if (confirm('Are you sure you want to give up? Your progress will be saved.')) {
      navigate('/evaluation')
    }
  }, [navigate])

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
  if (questionError || !question) {
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
            <h2 className="text-white font-semibold">{question.title}</h2>
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
              <span className="text-gray-300">{question.title}</span>
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
        leftPanel={<QuestionPanel question={question} />}
        rightTopPanel={
          <CodeEditor
            key={editorKey}
            initialCode={code}
            initialLanguage={language}
            onChange={handleCodeChange}
            onLanguageChange={handleLanguageChange}
          />
        }
        rightBottomPanel={
          <TestCasesPanel
            testCases={question.visible_test_cases}
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
        hasIntroduced={hasIntroduced || !question}
        isAlwaysListening={isAlwaysListening}
        isSpeechDetected={isSpeechDetected}
        onEnableAlwaysListening={enableAlwaysListening}
        onDisableAlwaysListening={disableAlwaysListening}
      />
    </>
  )
}
