import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import InterviewLayout from '@/components/interview/InterviewLayout'
import QuestionPanel from '@/components/interview/QuestionPanel'
import CodeEditor from '@/components/interview/CodeEditor'
import TestCasesPanel, { type TestResult } from '@/components/interview/TestCasesPanel'
import InterviewTimer from '@/components/interview/InterviewTimer'
import type { QuestionData, StarterCode } from '@/types'
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

  // Get topic and difficulty from URL params
  const topicSlug = searchParams.get('topic') || 'arrays'
  const difficulty = (searchParams.get('difficulty') as Difficulty) || 'medium'

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

  return (
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
  )
}
