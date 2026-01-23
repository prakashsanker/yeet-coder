import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'

interface PaywallModalProps {
  isOpen: boolean
  onClose: () => void
  existingInterview?: {
    id: string
    session_type: 'coding' | 'system_design'
  } | null
}

export default function PaywallModal({
  isOpen,
  onClose,
  existingInterview,
}: PaywallModalProps) {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  if (!isOpen) return null

  const handleUpgrade = async () => {
    setIsLoading(true)
    try {
      const { url } = await api.subscription.createCheckout()
      if (url) {
        window.location.href = url
      }
    } catch (err) {
      console.error('Failed to create checkout session:', err)
      alert('Failed to start checkout. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResumeInterview = () => {
    if (!existingInterview) return

    const path = existingInterview.session_type === 'system_design'
      ? `/system-design/${existingInterview.id}`
      : `/interview/${existingInterview.id}`

    navigate(path)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-lc-bg-layer-1 rounded-xl p-6 w-full max-w-md border border-lc-border">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-lc-text-primary">Upgrade to Pro</h2>
          <button
            onClick={onClose}
            className="text-lc-text-muted hover:text-lc-text-primary transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Message */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-brand-orange/10 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <p className="text-lc-text-primary font-semibold">Free interview limit reached</p>
              <p className="text-lc-text-muted text-sm">Upgrade to Pro for unlimited interviews</p>
            </div>
          </div>

          <p className="text-lc-text-secondary text-sm">
            You've used your free interview. Upgrade to Pro to unlock unlimited AI mock interviews, detailed feedback, and progress tracking.
          </p>
        </div>

        {/* Pro benefits */}
        <div className="bg-lc-bg-layer-2 rounded-lg p-4 mb-6">
          <h3 className="text-lc-text-primary font-medium mb-3">Pro includes:</h3>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm text-lc-text-secondary">
              <svg className="w-4 h-4 text-lc-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Unlimited AI mock interviews
            </li>
            <li className="flex items-center gap-2 text-sm text-lc-text-secondary">
              <svg className="w-4 h-4 text-lc-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Detailed AI feedback on every interview
            </li>
            <li className="flex items-center gap-2 text-sm text-lc-text-secondary">
              <svg className="w-4 h-4 text-lc-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Full access to NeetCode 150 + System Design
            </li>
            <li className="flex items-center gap-2 text-sm text-lc-text-secondary">
              <svg className="w-4 h-4 text-lc-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Progress tracking and weakness analysis
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleUpgrade}
            disabled={isLoading}
            className="w-full py-3 bg-lc-green hover:bg-lc-green-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Loading...' : 'Upgrade to Pro'}
          </button>

          {existingInterview && (
            <button
              onClick={handleResumeInterview}
              className="w-full py-3 bg-lc-bg-layer-2 hover:bg-lc-bg-layer-3 text-lc-text-primary font-medium rounded-lg transition-colors border border-lc-border"
            >
              Resume Your Interview
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
