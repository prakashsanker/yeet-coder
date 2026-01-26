import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { analytics } from '../../lib/posthog'
import { useAuth } from '../../contexts/AuthContext'
import { isAdmin } from '../../lib/admin'

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
  const { user } = useAuth()
  const userIsAdmin = isAdmin(user)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      analytics.paywallShown()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleUpgrade = async () => {
    analytics.upgradeClicked()
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
    <div className="fixed inset-0 bg-[rgba(0,0,0,0.5)] backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Upgrade to Pro</h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Message */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-[#FFF3E0] rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-[#E65100]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <p className="text-[var(--text-primary)] font-semibold">Free interview limit reached</p>
              <p className="text-[var(--text-muted)] text-sm">Upgrade to Pro for unlimited interviews</p>
            </div>
          </div>

          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            You've used your free interview. Upgrade to Pro to unlock unlimited AI mock interviews, detailed feedback, and progress tracking.
          </p>
        </div>

        {/* Pro benefits */}
        <div className="bg-[var(--bg-section)] rounded-xl p-4 mb-6">
          <h3 className="text-[var(--text-primary)] font-medium mb-3">Pro includes:</h3>
          <ul className="space-y-2.5">
            {[
              'Unlimited AI mock interviews',
              'Detailed AI feedback on every interview',
              userIsAdmin ? 'Full access to NeetCode 150 + System Design' : 'Full access to System Design',
              'Progress tracking and weakness analysis',
            ].map((benefit, i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
                <svg className="w-4 h-4 text-[var(--accent-purple)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        {/* Price */}
        <div className="text-center mb-6">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-3xl font-semibold text-[var(--text-primary)]">$10</span>
            <span className="text-[var(--text-muted)]">/month</span>
          </div>
          <p className="text-[var(--text-muted)] text-xs mt-1">Cancel anytime</p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleUpgrade}
            disabled={isLoading}
            className="w-full py-3 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Loading...' : 'Upgrade to Pro'}
          </button>

          {existingInterview && (
            <button
              onClick={handleResumeInterview}
              className="w-full py-3 btn-secondary"
            >
              Resume Your Interview
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm font-medium transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
