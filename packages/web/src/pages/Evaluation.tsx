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

// System design interview feedback - NEW structure with Style + Completeness
interface SystemDesignFeedback {
  // === STYLE ASSESSMENT ===
  style: {
    rating: 'strong' | 'adequate' | 'needs_improvement'
    assessment: string
    strengths: Array<{
      point: string
      example: string
    }>
    improvements: Array<{
      point: string
      what_they_did: string
      what_would_be_better: string
    }>
  }

  // === COMPLETENESS ASSESSMENT ===
  completeness: {
    rating: 'comprehensive' | 'adequate' | 'incomplete'
    assessment: string
    covered_well: Array<{
      topic: string
      detail: string
    }>
    gaps: Array<{
      topic: string
      importance: 'critical' | 'important' | 'minor'
      what_candidate_said: string
      what_was_missing: string
      answer_key_excerpt: string
      example_good_response: string
    }>
  }

  // === RECOMMENDATIONS ===
  recommendations: Array<{
    title: string
    explanation: string
    example?: string
  }>

  // Overall summary
  summary: string

  // Legacy fields for backward compatibility
  good_points?: string[]
  areas_for_improvement?: string[]
  detailed_notes?: {
    requirements: string
    architecture: string
    scalability: string
    data_model: string
    api_design: string
    trade_offs: string
    communication: string
  }
  missed_components?: string[]
  study_recommendations?: string[]
  key_takeaway?: string
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
  // System design interview scores (legacy numeric)
  requirements_gathering_score?: number
  system_components_score?: number
  scalability_score?: number
  data_model_score?: number
  api_design_score?: number
  trade_offs_score?: number
  communication_score?: number
  // System design qualitative ratings (NEW)
  style_rating?: 'strong' | 'adequate' | 'needs_improvement'
  completeness_rating?: 'comprehensive' | 'adequate' | 'incomplete'
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

// Type guard for system design feedback - checks for new structure first, then legacy
function isSystemDesignFeedback(feedback: CodingFeedback | SystemDesignFeedback): feedback is SystemDesignFeedback {
  // New structure has 'style' and 'completeness' objects
  if ('style' in feedback && 'completeness' in feedback) {
    return true
  }
  // Legacy structure has 'good_points' and 'areas_for_improvement'
  return 'good_points' in feedback && 'areas_for_improvement' in feedback
}

// Helper to check if feedback uses the new structure
function hasNewFeedbackStructure(feedback: SystemDesignFeedback): boolean {
  return feedback.style !== undefined && feedback.completeness !== undefined
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
          <p className="text-lc-text-muted">Loading evaluation...</p>
        </div>
      </div>
    )
  }

  if (error || !evaluation) {
    return (
      <div className="app-page flex items-center justify-center">
        <div className="text-center">
          <p className="text-lc-red mb-4">{error || 'Evaluation not found'}</p>
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
            <h2 className="text-2xl font-bold text-lc-text-primary">
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
              <div className="text-2xl font-bold text-brand-orange">
                {formatTime(evaluation.interview?.time_spent_seconds)}
              </div>
              <div className="text-sm text-lc-text-muted mt-1">Time Spent</div>
            </div>
            <div className="card p-5 text-center">
              <div className="text-2xl font-bold text-brand-orange">
                {evaluation.interview?.transcript?.length || 0}
              </div>
              <div className="text-sm text-lc-text-muted mt-1">Conversation Turns</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="card p-5 text-center">
              <div className="text-2xl font-bold text-lc-teal">
                {formatTime(evaluation.interview?.time_spent_seconds)}
              </div>
              <div className="text-sm text-lc-text-muted mt-1">Time Spent</div>
            </div>
            <div className="card p-5 text-center">
              <div className="text-2xl font-bold text-lc-teal">
                {evaluation.interview?.run_count || 0}
              </div>
              <div className="text-sm text-lc-text-muted mt-1">Runs</div>
            </div>
            <div className="card p-5 text-center">
              <div className="text-2xl font-bold text-lc-teal">
                {evaluation.interview?.submit_count || 0}
              </div>
              <div className="text-sm text-lc-text-muted mt-1">Submissions</div>
            </div>
            <div className="card p-5 text-center">
              <div className={`text-2xl font-bold ${overallPassRate >= 70 ? 'text-lc-green' : overallPassRate >= 50 ? 'text-lc-yellow' : 'text-lc-red'}`}>
                {overallPassRate}%
              </div>
              <div className="text-sm text-lc-text-muted mt-1">Tests Passed</div>
            </div>
          </div>
        )}

        {/* Test Results Breakdown - Only for coding */}
        {!isSystemDesign && testResults && totalTests > 0 && (
          <div className="card p-6 mb-8">
            <h3 className="text-lg font-semibold text-lc-text-primary mb-4">Test Results</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lc-text-muted">Visible Tests</span>
                  <span className={`font-semibold ${
                    testResults.visible.passed === testResults.visible.total ? 'text-lc-green' : 'text-lc-yellow'
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
                  <span className="text-lc-text-muted">Hidden Tests</span>
                  <span className={`font-semibold ${
                    testResults.hidden.passed === testResults.hidden.total ? 'text-lc-green' : 'text-lc-red'
                  }`}>
                    {testResults.hidden.passed}/{testResults.hidden.total}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`h-full rounded-full ${
                      testResults.hidden.passed === testResults.hidden.total ? 'bg-lc-green' : 'bg-lc-red'
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
              <div className="w-16 h-16 bg-brand-orange/20 rounded-full mx-auto flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-brand-orange"
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
            <h3 className="text-xl font-semibold text-lc-text-primary mb-2">Interview Submitted!</h3>
            <p className="text-lc-text-muted mb-4">
              Your submission has been recorded. AI evaluation is being generated...
            </p>
            <p className="text-sm text-lc-text-muted">
              Refresh the page in a few moments to see your detailed feedback.
            </p>
          </div>
        )}

        {/* User's Custom Test Cases - Only for coding */}
        {!isSystemDesign && evaluation.user_test_cases && evaluation.user_test_cases.length > 0 && (
          <div className="card p-6 mb-8">
            <h3 className="text-lg font-semibold text-lc-text-primary mb-4">Your Custom Test Cases ({evaluation.user_test_cases.length})</h3>
            <div className="space-y-3">
              {evaluation.user_test_cases.map((tc, index) => (
                <div key={index} className="bg-lc-bg-layer-2 rounded-lg p-3">
                  <div className="text-sm text-lc-text-muted mb-1">Test Case {index + 1}</div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-lc-text-muted">Input:</span>
                      <pre className="text-lc-text-secondary mt-1 bg-lc-bg-dark p-2 rounded overflow-x-auto">{tc.input || '(empty)'}</pre>
                    </div>
                    <div>
                      <span className="text-lc-text-muted">Expected:</span>
                      <pre className="text-lc-text-secondary mt-1 bg-lc-bg-dark p-2 rounded overflow-x-auto">{tc.expected_output || '(empty)'}</pre>
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
              <h3 className="text-lg font-semibold text-lc-text-primary">Your Submitted Code</h3>
              <span className="badge badge-neutral">
                {evaluation.interview.language}
              </span>
            </div>
            <pre className="bg-lc-bg-dark rounded-lg p-4 overflow-x-auto text-sm text-lc-text-secondary">
              <code>{evaluation.interview.final_code}</code>
            </pre>
          </div>
        )}

        {/* Notes - Only for system design */}
        {isSystemDesign && (evaluation.evaluated_notes || evaluation.interview?.notes) && (
          <div className="card p-6 mb-8">
            <h3 className="text-lg font-semibold text-lc-text-primary mb-4">Your Notes</h3>
            <pre className="bg-lc-bg-dark rounded-lg p-4 overflow-x-auto text-sm text-lc-text-secondary whitespace-pre-wrap font-mono">
              {evaluation.evaluated_notes || evaluation.interview?.notes}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

// Rating badge component for Style and Completeness
function RatingBadge({ rating }: {
  rating: 'strong' | 'adequate' | 'needs_improvement' | 'comprehensive' | 'incomplete'
}) {
  const labels: Record<string, string> = {
    strong: 'Strong',
    adequate: 'Adequate',
    needs_improvement: 'Needs Improvement',
    comprehensive: 'Comprehensive',
    incomplete: 'Incomplete',
  }

  const colors: Record<string, string> = {
    strong: 'bg-lc-green text-white',
    comprehensive: 'bg-lc-green text-white',
    adequate: 'bg-lc-yellow text-black',
    needs_improvement: 'bg-lc-red text-white',
    incomplete: 'bg-lc-red text-white',
  }

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${colors[rating]}`}>
      {labels[rating]}
    </span>
  )
}

// Importance badge for completeness gaps
function ImportanceBadge({ importance }: { importance: 'critical' | 'important' | 'minor' }) {
  const colors: Record<string, string> = {
    critical: 'bg-lc-red/20 text-lc-red border-lc-red/30',
    important: 'bg-lc-yellow/20 text-lc-yellow border-lc-yellow/30',
    minor: 'bg-lc-text-muted/20 text-lc-text-muted border-lc-text-muted/30',
  }

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${colors[importance]}`}>
      {importance.charAt(0).toUpperCase() + importance.slice(1)}
    </span>
  )
}

// System Design Evaluation Display Component - NEW with Style + Completeness
function SystemDesignEvaluationDisplay({ evaluation }: { evaluation: EvaluationData }) {
  const feedback = evaluation.feedback as SystemDesignFeedback | undefined
  const isNewStructure = feedback && hasNewFeedbackStructure(feedback)

  // If using new structure, render new UI
  if (isNewStructure && feedback) {
    return (
      <>
        {/* Overall Summary */}
        {feedback.summary && (
          <div className="mb-8 p-6 rounded-lg bg-lc-bg-layer-1 border border-lc-border">
            <h3 className="text-lg font-semibold mb-3 text-lc-text-primary">Summary</h3>
            <p className="text-lc-text-secondary leading-relaxed whitespace-pre-wrap">{feedback.summary}</p>
          </div>
        )}

        {/* Style and Completeness Rating Cards */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Style Rating Card */}
          <div className="bg-lc-bg-layer-1 rounded-lg p-6 border border-lc-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-lc-text-primary">Style</h3>
              {feedback.style?.rating && (
                <RatingBadge rating={feedback.style.rating} />
              )}
            </div>
            <p className="text-sm text-lc-text-muted mb-2">
              How you approached the problem: clarity of thought, structure, diagrams, trade-off consideration
            </p>
          </div>

          {/* Completeness Rating Card */}
          <div className="bg-lc-bg-layer-1 rounded-lg p-6 border border-lc-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-lc-text-primary">Completeness</h3>
              {feedback.completeness?.rating && (
                <RatingBadge rating={feedback.completeness.rating} />
              )}
            </div>
            <p className="text-sm text-lc-text-muted mb-2">
              What you covered compared to the answer key: features, depth, critical components
            </p>
          </div>
        </div>

        {/* STYLE SECTION */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-lc-text-primary flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center text-white text-sm">1</span>
            Style Assessment
          </h2>

          {/* Style Assessment Text */}
          {feedback.style?.assessment && (
            <div className="bg-lc-bg-layer-1 rounded-lg p-6 mb-6 border border-lc-border">
              <p className="text-lc-text-secondary leading-relaxed whitespace-pre-wrap">{feedback.style.assessment}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            {/* Style Strengths */}
            <div className="bg-lc-bg-layer-1 rounded-lg p-6 border border-lc-border">
              <h4 className="text-lg font-semibold text-lc-green mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Strengths
              </h4>
              {feedback.style?.strengths && feedback.style.strengths.length > 0 ? (
                <div className="space-y-4">
                  {feedback.style.strengths.map((item, index) => (
                    <div key={index} className="border-l-2 border-lc-green pl-4">
                      <p className="text-lc-text-primary font-medium">{item.point}</p>
                      {item.example && (
                        <p className="text-sm text-lc-text-muted mt-1 italic">"{item.example}"</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-lc-text-muted">No specific strengths identified</p>
              )}
            </div>

            {/* Style Improvements */}
            <div className="bg-lc-bg-layer-1 rounded-lg p-6 border border-lc-border">
              <h4 className="text-lg font-semibold text-lc-yellow mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Areas to Improve
              </h4>
              {feedback.style?.improvements && feedback.style.improvements.length > 0 ? (
                <div className="space-y-4">
                  {feedback.style.improvements.map((item, index) => (
                    <div key={index} className="border-l-2 border-lc-yellow pl-4">
                      <p className="text-lc-text-primary font-medium">{item.point}</p>
                      {item.what_they_did && (
                        <p className="text-sm text-lc-red mt-1">
                          <span className="font-medium">What you did:</span> {item.what_they_did}
                        </p>
                      )}
                      {item.what_would_be_better && (
                        <p className="text-sm text-lc-green mt-1">
                          <span className="font-medium">Better approach:</span> {item.what_would_be_better}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-lc-text-muted">No improvements identified</p>
              )}
            </div>
          </div>
        </div>

        {/* COMPLETENESS SECTION */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-lc-text-primary flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center text-white text-sm">2</span>
            Completeness Assessment
          </h2>

          {/* Completeness Assessment Text */}
          {feedback.completeness?.assessment && (
            <div className="bg-lc-bg-layer-1 rounded-lg p-6 mb-6 border border-lc-border">
              <p className="text-lc-text-secondary leading-relaxed whitespace-pre-wrap">{feedback.completeness.assessment}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            {/* Topics Covered Well */}
            <div className="bg-lc-bg-layer-1 rounded-lg p-6 border border-lc-border">
              <h4 className="text-lg font-semibold text-lc-green mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Topics Covered Well
              </h4>
              {feedback.completeness?.covered_well && feedback.completeness.covered_well.length > 0 ? (
                <div className="space-y-3">
                  {feedback.completeness.covered_well.map((item, index) => (
                    <div key={index} className="border-l-2 border-lc-green pl-4">
                      <p className="text-lc-text-primary font-medium">{item.topic}</p>
                      {item.detail && (
                        <p className="text-sm text-lc-text-muted mt-1">{item.detail}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-lc-text-muted">No topics specifically highlighted</p>
              )}
            </div>

            {/* Brief Gaps Summary */}
            <div className="bg-lc-bg-layer-1 rounded-lg p-6 border border-lc-border">
              <h4 className="text-lg font-semibold text-lc-red mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Gaps ({feedback.completeness?.gaps?.length || 0})
              </h4>
              {feedback.completeness?.gaps && feedback.completeness.gaps.length > 0 ? (
                <div className="space-y-2">
                  {feedback.completeness.gaps.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <ImportanceBadge importance={item.importance} />
                      <span className="text-lc-text-secondary">{item.topic}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-lc-text-muted">No significant gaps identified</p>
              )}
              {feedback.completeness?.gaps && feedback.completeness.gaps.length > 0 && (
                <p className="text-xs text-lc-text-muted mt-4">See detailed breakdown below</p>
              )}
            </div>
          </div>
        </div>

        {/* DETAILED MISSED COMPONENTS SECTION - Full Width, Very Prominent */}
        {feedback.completeness?.gaps && feedback.completeness.gaps.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-lc-red flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-lc-red flex items-center justify-center text-white text-sm">!</span>
              What You Missed (Detailed Breakdown)
            </h2>
            <p className="text-lc-text-muted mb-6">
              Below is a detailed comparison of what you said vs what a strong candidate would cover. Study these gaps carefully.
            </p>

            <div className="space-y-6">
              {feedback.completeness.gaps.map((gap, index) => (
                <div key={index} className="bg-lc-bg-layer-1 rounded-lg border border-lc-red/30 overflow-hidden">
                  {/* Gap Header */}
                  <div className="bg-lc-red/10 px-6 py-4 border-b border-lc-red/20">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold text-lc-text-primary flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-lc-red text-white flex items-center justify-center text-sm">
                          {index + 1}
                        </span>
                        {gap.topic}
                      </h4>
                      <ImportanceBadge importance={gap.importance} />
                    </div>
                    {gap.what_was_missing && (
                      <p className="text-sm text-lc-text-muted mt-2">{gap.what_was_missing}</p>
                    )}
                  </div>

                  {/* Gap Details */}
                  <div className="p-6 space-y-4">
                    {/* What You Said */}
                    <div className="bg-lc-red/5 rounded-lg p-4 border border-lc-red/20">
                      <h5 className="text-sm font-semibold text-lc-red mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        What You Said
                      </h5>
                      <p className="text-lc-text-secondary italic">
                        {gap.what_candidate_said || 'Not mentioned'}
                      </p>
                    </div>

                    {/* What Answer Key Says */}
                    {gap.answer_key_excerpt && (
                      <div className="bg-lc-teal/5 rounded-lg p-4 border border-lc-teal/20">
                        <h5 className="text-sm font-semibold text-lc-teal mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          From the Answer Key
                        </h5>
                        <p className="text-lc-text-secondary whitespace-pre-wrap text-sm leading-relaxed">
                          {gap.answer_key_excerpt}
                        </p>
                      </div>
                    )}

                    {/* Example Good Response */}
                    {gap.example_good_response && (
                      <div className="bg-lc-green/5 rounded-lg p-4 border border-lc-green/20">
                        <h5 className="text-sm font-semibold text-lc-green mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          What a Strong Candidate Would Say
                        </h5>
                        <p className="text-lc-text-secondary italic leading-relaxed">
                          "{gap.example_good_response}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RECOMMENDATIONS SECTION */}
        {feedback.recommendations && feedback.recommendations.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-lc-text-primary flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center text-white text-sm">3</span>
              Key Recommendations
            </h2>
            <div className="space-y-4">
              {feedback.recommendations.map((rec, index) => (
                <div key={index} className="bg-lc-bg-layer-1 rounded-lg p-6 border border-lc-border">
                  <h4 className="text-lg font-semibold text-brand-orange mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    {rec.title}
                  </h4>
                  <p className="text-lc-text-secondary leading-relaxed">{rec.explanation}</p>
                  {rec.example && (
                    <div className="mt-3 p-3 bg-lc-bg-dark rounded-lg">
                      <p className="text-sm text-lc-text-muted">
                        <span className="font-medium text-lc-teal">Example:</span> {rec.example}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    )
  }

  // LEGACY FALLBACK: Old feedback structure - FEEDBACK FOCUSED LAYOUT
  // Helper to get detailed notes that actually have content
  const detailedNotesWithContent = feedback && isSystemDesignFeedback(feedback) && feedback.detailed_notes
    ? [
        { key: 'requirements', label: 'Requirements Gathering', note: feedback.detailed_notes.requirements },
        { key: 'architecture', label: 'Architecture', note: feedback.detailed_notes.architecture },
        { key: 'scalability', label: 'Scalability', note: feedback.detailed_notes.scalability },
        { key: 'data_model', label: 'Data Model', note: feedback.detailed_notes.data_model },
        { key: 'api_design', label: 'API Design', note: feedback.detailed_notes.api_design },
        { key: 'trade_offs', label: 'Trade-offs', note: feedback.detailed_notes.trade_offs },
        { key: 'communication', label: 'Communication', note: feedback.detailed_notes.communication },
      ].filter(item => item.note && item.note.trim().length > 0)
    : []

  return (
    <>
      {/* KEY TAKEAWAY - Most prominent at top */}
      {feedback && isSystemDesignFeedback(feedback) && feedback.key_takeaway && (
        <div className="bg-brand-orange/10 border border-brand-orange rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-brand-orange mb-2 flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Key Takeaway
          </h3>
          <p className="text-lc-text-primary text-lg leading-relaxed">{feedback.key_takeaway}</p>
        </div>
      )}

      {/* Summary if no key takeaway */}
      {feedback?.summary && !(feedback && isSystemDesignFeedback(feedback) && feedback.key_takeaway) && (
        <div className="bg-lc-bg-layer-1 border border-lc-border rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-lc-text-primary mb-2">Summary</h3>
          <p className="text-lc-text-secondary leading-relaxed">{feedback.summary}</p>
        </div>
      )}

      {/* OVERALL SCORE - Compact inline display */}
      <div className="flex items-center gap-4 mb-8 p-4 bg-lc-bg-layer-1 rounded-lg border border-lc-border">
        <div className={`text-3xl font-bold ${
          (evaluation.overall_score || 0) >= 70 ? 'text-lc-green' :
          (evaluation.overall_score || 0) >= 50 ? 'text-lc-yellow' : 'text-lc-red'
        }`}>
          {evaluation.overall_score}/100
        </div>
        <div className="text-lc-text-muted">Overall Score</div>
      </div>

      {/* FEEDBACK SECTIONS - Primary focus */}
      {feedback && isSystemDesignFeedback(feedback) && (feedback.good_points || feedback.areas_for_improvement) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* What You Did Well */}
          <div className="bg-lc-bg-layer-1 rounded-lg p-6 border border-lc-border">
            <h3 className="text-lg font-semibold text-lc-green mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              What You Did Well
            </h3>
            {feedback.good_points && feedback.good_points.length > 0 ? (
              <ul className="space-y-3">
                {feedback.good_points.map((point, index) => (
                  <li key={index} className="flex items-start gap-3 text-lc-text-secondary">
                    <span className="w-6 h-6 rounded-full bg-lc-green/20 text-lc-green flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-lc-text-muted italic">No specific strengths identified</p>
            )}
          </div>

          {/* Areas for Improvement */}
          <div className="bg-lc-bg-layer-1 rounded-lg p-6 border border-lc-border">
            <h3 className="text-lg font-semibold text-lc-yellow mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Areas for Improvement
            </h3>
            {feedback.areas_for_improvement && feedback.areas_for_improvement.length > 0 ? (
              <ul className="space-y-3">
                {feedback.areas_for_improvement.map((area, index) => (
                  <li key={index} className="flex items-start gap-3 text-lc-text-secondary">
                    <span className="w-6 h-6 rounded-full bg-lc-yellow/20 text-lc-yellow flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{area}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-lc-text-muted italic">No specific improvements identified</p>
            )}
          </div>
        </div>
      )}

      {/* DETAILED FEEDBACK - Only show categories with actual content */}
      {detailedNotesWithContent.length > 0 && (
        <div className="bg-lc-bg-layer-1 rounded-lg p-6 mb-8 border border-lc-border">
          <h3 className="text-lg font-semibold text-lc-text-primary mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Detailed Feedback
          </h3>
          <div className="space-y-6">
            {detailedNotesWithContent.map(({ key, label, note }) => (
              <div key={key} className="border-l-3 border-brand-orange pl-4 py-1">
                <h4 className="text-sm font-semibold text-brand-orange mb-2 uppercase tracking-wide">{label}</h4>
                <p className="text-lc-text-secondary leading-relaxed">{note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MISSED COMPONENTS */}
      {feedback && isSystemDesignFeedback(feedback) && feedback.missed_components && feedback.missed_components.length > 0 && (
        <div className="bg-lc-red/5 rounded-lg p-6 mb-8 border border-lc-red/20">
          <h3 className="text-lg font-semibold text-lc-red mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Components You Missed
          </h3>
          <ul className="space-y-2">
            {feedback.missed_components.map((component, index) => (
              <li key={index} className="flex items-start gap-3 text-lc-text-secondary">
                <svg className="w-5 h-5 text-lc-red flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {component}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* STUDY RECOMMENDATIONS */}
      {feedback && isSystemDesignFeedback(feedback) && feedback.study_recommendations && feedback.study_recommendations.length > 0 && (
        <div className="bg-lc-teal/5 rounded-lg p-6 mb-8 border border-lc-teal/20">
          <h3 className="text-lg font-semibold text-lc-teal mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            What to Study Next
          </h3>
          <ul className="space-y-2">
            {feedback.study_recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-3 text-lc-text-secondary">
                <span className="w-6 h-6 rounded-full bg-lc-teal/20 text-lc-teal flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {index + 1}
                </span>
                <span className="leading-relaxed">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* SCORE BREAKDOWN - Collapsible / Secondary at bottom */}
      <details className="bg-lc-bg-layer-1 rounded-lg border border-lc-border mb-8">
        <summary className="p-4 cursor-pointer text-lc-text-secondary hover:text-lc-text-primary flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="font-medium">View Detailed Score Breakdown</span>
        </summary>
        <div className="p-6 pt-2 border-t border-lc-border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Requirements Gathering', score: evaluation.requirements_gathering_score },
              { label: 'System Components', score: evaluation.system_components_score },
              { label: 'Scalability', score: evaluation.scalability_score },
              { label: 'Data Model', score: evaluation.data_model_score },
              { label: 'API Design', score: evaluation.api_design_score },
              { label: 'Trade-offs', score: evaluation.trade_offs_score },
              { label: 'Communication', score: evaluation.communication_score },
            ].map(({ label, score }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-lc-text-muted text-sm">{label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-lc-bg-dark rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        (score || 0) >= 70
                          ? 'bg-lc-green'
                          : (score || 0) >= 50
                          ? 'bg-lc-yellow'
                          : 'bg-lc-red'
                      }`}
                      style={{ width: `${score || 0}%` }}
                    />
                  </div>
                  <span className="text-sm text-lc-text-secondary w-8 text-right">{score || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </details>
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
            ? 'bg-lc-green/10 border border-lc-green'
            : 'bg-lc-red/10 border border-lc-red'
        }`}
      >
        <div
          className={`text-4xl font-bold mb-2 ${
            evaluation.verdict === 'PASS' ? 'text-lc-green' : 'text-lc-red'
          }`}
        >
          {evaluation.verdict === 'PASS' ? 'PASSED' : 'NEEDS IMPROVEMENT'}
        </div>
        <div className="text-lg text-lc-text-secondary">
          Overall Score: {evaluation.overall_score}/100
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="bg-lc-bg-layer-1 rounded-lg p-6 mb-8 border border-lc-border">
        <h3 className="text-lg font-semibold text-lc-text-primary mb-4">Score Breakdown</h3>
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
                <span className="text-lc-text-secondary">{label}</span>
                <p className="text-xs text-lc-text-muted">{description}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="progress-bar w-24">
                  <div
                    className={`h-full rounded-full ${
                      (score || 0) >= 70
                        ? 'bg-lc-green'
                        : (score || 0) >= 50
                        ? 'bg-lc-yellow'
                        : 'bg-lc-red'
                    }`}
                    style={{ width: `${score || 0}%` }}
                  />
                </div>
                <span className="text-sm text-lc-text-secondary w-8 text-right">{score || 0}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback */}
      {feedback && !isSystemDesignFeedback(feedback) && (
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Strengths */}
          <div className="bg-lc-bg-layer-1 rounded-lg p-6 border border-lc-border">
            <h3 className="text-lg font-semibold text-lc-green mb-4">Strengths</h3>
            {feedback.strengths.length > 0 ? (
              <ul className="space-y-2">
                {feedback.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-2 text-lc-text-secondary">
                    <svg className="w-5 h-5 text-lc-green flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {strength}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-lc-text-muted">No strengths identified</p>
            )}
          </div>

          {/* Areas for Improvement */}
          <div className="bg-lc-bg-layer-1 rounded-lg p-6 border border-lc-border">
            <h3 className="text-lg font-semibold text-lc-yellow mb-4">Areas for Improvement</h3>
            {feedback.improvements.length > 0 ? (
              <ul className="space-y-2">
                {feedback.improvements.map((improvement, index) => (
                  <li key={index} className="flex items-start gap-2 text-lc-text-secondary">
                    <svg className="w-5 h-5 text-lc-yellow flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {improvement}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-lc-text-muted">No improvements identified</p>
            )}
          </div>
        </div>
      )}

      {/* Detailed Notes */}
      {feedback && !isSystemDesignFeedback(feedback) && feedback.detailed_notes && (
        <div className="bg-lc-bg-layer-1 rounded-lg p-6 mb-8 border border-lc-border">
          <h3 className="text-lg font-semibold text-lc-text-primary mb-4">Detailed Feedback</h3>
          <p className="text-lc-text-secondary whitespace-pre-wrap">
            {feedback.detailed_notes}
          </p>
        </div>
      )}
    </>
  )
}
