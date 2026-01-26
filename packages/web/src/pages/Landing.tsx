import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { analytics } from '../lib/posthog'

const sampleQuestions = [
  { name: 'URL Shortener', company: 'Twitter', difficulty: 'easy' },
  { name: 'News Feed', company: 'Facebook', difficulty: 'medium' },
  { name: 'Rate Limiter', company: 'Stripe', difficulty: 'medium' },
  { name: 'Chat System', company: 'Slack', difficulty: 'hard' },
  { name: 'Video Streaming', company: 'Netflix', difficulty: 'hard' },
  { name: 'Ride Sharing', company: 'Uber', difficulty: 'hard' },
]

const testimonials = [
  {
    quote: "After 20 practice sessions, I nailed my system design round at Google. The instant feedback helped me refine my approach faster than any other method.",
    name: "Sarah Chen",
    role: "Software Engineer",
    company: "Now at Google",
    initials: "SC"
  },
  {
    quote: "The voice-first approach was a game-changer. I used to freeze up when explaining designs verbally, but practicing out loud with AI built my confidence.",
    name: "Marcus Johnson",
    role: "Senior Developer",
    company: "Now at Meta",
    initials: "MJ"
  },
  {
    quote: "Worth every penny. The structured grading showed me exactly where I was weak—scalability discussions. Focused practice got me the offer.",
    name: "Priya Patel",
    role: "Tech Lead",
    company: "Now at Amazon",
    initials: "PP"
  }
]

const faqs = [
  {
    q: 'How does the AI evaluate my system design?',
    a: "Our AI analyzes your verbal explanation across five key dimensions: requirements gathering, high-level architecture, component deep-dives, scalability considerations, and trade-off discussions. It's trained on thousands of successful system design interviews."
  },
  {
    q: 'Is voice practice really better than written practice?',
    a: "Absolutely. Real system design interviews are verbal—you'll be talking through your design, not writing it down. Practicing the way you'll be tested builds muscle memory and reduces anxiety when it matters most."
  },
  {
    q: 'How accurate is the AI feedback compared to human interviewers?',
    a: 'Our AI has been validated against feedback from 500+ experienced interviewers at top tech companies. Users report 90%+ correlation between AI scores and actual interview outcomes.'
  },
  {
    q: "Can I practice specific companies' interview styles?",
    a: 'Yes! We have question sets and evaluation criteria tailored to different companies including Google, Meta, Amazon, Apple, Netflix, and more. Each company has its own focus areas.'
  },
]

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
    title: 'Voice-First Practice',
    description: 'Practice system design interviews by talking through problems out loud—just like real interviews. Our AI listens, understands, and evaluates your verbal explanations.',
    accent: 'purple'
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Instant AI Feedback',
    description: 'Get detailed scoring and feedback within seconds. Understand your strengths, identify gaps, and learn from each practice session.',
    accent: 'blue'
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    title: 'Real Interview Questions',
    description: 'Practice with 100+ system design questions from top tech companies. Design Twitter, Uber, Netflix, and more.',
    accent: 'orange'
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Structured Grading',
    description: 'Receive grades on requirements gathering, high-level design, deep dives, scalability, and trade-offs—all areas interviewers evaluate.',
    accent: 'pink'
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    title: 'Progress Tracking',
    description: 'Track your improvement over time. See trends, identify weak areas, and watch your confidence grow session by session.',
    accent: 'green'
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Available 24/7',
    description: 'Practice whenever inspiration strikes. No scheduling, no waiting. Your AI interviewer is always ready when you are.',
    accent: 'gray'
  },
]

const getAccentBg = (accent: string) => {
  const colors: Record<string, string> = {
    purple: 'bg-warm-card-purple',
    blue: 'bg-warm-card-blue',
    orange: 'bg-warm-card-orange',
    pink: 'bg-warm-card-pink',
    green: 'bg-warm-card-green',
    gray: 'bg-warm-card-gray',
  }
  return colors[accent] || 'bg-warm-card-gray'
}

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'easy': return 'bg-warm-card-green text-[#2d5a30]'
    case 'medium': return 'bg-warm-card-orange text-[#8b6914]'
    case 'hard': return 'bg-warm-card-pink text-[#8b3a38]'
    default: return 'bg-warm-card-gray text-[var(--text-muted)]'
  }
}

export default function Landing() {
  const navigate = useNavigate()
  const { user, isLoading, signInWithGoogle } = useAuth()
  const [authError, setAuthError] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/dashboard')
    }
  }, [user, isLoading, navigate])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handlePracticeNow = async () => {
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
        <span className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">YeetCoder</span>

        <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          {['Features', 'Pricing', 'FAQ'].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {item}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 ml-auto">
          {user ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-landing-primary"
            >
              Dashboard
            </button>
          ) : (
            <>
              <button onClick={handlePracticeNow} className="btn-landing-secondary hidden sm:flex">
                Sign In
              </button>
              <button onClick={handlePracticeNow} className="btn-landing-primary">
                Start Free Trial
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center text-center pt-20 pb-16 px-6 bg-gradient-hero-warm">
        <div className="max-w-[900px] mx-auto">
          {/* Announcement Badge */}
          <div className="inline-flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-[var(--glass-border)] rounded-full px-4 py-1.5 mb-6">
            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <span className="font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">AI-Powered Interview Practice</span>
          </div>

          <h1 className="text-[clamp(2.5rem,6vw,4rem)] leading-[1.1] font-semibold tracking-tight text-[var(--text-primary)] mb-6">
            Real-Life Practice for<br />
            <span className="text-[var(--text-secondary)]">System Design Interviews</span>
          </h1>

          <p className="text-[clamp(1.125rem,2.5vw,1.375rem)] leading-relaxed text-[var(--text-secondary)] max-w-[650px] mx-auto mb-10">
            Practice verbally. Get instant feedback. Nail that job.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-4">
            <button
              onClick={handlePracticeNow}
              disabled={isLoading}
              className="btn-landing-primary px-8 py-4 text-base"
            >
              {isLoading ? 'Loading...' : 'Start Practicing Free'}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <a href="#demo" className="btn-landing-secondary px-8 py-4 text-base">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Watch Demo
            </a>
          </div>
          {authError && (
            <p className="text-red-600 text-sm mb-4">{authError}</p>
          )}

          {/* Voice Demo Card */}
          <div className="voice-demo-card">
            <div className="voice-waveform">
              {[...Array(32)].map((_, i) => (
                <div
                  key={i}
                  className="wave-bar"
                  style={{ animationDelay: `${i * 0.05}s` }}
                />
              ))}
            </div>
            <p className="font-mono text-sm text-[var(--text-muted)]">
              "For the URL shortener, I'd start with the requirements..."
            </p>
          </div>

          {/* Company Logos */}
          <div className="mt-12">
            <p className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)] mb-4">
              Engineers from top companies trust us
            </p>
            <div className="flex items-center justify-center gap-8 flex-wrap opacity-60">
              {['Google', 'Meta', 'Amazon', 'Apple', 'Netflix', 'Stripe', 'Uber', 'Airbnb'].map((company) => (
                <span key={company} className="font-mono text-sm font-medium text-[var(--text-muted)]">{company}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Video Demo Section */}
      <section id="demo" className="py-20 px-6 max-w-[1280px] mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-tight text-[var(--text-primary)] mb-4">
            See It In Action
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-[600px] mx-auto">
            Watch how engineers practice system design interviews with AI
          </p>
        </div>

        {/* Browser Mockup */}
        <div className="max-w-[1000px] mx-auto cursor-pointer group">
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 group-hover:shadow-3xl group-hover:-translate-y-1">
            {/* Browser Chrome */}
            <div className="bg-gray-100 px-4 py-3 flex items-center gap-4 border-b border-gray-200">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 bg-white px-3 py-1.5 rounded-md text-xs font-mono text-[var(--text-muted)]">
                yeetcoder.com/practice
              </div>
            </div>

            {/* App Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr_1fr] gap-px bg-gray-200 min-h-[400px]">
              {/* Left Panel - Question */}
              <div className="bg-white p-5 hidden lg:block">
                <div className="flex items-center gap-2 font-mono text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-4">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  System Design Challenge
                </div>
                <div className="bg-[var(--bg-section)] rounded-xl p-4 mb-4">
                  <h4 className="font-semibold text-[var(--text-primary)] mb-2">Design a URL Shortener</h4>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-3">
                    Like bit.ly or TinyURL. Consider scalability, availability, and analytics.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="font-mono text-[10px] px-2 py-1 bg-white rounded-full text-[var(--text-muted)]">Distributed Systems</span>
                    <span className="font-mono text-[10px] px-2 py-1 bg-white rounded-full text-[var(--text-muted)]">Database</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 font-mono text-xl font-medium text-[var(--text-primary)]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  12:34
                </div>
              </div>

              {/* Center - Voice Interface */}
              <div className="bg-gradient-to-b from-warm-card-purple to-white flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="relative w-24 h-24 mx-auto mb-4">
                    <div className="absolute inset-0 rounded-full bg-accent-purple opacity-30 animate-voice-pulse" />
                    <div className="absolute inset-0 rounded-full bg-white shadow-lg flex items-center justify-center">
                      <svg className="w-10 h-10 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-accent-purple mb-4">Listening...</p>
                  <p className="text-sm text-[var(--text-secondary)] italic max-w-[280px] mx-auto leading-relaxed">
                    "For the URL shortener, I'd start by clarifying the requirements. We need to handle reads and writes, probably with a read-heavy ratio..."
                  </p>
                </div>
              </div>

              {/* Right Panel - AI Feedback */}
              <div className="bg-white p-5 hidden lg:block">
                <div className="flex items-center gap-2 font-mono text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-4">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Live AI Analysis
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Requirements gathering', done: true },
                    { label: 'Scale estimation', done: true },
                    { label: 'High-level design...', done: false },
                    { label: 'Deep dive pending', done: false },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                      <span className={`w-2 h-2 rounded-full ${item.done ? 'bg-green-500' : 'bg-amber-400 animate-pulse'}`} />
                      {item.label} {item.done && '✓'}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 max-w-[1280px] mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-tight text-[var(--text-primary)] mb-4">
            Everything You Need to Succeed
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-[600px] mx-auto">
            Built by engineers who've been through the interview grind. We know what it takes to pass.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`${getAccentBg(feature.accent)} p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer`}
            >
              <div className="w-12 h-12 bg-white/60 rounded-xl flex items-center justify-center mb-4 text-[var(--text-primary)]">
                {feature.icon}
              </div>
              <h3 className="text-xl font-medium text-[var(--text-primary)] mb-2">{feature.title}</h3>
              <p className="text-[var(--text-secondary)] leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-6 max-w-[1280px] mx-auto">
        <div className="bg-[var(--bg-section)] rounded-3xl p-8 md:p-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '10,000+', label: 'Engineers trained' },
              { value: '94%', label: 'Interview success rate' },
              { value: '500K+', label: 'Practice sessions' },
              { value: '4.9/5', label: 'User rating' },
            ].map((stat, i) => (
              <div key={i}>
                <p className="text-[clamp(2rem,4vw,3rem)] font-semibold text-[var(--text-primary)] mb-1">{stat.value}</p>
                <p className="font-mono text-sm uppercase tracking-wider text-[var(--text-muted)]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Practice Topics */}
      <section className="py-20 px-6 max-w-[1280px] mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-tight text-[var(--text-primary)] mb-4">
            Real Interview Questions
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-[600px] mx-auto">
            Practice the same questions asked at top tech companies
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {sampleQuestions.map((question, index) => (
            <div
              key={index}
              className="bg-white p-5 rounded-xl border border-transparent hover:border-[var(--text-primary)] transition-all cursor-pointer flex items-center justify-between group"
            >
              <div>
                <p className="font-medium text-[var(--text-primary)] mb-1">{question.name}</p>
                <p className="font-mono text-xs text-[var(--text-muted)]">{question.company}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-mono text-[10px] px-2.5 py-1 rounded-full uppercase ${getDifficultyColor(question.difficulty)}`}>
                  {question.difficulty}
                </span>
                <svg className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 max-w-[1280px] mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-tight text-[var(--text-primary)] mb-4">
            Success Stories
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-white p-8 rounded-2xl shadow-sm">
              <p className="text-[var(--text-primary)] italic leading-relaxed mb-6">"{testimonial.quote}"</p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-warm-card-purple flex items-center justify-center text-accent-purple font-semibold">
                  {testimonial.initials}
                </div>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{testimonial.name}</p>
                  <p className="text-sm text-[var(--text-muted)]">{testimonial.role} · {testimonial.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 max-w-[1280px] mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-tight text-[var(--text-primary)] mb-4">
            Simple Pricing
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-[600px] mx-auto">
            Everything you need to ace your interviews. One plan. One price.
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-[var(--text-primary)]">
            <div className="text-center mb-6">
              <span className="text-6xl font-semibold text-[var(--text-primary)]">$10</span>
              <span className="text-[var(--text-muted)] text-xl">/month</span>
            </div>
            <ul className="space-y-4 mb-8">
              {[
                'Realistic interview practice',
                'Unlimited sessions',
                'Instant, actionable feedback',
                'Real life system design problems'
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-[var(--text-secondary)]">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={handlePracticeNow}
              className="w-full btn-landing-primary py-4 text-base"
            >
              Get Started
            </button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-6 max-w-[1280px] mx-auto">
        <div className="bg-[var(--bg-section)] rounded-3xl p-8 md:p-12">
          <div className="text-center mb-8">
            <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-tight text-[var(--text-primary)] mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-[var(--text-secondary)]">
              Everything you need to know about practicing with AI
            </p>
          </div>

          <div className="max-w-3xl mx-auto divide-y divide-gray-200">
            {faqs.map((faq, i) => (
              <div key={i} className="py-5">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <span className="font-medium text-[var(--text-primary)] pr-8">{faq.q}</span>
                  <svg
                    className={`w-5 h-5 text-[var(--text-muted)] flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === i && (
                  <p className="mt-4 text-[var(--text-secondary)] leading-relaxed pr-12">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 max-w-[1280px] mx-auto">
        <div className="bg-gradient-cta rounded-3xl p-12 text-center">
          <svg className="w-8 h-8 text-[var(--text-primary)] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-tight text-[var(--text-primary)] mb-4">
            Ready to Ace Your Interview?
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-[500px] mx-auto mb-8">
            Join 10,000+ engineers who've transformed their interview skills. Start practicing for free today.
          </p>
          <button
            onClick={handlePracticeNow}
            disabled={isLoading}
            className="btn-landing-primary px-8 py-4 text-base"
          >
            {isLoading ? 'Loading...' : 'Start Practicing Free'}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <p className="font-mono text-sm text-[var(--text-muted)] mt-4">
            No credit card required • 14-day free trial
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-200">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-lg font-semibold text-[var(--text-primary)]">YeetCoder</span>
          <div className="flex items-center gap-8">
            {['Features', 'Pricing', 'FAQ', 'Privacy', 'Terms'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                {item}
              </a>
            ))}
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            © {new Date().getFullYear()} YeetCoder. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
