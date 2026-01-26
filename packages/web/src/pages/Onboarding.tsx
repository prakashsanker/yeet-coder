import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api, ApiError, type Topic, type Question } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { isAdmin } from '../lib/admin'
import AppHeader from '../components/common/AppHeader'
import PaywallModal from '../components/common/PaywallModal'
import { analytics } from '../lib/posthog'

type InterviewType = 'leetcode' | 'system_design' | null
type Step = 'type' | 'topic' | 'question' | 'confirm'

interface LocationState {
  selectedQuestion?: Question
}

export default function Onboarding() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isLoading: authLoading } = useAuth()

  const locationState = location.state as LocationState | null
  const preSelectedQuestion = locationState?.selectedQuestion

  const [interviewType, setInterviewType] = useState<InterviewType>(() => {
    if (preSelectedQuestion) {
      return preSelectedQuestion.type === 'system_design' ? 'system_design' : 'leetcode'
    }
    return null
  })
  const [topics, setTopics] = useState<Topic[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(preSelectedQuestion || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPaywall, setShowPaywall] = useState(false)
  const [existingInterview, setExistingInterview] = useState<{
    id: string
    session_type: 'coding' | 'system_design'
  } | null>(null)

  const userIsAdmin = isAdmin(user)

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/')
    }
  }, [user, authLoading, navigate])

  // Auto-select system_design for non-admin users
  useEffect(() => {
    if (!authLoading && user && !userIsAdmin && !preSelectedQuestion && !interviewType) {
      setInterviewType('system_design')
      analytics.interviewTypeSelected('system_design')
    }
  }, [authLoading, user, userIsAdmin, preSelectedQuestion, interviewType])

  // Load topics when LeetCode is selected
  useEffect(() => {
    if (interviewType === 'leetcode') {
      setLoading(true)
      setError(null)
      api.topics.list()
        .then(({ topics }) => {
          const codingTopics = topics.filter(t => t.type !== 'system_design')
          setTopics(codingTopics)
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [interviewType])

  useEffect(() => {
    if (interviewType === 'system_design') {
      setLoading(true)
      setError(null)
      api.questions.list({ type: 'system_design' })
        .then(({ questions }) => setQuestions(questions))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [interviewType])

  useEffect(() => {
    if (selectedTopic) {
      setLoading(true)
      setError(null)
      api.questions.list({ type: 'coding', topic_id: selectedTopic.id })
        .then(({ questions }) => setQuestions(questions))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [selectedTopic])

  const getCurrentStep = (): Step => {
    // Non-admin users skip the type selection (system_design is auto-selected)
    if (!interviewType) return userIsAdmin ? 'type' : 'question'
    // Skip topic selection if question is already pre-selected
    if (interviewType === 'leetcode' && !selectedTopic && !selectedQuestion) return 'topic'
    if (!selectedQuestion) return 'question'
    return 'confirm'
  }

  const handleBack = () => {
    const step = getCurrentStep()
    if (step === 'confirm') {
      if (preSelectedQuestion) {
        navigate('/dashboard')
        return
      }
      setSelectedQuestion(null)
    } else if (step === 'question') {
      if (interviewType === 'leetcode') {
        setSelectedTopic(null)
        setQuestions([])
      } else {
        // Non-admin users go back to dashboard from question selection
        // since they skip the type selection step
        if (!userIsAdmin) {
          navigate('/dashboard')
          return
        }
        setInterviewType(null)
        setQuestions([])
      }
    } else if (step === 'topic') {
      setInterviewType(null)
      setTopics([])
    } else {
      navigate('/dashboard')
    }
  }

  const [isStarting, setIsStarting] = useState(false)

  const handleStartPractice = async () => {
    if (!selectedQuestion) return

    setIsStarting(true)
    setError(null)

    analytics.interviewStartClicked(selectedQuestion.id, interviewType || 'leetcode')

    try {
      const { interview } = await api.interviews.create({
        question_id: selectedQuestion.id,
        language: interviewType === 'leetcode' ? 'python' : undefined,
      })

      analytics.interviewCreated(interview.id, interview.session_type)

      if (interview.session_type === 'system_design') {
        navigate(`/system-design/${interview.id}`)
      } else {
        navigate(`/interview/${interview.id}`)
      }
    } catch (err) {
      console.error('Failed to create interview:', err)

      if (err instanceof ApiError && err.code === 'free_tier_limit') {
        analytics.freeTierLimitHit()
        const existingInterviewData = err.data?.existingInterview as {
          id: string
          session_type: 'coding' | 'system_design'
        } | undefined

        setExistingInterview(existingInterviewData || null)
        setShowPaywall(true)
        setIsStarting(false)
        return
      }

      setError(err instanceof Error ? err.message : 'Failed to start interview')
      setIsStarting(false)
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'difficulty-easy'
      case 'medium': return 'difficulty-medium'
      case 'hard': return 'difficulty-hard'
      default: return 'badge-neutral'
    }
  }

  const step = getCurrentStep()

  if (authLoading) {
    return (
      <div className="app-page flex items-center justify-center">
        <div className="spinner w-8 h-8"></div>
      </div>
    )
  }

  return (
    <div className="app-page">
      <AppHeader showBack onBack={handleBack}>
        {/* Progress indicator */}
        <div className="flex items-center gap-2">
          {userIsAdmin && (
            <>
              <div className={`w-2 h-2 rounded-full transition-colors ${step === 'type' ? 'bg-[var(--text-primary)]' : 'bg-[rgba(0,0,0,0.15)]'}`} />
              <div className={`w-2 h-2 rounded-full transition-colors ${step === 'topic' || (interviewType === 'system_design' && step === 'question') ? 'bg-[var(--text-primary)]' : 'bg-[rgba(0,0,0,0.15)]'}`} />
            </>
          )}
          <div className={`w-2 h-2 rounded-full transition-colors ${step === 'question' ? 'bg-[var(--text-primary)]' : 'bg-[rgba(0,0,0,0.15)]'}`} />
          <div className={`w-2 h-2 rounded-full transition-colors ${step === 'confirm' ? 'bg-[var(--text-primary)]' : 'bg-[rgba(0,0,0,0.15)]'}`} />
        </div>
      </AppHeader>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Step: Choose Interview Type (admin only) */}
        {step === 'type' && userIsAdmin && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-semibold text-[var(--text-primary)] tracking-tight mb-3">What do you want to practice?</h1>
              <p className="text-[var(--text-muted)]">Choose your interview type to get started</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {/* LeetCode */}
              <button
                onClick={() => {
                  setInterviewType('leetcode')
                  analytics.interviewTypeSelected('leetcode')
                }}
                className="text-left p-6 card card-hover border-2 border-[rgba(0,0,0,0.08)] hover:border-[var(--accent-blue)] group"
              >
                <div className="w-14 h-14 bg-[#E3F2FD] rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#BBDEFB] transition-colors">
                  <svg className="w-7 h-7 text-[var(--accent-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">LeetCode Practice</h3>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed">Solve coding problems while explaining your thought process to an AI interviewer</p>
              </button>

              {/* System Design */}
              <button
                onClick={() => {
                  setInterviewType('system_design')
                  analytics.interviewTypeSelected('system_design')
                }}
                className="text-left p-6 card card-hover border-2 border-[rgba(0,0,0,0.08)] hover:border-[var(--accent-purple)] group"
              >
                <div className="w-14 h-14 bg-[#F3E5F5] rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#E1BEE7] transition-colors">
                  <svg className="w-7 h-7 text-[var(--accent-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">System Design</h3>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed">Design scalable systems and discuss architecture decisions with AI feedback</p>
              </button>
            </div>
          </div>
        )}

        {/* Step: Choose Topic (LeetCode only) */}
        {step === 'topic' && interviewType === 'leetcode' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight mb-2">Select a Topic</h1>
              <p className="text-[var(--text-muted)]">Choose a topic to practice</p>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="spinner w-8 h-8"></div>
              </div>
            )}

            {error && (
              <div className="text-center py-12">
                <p className="text-[#C62828]">{error}</p>
              </div>
            )}

            {!loading && !error && (
              <div className="grid gap-2">
                {topics.map((topic, index) => (
                  <button
                    key={topic.id}
                    onClick={() => {
                      setSelectedTopic(topic)
                      analytics.topicSelected(topic.id, topic.name)
                    }}
                    className="w-full text-left p-4 card card-hover border border-[rgba(0,0,0,0.08)] hover:border-[var(--accent-blue)] group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[var(--bg-section)] rounded-lg flex items-center justify-center text-[var(--text-muted)] text-sm font-medium group-hover:bg-[#E3F2FD] group-hover:text-[var(--accent-blue)] transition-colors">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-[var(--text-primary)] font-medium">{topic.name}</h3>
                        {topic.description && (
                          <p className="text-[var(--text-muted)] text-sm mt-0.5">{topic.description}</p>
                        )}
                      </div>
                      <svg className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent-blue)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: Choose Question */}
        {step === 'question' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight mb-2">
                {interviewType === 'leetcode' ? selectedTopic?.name : 'System Design Questions'}
              </h1>
              <p className="text-[var(--text-muted)]">Choose a problem to practice</p>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="spinner w-8 h-8"></div>
              </div>
            )}

            {error && (
              <div className="text-center py-12">
                <p className="text-[#C62828]">{error}</p>
              </div>
            )}

            {!loading && !error && questions.length === 0 && (
              <div className="text-center py-12 card">
                <p className="text-[var(--text-muted)]">No questions available for this topic yet.</p>
              </div>
            )}

            {!loading && !error && questions.length > 0 && (
              <div className="grid gap-2">
                {questions.map((question) => (
                  <button
                    key={question.id}
                    onClick={() => {
                      setSelectedQuestion(question)
                      analytics.questionSelected(question.id, question.title, question.difficulty)
                    }}
                    className="w-full text-left p-4 card card-hover border border-[rgba(0,0,0,0.08)] hover:border-[var(--accent-purple)] group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {question.leetcode_number && (
                            <span className="text-[var(--text-muted)] text-sm">#{question.leetcode_number}</span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getDifficultyColor(question.difficulty)}`}>
                            {question.difficulty}
                          </span>
                          {question.source && (
                            <span className="text-[var(--text-muted)] text-xs">{question.source}</span>
                          )}
                        </div>
                        <h3 className="text-[var(--text-primary)] font-medium">{question.title}</h3>
                      </div>
                      <svg className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent-purple)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: Confirm & Start */}
        {step === 'confirm' && selectedQuestion && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight mb-2">Ready to Start</h1>
              <p className="text-[var(--text-muted)]">Review your selection and begin your interview</p>
            </div>

            {/* Selected question card */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-3">
                {selectedQuestion.leetcode_number && (
                  <span className="text-[var(--text-muted)] text-sm">#{selectedQuestion.leetcode_number}</span>
                )}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getDifficultyColor(selectedQuestion.difficulty)}`}>
                  {selectedQuestion.difficulty}
                </span>
                {selectedQuestion.source && (
                  <span className="text-[var(--text-muted)] text-xs">{selectedQuestion.source}</span>
                )}
              </div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">{selectedQuestion.title}</h2>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed line-clamp-3">{selectedQuestion.description}</p>
            </div>

            {/* How it works */}
            <div className="card p-6">
              <h3 className="text-[var(--text-primary)] font-semibold mb-4">How it works</h3>
              <ul className="space-y-3">
                {interviewType === 'leetcode' ? (
                  <>
                    <li className="flex items-start gap-3 text-[var(--text-secondary)] text-sm">
                      <span className="w-6 h-6 bg-[#E3F2FD] text-[var(--accent-blue)] rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold">1</span>
                      <span>You'll see the full problem and can start coding</span>
                    </li>
                    <li className="flex items-start gap-3 text-[var(--text-secondary)] text-sm">
                      <span className="w-6 h-6 bg-[#E3F2FD] text-[var(--accent-blue)] rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold">2</span>
                      <span>Explain your approach out loud as you code</span>
                    </li>
                    <li className="flex items-start gap-3 text-[var(--text-secondary)] text-sm">
                      <span className="w-6 h-6 bg-[#E3F2FD] text-[var(--accent-blue)] rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold">3</span>
                      <span>The AI interviewer will ask clarifying questions</span>
                    </li>
                    <li className="flex items-start gap-3 text-[var(--text-secondary)] text-sm">
                      <span className="w-6 h-6 bg-[#E3F2FD] text-[var(--accent-blue)] rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold">4</span>
                      <span>Get instant feedback when you're done</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start gap-3 text-[var(--text-secondary)] text-sm">
                      <span className="w-6 h-6 bg-[#F3E5F5] text-[var(--accent-purple)] rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold">1</span>
                      <span>Discuss the system design problem with an AI interviewer</span>
                    </li>
                    <li className="flex items-start gap-3 text-[var(--text-secondary)] text-sm">
                      <span className="w-6 h-6 bg-[#F3E5F5] text-[var(--accent-purple)] rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold">2</span>
                      <span>Start by clarifying requirements and constraints</span>
                    </li>
                    <li className="flex items-start gap-3 text-[var(--text-secondary)] text-sm">
                      <span className="w-6 h-6 bg-[#F3E5F5] text-[var(--accent-purple)] rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold">3</span>
                      <span>Walk through your high-level design and component choices</span>
                    </li>
                    <li className="flex items-start gap-3 text-[var(--text-secondary)] text-sm">
                      <span className="w-6 h-6 bg-[#F3E5F5] text-[var(--accent-purple)] rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold">4</span>
                      <span>Get detailed feedback on your design decisions</span>
                    </li>
                  </>
                )}
              </ul>
            </div>

            {/* Start button */}
            <button
              onClick={handleStartPractice}
              disabled={isStarting}
              className="w-full py-4 btn-primary text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStarting ? (
                <>
                  <div className="spinner w-5 h-5 border-white border-t-transparent"></div>
                  Creating Interview...
                </>
              ) : (
                <>
                  Start Interview
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </div>
        )}
      </main>

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        existingInterview={existingInterview}
      />
    </div>
  )
}
