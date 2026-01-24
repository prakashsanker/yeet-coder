import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { analytics } from '../lib/posthog'

const testimonials = [
  {
    name: 'Michael Chen',
    role: 'Senior Software Engineer',
    company: 'Google',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    quote: 'YeetCoder helped me nail my system design interviews. The AI feedback is incredibly detailed and helped me identify gaps in my knowledge I didn\'t even know existed.',
  },
  {
    name: 'Sarah Mitchell',
    role: 'Staff Engineer',
    company: 'Palantir',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
    quote: 'I practiced 50+ system design questions before my Palantir interview. The instant grading meant I could iterate quickly and improve with each session.',
  },
  {
    name: 'David Park',
    role: 'Principal Engineer',
    company: 'Splunk',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    quote: 'Way more affordable than hiring a coach, and available 24/7. I went from struggling with system design to getting offers from 3 top companies.',
  },
]

export default function Landing() {
  const navigate = useNavigate()
  const { user, isLoading, signInWithGoogle } = useAuth()
  const [authError, setAuthError] = useState<string | null>(null)

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!isLoading && user) {
      navigate('/dashboard')
    }
  }, [user, isLoading, navigate])

  const handlePracticeNow = async () => {
    setAuthError(null)
    if (user) {
      // Already authenticated, go to dashboard
      navigate('/dashboard')
    } else {
      // Need to authenticate first - will redirect to /dashboard after callback
      analytics.signupInitiated()
      try {
        await signInWithGoogle()
      } catch (error) {
        setAuthError('Failed to sign in. Please try again.')
        console.error(error)
      }
    }
  }

  return (
    <div className="min-h-screen bg-lc-bg-dark">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-lc-bg-dark/95 backdrop-blur-sm border-b border-lc-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-orange rounded-lg flex items-center justify-center">
                <span className="text-lc-bg-dark font-bold text-lg">Y</span>
              </div>
              <span className="text-lc-text-primary font-semibold text-lg">YeetCoder</span>
            </div>
            {user ? (
              <div className="flex items-center gap-2">
                <img
                  src={user.user_metadata?.avatar_url || ''}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
                <span className="text-lc-text-secondary text-sm hidden sm:inline">
                  {user.user_metadata?.full_name || user.email}
                </span>
              </div>
            ) : (
              <button
                onClick={handlePracticeNow}
                className="px-4 py-1.5 bg-lc-bg-layer-2 hover:bg-lc-bg-layer-3 text-lc-text-primary text-sm rounded-lg transition-colors border border-lc-border"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-14 overflow-hidden">
        {/* Diagonal gradient background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-lc-bg-dark via-lc-bg-layer-1 to-lc-bg-dark" />
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-lc-bg-layer-1/50 to-transparent" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left side - Text */}
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-lc-text-primary leading-tight">
                Master System Design
                <span className="block text-brand-orange">Interviews</span>
              </h1>
              <p className="mt-6 text-lg text-lc-text-secondary max-w-xl">
                Practice with a realistic AI avatar to simulate real world system design interviews. Get instant feedback to improve.
              </p>

              <div className="mt-10">
                <button
                  onClick={handlePracticeNow}
                  disabled={isLoading}
                  className="px-8 py-3 bg-lc-green hover:bg-lc-green-dark text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      Practice Now
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
                {authError && (
                  <p className="mt-2 text-lc-red text-sm">{authError}</p>
                )}
              </div>

              {/* Trust badge */}
              <div className="mt-12 pt-8 border-t border-lc-border">
                <p className="text-lc-text-muted text-sm mb-4">Trusted by engineers at</p>
                <div className="flex items-center gap-8 opacity-60">
                  <span className="text-lc-text-secondary font-semibold">Google</span>
                  <span className="text-lc-text-secondary font-semibold">Palantir</span>
                  <span className="text-lc-text-secondary font-semibold">Splunk</span>
                </div>
              </div>
            </div>

            {/* Right side - Illustration/Card */}
            <div className="hidden lg:block">
              <div className="relative">
                {/* Main card */}
                <div className="bg-lc-bg-layer-1 rounded-2xl border border-lc-border shadow-2xl p-6">
                  {/* Mock interface header */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-lc-red" />
                    <div className="w-3 h-3 rounded-full bg-lc-yellow" />
                    <div className="w-3 h-3 rounded-full bg-lc-green" />
                  </div>

                  {/* Mock problem display */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 bg-lc-yellow/20 text-lc-yellow text-xs rounded font-medium">Medium</span>
                      <span className="text-lc-text-primary font-medium">Design a URL Shortener</span>
                    </div>

                    <div className="h-px bg-lc-border" />

                    <div className="space-y-2">
                      <div className="h-3 bg-lc-bg-layer-3 rounded w-full" />
                      <div className="h-3 bg-lc-bg-layer-3 rounded w-5/6" />
                      <div className="h-3 bg-lc-bg-layer-3 rounded w-4/6" />
                    </div>

                    <div className="flex gap-2 mt-4">
                      <span className="px-2 py-1 bg-lc-bg-layer-2 text-lc-text-secondary text-xs rounded">Scalability</span>
                      <span className="px-2 py-1 bg-lc-bg-layer-2 text-lc-text-secondary text-xs rounded">Database</span>
                      <span className="px-2 py-1 bg-lc-bg-layer-2 text-lc-text-secondary text-xs rounded">Caching</span>
                    </div>
                  </div>

                  {/* AI feedback indicator */}
                  <div className="mt-6 p-4 bg-lc-green/10 rounded-lg border border-lc-green/20">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-lc-green rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-lc-green text-sm font-medium">AI Feedback Ready</p>
                        <p className="text-lc-text-muted text-xs">Score: 85/100</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating accent elements */}
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-brand-orange/10 rounded-full blur-2xl" />
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-lc-green/10 rounded-full blur-2xl" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-lc-text-primary">
              Start Exploring
            </h2>
            <p className="mt-4 text-lc-text-secondary max-w-2xl mx-auto">
              Everything you need to ace system design interviews at top tech companies
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="group bg-lc-bg-layer-1 rounded-xl p-6 border border-lc-border hover:border-lc-teal/50 transition-all">
              <div className="w-12 h-12 bg-lc-teal/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-lc-teal/20 transition-colors">
                <svg className="w-6 h-6 text-lc-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-lc-text-primary mb-2">
                Real-World System Design
              </h3>
              <p className="text-lc-text-secondary text-sm leading-relaxed">
                Practice designing systems like URL shorteners, chat applications, and distributed databases — the exact questions asked at FAANG companies.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group bg-lc-bg-layer-1 rounded-xl p-6 border border-lc-border hover:border-brand-orange/50 transition-all">
              <div className="w-12 h-12 bg-brand-orange/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-brand-orange/20 transition-colors">
                <svg className="w-6 h-6 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-lc-text-primary mb-2">
                Unlimited Practice, Low Cost
              </h3>
              <p className="text-lc-text-secondary text-sm leading-relaxed">
                Practice as much as you want for a fraction of what you'd pay for mock interviews. No scheduling hassles, available 24/7.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group bg-lc-bg-layer-1 rounded-xl p-6 border border-lc-border hover:border-lc-green/50 transition-all">
              <div className="w-12 h-12 bg-lc-green/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-lc-green/20 transition-colors">
                <svg className="w-6 h-6 text-lc-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-lc-text-primary mb-2">
                Instant AI Grading
              </h3>
              <p className="text-lc-text-secondary text-sm leading-relaxed">
                Get detailed feedback immediately after each session. Understand exactly where you excelled and what needs improvement.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 bg-lc-bg-layer-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-lc-text-primary">
              What Engineers Say
            </h2>
            <p className="mt-4 text-lc-text-secondary">
              Join thousands of engineers who've leveled up their system design skills
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.name}
                className="bg-lc-bg-dark rounded-xl p-6 border border-lc-border"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-brand-orange" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-lc-text-secondary text-sm leading-relaxed mb-6">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-lc-text-primary font-medium text-sm">{testimonial.name}</p>
                    <p className="text-lc-text-muted text-xs">
                      {testimonial.role} at {testimonial.company}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-lc-text-primary mb-4">
            Ready to Ace Your Interview?
          </h2>
          <p className="text-lc-text-secondary text-lg mb-10 max-w-2xl mx-auto">
            Join thousands of engineers who've successfully landed offers at top tech companies
          </p>
          <button
            onClick={handlePracticeNow}
            disabled={isLoading}
            className="px-10 py-4 bg-lc-green hover:bg-lc-green-dark text-white font-medium rounded-lg transition-colors text-lg disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Start Practicing for Free'}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-lc-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-brand-orange rounded flex items-center justify-center">
                <span className="text-lc-bg-dark font-bold text-sm">Y</span>
              </div>
              <span className="text-lc-text-secondary text-sm">YeetCoder</span>
            </div>
            <p className="text-lc-text-muted text-sm">
              &copy; {new Date().getFullYear()} YeetCoder. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

    </div>
  )
}
