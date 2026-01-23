import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api, type Topic, type Question } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import AppHeader from '../components/common/AppHeader'

type InterviewType = 'leetcode' | 'system_design' | null
type Step = 'type' | 'topic' | 'question' | 'confirm'

interface LocationState {
  selectedQuestion?: Question
}

export default function Onboarding() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isLoading: authLoading } = useAuth()

  // Check if a question was pre-selected from Dashboard
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

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/')
    }
  }, [user, authLoading, navigate])

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

  // Load system design questions directly
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

  // Load questions when topic is selected (for LeetCode)
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
    if (!interviewType) return 'type'
    if (interviewType === 'leetcode' && !selectedTopic) return 'topic'
    if (!selectedQuestion) return 'question'
    return 'confirm'
  }

  const handleBack = () => {
    const step = getCurrentStep()
    if (step === 'confirm') {
      // If came from dashboard with pre-selected question, go back to dashboard
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

    try {
      // Create interview session first
      const { interview } = await api.interviews.create({
        question_id: selectedQuestion.id,
        language: interviewType === 'leetcode' ? 'python' : undefined,
      })

      // Navigate to the correct interview page based on session type
      if (interview.session_type === 'system_design') {
        navigate(`/system-design/${interview.id}`)
      } else {
        navigate(`/interview/${interview.id}`)
      }
    } catch (err) {
      console.error('Failed to create interview:', err)
      setError(err instanceof Error ? err.message : 'Failed to start interview')
      setIsStarting(false)
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-lc-green bg-lc-green/10'
      case 'medium': return 'text-lc-yellow bg-lc-yellow/10'
      case 'hard': return 'text-lc-red bg-lc-red/10'
      default: return 'text-lc-text-muted bg-lc-bg-layer-2'
    }
  }

  const step = getCurrentStep()

  if (authLoading) {
    return (
      <div className="min-h-screen bg-lc-bg-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-lc-bg-dark">
      {/* Header */}
      <AppHeader showBack onBack={handleBack}>
        {/* Progress indicator */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${step === 'type' ? 'bg-brand-orange' : 'bg-lc-text-muted/30'}`} />
          <div className={`w-2 h-2 rounded-full ${step === 'topic' || (interviewType === 'system_design' && step === 'question') ? 'bg-brand-orange' : 'bg-lc-text-muted/30'}`} />
          <div className={`w-2 h-2 rounded-full ${step === 'question' || step === 'confirm' ? 'bg-brand-orange' : 'bg-lc-text-muted/30'}`} />
          <div className={`w-2 h-2 rounded-full ${step === 'confirm' ? 'bg-brand-orange' : 'bg-lc-text-muted/30'}`} />
        </div>
      </AppHeader>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Step: Choose Interview Type */}
        {step === 'type' && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-lc-text-primary mb-2">What do you want to practice?</h1>
              <p className="text-lc-text-muted">Choose your interview type to get started</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {/* LeetCode */}
              <button
                onClick={() => setInterviewType('leetcode')}
                className="text-left p-6 bg-lc-bg-layer-1 hover:bg-lc-bg-layer-2 rounded-xl transition-all border-2 border-transparent hover:border-brand-orange/50 group"
              >
                <div className="w-14 h-14 bg-brand-orange/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-brand-orange/20 transition-colors">
                  <svg className="w-7 h-7 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-lc-text-primary mb-2">LeetCode Practice</h3>
                <p className="text-lc-text-muted text-sm">Solve coding problems while explaining your thought process to an AI interviewer</p>
              </button>

              {/* System Design */}
              <button
                onClick={() => setInterviewType('system_design')}
                className="text-left p-6 bg-lc-bg-layer-1 hover:bg-lc-bg-layer-2 rounded-xl transition-all border-2 border-transparent hover:border-lc-teal/50 group"
              >
                <div className="w-14 h-14 bg-lc-teal/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-lc-teal/20 transition-colors">
                  <svg className="w-7 h-7 text-lc-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-lc-text-primary mb-2">System Design</h3>
                <p className="text-lc-text-muted text-sm">Design scalable systems and discuss architecture decisions with AI feedback</p>
              </button>
            </div>
          </div>
        )}

        {/* Step: Choose Topic (LeetCode only) */}
        {step === 'topic' && interviewType === 'leetcode' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-lc-text-primary mb-2">Select a Topic</h1>
              <p className="text-lc-text-muted">Choose a topic to practice</p>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange"></div>
              </div>
            )}

            {error && (
              <div className="text-center py-12">
                <p className="text-lc-red">{error}</p>
              </div>
            )}

            {!loading && !error && (
              <div className="grid gap-2">
                {topics.map((topic, index) => (
                  <button
                    key={topic.id}
                    onClick={() => setSelectedTopic(topic)}
                    className="w-full text-left p-4 bg-lc-bg-layer-1 hover:bg-lc-bg-layer-2 rounded-lg transition-all border border-transparent hover:border-brand-orange/30 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-lc-bg-layer-2 rounded-lg flex items-center justify-center text-lc-text-muted text-sm font-medium group-hover:bg-brand-orange/10 group-hover:text-brand-orange transition-colors">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lc-text-primary font-medium">{topic.name}</h3>
                        {topic.description && (
                          <p className="text-lc-text-muted text-sm mt-0.5">{topic.description}</p>
                        )}
                      </div>
                      <svg className="w-5 h-5 text-lc-text-muted group-hover:text-brand-orange transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <h1 className="text-2xl font-bold text-lc-text-primary mb-2">
                {interviewType === 'leetcode' ? selectedTopic?.name : 'System Design Questions'}
              </h1>
              <p className="text-lc-text-muted">Choose a problem to practice</p>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange"></div>
              </div>
            )}

            {error && (
              <div className="text-center py-12">
                <p className="text-lc-red">{error}</p>
              </div>
            )}

            {!loading && !error && questions.length === 0 && (
              <div className="text-center py-12">
                <p className="text-lc-text-muted">No questions available for this topic yet.</p>
              </div>
            )}

            {!loading && !error && questions.length > 0 && (
              <div className="grid gap-2">
                {questions.map((question) => (
                  <button
                    key={question.id}
                    onClick={() => setSelectedQuestion(question)}
                    className="w-full text-left p-4 bg-lc-bg-layer-1 hover:bg-lc-bg-layer-2 rounded-lg transition-all border border-transparent hover:border-brand-orange/30 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {question.leetcode_number && (
                            <span className="text-lc-text-muted text-sm">#{question.leetcode_number}</span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getDifficultyColor(question.difficulty)}`}>
                            {question.difficulty}
                          </span>
                          {question.source && (
                            <span className="text-lc-text-muted text-xs">{question.source}</span>
                          )}
                        </div>
                        <h3 className="text-lc-text-primary font-medium">{question.title}</h3>
                      </div>
                      <svg className="w-5 h-5 text-lc-text-muted group-hover:text-brand-orange transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <h1 className="text-2xl font-bold text-lc-text-primary mb-2">Ready to Start</h1>
              <p className="text-lc-text-muted">Review your selection and begin your interview</p>
            </div>

            {/* Selected question card */}
            <div className="bg-lc-bg-layer-1 rounded-xl p-6 border border-lc-border">
              <div className="flex items-center gap-2 mb-3">
                {selectedQuestion.leetcode_number && (
                  <span className="text-lc-text-muted text-sm">#{selectedQuestion.leetcode_number}</span>
                )}
                <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getDifficultyColor(selectedQuestion.difficulty)}`}>
                  {selectedQuestion.difficulty}
                </span>
                {selectedQuestion.source && (
                  <span className="text-lc-text-muted text-xs">{selectedQuestion.source}</span>
                )}
              </div>
              <h2 className="text-xl font-semibold text-lc-text-primary mb-3">{selectedQuestion.title}</h2>
              <p className="text-lc-text-secondary text-sm line-clamp-3">{selectedQuestion.description}</p>
            </div>

            {/* How it works */}
            <div className="bg-lc-bg-layer-1 rounded-xl p-6 border border-lc-border">
              <h3 className="text-lc-text-primary font-semibold mb-4">How it works</h3>
              <ul className="space-y-3">
                {interviewType === 'leetcode' ? (
                  <>
                    <li className="flex items-start gap-3 text-lc-text-muted text-sm">
                      <span className="w-6 h-6 bg-brand-orange/10 text-brand-orange rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">1</span>
                      <span>You'll see the full problem and can start coding</span>
                    </li>
                    <li className="flex items-start gap-3 text-lc-text-muted text-sm">
                      <span className="w-6 h-6 bg-brand-orange/10 text-brand-orange rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">2</span>
                      <span>Explain your approach out loud as you code</span>
                    </li>
                    <li className="flex items-start gap-3 text-lc-text-muted text-sm">
                      <span className="w-6 h-6 bg-brand-orange/10 text-brand-orange rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">3</span>
                      <span>The AI interviewer will ask clarifying questions</span>
                    </li>
                    <li className="flex items-start gap-3 text-lc-text-muted text-sm">
                      <span className="w-6 h-6 bg-brand-orange/10 text-brand-orange rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">4</span>
                      <span>Get instant feedback when you're done</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start gap-3 text-lc-text-muted text-sm">
                      <span className="w-6 h-6 bg-lc-teal/10 text-lc-teal rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">1</span>
                      <span>Discuss the system design problem with an AI interviewer</span>
                    </li>
                    <li className="flex items-start gap-3 text-lc-text-muted text-sm">
                      <span className="w-6 h-6 bg-lc-teal/10 text-lc-teal rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">2</span>
                      <span>Start by clarifying requirements and constraints</span>
                    </li>
                    <li className="flex items-start gap-3 text-lc-text-muted text-sm">
                      <span className="w-6 h-6 bg-lc-teal/10 text-lc-teal rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">3</span>
                      <span>Walk through your high-level design and component choices</span>
                    </li>
                    <li className="flex items-start gap-3 text-lc-text-muted text-sm">
                      <span className="w-6 h-6 bg-lc-teal/10 text-lc-teal rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">4</span>
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
              className="w-full py-4 bg-lc-green hover:bg-lc-green-dark text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStarting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
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
    </div>
  )
}
