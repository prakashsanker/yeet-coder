import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import InterviewLayout from '@/components/interview/InterviewLayout'
import QuestionPanel from '@/components/interview/QuestionPanel'
import CodeEditor from '@/components/interview/CodeEditor'
import TestCasesPanel, { type TestResult } from '@/components/interview/TestCasesPanel'
import InterviewTimer from '@/components/interview/InterviewTimer'
import type { QuestionData } from '@/types'
import type { SupportedLanguage } from '@/hooks/useCodeEditor'

// Sample question for demo (will be replaced with API data)
const sampleQuestion: QuestionData = {
  title: 'Two Sum',
  description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.`,
  examples: [
    {
      input: 'nums = [2,7,11,15], target = 9',
      output: '[0,1]',
      explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].',
    },
    {
      input: 'nums = [3,2,4], target = 6',
      output: '[1,2]',
    },
    {
      input: 'nums = [3,3], target = 6',
      output: '[0,1]',
    },
  ],
  constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9', '-10^9 <= target <= 10^9', 'Only one valid answer exists.'],
  visible_test_cases: [
    { input: '[2,7,11,15]\n9', expected_output: '[0, 1]' },
    { input: '[3,2,4]\n6', expected_output: '[1, 2]' },
    { input: '[3,3]\n6', expected_output: '[0, 1]' },
  ],
  hidden_test_cases: [],
}

export default function Interview() {
  const navigate = useNavigate()
  const [code, setCode] = useState<string>('')
  const [language, setLanguage] = useState<SupportedLanguage>('python')
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [question] = useState<QuestionData>(sampleQuestion)

  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode)
  }, [])

  const handleLanguageChange = useCallback((newLanguage: SupportedLanguage) => {
    setLanguage(newLanguage)
  }, [])

  const handleRun = useCallback(async () => {
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
  }, [code, language, question.visible_test_cases])

  const handleSubmit = useCallback(async () => {
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

  return (
    <InterviewLayout
      header={
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-white">YeetCoder</h1>
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
