import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { analytics } from '../lib/posthog'
import { useState } from 'react'

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
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-semibold text-sm">Y</span>
              </div>
              <span className="text-slate-900 font-semibold tracking-tight">YeetCoder</span>
            </Link>
            <div className="flex items-center gap-8">
              <Link to="/#how-it-works" className="text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors hidden sm:block">
                How it works
              </Link>
              <Link to="/compare" className="text-indigo-600 text-sm font-medium hidden sm:block">
                Compare
              </Link>
              <Link to="/#pricing" className="text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors hidden sm:block">
                Pricing
              </Link>
              <button
                onClick={handleGetStarted}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Get started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 mb-8">
              <span className="text-indigo-700 text-sm font-medium">Comparison</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-slate-900 tracking-tight leading-[1.1] mb-6">
              How YeetCoder compares to other prep methods
            </h1>
            <p className="text-xl text-slate-600 leading-relaxed">
              There are many ways to prepare for system design interviews. Here's how YeetCoder stacks up against the alternatives.
            </p>
          </div>
        </div>
      </section>

      {/* Main comparison table */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-4 pr-6 text-slate-500 font-medium text-sm">Feature</th>
                  <th className="text-left py-4 px-6 bg-gradient-to-b from-indigo-50 to-indigo-100/50 rounded-t-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center shadow-md shadow-indigo-200">
                        <span className="text-white font-semibold text-xs">Y</span>
                      </div>
                      <span className="text-indigo-900 font-bold">YeetCoder</span>
                      <span className="ml-1 px-2 py-0.5 bg-indigo-600 text-white text-xs font-semibold rounded-full">Best value</span>
                    </div>
                  </th>
                  <th className="text-left py-4 px-6 text-slate-700 font-medium">Human Interviewers</th>
                  <th className="text-left py-4 px-6 text-slate-700 font-medium">Self-Study</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, index) => (
                  <tr key={index} className="border-b border-slate-100">
                    <td className="py-4 pr-6 text-slate-600 font-medium">{row.feature}</td>
                    <td className={`py-4 px-6 bg-indigo-50/60 ${index === comparisonData.length - 1 ? 'rounded-b-xl' : ''}`}>
                      <span className="text-indigo-900 font-semibold">{row.yeetcoder}</span>
                    </td>
                    <td className="py-4 px-6 text-slate-600">{row.humanInterviewer}</td>
                    <td className="py-4 px-6 text-slate-600">{row.selfStudy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Detailed breakdowns */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-semibold text-slate-900 tracking-tight mb-12">
            The real trade-offs
          </h2>

          <div className="grid md:grid-cols-3 gap-8 items-start">
            {/* YeetCoder - Featured */}
            <div className="relative bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 p-8 rounded-2xl shadow-xl shadow-indigo-200 md:scale-105 md:-mt-4 md:mb-4 order-first">
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
              <p className="text-indigo-100 mb-6 leading-relaxed">
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
                className="w-full mt-6 px-6 py-3 bg-white text-indigo-600 font-semibold rounded-xl hover:bg-indigo-50 transition-colors shadow-lg"
              >
                Start free interview
              </button>
            </div>

            {/* Human Interviewers */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-4">Human Interviewers</h3>
              <p className="text-slate-600 mb-6 leading-relaxed">
                Services like Pramp, interviewing.io, or hiring a FAANG engineer for mock interviews.
              </p>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">The good</h4>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-slate-600 text-sm">
                      <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Real human interaction
                    </li>
                    <li className="flex items-start gap-2 text-slate-600 text-sm">
                      <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Nuanced feedback from experience
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">The trade-offs</h4>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-slate-600 text-sm">
                      <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span><strong className="text-slate-900">$150–300 per session</strong> adds up fast</span>
                    </li>
                    <li className="flex items-start gap-2 text-slate-600 text-sm">
                      <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Schedule days or weeks in advance</span>
                    </li>
                    <li className="flex items-start gap-2 text-slate-600 text-sm">
                      <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Quality varies wildly by interviewer</span>
                    </li>
                    <li className="flex items-start gap-2 text-slate-600 text-sm">
                      <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Limited reps due to cost</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Self-Study */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-4">Self-Study</h3>
              <p className="text-slate-600 mb-6 leading-relaxed">
                Books like "Designing Data-Intensive Applications", YouTube videos, ByteByteGo, courses.
              </p>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">The good</h4>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-slate-600 text-sm">
                      <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Free or low cost
                    </li>
                    <li className="flex items-start gap-2 text-slate-600 text-sm">
                      <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Build foundational knowledge
                    </li>
                    <li className="flex items-start gap-2 text-slate-600 text-sm">
                      <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Go at your own pace
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">The trade-offs</h4>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-slate-600 text-sm">
                      <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span><strong className="text-slate-900">Passive learning</strong> — you read, but never speak</span>
                    </li>
                    <li className="flex items-start gap-2 text-slate-600 text-sm">
                      <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>No feedback on your verbal explanation</span>
                    </li>
                    <li className="flex items-start gap-2 text-slate-600 text-sm">
                      <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>No one challenges your design</span>
                    </li>
                    <li className="flex items-start gap-2 text-slate-600 text-sm">
                      <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-semibold text-slate-900 tracking-tight mb-6">
              The math is simple
            </h2>
            <p className="text-slate-600 text-lg mb-12 leading-relaxed">
              One session with a human mock interviewer costs $150–300. For the same price as a single session, you get an entire month of unlimited practice with YeetCoder.
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="text-4xl font-semibold text-slate-900 mb-2">1</p>
                <p className="text-slate-600">Human mock interview session</p>
                <p className="text-2xl font-semibold text-slate-400 mt-4">$150–300</p>
              </div>
              <div className="p-8 rounded-2xl bg-indigo-50 border-2 border-indigo-200">
                <p className="text-4xl font-semibold text-slate-900 mb-2">Unlimited</p>
                <p className="text-slate-700">YeetCoder interviews for a month</p>
                <p className="text-2xl font-semibold text-indigo-600 mt-4">$19</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key insight */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-3xl mx-auto">
            <blockquote className="text-2xl md:text-3xl font-medium text-slate-900 text-center leading-relaxed">
              "Reading about system design and <em className="text-indigo-600">defending your design out loud</em> are completely different skills."
            </blockquote>
            <p className="text-slate-500 text-center mt-8">
              Real interviews require you to think on your feet, handle pushback, and articulate your reasoning clearly. The only way to get better is to practice speaking — not just reading.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-semibold text-slate-900 tracking-tight mb-6">
            Try it free
          </h2>
          <p className="text-slate-600 text-xl mb-10 max-w-xl mx-auto">
            Your first interview is completely free. No credit card required. See for yourself how YeetCoder compares.
          </p>
          <button
            onClick={handleGetStarted}
            disabled={isLoading}
            className="px-8 py-4 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors text-lg shadow-lg shadow-indigo-200"
          >
            {isLoading ? 'Loading...' : 'Start your free interview'}
          </button>
          {authError && (
            <p className="mt-4 text-red-600 text-sm">{authError}</p>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
                <span className="text-white font-semibold text-xs">Y</span>
              </div>
              <span className="text-slate-500 text-sm">YeetCoder</span>
            </Link>
            <div className="flex items-center gap-6">
              <Link to="/" className="text-slate-500 hover:text-slate-700 text-sm transition-colors">
                Home
              </Link>
              <Link to="/#pricing" className="text-slate-500 hover:text-slate-700 text-sm transition-colors">
                Pricing
              </Link>
            </div>
            <p className="text-slate-400 text-sm">
              © {new Date().getFullYear()} YeetCoder. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
