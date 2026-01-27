import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppHeader from '../components/common/AppHeader'
import { api } from '../lib/api'

const LOADING_MESSAGES = [
  'Analyzing your system design...',
  'Reviewing your architecture decisions...',
  'Comparing against the answer key...',
  'Evaluating requirements gathering...',
  'Checking capacity estimates...',
  'Assessing trade-off discussions...',
  'Generating detailed feedback...',
  'Almost done...',
]

export default function GeneratingEvaluation() {
  const { interviewId } = useParams<{ interviewId: string }>()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [messageIndex, setMessageIndex] = useState(0)

  // Cycle through loading messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  // Create evaluation and redirect
  useEffect(() => {
    async function createEvaluation() {
      if (!interviewId) {
        setError('No interview ID provided')
        return
      }

      try {
        // Create the evaluation (this triggers AI grading)
        const { evaluation } = await api.evaluations.create({ interview_id: interviewId })

        // Navigate to the evaluation page
        navigate(`/evaluation/${evaluation.id}`, { replace: true })
      } catch (err) {
        console.error('Failed to create evaluation:', err)
        setError(err instanceof Error ? err.message : 'Failed to generate evaluation')
      }
    }

    createEvaluation()
  }, [interviewId, navigate])

  if (error) {
    return (
      <div className="app-page">
        <AppHeader />
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-lc-text-primary mb-2">Evaluation Failed</h2>
            <p className="text-lc-text-muted mb-6">{error}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-page">
      <AppHeader />
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          {/* Animated icon */}
          <div className="relative w-24 h-24 mx-auto mb-8">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border-4 border-brand-orange/20"></div>
            {/* Spinning ring */}
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-orange animate-spin"></div>
            {/* Inner icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-10 h-10 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-lc-text-primary mb-3">
            Generating Your Evaluation
          </h2>

          {/* Cycling message */}
          <p className="text-lc-text-secondary mb-6 h-6 transition-opacity duration-500">
            {LOADING_MESSAGES[messageIndex]}
          </p>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-8">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  i === messageIndex % 3 ? 'bg-brand-orange' : 'bg-brand-orange/30'
                }`}
              />
            ))}
          </div>

          {/* Info text */}
          <p className="text-sm text-lc-text-muted">
            Our AI interviewer is reviewing your design against the answer key.
            <br />
            This usually takes 15-30 seconds.
          </p>
        </div>
      </div>
    </div>
  )
}
