import { useState } from 'react'
import type { TestCase } from '@/types'

export interface TestResult {
  testCase: TestCase
  passed: boolean
  actualOutput?: string
  error?: string
  executionTime?: number
}

interface TestCasesPanelProps {
  testCases: TestCase[]
  results?: TestResult[]
  isRunning?: boolean
  onRun?: () => void
  onSubmit?: () => void
  customTestCases?: TestCase[]
  onCustomTestCasesChange?: (testCases: TestCase[]) => void
}

export default function TestCasesPanel({
  testCases,
  results = [],
  isRunning = false,
  onRun,
  onSubmit,
  customTestCases = [],
  onCustomTestCasesChange,
}: TestCasesPanelProps) {
  const [activeTab, setActiveTab] = useState<'cases' | 'results'>('cases')
  const [isAddingTestCase, setIsAddingTestCase] = useState(false)
  const [newInput, setNewInput] = useState('')
  const [newExpectedOutput, setNewExpectedOutput] = useState('')

  const allTestCases = [...testCases, ...customTestCases]

  const handleAddTestCase = () => {
    if (newInput.trim() || newExpectedOutput.trim()) {
      const newTestCase: TestCase = {
        input: newInput,
        expected_output: newExpectedOutput,
      }
      onCustomTestCasesChange?.([...customTestCases, newTestCase])
      setNewInput('')
      setNewExpectedOutput('')
      setIsAddingTestCase(false)
    }
  }

  const handleRemoveCustomTestCase = (index: number) => {
    const updated = customTestCases.filter((_, i) => i !== index)
    onCustomTestCasesChange?.(updated)
  }

  const passedCount = results.filter((r) => r.passed).length
  const totalCount = results.length

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg overflow-hidden">
      {/* Tab Header */}
      <div className="flex items-center border-b border-gray-700">
        <button
          onClick={() => setActiveTab('cases')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'cases'
              ? 'text-white border-b-2 border-primary-500'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Test Cases
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'results'
              ? 'text-white border-b-2 border-primary-500'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Results
          {results.length > 0 && (
            <span
              className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                passedCount === totalCount
                  ? 'bg-green-600 text-white'
                  : 'bg-red-600 text-white'
              }`}
            >
              {passedCount}/{totalCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'cases' ? (
          <div className="space-y-4">
            {/* Built-in test cases */}
            {testCases.map((testCase, index) => (
              <div
                key={`builtin-${index}`}
                className="bg-gray-700 rounded-lg p-3 space-y-2"
              >
                <div className="text-sm text-gray-400">Case {index + 1}</div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500">Input:</div>
                  <pre className="text-sm text-gray-200 bg-gray-800 rounded p-2 overflow-x-auto">
                    {testCase.input}
                  </pre>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500">Expected Output:</div>
                  <pre className="text-sm text-gray-200 bg-gray-800 rounded p-2 overflow-x-auto">
                    {testCase.expected_output}
                  </pre>
                </div>
              </div>
            ))}

            {/* Custom test cases */}
            {customTestCases.map((testCase, index) => (
              <div
                key={`custom-${index}`}
                className="bg-gray-700 rounded-lg p-3 space-y-2 border border-blue-600/50"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm text-blue-400">Custom Case {index + 1}</div>
                  <button
                    onClick={() => handleRemoveCustomTestCase(index)}
                    className="text-gray-400 hover:text-red-400 transition-colors"
                    title="Remove test case"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500">Input:</div>
                  <pre className="text-sm text-gray-200 bg-gray-800 rounded p-2 overflow-x-auto">
                    {testCase.input || '(empty)'}
                  </pre>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500">Expected Output:</div>
                  <pre className="text-sm text-gray-200 bg-gray-800 rounded p-2 overflow-x-auto">
                    {testCase.expected_output || '(empty)'}
                  </pre>
                </div>
              </div>
            ))}

            {/* Add test case form */}
            {isAddingTestCase ? (
              <div className="bg-gray-700 rounded-lg p-3 space-y-3 border border-blue-600">
                <div className="text-sm text-blue-400">Add Custom Test Case</div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500">Input:</div>
                  <textarea
                    value={newInput}
                    onChange={(e) => setNewInput(e.target.value)}
                    placeholder="Enter input..."
                    className="w-full text-sm text-gray-200 bg-gray-800 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500">Expected Output:</div>
                  <textarea
                    value={newExpectedOutput}
                    onChange={(e) => setNewExpectedOutput(e.target.value)}
                    placeholder="Enter expected output..."
                    className="w-full text-sm text-gray-200 bg-gray-800 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddTestCase}
                    className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingTestCase(false)
                      setNewInput('')
                      setNewExpectedOutput('')
                    }}
                    className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingTestCase(true)}
                className="w-full py-2 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-blue-500 hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Custom Test Case
              </button>
            )}

            {allTestCases.length === 0 && !isAddingTestCase && (
              <div className="text-gray-400 text-sm text-center py-4">
                No test cases yet. Add your own above.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {results.map((result, index) => (
              <div
                key={index}
                className={`rounded-lg p-3 space-y-2 ${
                  result.passed
                    ? 'bg-green-900/30 border border-green-700'
                    : 'bg-red-900/30 border border-red-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {result.passed ? (
                      <svg
                        className="w-5 h-5 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5 text-red-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                    <span className="text-sm text-gray-200">
                      Case {index + 1}
                    </span>
                  </div>
                  {result.executionTime && (
                    <span className="text-xs text-gray-400">
                      {result.executionTime}ms
                    </span>
                  )}
                </div>

                {result.error ? (
                  <div className="space-y-1">
                    <div className="text-xs text-red-400">Error:</div>
                    <pre className="text-sm text-red-300 bg-gray-800 rounded p-2 overflow-x-auto">
                      {result.error}
                    </pre>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <div className="text-xs text-gray-500">Input:</div>
                      <pre className="text-sm text-gray-200 bg-gray-800 rounded p-2 overflow-x-auto">
                        {result.testCase.input}
                      </pre>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-gray-500">Expected:</div>
                      <pre className="text-sm text-gray-200 bg-gray-800 rounded p-2 overflow-x-auto">
                        {result.testCase.expected_output}
                      </pre>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-gray-500">Your Output:</div>
                      <pre
                        className={`text-sm bg-gray-800 rounded p-2 overflow-x-auto ${
                          result.passed ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {result.actualOutput ?? '(no output)'}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            ))}
            {results.length === 0 && (
              <div className="text-gray-400 text-sm text-center py-8">
                Run your code to see results
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 p-4 border-t border-gray-700">
        <button
          onClick={onRun}
          disabled={isRunning}
          className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isRunning ? (
            <>
              <svg
                className="animate-spin w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Running...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Run
            </>
          )}
        </button>
        <button
          onClick={onSubmit}
          disabled={isRunning}
          className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
        >
          Submit
        </button>
      </div>
    </div>
  )
}
