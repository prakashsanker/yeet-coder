import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/common/AppHeader'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

interface SubscriptionDetails {
  tier: 'free' | 'pro'
  status: string | null
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
}

export default function Subscription() {
  const navigate = useNavigate()
  const { user } = useAuth()

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
    <div className="min-h-screen bg-lc-bg-dark flex flex-col">
      <AppHeader showBack onBack={() => navigate('/dashboard')} />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-bold text-lc-text-primary mb-6">Subscription</h1>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lc-green"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Error message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Success message */}
            {successMessage && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-400 text-sm">{successMessage}</p>
              </div>
            )}

            {/* Current Plan Card */}
            <div className="bg-lc-bg-layer-1 border border-lc-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-lc-text-primary">Current Plan</h2>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    subscription?.tier === 'pro'
                      ? 'bg-brand-orange/20 text-brand-orange'
                      : 'bg-lc-bg-layer-3 text-lc-text-secondary'
                  }`}
                >
                  {subscription?.tier === 'pro' ? 'Pro' : 'Free'}
                </span>
              </div>

              {subscription?.tier === 'pro' ? (
                <div className="space-y-4">
                  <div className="text-lc-text-secondary text-sm">
                    <p className="mb-2">You have access to:</p>
                    <ul className="list-disc list-inside space-y-1 text-lc-text-muted">
                      <li>Unlimited mock interviews</li>
                      <li>Detailed AI feedback</li>
                      <li>Access to NeetCode 150 + System Design</li>
                      <li>Progress tracking</li>
                    </ul>
                  </div>

                  {subscription.currentPeriodEnd && (
                    <div className="pt-4 border-t border-lc-border">
                      <p className="text-sm text-lc-text-muted">
                        {subscription.cancelAtPeriodEnd ? (
                          <>
                            Your subscription will end on{' '}
                            <span className="text-lc-text-secondary">
                              {formatDate(subscription.currentPeriodEnd)}
                            </span>
                          </>
                        ) : (
                          <>
                            Next billing date:{' '}
                            <span className="text-lc-text-secondary">
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
                  <p className="text-lc-text-muted text-sm">
                    You're on the free plan with limited access. Upgrade to Pro for unlimited interviews and more.
                  </p>
                  <button
                    onClick={handleUpgrade}
                    className="w-full py-2 px-4 bg-brand-orange hover:bg-brand-orange/90 text-white font-medium rounded-lg transition-colors"
                  >
                    Upgrade to Pro
                  </button>
                </div>
              )}
            </div>

            {/* Cancel Subscription Section (only for pro users) */}
            {subscription?.tier === 'pro' && !subscription.cancelAtPeriodEnd && (
              <div className="bg-lc-bg-layer-1 border border-lc-border rounded-lg p-6">
                <h2 className="text-lg font-semibold text-lc-text-primary mb-2">Cancel Subscription</h2>
                <p className="text-lc-text-muted text-sm mb-4">
                  If you cancel, you'll still have access to Pro features until the end of your current billing period.
                </p>

                {!showConfirmCancel ? (
                  <button
                    onClick={() => setShowConfirmCancel(true)}
                    className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                  >
                    Cancel subscription
                  </button>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <p className="text-lc-text-secondary text-sm mb-4">
                      Are you sure you want to cancel your subscription? You'll lose access to Pro features after{' '}
                      {formatDate(subscription.currentPeriodEnd)}.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleCancelSubscription}
                        disabled={isCancelling}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        {isCancelling ? 'Cancelling...' : 'Yes, cancel subscription'}
                      </button>
                      <button
                        onClick={() => setShowConfirmCancel(false)}
                        disabled={isCancelling}
                        className="px-4 py-2 bg-lc-bg-layer-3 hover:bg-lc-bg-layer-2 text-lc-text-secondary text-sm font-medium rounded-lg transition-colors"
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
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-yellow-400 text-sm">
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
