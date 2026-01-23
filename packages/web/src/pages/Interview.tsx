import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import InterviewLayout from '@/components/interview/InterviewLayout'
import QuestionPanel from '@/components/interview/QuestionPanel'
import CodeEditor from '@/components/interview/CodeEditor'
import TestCasesPanel, { type TestResult } from '@/components/interview/TestCasesPanel'
import InterviewTimer from '@/components/interview/InterviewTimer'
import FloatingInterviewer from '@/components/interview/FloatingInterviewer'
import { useRealtimeVoice } from '@/hooks/useRealtimeVoice'
console.log('🚀 Interview.tsx loaded - using useRealtimeVoice (Realtime API)')
import { useInterviewStore } from '@/store/interviewStore'
import type { QuestionData, TranscriptEntry } from '@/types'
import type { SupportedLanguage } from '@/hooks/useCodeEditor'
import { api, type Question, type InterviewSession } from '@/lib/api'

type StarterCodeLanguage = keyof QuestionData['starter_code']

// Helper to convert DB Question to QuestionData format
function questionToQuestionData(question: Question): QuestionData {
  const metadata = question.metadata as {
    constraints?: string[]
    visible_test_cases?: { input: string; expected_output: string }[]
    hidden_test_cases?: { input: string; expected_output: string }[]
    starter_code?: {
      python: string
      javascript: string
      typescript: string
      java: string
      cpp: string
    }
  } | null

  return {
    title: question.title,
    description: question.description,
    examples: question.examples || [],
    constraints: metadata?.constraints || [],
    visible_test_cases: metadata?.visible_test_cases || [],
    hidden_test_cases: metadata?.hidden_test_cases || [],
    starter_code: metadata?.starter_code || {
      python: '',
      javascript: '',
      typescript: '',
      java: '',
      cpp: '',
    },
  }
}

export default function Interview() {
  const navigate = useNavigate()
  const { id: interviewIdParam } = useParams<{ id: string }>()

  // Zustand store
  const {
    interviewId,
    code,
    language,
    runCount,
    timeSpentSeconds,
    setCode,
    setLanguage,
    incrementRunCount,
    addTranscriptEntry,
    submitInterview,
    endInterview,
    updateTimeSpent,
    setInterviewId,
  } = useInterviewStore()

  // Local UI state
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const [hasIntroduced, setHasIntroduced] = useState(() => {
    // Check localStorage on initial render to see if intro was already played
    if (interviewIdParam) {
      return localStorage.getItem(`intro_played_${interviewIdParam}`) === 'true'
    }
    return false
  })
  const [cachedIntro, setCachedIntro] = useState<{ text: string; audio?: string } | null>(null)
  const [isPreloading, setIsPreloading] = useState(false)
  const [interview, setInterview] = useState<InterviewSession | null>(null)
  const [questionData, setQuestionData] = useState<QuestionData | null>(null)
  const [isResumedSession, setIsResumedSession] = useState(false)
  const [customTestCases, setCustomTestCases] = useState<{ input: string; expected_output: string }[]>([])

  // Refs
  const timeIntervalRef = useRef<number | null>(null)
  const autoSaveIntervalRef = useRef<number | null>(null)
  const lastSavedCodeRef = useRef<string>('')

  // Format question for voice context
  const questionContext = useMemo(() => {
    if (!questionData) return ''
    return `${questionData.title}\n\n${questionData.description}\n\nConstraints:\n${questionData.constraints.join('\n')}`
  }, [questionData])

  // Voice interaction hook - using Realtime API for low-latency
  const {
    voiceState,
    currentTranscript,
    startListening,
    stopListening,
    playCachedIntroduction,
    isAlwaysListening,
    isSpeechDetected,
    enableAlwaysListening,
    disableAlwaysListening,
  } = useRealtimeVoice({
    interviewId: interviewId || interviewIdParam || '',
    currentQuestion: questionContext,
    userCode: code,
    onTranscriptUpdate: (transcript: TranscriptEntry[]) => {
      const lastEntry = transcript[transcript.length - 1]
      if (lastEntry) {
        addTranscriptEntry(lastEntry)
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
        setInterview(loadedInterview)
        setInterviewId(loadedInterview.id)

        // Convert question to QuestionData format
        let qData: QuestionData | null = null

        if (loadedInterview.question) {
          // New format: question is joined from questions table
          qData = questionToQuestionData(loadedInterview.question)
        } else if (loadedInterview.question_data) {
          // Legacy format: question_data is embedded JSONB
          qData = loadedInterview.question_data
        }

        if (!qData) {
          throw new Error('Interview has no question data')
        }

        setQuestionData(qData)

        // Check if this is a resumed session (has saved progress)
        const hasProgress = (loadedInterview.time_spent_seconds && loadedInterview.time_spent_seconds > 5) ||
                           loadedInterview.final_code
        if (hasProgress) {
          setIsResumedSession(true)
          setHasIntroduced(true) // Skip intro for resumed sessions
          console.log('[INTERVIEW] Resumed session - skipping intro')
        }

        // Set code from saved final_code or starter code
        const initialCode = loadedInterview.final_code || qData.starter_code?.[loadedInterview.language as StarterCodeLanguage] || ''
        setCode(initialCode)
        lastSavedCodeRef.current = initialCode
        setLanguage(loadedInterview.language || 'python')
        setEditorKey((k) => k + 1)

        console.log('[INTERVIEW] Loaded interview:', loadedInterview.id)
      } catch (error) {
        console.error('Failed to load interview:', error)
        setLoadError(error instanceof Error ? error.message : 'Failed to load interview')
      } finally {
        setIsLoading(false)
      }
    }

    loadInterview()
  }, [interviewIdParam, setCode, setLanguage, setInterviewId])

  // Time tracking
  useEffect(() => {
    if (interview && !timeIntervalRef.current) {
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
  }, [interview, updateTimeSpent])

  // Auto-save every 10 seconds
  useEffect(() => {
    if (!interviewIdParam || interviewIdParam.startsWith('local-')) {
      return
    }

    autoSaveIntervalRef.current = window.setInterval(() => {
      // Only save if code has changed
      if (code !== lastSavedCodeRef.current) {
        console.log('[INTERVIEW] Auto-saving code...')
        api.interviews.update(interviewIdParam, {
          code,
          time_spent_seconds: timeSpentSeconds,
        }).then(() => {
          lastSavedCodeRef.current = code
          console.log('[INTERVIEW] Auto-save complete')
        }).catch((err) => {
          console.error('[INTERVIEW] Auto-save failed:', err)
        })
      }
    }, 10000) // 10 seconds

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current)
        autoSaveIntervalRef.current = null
      }
    }
  }, [interviewIdParam, code, timeSpentSeconds])

  // Pre-cache introduction when question is loaded (skip for resumed sessions)
  useEffect(() => {
    // Skip preloading if intro was already played or this is a resumed session
    if (hasIntroduced || isResumedSession) {
      return
    }

    if (questionData && questionContext && !cachedIntro && !isPreloading) {
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
  }, [questionData, questionContext, cachedIntro, isPreloading, hasIntroduced, isResumedSession])

  // Auto-play intro when cached and ready
  useEffect(() => {
    if (cachedIntro && !hasIntroduced && questionData && !isResumedSession) {
      setHasIntroduced(true)
      // Persist to localStorage so refresh doesn't replay intro
      if (interviewIdParam) {
        localStorage.setItem(`intro_played_${interviewIdParam}`, 'true')
      }
      setTimeout(() => {
        playCachedIntroduction(cachedIntro)
      }, 500)
    }
  }, [cachedIntro, hasIntroduced, questionData, playCachedIntroduction, interviewIdParam, isResumedSession])

  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode)
  }, [setCode])

  const handleLanguageChange = useCallback(
    (newLanguage: SupportedLanguage) => {
      setLanguage(newLanguage)
      if (questionData?.starter_code) {
        const starterCode = questionData.starter_code[newLanguage as StarterCodeLanguage]
        if (starterCode) {
          setCode(starterCode)
          setEditorKey((k) => k + 1)
        }
      }
      // Persist language choice to database
      if (interviewIdParam && !interviewIdParam.startsWith('local-')) {
        api.interviews.update(interviewIdParam, { language: newLanguage }).catch((err) => {
          console.error('[INTERVIEW] Failed to save language:', err)
        })
      }
    },
    [questionData, setLanguage, setCode, interviewIdParam]
  )

  const handleRun = useCallback(async () => {
    if (!questionData || !interviewIdParam) return

    // Combine built-in and custom test cases
    const builtInTestCases = questionData.visible_test_cases || []
    const allVisibleTestCases = [...builtInTestCases, ...customTestCases]

    // Check if we have test cases to run
    if (allVisibleTestCases.length === 0) {
      setTestResults([{
        testCase: { input: '', expected_output: '' },
        passed: false,
        error: 'No test cases available. Add custom test cases to run your code.',
      }])
      return
    }

    setIsRunning(true)
    setTestResults([])

    incrementRunCount()

    // Save code on run
    if (!interviewIdParam.startsWith('local-')) {
      api.interviews.update(interviewIdParam, {
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
          test_cases: allVisibleTestCases,
          execution_type: 'run',
          interview_id: interviewIdParam,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Execution failed')
      }

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
            testCase: allVisibleTestCases[result.test_case_index],
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
      const results: TestResult[] = allVisibleTestCases.map((tc) => ({
        testCase: tc,
        passed: false,
        error: error instanceof Error ? error.message : 'Failed to execute code',
      }))
      setTestResults(results)
    } finally {
      setIsRunning(false)
    }
  }, [code, language, questionData, incrementRunCount, interviewIdParam, customTestCases])

  const handleSubmit = useCallback(async () => {
    if (!questionData || !interviewIdParam) return

    // Combine all test cases (built-in visible, hidden, and custom)
    const builtInVisible = questionData.visible_test_cases || []
    const builtInHidden = questionData.hidden_test_cases || []
    const allTestCases = [...builtInVisible, ...builtInHidden, ...customTestCases]

    // Helper to create evaluation with test data
    const createEvaluationWithData = async (testResults?: {
      visible: { passed: number; total: number }
      hidden: { passed: number; total: number }
    }) => {
      try {
        const { evaluation } = await api.evaluations.create({
          interview_id: interviewIdParam,
          test_results: testResults || {
            visible: { passed: 0, total: builtInVisible.length },
            hidden: { passed: 0, total: builtInHidden.length },
          },
          user_test_cases: customTestCases,
        })
        navigate(`/evaluation/${evaluation.id}`)
      } catch {
        console.error('Failed to create evaluation')
        navigate('/')
      }
    }

    setIsRunning(true)

    try {
      // If no test cases, just submit without execution
      if (allTestCases.length === 0) {
        await submitInterview(false) // Submit as not all passed (no tests to verify)
        await createEvaluationWithData()
        return
      }

      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language,
          test_cases: allTestCases,
          execution_type: 'submit',
          interview_id: interviewIdParam,
        }),
      })

      const data = await response.json()

      // Check if execution was successful
      if (!response.ok || !data.success) {
        const errorMessage = data.error || data.message || 'Execution failed'
        console.error('Submit execution failed:', errorMessage)
        // Still allow submission even if execution fails
        await submitInterview(false)
        setTestResults([{
          testCase: { input: '', expected_output: '' },
          passed: false,
          error: `Execution error: ${errorMessage}. Your solution has been submitted.`,
        }])
        await createEvaluationWithData()
        return
      }

      // Calculate pass counts for visible and hidden test cases
      const results = data.results || []
      let visiblePassed = 0
      let hiddenPassed = 0

      results.forEach((result: { status: string; test_case_index: number }) => {
        if (result.status === 'Accepted') {
          if (result.test_case_index < builtInVisible.length) {
            visiblePassed++
          } else if (result.test_case_index < builtInVisible.length + builtInHidden.length) {
            hiddenPassed++
          }
        }
      })

      const testResultsSummary = {
        visible: { passed: visiblePassed, total: builtInVisible.length },
        hidden: { passed: hiddenPassed, total: builtInHidden.length },
      }

      const allPassed = data.summary?.all_passed ?? false

      await submitInterview(allPassed)

      // Always navigate to evaluation on submit (even if tests fail)
      await createEvaluationWithData(testResultsSummary)

      // If not all passed, also show results in UI before navigation
      if (!allPassed && results.length > 0) {
        const testResultsList: TestResult[] = results.map(
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
        setTestResults(testResultsList)
      }
    } catch (error) {
      console.error('Submit failed:', error)
      // Still try to submit even if there was an error
      try {
        await submitInterview(false)
        await createEvaluationWithData()
      } catch {
        setTestResults([{
          testCase: { input: '', expected_output: '' },
          passed: false,
          error: error instanceof Error ? error.message : 'Submit failed',
        }])
      }
    } finally {
      setIsRunning(false)
    }
  }, [code, language, questionData, interviewIdParam, submitInterview, navigate, customTestCases])

  const handleTimerComplete = useCallback(async () => {
    await endInterview('timeout')
    if (interviewIdParam) {
      try {
        const builtInVisible = questionData?.visible_test_cases || []
        const builtInHidden = questionData?.hidden_test_cases || []
        const { evaluation } = await api.evaluations.create({
          interview_id: interviewIdParam,
          test_results: {
            visible: { passed: 0, total: builtInVisible.length },
            hidden: { passed: 0, total: builtInHidden.length },
          },
          user_test_cases: customTestCases,
        })
        navigate(`/evaluation/${evaluation.id}`)
      } catch {
        console.error('Failed to create evaluation after timeout')
        navigate('/')
      }
    }
  }, [endInterview, interviewIdParam, navigate, questionData, customTestCases])

  const handleGiveUp = useCallback(async () => {
    if (confirm('Are you sure you want to give up? Your progress will be saved.')) {
      await endInterview('give_up')
      if (interviewIdParam) {
        try {
          const builtInVisible = questionData?.visible_test_cases || []
          const builtInHidden = questionData?.hidden_test_cases || []
          const { evaluation } = await api.evaluations.create({
            interview_id: interviewIdParam,
            test_results: {
              visible: { passed: 0, total: builtInVisible.length },
              hidden: { passed: 0, total: builtInHidden.length },
            },
            user_test_cases: customTestCases,
          })
          navigate(`/evaluation/${evaluation.id}`)
        } catch {
          console.error('Failed to create evaluation after give up')
          navigate('/')
        }
      }
    }
  }, [endInterview, interviewIdParam, navigate, questionData, customTestCases])

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading interview...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (loadError || !questionData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <p className="text-red-400 mb-4">{loadError || 'Failed to load interview'}</p>
          <button
            onClick={() => navigate('/onboarding')}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            Start New Interview
          </button>
        </div>
      </div>
    )
  }

  // Waiting for intro to cache (skip for resumed sessions)
  if (!cachedIntro && isPreloading && !isResumedSession && !hasIntroduced) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Preparing AI interviewer...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <InterviewLayout
        header={
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 bg-brand-orange rounded-lg flex items-center justify-center">
                  <span className="text-lc-bg-dark font-bold text-lg">Y</span>
                </div>
                <span className="text-lc-text-primary font-semibold text-lg">YeetCoder</span>
              </button>
              <span className="text-lc-text-muted">|</span>
              <span className="text-lc-text-secondary text-sm">{questionData.title}</span>
              <span className="px-2 py-0.5 text-xs bg-lc-bg-layer-2 text-lc-text-muted rounded">
                Runs: {runCount}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <InterviewTimer
                durationSeconds={interview?.time_limit_seconds || 3600}
                onComplete={handleTimerComplete}
              />
              <button
                onClick={handleGiveUp}
                className="px-4 py-2 text-sm text-lc-text-muted hover:text-lc-text-primary transition-colors"
              >
                Give Up
              </button>
            </div>
          </div>
        }
        leftPanel={<QuestionPanel question={questionData} />}
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
            testCases={questionData.visible_test_cases}
            results={testResults}
            isRunning={isRunning}
            onRun={handleRun}
            onSubmit={handleSubmit}
            customTestCases={customTestCases}
            onCustomTestCasesChange={setCustomTestCases}
          />
        }
      />

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
    </>
  )
}
