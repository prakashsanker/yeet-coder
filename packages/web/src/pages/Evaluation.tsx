import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppHeader from '../components/common/AppHeader'
import { API_URL, api } from '../lib/api'

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
      id: string
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
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

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

  const handleRetryEvaluation = async () => {
    if (!id || isRetrying) return

    setIsRetrying(true)
    setRetryError(null)

    try {
      const result = await api.evaluations.rerun(id)
      if (result.evaluation) {
        // Reload the page to get fresh data with interview info
        window.location.reload()
      }
    } catch (err) {
      console.error('Failed to retry evaluation:', err)
      setRetryError(err instanceof Error ? err.message : 'Failed to generate evaluation. Please try again.')
    } finally {
      setIsRetrying(false)
    }
  }

  if (isLoading) {
    return (
      <div className="app-page flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-landing-muted">Loading evaluation...</p>
        </div>
      </div>
    )
  }

  if (error || !evaluation) {
    return (
      <div className="app-page flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Evaluation not found'}</p>
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
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-landing-primary">
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
                  <div className="text-2xl font-bold text-accent-purple">
                    {formatTime(evaluation.interview?.time_spent_seconds)}
                  </div>
                  <div className="text-sm text-landing-muted mt-1">Time Spent</div>
                </div>
                <div className="card p-5 text-center">
                  <div className="text-2xl font-bold text-accent-purple">
                    {evaluation.interview?.transcript?.length || 0}
                  </div>
                  <div className="text-sm text-landing-muted mt-1">Conversation Turns</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="card p-5 text-center">
                  <div className="text-2xl font-bold text-accent-blue">
                    {formatTime(evaluation.interview?.time_spent_seconds)}
                  </div>
                  <div className="text-sm text-landing-muted mt-1">Time Spent</div>
                </div>
                <div className="card p-5 text-center">
                  <div className="text-2xl font-bold text-accent-blue">
                    {evaluation.interview?.run_count || 0}
                  </div>
                  <div className="text-sm text-landing-muted mt-1">Runs</div>
                </div>
                <div className="card p-5 text-center">
                  <div className="text-2xl font-bold text-accent-blue">
                    {evaluation.interview?.submit_count || 0}
                  </div>
                  <div className="text-sm text-landing-muted mt-1">Submissions</div>
                </div>
                <div className="card p-5 text-center">
                  <div className={`text-2xl font-bold ${overallPassRate >= 70 ? 'text-green-600' : overallPassRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                    {overallPassRate}%
                  </div>
                  <div className="text-sm text-landing-muted mt-1">Tests Passed</div>
                </div>
              </div>
            )}

            {/* Test Results Breakdown - Only for coding */}
            {!isSystemDesign && testResults && totalTests > 0 && (
              <div className="card p-6 mb-8">
                <h3 className="text-lg font-semibold text-landing-primary mb-4">Test Results</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-landing-muted">Visible Tests</span>
                      <span className={`font-semibold ${
                        testResults.visible.passed === testResults.visible.total ? 'text-green-600' : 'text-amber-600'
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
                      <span className="text-landing-muted">Hidden Tests</span>
                      <span className={`font-semibold ${
                        testResults.hidden.passed === testResults.hidden.total ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {testResults.hidden.passed}/{testResults.hidden.total}
                      </span>
                    </div>
                    <div className="progress-bar">
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
              isSystemDesign ? (
                // System Design Evaluation Display
                <SystemDesignEvaluationDisplay
                  evaluation={evaluation}
                  onRetry={handleRetryEvaluation}
                  isRetrying={isRetrying}
                />
              ) : (
                // Coding Evaluation Display
                <CodingEvaluationDisplay evaluation={evaluation} />
              )
            ) : (
              /* Pending Evaluation - offer retry */
              <div className="card p-8 text-center mb-8">
                <div className="mb-4">
                  <div className="w-16 h-16 bg-amber-100 rounded-full mx-auto flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-amber-600"
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
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-landing-primary mb-2">Evaluation Incomplete</h3>
                <p className="text-landing-muted mb-6">
                  Your interview was recorded but the AI evaluation didn't complete.
                  <br />
                  This can happen due to network issues. Click below to generate your evaluation.
                </p>
                {retryError && (
                  <p className="text-red-600 text-sm mb-4">{retryError}</p>
                )}
                <button
                  onClick={handleRetryEvaluation}
                  disabled={isRetrying}
                  className="btn-primary px-6 py-3"
                >
                  {isRetrying ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating Evaluation...
                    </>
                  ) : (
                    'Generate Evaluation'
                  )}
                </button>
                <p className="text-xs text-landing-muted mt-4">
                  This usually takes 15-30 seconds.
                </p>
              </div>
            )}

            {/* User's Custom Test Cases - Only for coding */}
            {!isSystemDesign && evaluation.user_test_cases && evaluation.user_test_cases.length > 0 && (
              <div className="card p-6 mb-8">
                <h3 className="text-lg font-semibold text-landing-primary mb-4">Your Custom Test Cases ({evaluation.user_test_cases.length})</h3>
                <div className="space-y-3">
                  {evaluation.user_test_cases.map((tc, index) => (
                    <div key={index} className="bg-warm-section rounded-lg p-3">
                      <div className="text-sm text-landing-muted mb-1">Test Case {index + 1}</div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-landing-muted">Input:</span>
                          <pre className="text-landing-secondary mt-1 bg-landing-primary/5 p-2 rounded overflow-x-auto">{tc.input || '(empty)'}</pre>
                        </div>
                        <div>
                          <span className="text-landing-muted">Expected:</span>
                          <pre className="text-landing-secondary mt-1 bg-landing-primary/5 p-2 rounded overflow-x-auto">{tc.expected_output || '(empty)'}</pre>
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
                  <h3 className="text-lg font-semibold text-landing-primary">Your Submitted Code</h3>
                  <span className="badge badge-neutral">
                    {evaluation.interview.language}
                  </span>
                </div>
                <pre className="bg-landing-primary/5 rounded-lg p-4 overflow-x-auto text-sm text-landing-secondary">
                  <code>{evaluation.interview.final_code}</code>
                </pre>
              </div>
            )}

            {/* Notes - Only for system design */}
            {isSystemDesign && (evaluation.evaluated_notes || evaluation.interview?.notes) && (
              <div className="card p-6 mb-8">
                <h3 className="text-lg font-semibold text-landing-primary mb-4">Your Notes</h3>
                <pre className="bg-landing-primary/5 rounded-lg p-4 overflow-x-auto text-sm text-landing-secondary whitespace-pre-wrap font-mono">
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
    strong: 'bg-green-500 text-white',
    comprehensive: 'bg-green-500 text-white',
    adequate: 'bg-amber-500 text-white',
    needs_improvement: 'bg-red-500 text-white',
    incomplete: 'bg-red-500 text-white',
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
    critical: 'bg-red-100 text-red-700 border-red-200',
    important: 'bg-amber-100 text-amber-700 border-amber-200',
    minor: 'bg-gray-100 text-gray-600 border-gray-200',
  }

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${colors[importance]}`}>
      {importance.charAt(0).toUpperCase() + importance.slice(1)}
    </span>
  )
}

// System Design Evaluation Display Component - NEW with Style + Completeness
function SystemDesignEvaluationDisplay({ evaluation, onRetry, isRetrying }: {
  evaluation: EvaluationData
  onRetry?: () => void
  isRetrying?: boolean
}) {
  const feedback = evaluation.feedback as SystemDesignFeedback | undefined
  const isNewStructure = feedback && hasNewFeedbackStructure(feedback)

  // Check if the feedback indicates an error/incomplete evaluation
  const hasErrorInFeedback = feedback?.summary?.toLowerCase().includes('could not be completed') ||
    feedback?.summary?.toLowerCase().includes('error') ||
    feedback?.style?.assessment?.toLowerCase().includes('unable to generate') ||
    feedback?.style?.assessment?.toLowerCase().includes('error')

  // If using new structure, render new UI
  if (isNewStructure && feedback) {
    return (
      <>
        {/* Retry Banner - Show if feedback indicates error */}
        {hasErrorInFeedback && onRetry && (
          <div className="mb-8 p-6 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-amber-800 mb-1">Evaluation Incomplete</h3>
                <p className="text-amber-700 text-sm">
                  The detailed feedback could not be generated. Click to retry.
                </p>
              </div>
              <button
                onClick={onRetry}
                disabled={isRetrying}
                className="btn-primary px-4 py-2 text-sm"
              >
                {isRetrying ? 'Retrying...' : 'Retry Evaluation'}
              </button>
            </div>
          </div>
        )}

        {/* Overall Summary */}
        {feedback.summary && !hasErrorInFeedback && (
          <div className="mb-8 p-6 rounded-lg bg-white border border-black/10">
            <h3 className="text-lg font-semibold mb-3 text-landing-primary">Summary</h3>
            <p className="text-landing-secondary leading-relaxed whitespace-pre-wrap">{feedback.summary}</p>
          </div>
        )}

        {/* Style and Completeness Rating Cards */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Style Rating Card */}
          <div className="bg-white rounded-lg p-6 border border-black/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-landing-primary">Style</h3>
              {feedback.style?.rating && (
                <RatingBadge rating={feedback.style.rating} />
              )}
            </div>
            <p className="text-sm text-landing-muted mb-2">
              How you approached the problem: clarity of thought, structure, diagrams, trade-off consideration
            </p>
          </div>

          {/* Completeness Rating Card */}
          <div className="bg-white rounded-lg p-6 border border-black/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-landing-primary">Completeness</h3>
              {feedback.completeness?.rating && (
                <RatingBadge rating={feedback.completeness.rating} />
              )}
            </div>
            <p className="text-sm text-landing-muted mb-2">
              What you covered compared to the answer key: features, depth, critical components
            </p>
          </div>
        </div>

        {/* STYLE SECTION */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-landing-primary flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-accent-purple flex items-center justify-center text-white text-sm">1</span>
            Style Assessment
          </h2>

          {/* Style Assessment Text */}
          {feedback.style?.assessment && (
            <div className="bg-white rounded-lg p-6 mb-6 border border-black/10">
              <p className="text-landing-secondary leading-relaxed whitespace-pre-wrap">{feedback.style.assessment}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            {/* Style Strengths */}
            <div className="bg-white rounded-lg p-6 border border-black/10">
              <h4 className="text-lg font-semibold text-green-600 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Strengths
              </h4>
              {feedback.style?.strengths && feedback.style.strengths.length > 0 ? (
                <div className="space-y-4">
                  {feedback.style.strengths.map((item, index) => (
                    <div key={index} className="border-l-2 border-green-500 pl-4">
                      <p className="text-landing-primary font-medium">{item.point}</p>
                      {item.example && (
                        <p className="text-sm text-landing-muted mt-1 italic">"{item.example}"</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-landing-muted">No specific strengths identified</p>
              )}
            </div>

            {/* Style Improvements */}
            <div className="bg-white rounded-lg p-6 border border-black/10">
              <h4 className="text-lg font-semibold text-amber-600 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Areas to Improve
              </h4>
              {feedback.style?.improvements && feedback.style.improvements.length > 0 ? (
                <div className="space-y-4">
                  {feedback.style.improvements.map((item, index) => (
                    <div key={index} className="border-l-2 border-amber-500 pl-4">
                      <p className="text-landing-primary font-medium">{item.point}</p>
                      {item.what_they_did && (
                        <p className="text-sm text-red-600 mt-1">
                          <span className="font-medium">What you did:</span> {item.what_they_did}
                        </p>
                      )}
                      {item.what_would_be_better && (
                        <p className="text-sm text-green-600 mt-1">
                          <span className="font-medium">Better approach:</span> {item.what_would_be_better}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-landing-muted">No improvements identified</p>
              )}
            </div>
          </div>
        </div>

        {/* COMPLETENESS SECTION */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-landing-primary flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-accent-purple flex items-center justify-center text-white text-sm">2</span>
            Completeness Assessment
          </h2>

          {/* Completeness Assessment Text */}
          {feedback.completeness?.assessment && (
            <div className="bg-white rounded-lg p-6 mb-6 border border-black/10">
              <p className="text-landing-secondary leading-relaxed whitespace-pre-wrap">{feedback.completeness.assessment}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            {/* Topics Covered Well */}
            <div className="bg-white rounded-lg p-6 border border-black/10">
              <h4 className="text-lg font-semibold text-green-600 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Topics Covered Well
              </h4>
              {feedback.completeness?.covered_well && feedback.completeness.covered_well.length > 0 ? (
                <div className="space-y-3">
                  {feedback.completeness.covered_well.map((item, index) => (
                    <div key={index} className="border-l-2 border-green-500 pl-4">
                      <p className="text-landing-primary font-medium">{item.topic}</p>
                      {item.detail && (
                        <p className="text-sm text-landing-muted mt-1">{item.detail}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-landing-muted">No topics specifically highlighted</p>
              )}
            </div>

            {/* Brief Gaps Summary */}
            <div className="bg-white rounded-lg p-6 border border-black/10">
              <h4 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
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
                      <span className="text-landing-secondary">{item.topic}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-landing-muted">No significant gaps identified</p>
              )}
              {feedback.completeness?.gaps && feedback.completeness.gaps.length > 0 && (
                <p className="text-xs text-landing-muted mt-4">See detailed breakdown below</p>
              )}
            </div>
          </div>
        </div>

        {/* DETAILED MISSED COMPONENTS SECTION */}
        {feedback.completeness?.gaps && feedback.completeness.gaps.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-red-600 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-sm">!</span>
              What You Missed (Detailed Breakdown)
            </h2>
            <p className="text-landing-muted mb-6">
              Below is a detailed comparison of what you said vs what a strong candidate would cover.
            </p>

            <div className="space-y-6">
              {feedback.completeness.gaps.map((gap, index) => (
                <div key={index} className="bg-white rounded-lg border border-red-200 overflow-hidden">
                  <div className="bg-red-50 px-6 py-4 border-b border-red-100">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold text-landing-primary flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-sm">
                          {index + 1}
                        </span>
                        {gap.topic}
                      </h4>
                      <ImportanceBadge importance={gap.importance} />
                    </div>
                    {gap.what_was_missing && (
                      <p className="text-sm text-landing-muted mt-2">{gap.what_was_missing}</p>
                    )}
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                      <h5 className="text-sm font-semibold text-red-700 mb-2">What You Said</h5>
                      <p className="text-landing-secondary italic">
                        {gap.what_candidate_said || 'Not mentioned'}
                      </p>
                    </div>

                    {gap.answer_key_excerpt && (
                      <div className="bg-teal-50 rounded-lg p-4 border border-teal-100">
                        <h5 className="text-sm font-semibold text-teal-700 mb-2">From the Answer Key</h5>
                        <p className="text-landing-secondary whitespace-pre-wrap text-sm leading-relaxed">
                          {gap.answer_key_excerpt}
                        </p>
                      </div>
                    )}

                    {gap.example_good_response && (
                      <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                        <h5 className="text-sm font-semibold text-green-700 mb-2">What a Strong Candidate Would Say</h5>
                        <p className="text-landing-secondary italic leading-relaxed">
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
            <h2 className="text-xl font-bold mb-4 text-landing-primary flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-accent-purple flex items-center justify-center text-white text-sm">3</span>
              Key Recommendations
            </h2>
            <div className="space-y-4">
              {feedback.recommendations.map((rec, index) => (
                <div key={index} className="bg-white rounded-lg p-6 border border-black/10">
                  <h4 className="text-lg font-semibold text-accent-purple mb-2">{rec.title}</h4>
                  <p className="text-landing-secondary leading-relaxed">{rec.explanation}</p>
                  {rec.example && (
                    <div className="mt-3 p-3 bg-warm-section rounded-lg">
                      <p className="text-sm text-landing-muted">
                        <span className="font-medium text-teal-600">Example:</span> {rec.example}
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

  // LEGACY FALLBACK
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
      {/* KEY TAKEAWAY */}
      {feedback && isSystemDesignFeedback(feedback) && feedback.key_takeaway && (
        <div className="bg-accent-purple/10 border border-accent-purple rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-accent-purple mb-2">Key Takeaway</h3>
          <p className="text-landing-primary text-lg leading-relaxed">{feedback.key_takeaway}</p>
        </div>
      )}

      {/* Summary */}
      {feedback?.summary && !(feedback && isSystemDesignFeedback(feedback) && feedback.key_takeaway) && (
        <div className="bg-white border border-black/10 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-landing-primary mb-2">Summary</h3>
          <p className="text-landing-secondary leading-relaxed">{feedback.summary}</p>
        </div>
      )}

      {/* OVERALL SCORE */}
      <div className="flex items-center gap-4 mb-8 p-4 bg-white rounded-lg border border-black/10">
        <div className={`text-3xl font-bold ${
          (evaluation.overall_score || 0) >= 70 ? 'text-green-600' :
          (evaluation.overall_score || 0) >= 50 ? 'text-amber-600' : 'text-red-600'
        }`}>
          {evaluation.overall_score}/100
        </div>
        <div className="text-landing-muted">Overall Score</div>
      </div>

      {/* FEEDBACK SECTIONS */}
      {feedback && isSystemDesignFeedback(feedback) && (feedback.good_points || feedback.areas_for_improvement) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 border border-black/10">
            <h3 className="text-lg font-semibold text-green-600 mb-4">What You Did Well</h3>
            {feedback.good_points && feedback.good_points.length > 0 ? (
              <ul className="space-y-3">
                {feedback.good_points.map((point, index) => (
                  <li key={index} className="flex items-start gap-3 text-landing-secondary">
                    <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-landing-muted italic">No specific strengths identified</p>
            )}
          </div>

          <div className="bg-white rounded-lg p-6 border border-black/10">
            <h3 className="text-lg font-semibold text-amber-600 mb-4">Areas for Improvement</h3>
            {feedback.areas_for_improvement && feedback.areas_for_improvement.length > 0 ? (
              <ul className="space-y-3">
                {feedback.areas_for_improvement.map((area, index) => (
                  <li key={index} className="flex items-start gap-3 text-landing-secondary">
                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{area}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-landing-muted italic">No specific improvements identified</p>
            )}
          </div>
        </div>
      )}

      {/* DETAILED FEEDBACK */}
      {detailedNotesWithContent.length > 0 && (
        <div className="bg-white rounded-lg p-6 mb-8 border border-black/10">
          <h3 className="text-lg font-semibold text-landing-primary mb-6">Detailed Feedback</h3>
          <div className="space-y-6">
            {detailedNotesWithContent.map(({ key, label, note }) => (
              <div key={key} className="border-l-3 border-accent-purple pl-4 py-1">
                <h4 className="text-sm font-semibold text-accent-purple mb-2 uppercase tracking-wide">{label}</h4>
                <p className="text-landing-secondary leading-relaxed">{note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MISSED COMPONENTS */}
      {feedback && isSystemDesignFeedback(feedback) && feedback.missed_components && feedback.missed_components.length > 0 && (
        <div className="bg-red-50 rounded-lg p-6 mb-8 border border-red-200">
          <h3 className="text-lg font-semibold text-red-700 mb-4">Components You Missed</h3>
          <ul className="space-y-2">
            {feedback.missed_components.map((component, index) => (
              <li key={index} className="flex items-start gap-3 text-landing-secondary">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="bg-teal-50 rounded-lg p-6 mb-8 border border-teal-200">
          <h3 className="text-lg font-semibold text-teal-700 mb-4">What to Study Next</h3>
          <ul className="space-y-2">
            {feedback.study_recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-3 text-landing-secondary">
                <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {index + 1}
                </span>
                <span className="leading-relaxed">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* SCORE BREAKDOWN */}
      <details className="bg-white rounded-lg border border-black/10 mb-8">
        <summary className="p-4 cursor-pointer text-landing-secondary hover:text-landing-primary flex items-center gap-2">
          <span className="font-medium">View Detailed Score Breakdown</span>
        </summary>
        <div className="p-6 pt-2 border-t border-black/10">
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
                <span className="text-landing-muted text-sm">{label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        (score || 0) >= 70 ? 'bg-green-500' : (score || 0) >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${score || 0}%` }}
                    />
                  </div>
                  <span className="text-sm text-landing-secondary w-8 text-right">{score || 0}</span>
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
          evaluation.verdict === 'PASS' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}
      >
        <div className={`text-4xl font-bold mb-2 ${evaluation.verdict === 'PASS' ? 'text-green-600' : 'text-red-600'}`}>
          {evaluation.verdict === 'PASS' ? 'PASSED' : 'NEEDS IMPROVEMENT'}
        </div>
        <div className="text-lg text-landing-secondary">
          Overall Score: {evaluation.overall_score}/100
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="bg-white rounded-lg p-6 mb-8 border border-black/10">
        <h3 className="text-lg font-semibold text-landing-primary mb-4">Score Breakdown</h3>
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
            <div key={label} className="flex items-center justify-between">
              <div>
                <span className="text-landing-secondary">{label}</span>
                <p className="text-xs text-landing-muted">{description}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="progress-bar w-24">
                  <div
                    className={`h-full rounded-full ${(score || 0) >= 70 ? 'bg-green-500' : (score || 0) >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${score || 0}%` }}
                  />
                </div>
                <span className="text-sm text-landing-secondary w-8 text-right">{score || 0}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback */}
      {feedback && !isSystemDesignFeedback(feedback) && (
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 border border-black/10">
            <h3 className="text-lg font-semibold text-green-600 mb-4">Strengths</h3>
            {feedback.strengths.length > 0 ? (
              <ul className="space-y-2">
                {feedback.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-2 text-landing-secondary">
                    <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {strength}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-landing-muted">No strengths identified</p>
            )}
          </div>

          <div className="bg-white rounded-lg p-6 border border-black/10">
            <h3 className="text-lg font-semibold text-amber-600 mb-4">Areas for Improvement</h3>
            {feedback.improvements.length > 0 ? (
              <ul className="space-y-2">
                {feedback.improvements.map((improvement, index) => (
                  <li key={index} className="flex items-start gap-2 text-landing-secondary">
                    <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {improvement}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-landing-muted">No improvements identified</p>
            )}
          </div>
        </div>
      )}

      {/* Detailed Notes */}
      {feedback && !isSystemDesignFeedback(feedback) && feedback.detailed_notes && (
        <div className="bg-white rounded-lg p-6 mb-8 border border-black/10">
          <h3 className="text-lg font-semibold text-landing-primary mb-4">Detailed Feedback</h3>
          <p className="text-landing-secondary whitespace-pre-wrap">{feedback.detailed_notes}</p>
        </div>
      )}
    </>
  )
}
