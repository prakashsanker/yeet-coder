import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

interface TestResults {
  visible: { passed: number; total: number }
  hidden: { passed: number; total: number }
}

interface UserTestCase {
  input: string
  expected_output: string
}

interface EvaluationData {
  id: string
  interview_id: string
  test_case_coverage_score?: number
  thought_process_score?: number
  clarifying_questions_score?: number
  edge_case_score?: number
  time_management_score?: number
  complexity_analysis_score?: number
  code_quality_score?: number
  overall_score?: number
  verdict?: 'PASS' | 'FAIL'
  feedback?: {
    strengths: string[]
    improvements: string[]
    detailed_notes: string
  }
  test_results?: TestResults
  user_test_cases?: UserTestCase[]
  solution_code?: string
  created_at: string
  interview?: {
    id: string
    final_code?: string
    language: string
    time_spent_seconds?: number
    run_count: number
    submit_count: number
    transcript?: { speaker: string; text: string; timestamp: number }[]
    question?: {
      title: string
      description: string
      difficulty: string
    }
  }
}

export default function Evaluation() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadEvaluation() {
      if (!id) {
        setError('No evaluation ID provided')
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/evaluations/${id}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load evaluation')
        }

        setEvaluation(data.evaluation)
      } catch (err) {
        console.error('Failed to load evaluation:', err)
        setError(err instanceof Error ? err.message : 'Failed to load evaluation')
      } finally {
        setIsLoading(false)
      }
    }

    loadEvaluation()
  }, [id])

  const formatTime = (seconds?: number) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading evaluation...</p>
        </div>
      </div>
    )
  }

  if (error || !evaluation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Evaluation not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    )
  }

  const hasScores = evaluation.overall_score !== null && evaluation.overall_score !== undefined

  // Calculate test pass percentages
  const testResults = evaluation.test_results
  const totalTests = (testResults?.visible?.total || 0) + (testResults?.hidden?.total || 0)
  const totalPassed = (testResults?.visible?.passed || 0) + (testResults?.hidden?.passed || 0)
  const overallPassRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1
            onClick={() => navigate('/')}
            className="text-xl font-semibold cursor-pointer hover:text-primary-400 transition-colors"
          >
            YeetCoder
          </h1>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            Start New Interview
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Question Title */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            {evaluation.interview?.question?.title || 'Interview Completed'}
          </h2>
          {evaluation.interview?.question?.difficulty && (
            <span
              className={`px-2 py-1 text-xs rounded ${
                evaluation.interview.question.difficulty === 'easy'
                  ? 'bg-green-600'
                  : evaluation.interview.question.difficulty === 'medium'
                  ? 'bg-yellow-600'
                  : 'bg-red-600'
              }`}
            >
              {evaluation.interview.question.difficulty.charAt(0).toUpperCase() +
                evaluation.interview.question.difficulty.slice(1)}
            </span>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-primary-400">
              {formatTime(evaluation.interview?.time_spent_seconds)}
            </div>
            <div className="text-sm text-gray-400">Time Spent</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-primary-400">
              {evaluation.interview?.run_count || 0}
            </div>
            <div className="text-sm text-gray-400">Runs</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-primary-400">
              {evaluation.interview?.submit_count || 0}
            </div>
            <div className="text-sm text-gray-400">Submissions</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className={`text-2xl font-bold ${overallPassRate >= 70 ? 'text-green-400' : overallPassRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
              {overallPassRate}%
            </div>
            <div className="text-sm text-gray-400">Tests Passed</div>
          </div>
        </div>

        {/* Test Results Breakdown */}
        {testResults && totalTests > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold mb-4">Test Results</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">Visible Tests</span>
                  <span className={`font-semibold ${
                    testResults.visible.passed === testResults.visible.total ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {testResults.visible.passed}/{testResults.visible.total}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      testResults.visible.passed === testResults.visible.total ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                    style={{ width: testResults.visible.total > 0 ? `${(testResults.visible.passed / testResults.visible.total) * 100}%` : '0%' }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">Hidden Tests</span>
                  <span className={`font-semibold ${
                    testResults.hidden.passed === testResults.hidden.total ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {testResults.hidden.passed}/{testResults.hidden.total}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      testResults.hidden.passed === testResults.hidden.total ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    style={{ width: testResults.hidden.total > 0 ? `${(testResults.hidden.passed / testResults.hidden.total) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {hasScores ? (
          <>
            {/* Overall Result */}
            <div
              className={`mb-8 p-6 rounded-lg text-center ${
                evaluation.verdict === 'PASS'
                  ? 'bg-green-900/30 border border-green-700'
                  : 'bg-red-900/30 border border-red-700'
              }`}
            >
              <div
                className={`text-4xl font-bold mb-2 ${
                  evaluation.verdict === 'PASS' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {evaluation.verdict === 'PASS' ? 'PASSED' : 'NEEDS IMPROVEMENT'}
              </div>
              <div className="text-lg text-gray-300">
                Overall Score: {evaluation.overall_score}/100
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="bg-gray-800 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-semibold mb-4">Score Breakdown</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Test Case Coverage', score: evaluation.test_case_coverage_score, description: 'How many test cases passed' },
                  { label: 'Thought Process', score: evaluation.thought_process_score, description: 'Quality of verbal problem-solving' },
                  { label: 'Clarifying Questions', score: evaluation.clarifying_questions_score, description: 'Asking about requirements and edge cases' },
                  { label: 'Edge Case Awareness', score: evaluation.edge_case_score, description: 'Quality of test cases you created' },
                  { label: 'Time Management', score: evaluation.time_management_score, description: 'Efficient use of available time' },
                  { label: 'Complexity Analysis', score: evaluation.complexity_analysis_score, description: 'Big O time/space discussion' },
                  { label: 'Code Quality', score: evaluation.code_quality_score, description: 'Clean, readable code' },
                ].map(({ label, score, description }) => (
                  <div key={label} className="flex items-center justify-between group relative">
                    <div>
                      <span className="text-gray-300">{label}</span>
                      <p className="text-xs text-gray-500">{description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            (score || 0) >= 70
                              ? 'bg-green-500'
                              : (score || 0) >= 50
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${score || 0}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-300 w-8 text-right">{score || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Feedback */}
            {evaluation.feedback && (
              <div className="grid grid-cols-2 gap-6 mb-8">
                {/* Strengths */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-green-400 mb-4">Strengths</h3>
                  {evaluation.feedback.strengths.length > 0 ? (
                    <ul className="space-y-2">
                      {evaluation.feedback.strengths.map((strength, index) => (
                        <li key={index} className="flex items-start gap-2 text-gray-300">
                          <svg
                            className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
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
                          {strength}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No strengths identified</p>
                  )}
                </div>

                {/* Areas for Improvement */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-yellow-400 mb-4">
                    Areas for Improvement
                  </h3>
                  {evaluation.feedback.improvements.length > 0 ? (
                    <ul className="space-y-2">
                      {evaluation.feedback.improvements.map((improvement, index) => (
                        <li key={index} className="flex items-start gap-2 text-gray-300">
                          <svg
                            className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                          {improvement}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No improvements identified</p>
                  )}
                </div>
              </div>
            )}

            {/* Detailed Notes */}
            {evaluation.feedback?.detailed_notes && (
              <div className="bg-gray-800 rounded-lg p-6 mb-8">
                <h3 className="text-lg font-semibold mb-4">Detailed Feedback</h3>
                <p className="text-gray-300 whitespace-pre-wrap">
                  {evaluation.feedback.detailed_notes}
                </p>
              </div>
            )}
          </>
        ) : (
          /* Pending Evaluation */
          <div className="bg-gray-800 rounded-lg p-8 text-center mb-8">
            <div className="animate-pulse mb-4">
              <div className="w-16 h-16 bg-primary-600/30 rounded-full mx-auto flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-primary-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2">Interview Submitted!</h3>
            <p className="text-gray-400 mb-4">
              Your submission has been recorded. AI evaluation is being generated...
            </p>
            <p className="text-sm text-gray-500">
              Refresh the page in a few moments to see your detailed feedback.
            </p>
          </div>
        )}

        {/* User's Custom Test Cases */}
        {evaluation.user_test_cases && evaluation.user_test_cases.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold mb-4">Your Custom Test Cases ({evaluation.user_test_cases.length})</h3>
            <div className="space-y-3">
              {evaluation.user_test_cases.map((tc, index) => (
                <div key={index} className="bg-gray-700 rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-1">Test Case {index + 1}</div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Input:</span>
                      <pre className="text-gray-300 mt-1 bg-gray-800 p-2 rounded overflow-x-auto">{tc.input || '(empty)'}</pre>
                    </div>
                    <div>
                      <span className="text-gray-500">Expected:</span>
                      <pre className="text-gray-300 mt-1 bg-gray-800 p-2 rounded overflow-x-auto">{tc.expected_output || '(empty)'}</pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submitted Code */}
        {evaluation.interview?.final_code && (
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Your Submitted Code</h3>
              <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">
                {evaluation.interview.language}
              </span>
            </div>
            <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm text-gray-300">
              <code>{evaluation.interview.final_code}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
