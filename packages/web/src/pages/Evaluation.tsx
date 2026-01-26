import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppHeader from '../components/common/AppHeader'
import { API_URL } from '../lib/api'

interface TestResults {
  visible: { passed: number; total: number }
  hidden: { passed: number; total: number }
}

interface UserTestCase {
  input: string
  expected_output: string
}

// Coding interview feedback
interface CodingFeedback {
  strengths: string[]
  improvements: string[]
  detailed_notes: string
}

// System design interview feedback
interface SystemDesignFeedback {
  summary: string
  good_points: string[]
  areas_for_improvement: string[]
  detailed_notes: {
    requirements: string
    architecture: string
    scalability: string
    data_model: string
    api_design: string
    trade_offs: string
    communication: string
  }
  missed_components: string[]
  study_recommendations: string[]
  key_takeaway: string
}

interface EvaluationData {
  id: string
  interview_id: string
  // Coding interview scores
  test_case_coverage_score?: number
  thought_process_score?: number
  clarifying_questions_score?: number
  edge_case_score?: number
  time_management_score?: number
  complexity_analysis_score?: number
  code_quality_score?: number
  // System design interview scores
  requirements_gathering_score?: number
  system_components_score?: number
  scalability_score?: number
  data_model_score?: number
  api_design_score?: number
  trade_offs_score?: number
  communication_score?: number
  // Common fields
  overall_score?: number
  verdict?: 'PASS' | 'FAIL'
  feedback?: CodingFeedback | SystemDesignFeedback
  test_results?: TestResults
  user_test_cases?: UserTestCase[]
  solution_code?: string
  // System design snapshots
  evaluated_drawing?: { elements: unknown[] } | null
  evaluated_notes?: string | null
  created_at: string
  interview?: {
    id: string
    session_type?: 'coding' | 'system_design'
    final_code?: string
    language?: string
    time_spent_seconds?: number
    run_count: number
    submit_count: number
    transcript?: { speaker: string; text: string; timestamp: number }[]
    drawing_data?: { elements: unknown[] } | null
    notes?: string | null
    question?: {
      title: string
      description: string
      difficulty: string
      type?: 'coding' | 'system_design'
    }
  }
}

// Type guard for system design feedback
function isSystemDesignFeedback(feedback: CodingFeedback | SystemDesignFeedback): feedback is SystemDesignFeedback {
  return 'good_points' in feedback && 'areas_for_improvement' in feedback
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
        const response = await fetch(`${API_URL}/api/evaluations/${id}`)
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
      <div className="app-page flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-[var(--text-muted)]">Loading evaluation...</p>
        </div>
      </div>
    )
  }

  if (error || !evaluation) {
    return (
      <div className="app-page flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#C62828] mb-4">{error || 'Evaluation not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            Return Home
          </button>
        </div>
      </div>
    )
  }

  const hasScores = evaluation.overall_score !== null && evaluation.overall_score !== undefined
  const isSystemDesign = evaluation.interview?.session_type === 'system_design' ||
                         evaluation.interview?.question?.type === 'system_design'

  // Calculate test pass percentages (only for coding)
  const testResults = evaluation.test_results
  const totalTests = (testResults?.visible?.total || 0) + (testResults?.hidden?.total || 0)
  const totalPassed = (testResults?.visible?.passed || 0) + (testResults?.hidden?.passed || 0)
  const overallPassRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0

  return (
    <div className="app-page">
      {/* Header */}
      <AppHeader />

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Question Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">
              {evaluation.interview?.question?.title || 'Interview Completed'}
            </h2>
            {isSystemDesign && (
              <span className="badge badge-purple">System Design</span>
            )}
          </div>
          {evaluation.interview?.question?.difficulty && (
            <span
              className={`badge capitalize ${
                evaluation.interview.question.difficulty === 'easy'
                  ? 'difficulty-easy'
                  : evaluation.interview.question.difficulty === 'medium'
                  ? 'difficulty-medium'
                  : 'difficulty-hard'
              }`}
            >
              {evaluation.interview.question.difficulty.charAt(0).toUpperCase() +
                evaluation.interview.question.difficulty.slice(1)}
            </span>
          )}
        </div>

        {/* Stats Row - Different for system design vs coding */}
        {isSystemDesign ? (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="card p-5 text-center">
              <div className="text-2xl font-bold text-[var(--accent-purple)]">
                {formatTime(evaluation.interview?.time_spent_seconds)}
              </div>
              <div className="text-sm text-[var(--text-muted)] mt-1">Time Spent</div>
            </div>
            <div className="card p-5 text-center">
              <div className="text-2xl font-bold text-[var(--accent-purple)]">
                {evaluation.interview?.transcript?.length || 0}
              </div>
              <div className="text-sm text-[var(--text-muted)] mt-1">Conversation Turns</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="card p-5 text-center">
              <div className="text-2xl font-bold text-[var(--accent-blue)]">
                {formatTime(evaluation.interview?.time_spent_seconds)}
              </div>
              <div className="text-sm text-[var(--text-muted)] mt-1">Time Spent</div>
            </div>
            <div className="card p-5 text-center">
              <div className="text-2xl font-bold text-[var(--accent-blue)]">
                {evaluation.interview?.run_count || 0}
              </div>
              <div className="text-sm text-[var(--text-muted)] mt-1">Runs</div>
            </div>
            <div className="card p-5 text-center">
              <div className="text-2xl font-bold text-[var(--accent-blue)]">
                {evaluation.interview?.submit_count || 0}
              </div>
              <div className="text-sm text-[var(--text-muted)] mt-1">Submissions</div>
            </div>
            <div className="card p-5 text-center">
              <div className={`text-2xl font-bold ${overallPassRate >= 70 ? 'score-success' : overallPassRate >= 50 ? 'score-warning' : 'score-error'}`}>
                {overallPassRate}%
              </div>
              <div className="text-sm text-[var(--text-muted)] mt-1">Tests Passed</div>
            </div>
          </div>
        )}

        {/* Test Results Breakdown - Only for coding */}
        {!isSystemDesign && testResults && totalTests > 0 && (
          <div className="card p-6 mb-8">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Test Results</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[var(--text-muted)]">Visible Tests</span>
                  <span className={`font-semibold ${
                    testResults.visible.passed === testResults.visible.total ? 'score-success' : 'score-warning'
                  }`}>
                    {testResults.visible.passed}/{testResults.visible.total}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-bar-fill ${
                      testResults.visible.passed === testResults.visible.total ? 'progress-bar-fill-success' : 'progress-bar-fill-warning'
                    }`}
                    style={{ width: testResults.visible.total > 0 ? `${(testResults.visible.passed / testResults.visible.total) * 100}%` : '0%' }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[var(--text-muted)]">Hidden Tests</span>
                  <span className={`font-semibold ${
                    testResults.hidden.passed === testResults.hidden.total ? 'score-success' : 'score-error'
                  }`}>
                    {testResults.hidden.passed}/{testResults.hidden.total}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`h-full rounded-full ${
                      testResults.hidden.passed === testResults.hidden.total ? 'bg-[#4CAF50]' : 'bg-[#C62828]'
                    }`}
                    style={{ width: testResults.hidden.total > 0 ? `${(testResults.hidden.passed / testResults.hidden.total) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {hasScores ? (
          isSystemDesign ? (
            // System Design Evaluation Display
            <SystemDesignEvaluationDisplay evaluation={evaluation} />
          ) : (
            // Coding Evaluation Display
            <CodingEvaluationDisplay evaluation={evaluation} />
          )
        ) : (
          /* Pending Evaluation */
          <div className="card p-8 text-center mb-8">
            <div className="animate-pulse mb-4">
              <div className="w-16 h-16 bg-[#F3E5F5] rounded-full mx-auto flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[var(--accent-purple)]"
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
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Interview Submitted!</h3>
            <p className="text-[var(--text-muted)] mb-4">
              Your submission has been recorded. AI evaluation is being generated...
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              Refresh the page in a few moments to see your detailed feedback.
            </p>
          </div>
        )}

        {/* User's Custom Test Cases - Only for coding */}
        {!isSystemDesign && evaluation.user_test_cases && evaluation.user_test_cases.length > 0 && (
          <div className="card p-6 mb-8">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Your Custom Test Cases ({evaluation.user_test_cases.length})</h3>
            <div className="space-y-3">
              {evaluation.user_test_cases.map((tc, index) => (
                <div key={index} className="bg-[var(--bg-section)] rounded-lg p-3">
                  <div className="text-sm text-[var(--text-muted)] mb-1">Test Case {index + 1}</div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-[var(--text-muted)]">Input:</span>
                      <pre className="text-[var(--text-secondary)] mt-1 bg-white p-2 rounded overflow-x-auto">{tc.input || '(empty)'}</pre>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">Expected:</span>
                      <pre className="text-[var(--text-secondary)] mt-1 bg-white p-2 rounded overflow-x-auto">{tc.expected_output || '(empty)'}</pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submitted Code - Only for coding */}
        {!isSystemDesign && evaluation.interview?.final_code && (
          <div className="card p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Your Submitted Code</h3>
              <span className="badge badge-neutral">
                {evaluation.interview.language}
              </span>
            </div>
            <pre className="bg-[#1e1e1e] rounded-lg p-4 overflow-x-auto text-sm text-[#d4d4d4]">
              <code>{evaluation.interview.final_code}</code>
            </pre>
          </div>
        )}

        {/* Notes - Only for system design */}
        {isSystemDesign && (evaluation.evaluated_notes || evaluation.interview?.notes) && (
          <div className="card p-6 mb-8">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Your Notes</h3>
            <pre className="bg-[#1e1e1e] rounded-lg p-4 overflow-x-auto text-sm text-[#d4d4d4] whitespace-pre-wrap font-mono">
              {evaluation.evaluated_notes || evaluation.interview?.notes}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

// System Design Evaluation Display Component
function SystemDesignEvaluationDisplay({ evaluation }: { evaluation: EvaluationData }) {
  const feedback = evaluation.feedback as SystemDesignFeedback | undefined

  return (
    <>
      {/* Overall Score */}
      <div className="mb-8 p-6 card text-center">
        <div className={`text-4xl font-bold mb-2 ${
          (evaluation.overall_score || 0) >= 70 ? 'score-success' :
          (evaluation.overall_score || 0) >= 50 ? 'score-warning' : 'score-error'
        }`}>
          {evaluation.overall_score}/100
        </div>
        <div className="text-lg text-[var(--text-secondary)]">Overall Score</div>
        {feedback?.summary && (
          <p className="mt-4 text-[var(--text-muted)] max-w-2xl mx-auto">{feedback.summary}</p>
        )}
      </div>

      {/* Score Breakdown */}
      <div className="card p-6 mb-8">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Score Breakdown</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Requirements Gathering', score: evaluation.requirements_gathering_score, description: 'Clarifying functional & non-functional requirements' },
            { label: 'System Components', score: evaluation.system_components_score, description: 'Core components and architecture design' },
            { label: 'Scalability', score: evaluation.scalability_score, description: 'Handling growth, load balancing, caching' },
            { label: 'Data Model', score: evaluation.data_model_score, description: 'Database design and data flow' },
            { label: 'API Design', score: evaluation.api_design_score, description: 'Interface design and contracts' },
            { label: 'Trade-offs', score: evaluation.trade_offs_score, description: 'Discussing pros/cons of decisions' },
            { label: 'Communication', score: evaluation.communication_score, description: 'Clarity and structure of explanation' },
          ].map(({ label, score, description }) => (
            <div key={label} className="flex items-center justify-between group relative">
              <div>
                <span className="text-[var(--text-secondary)]">{label}</span>
                <p className="text-xs text-[var(--text-muted)]">{description}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="progress-bar w-24">
                  <div
                    className={`h-full rounded-full ${
                      (score || 0) >= 70
                        ? 'bg-[#4CAF50]'
                        : (score || 0) >= 50
                        ? 'bg-[#FF9800]'
                        : 'bg-[#C62828]'
                    }`}
                    style={{ width: `${score || 0}%` }}
                  />
                </div>
                <span className="text-sm text-[var(--text-secondary)] w-8 text-right">{score || 0}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Good Points and Areas for Improvement */}
      {feedback && isSystemDesignFeedback(feedback) && (
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Good Points */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-[#2E7D32] mb-4">What You Did Well</h3>
            {feedback.good_points.length > 0 ? (
              <ul className="space-y-2">
                {feedback.good_points.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-[var(--text-secondary)]">
                    <svg
                      className="w-5 h-5 text-[#4CAF50] flex-shrink-0 mt-0.5"
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
                    {point}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[var(--text-muted)]">No specific strengths identified</p>
            )}
          </div>

          {/* Areas for Improvement */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-[#E65100] mb-4">Areas for Improvement</h3>
            {feedback.areas_for_improvement.length > 0 ? (
              <ul className="space-y-2">
                {feedback.areas_for_improvement.map((area, index) => (
                  <li key={index} className="flex items-start gap-2 text-[var(--text-secondary)]">
                    <svg
                      className="w-5 h-5 text-[#FF9800] flex-shrink-0 mt-0.5"
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
                    {area}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[var(--text-muted)]">No improvements identified</p>
            )}
          </div>
        </div>
      )}

      {/* Missed Components */}
      {feedback && isSystemDesignFeedback(feedback) && feedback.missed_components.length > 0 && (
        <div className="card p-6 mb-8">
          <h3 className="text-lg font-semibold text-[#C62828] mb-4">Missed Components</h3>
          <ul className="space-y-2">
            {feedback.missed_components.map((component, index) => (
              <li key={index} className="flex items-start gap-2 text-[var(--text-secondary)]">
                <svg
                  className="w-5 h-5 text-[#C62828] flex-shrink-0 mt-0.5"
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
                {component}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Detailed Notes by Category */}
      {feedback && isSystemDesignFeedback(feedback) && feedback.detailed_notes && (
        <div className="card p-6 mb-8">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Detailed Feedback by Category</h3>
          <div className="space-y-4">
            {[
              { key: 'requirements', label: 'Requirements Gathering' },
              { key: 'architecture', label: 'Architecture' },
              { key: 'scalability', label: 'Scalability' },
              { key: 'data_model', label: 'Data Model' },
              { key: 'api_design', label: 'API Design' },
              { key: 'trade_offs', label: 'Trade-offs' },
              { key: 'communication', label: 'Communication' },
            ].map(({ key, label }) => {
              const note = feedback.detailed_notes[key as keyof typeof feedback.detailed_notes]
              if (!note) return null
              return (
                <div key={key} className="border-l-2 border-[var(--accent-purple)] pl-4">
                  <h4 className="text-sm font-semibold text-[var(--text-muted)] mb-1">{label}</h4>
                  <p className="text-[var(--text-secondary)]">{note}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Study Recommendations */}
      {feedback && isSystemDesignFeedback(feedback) && feedback.study_recommendations.length > 0 && (
        <div className="card p-6 mb-8">
          <h3 className="text-lg font-semibold text-[var(--accent-purple)] mb-4">What to Study Next</h3>
          <ul className="space-y-2">
            {feedback.study_recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2 text-[var(--text-secondary)]">
                <svg
                  className="w-5 h-5 text-[var(--accent-purple)] flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key Takeaway */}
      {feedback && isSystemDesignFeedback(feedback) && feedback.key_takeaway && (
        <div className="bg-[#F3E5F5] border border-[var(--accent-purple)] rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-[var(--accent-purple)] mb-2">Key Takeaway</h3>
          <p className="text-[var(--text-primary)] text-lg">{feedback.key_takeaway}</p>
        </div>
      )}
    </>
  )
}

// Coding Evaluation Display Component
function CodingEvaluationDisplay({ evaluation }: { evaluation: EvaluationData }) {
  const feedback = evaluation.feedback as CodingFeedback | undefined

  return (
    <>
      {/* Overall Result */}
      <div
        className={`mb-8 p-6 rounded-xl text-center ${
          evaluation.verdict === 'PASS'
            ? 'bg-[#E8F5E9] border border-[#4CAF50]'
            : 'bg-[#FFEBEE] border border-[#C62828]'
        }`}
      >
        <div
          className={`text-4xl font-bold mb-2 ${
            evaluation.verdict === 'PASS' ? 'score-success' : 'score-error'
          }`}
        >
          {evaluation.verdict === 'PASS' ? 'PASSED' : 'NEEDS IMPROVEMENT'}
        </div>
        <div className="text-lg text-[var(--text-secondary)]">
          Overall Score: {evaluation.overall_score}/100
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="card p-6 mb-8">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Score Breakdown</h3>
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
                <span className="text-[var(--text-secondary)]">{label}</span>
                <p className="text-xs text-[var(--text-muted)]">{description}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="progress-bar w-24">
                  <div
                    className={`h-full rounded-full ${
                      (score || 0) >= 70
                        ? 'bg-[#4CAF50]'
                        : (score || 0) >= 50
                        ? 'bg-[#FF9800]'
                        : 'bg-[#C62828]'
                    }`}
                    style={{ width: `${score || 0}%` }}
                  />
                </div>
                <span className="text-sm text-[var(--text-secondary)] w-8 text-right">{score || 0}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback */}
      {feedback && !isSystemDesignFeedback(feedback) && (
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Strengths */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-[#2E7D32] mb-4">Strengths</h3>
            {feedback.strengths.length > 0 ? (
              <ul className="space-y-2">
                {feedback.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-2 text-[var(--text-secondary)]">
                    <svg
                      className="w-5 h-5 text-[#4CAF50] flex-shrink-0 mt-0.5"
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
              <p className="text-[var(--text-muted)]">No strengths identified</p>
            )}
          </div>

          {/* Areas for Improvement */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-[#E65100] mb-4">
              Areas for Improvement
            </h3>
            {feedback.improvements.length > 0 ? (
              <ul className="space-y-2">
                {feedback.improvements.map((improvement, index) => (
                  <li key={index} className="flex items-start gap-2 text-[var(--text-secondary)]">
                    <svg
                      className="w-5 h-5 text-[#FF9800] flex-shrink-0 mt-0.5"
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
              <p className="text-[var(--text-muted)]">No improvements identified</p>
            )}
          </div>
        </div>
      )}

      {/* Detailed Notes */}
      {feedback && !isSystemDesignFeedback(feedback) && feedback.detailed_notes && (
        <div className="card p-6 mb-8">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Detailed Feedback</h3>
          <p className="text-[var(--text-secondary)] whitespace-pre-wrap">
            {feedback.detailed_notes}
          </p>
        </div>
      )}
    </>
  )
}
