import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_URL } from '../lib/api'

// Hardcoded example evaluation ID
const EXAMPLE_EVALUATION_ID = 'dd93cd1d-3361-42da-9161-d03460e7e227'

interface SystemDesignFeedback {
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
  recommendations: Array<{
    title: string
    explanation: string
    example?: string
  }>
  summary: string
}

interface EvaluationData {
  id: string
  interview_id: string
  style_rating?: 'strong' | 'adequate' | 'needs_improvement'
  completeness_rating?: 'comprehensive' | 'adequate' | 'incomplete'
  clarity_score?: number
  structure_score?: number
  correctness_score?: number
  overall_score?: number
  feedback?: SystemDesignFeedback
  interview?: {
    session_type?: 'coding' | 'system_design'
    time_spent_seconds?: number
    transcript?: Array<{ speaker: string; text: string; timestamp: number }>
    question?: {
      title: string
      description: string
      difficulty: 'easy' | 'medium' | 'hard'
      type: 'coding' | 'system_design'
    }
  }
}

function hasNewFeedbackStructure(feedback: SystemDesignFeedback): boolean {
  return feedback.style !== undefined && feedback.completeness !== undefined
}

export default function ExampleEvaluation() {
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadEvaluation() {
      try {
        const response = await fetch(`${API_URL}/api/evaluations/${EXAMPLE_EVALUATION_ID}`)
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
  }, [])

  const formatTime = (seconds?: number) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-landing-muted">Loading example evaluation...</p>
        </div>
      </div>
    )
  }

  if (error || !evaluation) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Evaluation not found'}</p>
          <Link to="/" className="btn-primary">
            Return Home
          </Link>
        </div>
      </div>
    )
  }

  const feedback = evaluation.feedback as SystemDesignFeedback | undefined
  const hasNewStructure = feedback && hasNewFeedbackStructure(feedback)

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Simple Header */}
      <header className="app-header flex items-center justify-between px-6 flex-shrink-0">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-[var(--text-primary)] font-semibold tracking-tight text-lg">YeetCoder</span>
        </Link>
        <Link to="/" className="btn-primary">
          Try It Yourself
        </Link>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Banner */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 mb-8 border border-indigo-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-indigo-900">Example Evaluation</h3>
              <p className="text-sm text-indigo-700">This is what your evaluation will look like after completing an interview</p>
            </div>
          </div>
        </div>

        {/* Question Title */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-landing-primary">
              {evaluation.interview?.question?.title || 'System Design Interview'}
            </h2>
            <span className="badge badge-purple">System Design</span>
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

        {/* Stats Row */}
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

        {/* Evaluation Content */}
        {hasNewStructure && feedback ? (
          <div className="space-y-8">
            {/* Summary */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-landing-primary mb-4">Summary</h3>
              <p className="text-landing-secondary leading-relaxed">{feedback.summary}</p>
            </div>

            {/* Style Assessment */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-landing-primary">Interview Style</h3>
                <span className={`badge ${
                  feedback.style.rating === 'strong' ? 'badge-green' :
                  feedback.style.rating === 'adequate' ? 'badge-amber' :
                  'badge-red'
                }`}>
                  {feedback.style.rating.replace('_', ' ')}
                </span>
              </div>
              <p className="text-landing-secondary mb-6">{feedback.style.assessment}</p>

              {feedback.style.strengths.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-green-700 mb-3">Strengths</h4>
                  <div className="space-y-3">
                    {feedback.style.strengths.map((s, i) => (
                      <div key={i} className="bg-green-50 rounded-lg p-4 border border-green-100">
                        <p className="font-medium text-green-900">{s.point}</p>
                        <p className="text-sm text-green-700 mt-1">"{s.example}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {feedback.style.improvements.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-amber-700 mb-3">Areas for Improvement</h4>
                  <div className="space-y-3">
                    {feedback.style.improvements.map((imp, i) => (
                      <div key={i} className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                        <p className="font-medium text-amber-900">{imp.point}</p>
                        <p className="text-sm text-amber-700 mt-2">
                          <span className="font-medium">What you did:</span> {imp.what_they_did}
                        </p>
                        <p className="text-sm text-amber-700 mt-1">
                          <span className="font-medium">Better approach:</span> {imp.what_would_be_better}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Completeness Assessment */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-landing-primary">Completeness</h3>
                <span className={`badge ${
                  feedback.completeness.rating === 'comprehensive' ? 'badge-green' :
                  feedback.completeness.rating === 'adequate' ? 'badge-amber' :
                  'badge-red'
                }`}>
                  {feedback.completeness.rating}
                </span>
              </div>
              <p className="text-landing-secondary mb-6">{feedback.completeness.assessment}</p>

              {feedback.completeness.covered_well.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-green-700 mb-3">Topics Covered Well</h4>
                  <div className="space-y-2">
                    {feedback.completeness.covered_well.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <div>
                          <span className="font-medium text-landing-primary">{item.topic}:</span>{' '}
                          <span className="text-landing-secondary">{item.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {feedback.completeness.gaps.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-700 mb-3">Gaps to Address</h4>
                  <div className="space-y-4">
                    {feedback.completeness.gaps.map((gap, i) => (
                      <div key={i} className="bg-red-50 rounded-lg p-4 border border-red-100">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-red-900">{gap.topic}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            gap.importance === 'critical' ? 'bg-red-200 text-red-800' :
                            gap.importance === 'important' ? 'bg-amber-200 text-amber-800' :
                            'bg-gray-200 text-gray-700'
                          }`}>
                            {gap.importance}
                          </span>
                        </div>
                        <p className="text-sm text-red-700 mb-2">
                          <span className="font-medium">What was missing:</span> {gap.what_was_missing}
                        </p>
                        <div className="bg-white rounded p-3 mt-2">
                          <p className="text-xs font-medium text-gray-500 mb-1">Example good response:</p>
                          <p className="text-sm text-gray-700">{gap.example_good_response}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recommendations */}
            {feedback.recommendations.length > 0 && (
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-landing-primary mb-4">Recommendations</h3>
                <div className="space-y-4">
                  {feedback.recommendations.map((rec, i) => (
                    <div key={i} className="border-l-4 border-indigo-400 pl-4 py-2">
                      <h4 className="font-medium text-landing-primary">{rec.title}</h4>
                      <p className="text-sm text-landing-secondary mt-1">{rec.explanation}</p>
                      {rec.example && (
                        <p className="text-sm text-indigo-600 mt-2 italic">"{rec.example}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card p-8 text-center">
            <p className="text-landing-muted">Evaluation data is being generated...</p>
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 text-center">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white">
            <h3 className="text-2xl font-bold mb-3">Ready to practice?</h3>
            <p className="text-indigo-100 mb-6 max-w-md mx-auto">
              Get personalized AI feedback on your system design and coding interviews
            </p>
            <Link to="/" className="inline-flex items-center gap-2 bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition-colors">
              Start Your Interview
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
