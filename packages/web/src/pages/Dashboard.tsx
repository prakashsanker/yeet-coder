import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AppHeader from '../components/common/AppHeader'
import PaywallModal from '../components/common/PaywallModal'
import { api, type Question, type Evaluation, type InterviewSession, type Topic } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { analytics } from '../lib/posthog'

type Tab = 'neetcode' | 'system_design' | 'history'

interface EvaluationWithInterview extends Evaluation {
  interview: InterviewSession
}

interface TopicWithProgress extends Topic {
  questions: Question[]
  completedCount: number
  totalCount: number
}

interface SubscriptionStatus {
  tier: 'free' | 'pro'
  interviewsUsed: number
  interviewsAllowed: number | 'unlimited'
  existingInterview: {
    id: string
    question_id: string
    session_type: 'coding' | 'system_design'
    status: string
  } | null
}

// Define the roadmap structure with topic groups
const CODING_ROADMAP_ORDER = [
  ['arrays-hashing', 'two-pointers', 'sliding-window', 'stack'],
  ['binary-search', 'linked-list', 'trees', 'tries'],
  ['heap-priority-queue', 'backtracking', 'graphs', 'advanced-graphs'],
  ['1d-dp', '2d-dp', 'greedy', 'intervals'],
  ['math-geometry', 'bit-manipulation'],
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('neetcode')
  const [questions, setQuestions] = useState<Question[]>([])
  const [evaluations, setEvaluations] = useState<EvaluationWithInterview[]>([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false)

  const [topics, setTopics] = useState<TopicWithProgress[]>([])
  const [selectedTopic, setSelectedTopic] = useState<TopicWithProgress | null>(null)
  const [isLoadingRoadmap, setIsLoadingRoadmap] = useState(true)
  const hasLoadedRoadmapRef = useRef(false)
  const [showPaywall, setShowPaywall] = useState(false)

  useEffect(() => {
    if (searchParams.get('upgraded') === 'true') {
      analytics.upgradeSuccessful()
      setShowUpgradeSuccess(true)
      setSearchParams({}, { replace: true })
      setTimeout(() => setShowUpgradeSuccess(false), 5000)
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    async function loadSubscription() {
      if (!user) {
        setSubscription(null)
        return
      }
      try {
        const { subscription } = await api.subscription.getStatus()
        setSubscription(subscription)
        analytics.dashboardViewed(subscription.tier)
      } catch (err) {
        console.error('Failed to load subscription:', err)
      }
    }
    loadSubscription()
  }, [user])

  useEffect(() => {
    async function loadQuestions() {
      setIsLoadingQuestions(true)
      try {
        const type = activeTab === 'system_design' ? 'system_design' : 'coding'
        const { questions } = await api.questions.list({ type, limit: 50 })
        setQuestions(questions)
      } catch (err) {
        console.error('Failed to load questions:', err)
      } finally {
        setIsLoadingQuestions(false)
      }
    }
    if (activeTab !== 'history') {
      loadQuestions()
    }
  }, [activeTab])

  useEffect(() => {
    async function loadHistory() {
      if (!user) {
        setEvaluations([])
        setIsLoadingHistory(false)
        return
      }
      setIsLoadingHistory(true)
      try {
        const { evaluations } = await api.evaluations.list({ limit: 100 })
        setEvaluations(evaluations)
      } catch (err) {
        console.error('Failed to load history:', err)
      } finally {
        setIsLoadingHistory(false)
      }
    }
    loadHistory()
  }, [user])

  useEffect(() => {
    async function loadRoadmapData() {
      if (!hasLoadedRoadmapRef.current) {
        setIsLoadingRoadmap(true)
      }
      try {
        const { topics: allTopics } = await api.topics.list()
        const { questions: codingQuestions } = await api.questions.list({ type: 'coding', limit: 200 })

        const completedQuestionIds = new Set(
          evaluations
            .filter(e => e.overall_score && e.overall_score >= 70 && e.interview?.question_id)
            .map(e => e.interview.question_id)
        )

        const questionsByTopic: Record<string, Question[]> = {}
        codingQuestions.forEach(q => {
          if (q.topic_id) {
            if (!questionsByTopic[q.topic_id]) {
              questionsByTopic[q.topic_id] = []
            }
            questionsByTopic[q.topic_id].push(q)
          }
        })

        const topicsWithProgress: TopicWithProgress[] = allTopics
          .filter(topic => topic.type !== 'system_design')
          .map(topic => {
            const topicQuestions = questionsByTopic[topic.id] || []
            const completedCount = topicQuestions.filter(q => completedQuestionIds.has(q.id)).length
            return {
              ...topic,
              questions: topicQuestions,
              completedCount,
              totalCount: topicQuestions.length,
            }
          })

        setTopics(topicsWithProgress)
      } catch (err) {
        console.error('Failed to load roadmap data:', err)
      } finally {
        hasLoadedRoadmapRef.current = true
        setIsLoadingRoadmap(false)
      }
    }
    if (activeTab === 'neetcode') {
      loadRoadmapData()
    }
  }, [activeTab, evaluations])

  const handleStartPractice = (question: Question) => {
    navigate('/onboarding', { state: { selectedQuestion: question } })
  }

  const getTopicBySlug = (slug: string) => {
    return topics.find(t => t.slug === slug)
  }

  const getBorderColor = (completed: number, total: number) => {
    if (total === 0) return 'border-[rgba(0,0,0,0.1)]'
    const ratio = completed / total
    if (ratio === 1) return 'border-[#81C784]'
    if (ratio >= 0.5) return 'border-[var(--accent-orange)]'
    if (ratio > 0) return 'border-[var(--accent-purple)]'
    return 'border-[rgba(0,0,0,0.1)]'
  }

  const isQuestionCompleted = (questionId: string) => {
    return evaluations.some(
      e => e.interview?.question_id === questionId && e.overall_score && e.overall_score >= 70
    )
  }

  const getQuestionScore = (questionId: string) => {
    const evaluation = evaluations.find(e => e.interview?.question_id === questionId)
    return evaluation?.overall_score
  }

  const handleViewEvaluation = (evaluationId: string) => {
    navigate(`/evaluation/${evaluationId}`)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTime = (seconds?: number) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    return `${mins} min`
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'difficulty-easy'
      case 'medium':
        return 'difficulty-medium'
      case 'hard':
        return 'difficulty-hard'
      default:
        return 'badge-neutral'
    }
  }

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-[var(--text-muted)]'
    if (score >= 70) return 'score-success'
    if (score >= 50) return 'score-warning'
    return 'score-error'
  }

  const handleResumeInterview = () => {
    if (!subscription?.existingInterview) return
    const path = subscription.existingInterview.session_type === 'system_design'
      ? `/system-design/${subscription.existingInterview.id}`
      : `/interview/${subscription.existingInterview.id}`
    navigate(path)
  }

  return (
    <div className="app-page">
      <AppHeader />

      {/* Upgrade success toast */}
      {showUpgradeSuccess && (
        <div className="fixed top-20 right-4 z-50 bg-[#2E7D32] text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">Welcome to Pro! You now have unlimited interviews.</span>
          <button onClick={() => setShowUpgradeSuccess(false)} className="ml-2 text-white/80 hover:text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header with tier badge */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--text-primary)] tracking-tight">
              Practice Interview Questions
            </h1>
            <p className="text-[var(--text-secondary)] mt-1">
              Master system design and coding interviews with AI-powered feedback
            </p>
          </div>
          <div className="flex items-center gap-4">
            {subscription && (
              <span className={`badge ${
                subscription.tier === 'pro'
                  ? 'badge-purple'
                  : 'badge-neutral'
              }`}>
                {subscription.tier === 'pro' ? 'Pro' : 'Free'}
              </span>
            )}
            <button
              onClick={() => navigate('/onboarding')}
              className="btn-primary"
            >
              Start New Interview
            </button>
          </div>
        </div>

        {/* Resume Interview Card */}
        {subscription?.tier === 'free' && subscription.existingInterview && (
          <div className="mb-6 card p-4 border-[var(--accent-orange)] bg-[#FFF8E1]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FFE082] rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#F57C00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[var(--text-primary)] font-medium">You have an interview in progress</p>
                  <p className="text-[var(--text-secondary)] text-sm">Resume where you left off</p>
                </div>
              </div>
              <button
                onClick={handleResumeInterview}
                className="btn-primary bg-[#F57C00] hover:bg-[#EF6C00]"
              >
                Resume Interview
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-[rgba(0,0,0,0.1)]">
          {[
            { id: 'neetcode' as Tab, label: 'NeetCode 150' },
            { id: 'system_design' as Tab, label: 'System Design' },
            { id: 'history' as Tab, label: 'Past Submissions', badge: evaluations.length > 0 ? evaluations.length : undefined },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
            >
              <span className="flex items-center gap-2">
                {tab.label}
                {tab.badge && (
                  <span className="badge badge-neutral">
                    {tab.badge}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Tab description */}
        <p className="text-[var(--text-muted)] text-sm mb-6">
          {activeTab === 'system_design' && 'Resources to prepare for system design interviews. Practice designing scalable systems.'}
          {activeTab === 'neetcode' && 'The NeetCode 150 - a curated list of the most important LeetCode problems.'}
          {activeTab === 'history' && 'Your past interview submissions and evaluations.'}
        </p>

        {/* Content */}
        {activeTab === 'history' ? (
          <div>
            {isLoadingHistory ? (
              <div className="text-center py-12">
                <div className="spinner w-8 h-8 mx-auto mb-4"></div>
                <p className="text-[var(--text-muted)]">Loading history...</p>
              </div>
            ) : !user ? (
              <div className="text-center py-12 card p-8">
                <p className="text-[var(--text-muted)] mb-4">Sign in to view your past submissions</p>
              </div>
            ) : evaluations.length === 0 ? (
              <div className="text-center py-12 card p-8">
                <div className="w-12 h-12 bg-[var(--bg-section)] rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-[var(--text-muted)] mb-4">No submissions yet</p>
                <button
                  onClick={() => navigate('/onboarding')}
                  className="btn-primary"
                >
                  Start Your First Interview
                </button>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[rgba(0,0,0,0.08)] bg-[var(--bg-section)]">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Problem</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Score</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(0,0,0,0.06)]">
                    {evaluations.map((evaluation) => (
                      <tr
                        key={evaluation.id}
                        onClick={() => handleViewEvaluation(evaluation.id)}
                        className="hover:bg-[var(--bg-section)] cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="text-[var(--text-primary)] font-medium">
                            {evaluation.interview?.question?.title || 'Unknown Question'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge ${
                            evaluation.interview?.session_type === 'system_design'
                              ? 'badge-purple'
                              : 'badge-info'
                          }`}>
                            {evaluation.interview?.session_type === 'system_design' ? 'System Design' : 'Coding'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${getScoreColor(evaluation.overall_score)}`}>
                            {evaluation.overall_score ? `${evaluation.overall_score}/100` : 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-muted)] text-sm">
                          {formatTime(evaluation.interview?.time_spent_seconds)}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-muted)] text-sm">
                          {formatDate(evaluation.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'neetcode' ? (
          <div>
            {isLoadingRoadmap ? (
              <div className="text-center py-12">
                <div className="spinner w-8 h-8 mx-auto mb-4"></div>
                <p className="text-[var(--text-muted)]">Loading roadmap...</p>
              </div>
            ) : (
              <div className="flex gap-6">
                {/* Roadmap Grid */}
                <div className="flex-1">
                  <div className="space-y-4">
                    {CODING_ROADMAP_ORDER.map((row, rowIndex) => (
                      <div key={rowIndex} className="flex items-center justify-center gap-4 flex-wrap">
                        {row.map((slug) => {
                          const topic = getTopicBySlug(slug)
                          if (!topic) return null
                          const isSelected = selectedTopic?.id === topic.id

                          return (
                            <button
                              key={topic.id}
                              onClick={() => setSelectedTopic(isSelected ? null : topic)}
                              className={`relative group min-w-[140px] p-4 rounded-xl border-2 transition-all hover:scale-105 hover:shadow-md ${
                                isSelected
                                  ? 'border-[var(--accent-purple)] bg-[#F3E5F5] shadow-md'
                                  : `${getBorderColor(topic.completedCount, topic.totalCount)} bg-white hover:border-[var(--text-muted)]`
                              }`}
                            >
                              {topic.totalCount > 0 && (
                                <div className="absolute -top-2 -right-2">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${
                                    topic.completedCount === topic.totalCount
                                      ? 'bg-[#4CAF50] text-white'
                                      : topic.completedCount > 0
                                      ? 'bg-[var(--accent-purple)] text-white'
                                      : 'bg-[var(--bg-section)] text-[var(--text-muted)]'
                                  }`}>
                                    {topic.completedCount === topic.totalCount ? '✓' : topic.completedCount}
                                  </div>
                                </div>
                              )}

                              <div className="text-center">
                                <h3 className="font-medium text-[var(--text-primary)] text-sm mb-1">
                                  {topic.name}
                                </h3>
                                <p className="text-xs text-[var(--text-muted)]">
                                  {topic.totalCount > 0 ? `${topic.completedCount}/${topic.totalCount}` : 'No questions'}
                                </p>
                                {topic.totalCount > 0 && (
                                  <div className="progress-bar mt-2">
                                    <div
                                      className={`progress-bar-fill ${topic.completedCount === topic.totalCount ? 'progress-bar-fill-success' : 'progress-bar-fill-purple'}`}
                                      style={{ width: `${(topic.completedCount / topic.totalCount) * 100}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>

                  {!selectedTopic && (
                    <div className="text-center py-8 text-[var(--text-muted)]">
                      Click on a topic to see its questions
                    </div>
                  )}
                </div>

                {/* Question Panel */}
                {selectedTopic && (
                  <div className="w-80 card p-4 h-fit sticky top-20">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                        {selectedTopic.name}
                      </h2>
                      <button
                        onClick={() => setSelectedTopic(null)}
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {selectedTopic.description && (
                      <p className="text-sm text-[var(--text-muted)] mb-4">{selectedTopic.description}</p>
                    )}

                    <div className="text-sm text-[var(--text-muted)] mb-3">
                      {selectedTopic.completedCount}/{selectedTopic.totalCount} completed
                    </div>

                    {selectedTopic.questions.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-[var(--text-muted)]">No questions available yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                        {selectedTopic.questions
                          .sort((a, b) => {
                            const order: Record<string, number> = { easy: 1, medium: 2, hard: 3 }
                            return (order[a.difficulty] || 0) - (order[b.difficulty] || 0)
                          })
                          .map((question) => {
                            const completed = isQuestionCompleted(question.id)
                            const score = getQuestionScore(question.id)

                            return (
                              <button
                                key={question.id}
                                onClick={() => handleStartPractice(question)}
                                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                  completed
                                    ? 'border-[#C8E6C9] bg-[#E8F5E9] hover:bg-[#C8E6C9]'
                                    : 'border-[rgba(0,0,0,0.08)] bg-[var(--bg-section)] hover:bg-[rgba(0,0,0,0.04)]'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {completed && (
                                    <svg className="w-4 h-4 text-[#4CAF50] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                  <span className={`text-sm ${completed ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
                                    {question.leetcode_number && (
                                      <span className="text-[var(--text-muted)] mr-1">{question.leetcode_number}.</span>
                                    )}
                                    {question.title}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between mt-1.5">
                                  <span className={`badge ${getDifficultyColor(question.difficulty)}`}>
                                    {question.difficulty}
                                  </span>
                                  {score !== undefined && (
                                    <span className={`text-xs font-medium ${score >= 70 ? 'score-success' : score >= 50 ? 'score-warning' : 'score-error'}`}>
                                      {score}/100
                                    </span>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          // System Design Questions List
          <div>
            {isLoadingQuestions ? (
              <div className="text-center py-12">
                <div className="spinner w-8 h-8 mx-auto mb-4"></div>
                <p className="text-[var(--text-muted)]">Loading questions...</p>
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-12 card p-8">
                <p className="text-[var(--text-muted)]">No questions available</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[rgba(0,0,0,0.08)] bg-[var(--bg-section)]">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Problem</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Difficulty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(0,0,0,0.06)]">
                    {questions.map((question) => (
                      <tr
                        key={question.id}
                        onClick={() => handleStartPractice(question)}
                        className="hover:bg-[var(--bg-section)] cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-4">
                          <span className="text-[var(--text-primary)] font-medium">{question.title}</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className={`badge ${getDifficultyColor(question.difficulty)}`}>
                            {question.difficulty}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        existingInterview={null}
      />
    </div>
  )
}
