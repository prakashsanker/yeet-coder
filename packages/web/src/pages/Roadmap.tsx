import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/common/AppHeader'
import { api, type Topic, type Question, type Evaluation, type InterviewSession } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { isAdmin } from '../lib/admin'

interface TopicWithProgress extends Topic {
  questions: Question[]
  completedCount: number
  totalCount: number
}

interface EvaluationWithInterview extends Evaluation {
  interview: InterviewSession
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

const SYSTEM_DESIGN_ROADMAP = [
  ['system-design'],
]

export default function Roadmap() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const userIsAdmin = isAdmin(user)
  const [topics, setTopics] = useState<TopicWithProgress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // Non-admin users default to system_design (coding tab is hidden for them)
  const [activeType, setActiveType] = useState<'coding' | 'system_design'>(userIsAdmin ? 'coding' : 'system_design')
  const [selectedTopic, setSelectedTopic] = useState<TopicWithProgress | null>(null)
  const [evaluations, setEvaluations] = useState<EvaluationWithInterview[]>([])

  // Ensure non-admin users can't access coding tab
  // This handles race conditions where user loads after initial render
  useEffect(() => {
    if (user && !userIsAdmin && activeType === 'coding') {
      setActiveType('system_design')
    }
  }, [user, userIsAdmin, activeType])

  // Load topics and questions
  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        // Fetch all topics
        const { topics: allTopics } = await api.topics.list()

        // Fetch all questions
        const { questions: codingQuestions } = await api.questions.list({ type: 'coding', limit: 200 })
        const { questions: systemDesignQuestions } = await api.questions.list({ type: 'system_design', limit: 50 })
        const allQuestions = [...codingQuestions, ...systemDesignQuestions]

        // Fetch user's evaluations for progress tracking
        let userEvaluations: EvaluationWithInterview[] = []
        if (user) {
          const { evaluations } = await api.evaluations.list({ limit: 100 })
          userEvaluations = evaluations
          setEvaluations(evaluations)
        }

        // Create a set of completed question IDs (score >= 70 is "passed")
        const completedQuestionIds = new Set(
          userEvaluations
            .filter(e => e.overall_score && e.overall_score >= 70 && e.interview?.question_id)
            .map(e => e.interview.question_id)
        )

        // Group questions by topic
        const questionsByTopic: Record<string, Question[]> = {}
        allQuestions.forEach(q => {
          if (q.topic_id) {
            if (!questionsByTopic[q.topic_id]) {
              questionsByTopic[q.topic_id] = []
            }
            questionsByTopic[q.topic_id].push(q)
          }
        })

        // Build topics with progress
        const topicsWithProgress: TopicWithProgress[] = allTopics.map(topic => {
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
        setIsLoading(false)
      }
    }

    loadData()
  }, [user])

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

  const handleTopicClick = (topic: TopicWithProgress) => {
    setSelectedTopic(topic)
  }

  const handleStartPractice = (question: Question) => {
    navigate('/onboarding', { state: { selectedQuestion: question } })
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

  const roadmapRows = activeType === 'coding' ? CODING_ROADMAP_ORDER : SYSTEM_DESIGN_ROADMAP

  if (isLoading) {
    return (
      <div className="min-h-screen bg-lc-bg-dark">
        <AppHeader />
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange mx-auto mb-4"></div>
            <p className="text-lc-text-muted">Loading roadmap...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-lc-bg-dark">
      <AppHeader />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-lc-text-primary mb-2">
            {userIsAdmin ? 'Interview Roadmap' : 'System Design Roadmap'}
          </h1>
          <p className="text-lc-text-secondary">
            {userIsAdmin
              ? 'Follow this structured path to master coding and system design interviews'
              : 'Follow this structured path to master system design interviews'
            }
          </p>
        </div>

        {/* Type Tabs */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {userIsAdmin && (
            <button
              onClick={() => {
                setActiveType('coding')
                setSelectedTopic(null)
              }}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                activeType === 'coding'
                  ? 'bg-brand-orange text-white'
                  : 'bg-lc-bg-layer-1 text-lc-text-secondary hover:bg-lc-bg-layer-2'
              }`}
            >
              Coding (NeetCode 150)
            </button>
          )}
          <button
            onClick={() => {
              setActiveType('system_design')
              setSelectedTopic(null)
            }}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              activeType === 'system_design'
                ? 'bg-brand-orange text-white'
                : 'bg-lc-bg-layer-1 text-lc-text-secondary hover:bg-lc-bg-layer-2'
            }`}
          >
            System Design
          </button>
        </div>

        {/* Progress Overview */}
        {user && (
          <div className="bg-lc-bg-layer-1 rounded-lg border border-lc-border p-4 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-lc-text-muted text-sm">Overall Progress</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold text-lc-text-primary">
                    {topics
                      .filter(t => activeType === 'coding' ? t.type === 'coding' : t.type === 'system_design')
                      .reduce((sum, t) => sum + t.completedCount, 0)}
                  </span>
                  <span className="text-lc-text-muted">/</span>
                  <span className="text-lc-text-secondary">
                    {topics
                      .filter(t => activeType === 'coding' ? t.type === 'coding' : t.type === 'system_design')
                      .reduce((sum, t) => sum + t.totalCount, 0)} problems
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-lc-green"></div>
                  <span className="text-lc-text-muted">Complete</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-brand-orange"></div>
                  <span className="text-lc-text-muted">In Progress</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-lc-bg-layer-3"></div>
                  <span className="text-lc-text-muted">Not Started</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-6">
          {/* Roadmap Grid */}
          <div className="flex-1">
            <div className="space-y-4">
              {roadmapRows.map((row, rowIndex) => (
                <div key={rowIndex} className="flex items-center justify-center gap-4">
                  {row.map((slug) => {
                    const topic = getTopicBySlug(slug)
                    if (!topic) return null

                    const isSelected = selectedTopic?.id === topic.id

                    return (
                      <button
                        key={topic.id}
                        onClick={() => handleTopicClick(topic)}
                        className={`relative group min-w-[160px] p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                          isSelected
                            ? 'border-brand-orange bg-brand-orange/10'
                            : `${getBorderColor(topic.completedCount, topic.totalCount)} bg-lc-bg-layer-1 hover:bg-lc-bg-layer-2`
                        }`}
                      >
                        {/* Progress indicator */}
                        {topic.totalCount > 0 && (
                          <div className="absolute -top-2 -right-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
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
                          <h3 className="font-medium text-lc-text-primary text-sm mb-1">
                            {topic.name}
                          </h3>
                          <p className="text-xs text-lc-text-muted">
                            {topic.totalCount > 0
                              ? `${topic.completedCount}/${topic.totalCount} done`
                              : 'No questions yet'
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
          </div>

          {/* Question Panel */}
          {selectedTopic && (
            <div className="w-96 bg-lc-bg-layer-1 rounded-lg border border-lc-border p-4 h-fit sticky top-4">
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
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {selectedTopic.questions
                    .sort((a, b) => {
                      // Sort by difficulty: easy, medium, hard
                      const order = { easy: 1, medium: 2, hard: 3 }
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

        {/* Empty state when no topic selected */}
        {!selectedTopic && (
          <div className="text-center py-8 text-lc-text-muted">
            Click on a topic to see its questions
          </div>
        )}
      </div>
    </div>
  )
}
