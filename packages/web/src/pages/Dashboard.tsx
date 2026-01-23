import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AppHeader from '../components/common/AppHeader'
import PaywallModal from '../components/common/PaywallModal'
import { api, ApiError, type Question, type Evaluation, type InterviewSession, type Topic } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

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
  // Row 1 - Fundamentals
  ['arrays-hashing', 'two-pointers', 'sliding-window', 'stack'],
  // Row 2 - Core Patterns
  ['binary-search', 'linked-list', 'trees', 'tries'],
  // Row 3 - Graph & DP
  ['heap-priority-queue', 'backtracking', 'graphs', 'advanced-graphs'],
  // Row 4 - Advanced
  ['1d-dp', '2d-dp', 'greedy', 'intervals'],
  // Row 5 - Math & Bit
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

  // Roadmap state
  const [topics, setTopics] = useState<TopicWithProgress[]>([])
  const [selectedTopic, setSelectedTopic] = useState<TopicWithProgress | null>(null)
  const [isLoadingRoadmap, setIsLoadingRoadmap] = useState(true)
  const hasLoadedRoadmapRef = useRef(false)
  const [isStartingInterview, setIsStartingInterview] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [existingInterviewForPaywall, setExistingInterviewForPaywall] = useState<{
    id: string
    session_type: 'coding' | 'system_design'
  } | null>(null)

  // Handle upgrade success query param
  useEffect(() => {
    if (searchParams.get('upgraded') === 'true') {
      setShowUpgradeSuccess(true)
      // Clear the query param
      setSearchParams({}, { replace: true })
      // Hide the toast after 5 seconds
      setTimeout(() => setShowUpgradeSuccess(false), 5000)
    }
  }, [searchParams, setSearchParams])

  // Load subscription status
  useEffect(() => {
    async function loadSubscription() {
      if (!user) {
        setSubscription(null)
        return
      }

      try {
        const { subscription } = await api.subscription.getStatus()
        setSubscription(subscription)
      } catch (err) {
        console.error('Failed to load subscription:', err)
      }
    }

    loadSubscription()
  }, [user])

  // Load questions based on active tab
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

  // Load user's past evaluations
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

  // Load roadmap data (topics and questions)
  useEffect(() => {
    async function loadRoadmapData() {
      // Only show loading spinner on initial load, not on subsequent updates
      if (!hasLoadedRoadmapRef.current) {
        setIsLoadingRoadmap(true)
      }
      try {
        // Fetch all topics
        const { topics: allTopics } = await api.topics.list()

        // Fetch coding questions
        const { questions: codingQuestions } = await api.questions.list({ type: 'coding', limit: 200 })

        // Create a set of completed question IDs (score >= 70 is "passed")
        const completedQuestionIds = new Set(
          evaluations
            .filter(e => e.overall_score && e.overall_score >= 70 && e.interview?.question_id)
            .map(e => e.interview.question_id)
        )

        // Group questions by topic
        const questionsByTopic: Record<string, Question[]> = {}
        codingQuestions.forEach(q => {
          if (q.topic_id) {
            if (!questionsByTopic[q.topic_id]) {
              questionsByTopic[q.topic_id] = []
            }
            questionsByTopic[q.topic_id].push(q)
          }
        })

        // Build topics with progress
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
    // Navigate to onboarding with pre-selected question (for system design)
    navigate('/onboarding', { state: { selectedQuestion: question } })
  }

  // Start interview directly (for NeetCode questions)
  const handleStartInterviewDirectly = async (question: Question) => {
    setIsStartingInterview(true)
    try {
      const { interview } = await api.interviews.create({
        question_id: question.id,
        language: 'python',
      })

      // Navigate to the interview page
      navigate(`/interview/${interview.id}`)
    } catch (err) {
      console.error('Failed to create interview:', err)

      // Check if this is a free tier limit error
      if (err instanceof ApiError && err.code === 'free_tier_limit') {
        const existingInterviewData = err.data?.existingInterview as {
          id: string
          session_type: 'coding' | 'system_design'
        } | undefined

        setExistingInterviewForPaywall(existingInterviewData || null)
        setShowPaywall(true)
      }
    } finally {
      setIsStartingInterview(false)
    }
  }

  const getTopicBySlug = (slug: string) => {
    return topics.find(t => t.slug === slug)
  }

  const getProgressColor = (completed: number, total: number) => {
    if (total === 0) return 'bg-lc-bg-layer-3'
    const ratio = completed / total
    if (ratio === 1) return 'bg-lc-green'
    if (ratio >= 0.5) return 'bg-lc-yellow'
    if (ratio > 0) return 'bg-brand-orange'
    return 'bg-lc-bg-layer-3'
  }

  const getBorderColor = (completed: number, total: number) => {
    if (total === 0) return 'border-lc-border'
    const ratio = completed / total
    if (ratio === 1) return 'border-lc-green'
    if (ratio >= 0.5) return 'border-lc-yellow'
    if (ratio > 0) return 'border-brand-orange'
    return 'border-lc-border'
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
        return 'text-lc-green'
      case 'medium':
        return 'text-lc-yellow'
      case 'hard':
        return 'text-lc-red'
      default:
        return 'text-lc-text-muted'
    }
  }

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-lc-text-muted'
    if (score >= 70) return 'text-lc-green'
    if (score >= 50) return 'text-lc-yellow'
    return 'text-lc-red'
  }

  const handleResumeInterview = () => {
    if (!subscription?.existingInterview) return

    const path = subscription.existingInterview.session_type === 'system_design'
      ? `/system-design/${subscription.existingInterview.id}`
      : `/interview/${subscription.existingInterview.id}`

    navigate(path)
  }

  return (
    <div className="min-h-screen bg-lc-bg-dark">
      <AppHeader />

      {/* Upgrade success toast */}
      {showUpgradeSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-lc-green text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Welcome to Pro! You now have unlimited interviews.</span>
          <button
            onClick={() => setShowUpgradeSuccess(false)}
            className="ml-2 text-white/80 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Tier Badge */}
        {user && subscription && (
          <div className="mb-4 flex justify-end">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              subscription.tier === 'pro'
                ? 'bg-lc-green/20 text-lc-green'
                : 'bg-lc-bg-layer-2 text-lc-text-muted'
            }`}>
              {subscription.tier === 'pro' ? 'Pro' : 'Free'}
            </span>
          </div>
        )}

        {/* Resume Interview Card (for free users with existing interview) */}
        {subscription?.tier === 'free' && subscription.existingInterview && (
          <div className="mb-6 bg-brand-orange/10 border border-brand-orange/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-orange/20 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-lc-text-primary font-medium">You have an interview in progress</p>
                  <p className="text-lc-text-muted text-sm">Resume where you left off</p>
                </div>
              </div>
              <button
                onClick={handleResumeInterview}
                className="px-4 py-2 bg-brand-orange hover:bg-brand-orange/80 text-white font-medium rounded-lg transition-colors"
              >
                Resume Interview
              </button>
            </div>
          </div>
        )}

        {/* Main CTA */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-lc-text-primary mb-4">
            Practice Interview Questions
          </h1>
          <p className="text-lc-text-secondary mb-6">
            Master system design and coding interviews with AI-powered feedback
          </p>
          <button
            onClick={() => navigate('/onboarding')}
            className="px-6 py-3 bg-lc-green hover:bg-lc-green-dark text-white font-medium rounded-lg transition-colors"
          >
            Start New Interview
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-lc-border">
          <button
            onClick={() => setActiveTab('neetcode')}
            className={`px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'neetcode'
                ? 'text-lc-text-primary'
                : 'text-lc-text-muted hover:text-lc-text-secondary'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>NeetCode 150</span>
            </span>
            {activeTab === 'neetcode' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-orange" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('system_design')}
            className={`px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'system_design'
                ? 'text-lc-text-primary'
                : 'text-lc-text-muted hover:text-lc-text-secondary'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>System Design</span>
            </span>
            {activeTab === 'system_design' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-orange" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'history'
                ? 'text-lc-text-primary'
                : 'text-lc-text-muted hover:text-lc-text-secondary'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>Past Submissions</span>
              {evaluations.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-lc-bg-layer-2 rounded">
                  {evaluations.length}
                </span>
              )}
            </span>
            {activeTab === 'history' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-orange" />
            )}
          </button>
        </div>

        {/* Tab description */}
        {activeTab === 'system_design' && (
          <p className="text-lc-text-muted text-sm mb-6">
            Resources to prepare for system design interviews. Practice designing scalable systems.
          </p>
        )}
        {activeTab === 'neetcode' && (
          <p className="text-lc-text-muted text-sm mb-6">
            The NeetCode 150 - a curated list of the most important LeetCode problems.
          </p>
        )}
        {activeTab === 'history' && (
          <p className="text-lc-text-muted text-sm mb-6">
            Your past interview submissions and evaluations.
          </p>
        )}

        {/* Content */}
        {activeTab === 'history' ? (
          // Past Submissions
          <div>
            {isLoadingHistory ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange mx-auto mb-4"></div>
                <p className="text-lc-text-muted">Loading history...</p>
              </div>
            ) : !user ? (
              <div className="text-center py-12 bg-lc-bg-layer-1 rounded-lg border border-lc-border">
                <p className="text-lc-text-muted mb-4">Sign in to view your past submissions</p>
              </div>
            ) : evaluations.length === 0 ? (
              <div className="text-center py-12 bg-lc-bg-layer-1 rounded-lg border border-lc-border">
                <p className="text-lc-text-muted mb-4">No submissions yet</p>
                <button
                  onClick={() => navigate('/onboarding')}
                  className="px-4 py-2 bg-lc-green hover:bg-lc-green-dark text-white text-sm rounded-lg transition-colors"
                >
                  Start Your First Interview
                </button>
              </div>
            ) : (
              <div className="bg-lc-bg-layer-1 rounded-lg border border-lc-border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-lc-border">
                      <th className="px-4 py-3 text-left text-sm font-medium text-lc-text-muted">Problem</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-lc-text-muted">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-lc-text-muted">Score</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-lc-text-muted">Time</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-lc-text-muted">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluations.map((evaluation) => (
                      <tr
                        key={evaluation.id}
                        onClick={() => handleViewEvaluation(evaluation.id)}
                        className="border-b border-lc-border last:border-b-0 hover:bg-lc-bg-layer-2 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="text-lc-text-primary">
                            {evaluation.interview?.question?.title || 'Unknown Question'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            evaluation.interview?.session_type === 'system_design'
                              ? 'bg-purple-600/20 text-purple-400'
                              : 'bg-lc-teal/20 text-lc-teal'
                          }`}>
                            {evaluation.interview?.session_type === 'system_design' ? 'System Design' : 'Coding'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-medium ${getScoreColor(evaluation.overall_score)}`}>
                            {evaluation.overall_score ? `${evaluation.overall_score}/100` : 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-lc-text-muted">
                            {formatTime(evaluation.interview?.time_spent_seconds)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-lc-text-muted">
                            {formatDate(evaluation.created_at)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'neetcode' ? (
          // NeetCode 150 Roadmap
          <div>
            {isLoadingRoadmap ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange mx-auto mb-4"></div>
                <p className="text-lc-text-muted">Loading roadmap...</p>
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
                              className={`relative group min-w-[140px] p-3 rounded-xl border-2 transition-all hover:scale-105 ${
                                isSelected
                                  ? 'border-brand-orange bg-brand-orange/10'
                                  : `${getBorderColor(topic.completedCount, topic.totalCount)} bg-lc-bg-layer-1 hover:bg-lc-bg-layer-2`
                              }`}
                            >
                              {/* Progress indicator */}
                              {topic.totalCount > 0 && (
                                <div className="absolute -top-2 -right-2">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                    topic.completedCount === topic.totalCount
                                      ? 'bg-lc-green text-white'
                                      : topic.completedCount > 0
                                      ? 'bg-brand-orange text-white'
                                      : 'bg-lc-bg-layer-3 text-lc-text-muted'
                                  }`}>
                                    {topic.completedCount === topic.totalCount ? '✓' : topic.completedCount}
                                  </div>
                                </div>
                              )}

                              <div className="text-center">
                                <h3 className="font-medium text-lc-text-primary text-xs mb-1">
                                  {topic.name}
                                </h3>
                                <p className="text-xs text-lc-text-muted">
                                  {topic.totalCount > 0
                                    ? `${topic.completedCount}/${topic.totalCount}`
                                    : 'No questions'
                                  }
                                </p>

                                {/* Progress bar */}
                                {topic.totalCount > 0 && (
                                  <div className="mt-2 h-1 bg-lc-bg-layer-3 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${getProgressColor(topic.completedCount, topic.totalCount)}`}
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

                  {/* Empty state when no topic selected */}
                  {!selectedTopic && (
                    <div className="text-center py-8 text-lc-text-muted">
                      Click on a topic to see its questions
                    </div>
                  )}
                </div>

                {/* Question Panel */}
                {selectedTopic && (
                  <div className="w-80 bg-lc-bg-layer-1 rounded-lg border border-lc-border p-4 h-fit sticky top-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-lc-text-primary">
                        {selectedTopic.name}
                      </h2>
                      <button
                        onClick={() => setSelectedTopic(null)}
                        className="text-lc-text-muted hover:text-lc-text-primary"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {selectedTopic.description && (
                      <p className="text-sm text-lc-text-muted mb-4">
                        {selectedTopic.description}
                      </p>
                    )}

                    <div className="text-sm text-lc-text-muted mb-3">
                      {selectedTopic.completedCount}/{selectedTopic.totalCount} completed
                    </div>

                    {selectedTopic.questions.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-lc-text-muted">No questions available yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                        {selectedTopic.questions
                          .sort((a, b) => {
                            // Sort by difficulty: easy, medium, hard
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
                                    ? 'border-lc-green/30 bg-lc-green/5 hover:bg-lc-green/10'
                                    : 'border-lc-border bg-lc-bg-layer-2 hover:bg-lc-bg-layer-3'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {completed && (
                                    <svg className="w-4 h-4 text-lc-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                  <span className={`text-sm ${completed ? 'text-lc-text-secondary' : 'text-lc-text-primary'}`}>
                                    {question.leetcode_number && (
                                      <span className="text-lc-text-muted mr-1">{question.leetcode_number}.</span>
                                    )}
                                    {question.title}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <span className={`text-xs capitalize ${getDifficultyColor(question.difficulty)}`}>
                                    {question.difficulty}
                                  </span>
                                  {score !== undefined && (
                                    <span className={`text-xs ${score >= 70 ? 'text-lc-green' : score >= 50 ? 'text-lc-yellow' : 'text-lc-red'}`}>
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange mx-auto mb-4"></div>
                <p className="text-lc-text-muted">Loading questions...</p>
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-12 bg-lc-bg-layer-1 rounded-lg border border-lc-border">
                <p className="text-lc-text-muted">No questions available</p>
              </div>
            ) : (
              <div className="bg-lc-bg-layer-1 rounded-lg border border-lc-border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-lc-border">
                      <th className="px-4 py-3 text-left text-sm font-medium text-lc-text-muted">Problem</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-lc-text-muted">Difficulty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((question) => (
                      <tr
                        key={question.id}
                        onClick={() => handleStartPractice(question)}
                        className="border-b border-lc-border last:border-b-0 hover:bg-lc-bg-layer-2 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="text-lc-text-primary">{question.title}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium capitalize ${getDifficultyColor(question.difficulty)}`}>
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

      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        existingInterview={existingInterviewForPaywall}
      />
    </div>
  )
}
