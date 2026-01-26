import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/common/AppHeader'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { isAdmin } from '../lib/admin'

interface SubscriptionDetails {
  tier: 'free' | 'pro'
  status: string | null
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
}

export default function Subscription() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const userIsAdmin = isAdmin(user)

  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCancelling, setCancelling] = useState(false)
  const [showConfirmCancel, setShowConfirmCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadSubscription() {
      if (!user) {
        setSubscription(null)
        return
      }

      try {
        const { subscription } = await api.subscription.getDetails()
        setSubscription(subscription)
      } catch (err) {
        console.error('Failed to load subscription:', err)
        setError('Failed to load subscription details')
      } finally {
        setIsLoading(false)
      }
    }

    loadSubscription()
  }, [user])

  const handleCancelSubscription = async () => {
    setCancelling(true)
    setError(null)
    try {
      const result = await api.subscription.cancel()
      setSuccessMessage(result.message)
      // Refresh subscription details
      const { subscription: updated } = await api.subscription.getDetails()
      setSubscription(updated)
      setShowConfirmCancel(false)
    } catch (err) {
      console.error('Failed to cancel subscription:', err)
      setError('Failed to cancel subscription. Please try again.')
    } finally {
      setCancelling(false)
    }
  }

  const handleUpgrade = async () => {
    try {
      const { url } = await api.subscription.createCheckout()
      window.location.href = url
    } catch (err) {
      console.error('Failed to start checkout:', err)
      setError('Failed to start checkout. Please try again.')
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="app-page flex flex-col">
      <AppHeader showBack onBack={() => navigate('/dashboard')} />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Subscription</h1>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner w-8 h-8"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Error message */}
            {error && (
              <div className="bg-[#FFEBEE] border border-[#C62828] rounded-xl p-4">
                <p className="text-[#C62828] text-sm">{error}</p>
              </div>
            )}

            {/* Success message */}
            {successMessage && (
              <div className="bg-[#E8F5E9] border border-[#4CAF50] rounded-xl p-4">
                <p className="text-[#2E7D32] text-sm">{successMessage}</p>
              </div>
            )}

            {/* Current Plan Card */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Current Plan</h2>
                <span
                  className={`badge ${
                    subscription?.tier === 'pro'
                      ? 'badge-purple'
                      : 'badge-neutral'
                  }`}
                >
                  {subscription?.tier === 'pro' ? 'Pro' : 'Free'}
                </span>
              </div>

              {subscription?.tier === 'pro' ? (
                <div className="space-y-4">
                  <div className="text-[var(--text-secondary)] text-sm">
                    <p className="mb-2">You have access to:</p>
                    <ul className="list-disc list-inside space-y-1 text-[var(--text-muted)]">
                      <li>Unlimited mock interviews</li>
                      <li>Detailed AI feedback</li>
                      <li>Access to {userIsAdmin ? 'NeetCode 150 + System Design' : 'System Design'}</li>
                      <li>Progress tracking</li>
                    </ul>
                  </div>

                  {subscription.currentPeriodEnd && (
                    <div className="pt-4 border-t border-[rgba(0,0,0,0.08)]">
                      <p className="text-sm text-[var(--text-muted)]">
                        {subscription.cancelAtPeriodEnd ? (
                          <>
                            Your subscription will end on{' '}
                            <span className="text-[var(--text-secondary)] font-medium">
                              {formatDate(subscription.currentPeriodEnd)}
                            </span>
                          </>
                        ) : (
                          <>
                            Next billing date:{' '}
                            <span className="text-[var(--text-secondary)] font-medium">
                              {formatDate(subscription.currentPeriodEnd)}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[var(--text-muted)] text-sm">
                    You're on the free plan with limited access. Upgrade to Pro for unlimited interviews and more.
                  </p>
                  <button
                    onClick={handleUpgrade}
                    className="w-full btn-primary"
                  >
                    Upgrade to Pro
                  </button>
                </div>
              )}
            </div>

            {/* Cancel Subscription Section (only for pro users) */}
            {subscription?.tier === 'pro' && !subscription.cancelAtPeriodEnd && (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Cancel Subscription</h2>
                <p className="text-[var(--text-muted)] text-sm mb-4">
                  If you cancel, you'll still have access to Pro features until the end of your current billing period.
                </p>

                {!showConfirmCancel ? (
                  <button
                    onClick={() => setShowConfirmCancel(true)}
                    className="text-[#C62828] hover:text-[#B71C1C] text-sm font-medium transition-colors"
                  >
                    Cancel subscription
                  </button>
                ) : (
                  <div className="bg-[#FFEBEE] border border-[#C62828] rounded-xl p-4">
                    <p className="text-[var(--text-secondary)] text-sm mb-4">
                      Are you sure you want to cancel your subscription? You'll lose access to Pro features after{' '}
                      {formatDate(subscription.currentPeriodEnd)}.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleCancelSubscription}
                        disabled={isCancelling}
                        className="px-4 py-2 bg-[#C62828] hover:bg-[#B71C1C] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        {isCancelling ? 'Cancelling...' : 'Yes, cancel subscription'}
                      </button>
                      <button
                        onClick={() => setShowConfirmCancel(false)}
                        disabled={isCancelling}
                        className="btn-secondary text-sm"
                      >
                        Keep subscription
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Already cancelled notice */}
            {subscription?.tier === 'pro' && subscription.cancelAtPeriodEnd && (
              <div className="bg-[#FFF3E0] border border-[#E65100] rounded-xl p-4">
                <p className="text-[#E65100] text-sm">
                  Your subscription is set to cancel. You'll have access to Pro features until{' '}
                  {formatDate(subscription.currentPeriodEnd)}.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
