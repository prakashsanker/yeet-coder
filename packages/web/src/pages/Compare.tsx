import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { analytics } from '../lib/posthog'
import { useState, useEffect } from 'react'

const comparisonData = [
  {
    feature: 'Cost',
    yeetcoder: '$19/month unlimited',
    humanInterviewer: '$150–300 per session',
    selfStudy: 'Free – $200 (books/courses)',
  },
  {
    feature: 'Availability',
    yeetcoder: '24/7, instant access',
    humanInterviewer: 'Schedule days in advance',
    selfStudy: 'Anytime',
  },
  {
    feature: 'Feedback timing',
    yeetcoder: 'Instant, detailed rubric',
    humanInterviewer: 'After session ends',
    selfStudy: 'None',
  },
  {
    feature: 'Practice limit',
    yeetcoder: 'Unlimited',
    humanInterviewer: 'Limited by budget',
    selfStudy: 'N/A',
  },
  {
    feature: 'Voice practice',
    yeetcoder: 'Yes, real-time conversation',
    humanInterviewer: 'Yes',
    selfStudy: 'No',
  },
  {
    feature: 'Follow-up questions',
    yeetcoder: 'Yes, AI challenges weak points',
    humanInterviewer: 'Yes, varies by interviewer',
    selfStudy: 'No',
  },
  {
    feature: 'Consistency',
    yeetcoder: 'Same quality every time',
    humanInterviewer: 'Varies by interviewer',
    selfStudy: 'N/A',
  },
  {
    feature: 'Transcript & recording',
    yeetcoder: 'Full transcript included',
    humanInterviewer: 'Usually not provided',
    selfStudy: 'N/A',
  },
]

export default function Compare() {
  const navigate = useNavigate()
  const { user, isLoading, signInWithGoogle } = useAuth()
  const [authError, setAuthError] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleGetStarted = async () => {
    setAuthError(null)
    if (user) {
      navigate('/dashboard')
    } else {
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
    <div className="min-h-screen bg-[var(--bg-page)]" style={{ '--bg-page': '#FFF9F2' } as React.CSSProperties}>
      {/* Navigation */}
      <header className={`fixed top-0 left-0 right-0 z-50 h-20 flex items-center px-6 md:px-8 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-lg shadow-sm' : 'bg-transparent'}`}>
        <Link to="/" className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">YeetCoder</Link>

        <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          <Link to="/#features" className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            Features
          </Link>
          <Link to="/compare" className="text-sm font-medium text-[var(--accent-purple)]">
            Compare
          </Link>
          <Link to="/#pricing" className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-3 ml-auto">
          <button
            onClick={handleGetStarted}
            className="btn-landing-primary"
          >
            Get started
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6 bg-gradient-hero-warm">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-[var(--glass-border)] rounded-full px-4 py-1.5 mb-6">
              <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">Comparison</span>
            </div>
            <h1 className="text-[clamp(2.5rem,5vw,3.5rem)] font-semibold text-[var(--text-primary)] tracking-tight leading-[1.1] mb-6">
              How YeetCoder compares to other prep methods
            </h1>
            <p className="text-xl text-[var(--text-secondary)] leading-relaxed">
              There are many ways to prepare for system design interviews. Here's how YeetCoder stacks up against the alternatives.
            </p>
          </div>
        </div>
      </section>

      {/* Main comparison table */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-4 pr-6 text-[var(--text-muted)] font-medium text-sm">Feature</th>
                  <th className="text-left py-4 px-6 bg-warm-card-purple rounded-t-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--text-primary)] font-bold">YeetCoder</span>
                      <span className="ml-1 px-2 py-0.5 bg-[var(--accent-purple)] text-white text-xs font-semibold rounded-full">Best value</span>
                    </div>
                  </th>
                  <th className="text-left py-4 px-6 text-[var(--text-primary)] font-medium">Human Interviewers</th>
                  <th className="text-left py-4 px-6 text-[var(--text-primary)] font-medium">Self-Study</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-4 pr-6 text-[var(--text-secondary)] font-medium">{row.feature}</td>
                    <td className={`py-4 px-6 bg-warm-card-purple/60 ${index === comparisonData.length - 1 ? 'rounded-b-xl' : ''}`}>
                      <span className="text-[var(--text-primary)] font-semibold">{row.yeetcoder}</span>
                    </td>
                    <td className="py-4 px-6 text-[var(--text-secondary)]">{row.humanInterviewer}</td>
                    <td className="py-4 px-6 text-[var(--text-secondary)]">{row.selfStudy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Detailed breakdowns */}
      <section className="py-16 px-6 bg-[var(--bg-section)]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-semibold text-[var(--text-primary)] tracking-tight mb-12">
            The real trade-offs
          </h2>

          <div className="grid md:grid-cols-3 gap-8 items-start">
            {/* YeetCoder - Featured */}
            <div className="relative bg-gradient-to-br from-[var(--accent-purple)] via-[#8a6d8e] to-[#7a5d7e] p-8 rounded-2xl shadow-xl md:scale-105 md:-mt-4 md:mb-4 order-first">
              {/* Recommended badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1.5 bg-amber-400 text-amber-900 text-xs font-bold uppercase tracking-wider rounded-full shadow-lg">
                  Recommended
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center mb-6">
                <span className="text-white font-bold text-lg">Y</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">YeetCoder</h3>
              <p className="text-white/80 mb-6 leading-relaxed">
                AI-powered voice interviews with instant feedback and unlimited practice.
              </p>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-white/90 mb-2">What you get</h4>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-white text-sm">
                      <svg className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span><strong>$19/month</strong> for unlimited practice</span>
                    </li>
                    <li className="flex items-start gap-2 text-white text-sm">
                      <svg className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span><strong>Instant feedback</strong> after every interview</span>
                    </li>
                    <li className="flex items-start gap-2 text-white text-sm">
                      <svg className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Practice anytime, <strong>24/7 availability</strong></span>
                    </li>
                    <li className="flex items-start gap-2 text-white text-sm">
                      <svg className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>AI asks follow-ups and challenges you</span>
                    </li>
                    <li className="flex items-start gap-2 text-white text-sm">
                      <svg className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Scored rubric across 5 dimensions</span>
                    </li>
                    <li className="flex items-start gap-2 text-white text-sm">
                      <svg className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Full conversation transcript</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* CTA button */}
              <button
                onClick={handleGetStarted}
                className="w-full mt-6 px-6 py-3 bg-white text-[var(--accent-purple)] font-semibold rounded-xl hover:bg-white/90 transition-colors shadow-lg"
              >
                Start free interview
              </button>
            </div>

            {/* Human Interviewers */}
            <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-warm-card-orange flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-[#8b6914]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Human Interviewers</h3>
              <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">
                Services like Pramp, interviewing.io, or hiring a FAANG engineer for mock interviews.
              </p>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">The good</h4>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-[var(--text-secondary)] text-sm">
                      <svg className="w-4 h-4 text-[#4CAF50] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Real human interaction
                    </li>
                    <li className="flex items-start gap-2 text-[var(--text-secondary)] text-sm">
                      <svg className="w-4 h-4 text-[#4CAF50] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Nuanced feedback from experience
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">The trade-offs</h4>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-[var(--text-secondary)] text-sm">
                      <svg className="w-4 h-4 text-[#C62828] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span><strong className="text-[var(--text-primary)]">$150–300 per session</strong> adds up fast</span>
                    </li>
                    <li className="flex items-start gap-2 text-[var(--text-secondary)] text-sm">
                      <svg className="w-4 h-4 text-[#C62828] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Schedule days or weeks in advance</span>
                    </li>
                    <li className="flex items-start gap-2 text-[var(--text-secondary)] text-sm">
                      <svg className="w-4 h-4 text-[#C62828] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Quality varies wildly by interviewer</span>
                    </li>
                    <li className="flex items-start gap-2 text-[var(--text-secondary)] text-sm">
                      <svg className="w-4 h-4 text-[#C62828] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Limited reps due to cost</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Self-Study */}
            <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-warm-card-blue flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-[var(--accent-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Self-Study</h3>
              <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">
                Books like "Designing Data-Intensive Applications", YouTube videos, ByteByteGo, courses.
              </p>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">The good</h4>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-[var(--text-secondary)] text-sm">
                      <svg className="w-4 h-4 text-[#4CAF50] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Free or low cost
                    </li>
                    <li className="flex items-start gap-2 text-[var(--text-secondary)] text-sm">
                      <svg className="w-4 h-4 text-[#4CAF50] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Build foundational knowledge
                    </li>
                    <li className="flex items-start gap-2 text-[var(--text-secondary)] text-sm">
                      <svg className="w-4 h-4 text-[#4CAF50] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Go at your own pace
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">The trade-offs</h4>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-[var(--text-secondary)] text-sm">
                      <svg className="w-4 h-4 text-[#C62828] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span><strong className="text-[var(--text-primary)]">Passive learning</strong> — you read, but never speak</span>
                    </li>
                    <li className="flex items-start gap-2 text-[var(--text-secondary)] text-sm">
                      <svg className="w-4 h-4 text-[#C62828] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>No feedback on your verbal explanation</span>
                    </li>
                    <li className="flex items-start gap-2 text-[var(--text-secondary)] text-sm">
                      <svg className="w-4 h-4 text-[#C62828] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>No one challenges your design</span>
                    </li>
                    <li className="flex items-start gap-2 text-[var(--text-secondary)] text-sm">
                      <svg className="w-4 h-4 text-[#C62828] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Can't simulate interview pressure</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* The math section */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-semibold text-[var(--text-primary)] tracking-tight mb-6">
              The math is simple
            </h2>
            <p className="text-[var(--text-secondary)] text-lg mb-12 leading-relaxed">
              One session with a human mock interviewer costs $150–300. For the same price as a single session, you get an entire month of unlimited practice with YeetCoder.
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="p-8 rounded-2xl bg-[var(--bg-section)] border border-gray-200">
                <p className="text-4xl font-semibold text-[var(--text-primary)] mb-2">1</p>
                <p className="text-[var(--text-secondary)]">Human mock interview session</p>
                <p className="text-2xl font-semibold text-[var(--text-muted)] mt-4">$150–300</p>
              </div>
              <div className="p-8 rounded-2xl bg-warm-card-purple border-2 border-[var(--accent-purple)]">
                <p className="text-4xl font-semibold text-[var(--text-primary)] mb-2">Unlimited</p>
                <p className="text-[var(--text-primary)]">YeetCoder interviews for a month</p>
                <p className="text-2xl font-semibold text-[var(--accent-purple)] mt-4">$19</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key insight */}
      <section className="py-16 px-6 bg-[var(--bg-section)]">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl mx-auto">
            <blockquote className="text-2xl md:text-3xl font-medium text-[var(--text-primary)] text-center leading-relaxed">
              "Reading about system design and <em className="text-[var(--accent-purple)]">defending your design out loud</em> are completely different skills."
            </blockquote>
            <p className="text-[var(--text-muted)] text-center mt-8">
              Real interviews require you to think on your feet, handle pushback, and articulate your reasoning clearly. The only way to get better is to practice speaking — not just reading.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-gradient-cta rounded-3xl p-12 text-center">
            <svg className="w-8 h-8 text-[var(--text-primary)] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-semibold text-[var(--text-primary)] tracking-tight mb-6">
              Try it free
            </h2>
            <p className="text-[var(--text-secondary)] text-xl mb-10 max-w-xl mx-auto">
              Your first interview is completely free. No credit card required. See for yourself how YeetCoder compares.
            </p>
            <button
              onClick={handleGetStarted}
              disabled={isLoading}
              className="btn-landing-primary px-8 py-4 text-base"
            >
              {isLoading ? 'Loading...' : 'Start your free interview'}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {authError && (
              <p className="mt-4 text-[#C62828] text-sm">{authError}</p>
            )}
            <p className="font-mono text-sm text-[var(--text-muted)] mt-4">
              No credit card required
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-200">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link to="/" className="text-lg font-semibold text-[var(--text-primary)]">YeetCoder</Link>
          <div className="flex items-center gap-8">
            <Link to="/" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              Home
            </Link>
            <Link to="/#pricing" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              Pricing
            </Link>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            © {new Date().getFullYear()} YeetCoder. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
