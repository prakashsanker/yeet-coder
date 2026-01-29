import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AppHeader from '../components/common/AppHeader'
import PaywallModal from '../components/common/PaywallModal'
import { api, type Question, type Evaluation, type InterviewSession, type Topic } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { isAdmin } from '../lib/admin'
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

// Free tier only gets Pattern 1 (Hashing & ID Generation)
const FREE_PATTERN = 1

interface RoadmapQuestion {
  order: number
  id: string
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  companies: string[]
}

interface RoadmapPattern {
  pattern: number
  name: string
  description: string
  key_concepts: string[]
  questions: RoadmapQuestion[]
}

// System Design Pattern-based roadmap
const SYSTEM_DESIGN_ROADMAP: RoadmapPattern[] = [
  {
    pattern: 1,
    name: "Hashing & ID Generation",
    description: "Consistent hashing, unique ID generation (UUID, snowflake), encoding",
    key_concepts: ["Base62 encoding", "hash collisions", "KGS", "distributed ID generation"],
    questions: [
      { order: 1, id: "36f1d095-750b-459d-b620-a1655ed4e17b", title: "Design a URL Shortening service like TinyURL", difficulty: "easy", companies: ["Microsoft", "Amazon", "Bloomberg", "Uber"] },
      { order: 2, id: "340bc748-5ad4-4d6f-aa28-b15722593fc8", title: "Design Pastebin", difficulty: "easy", companies: ["Meta", "Google", "Amazon"] }
    ]
  },
  {
    pattern: 2,
    name: "Key-Value Stores & Caching",
    description: "In-memory caching, distributed hash tables, cache invalidation, TTL",
    key_concepts: ["Consistent hashing", "replication", "CAP theorem", "LRU eviction"],
    questions: [
      { order: 3, id: "5dd239b1-6f0c-4c82-885e-752803b05d8c", title: "Design a Key-Value Store", difficulty: "medium", companies: ["Amazon", "Google", "Meta", "Netflix"] }
    ]
  },
  {
    pattern: 3,
    name: "Message Queues & Async",
    description: "Producer-consumer, at-least-once delivery, dead letter queues",
    key_concepts: ["Idempotency keys", "dead letter queues", "priority queues", "backpressure"],
    questions: [
      { order: 4, id: "05a7b638-b267-4088-af54-78c4cd95e989", title: "Design a Job Scheduler", difficulty: "easy", companies: ["Uber", "LinkedIn", "Airbnb", "Stripe"] },
      { order: 5, id: "05fee718-fa2f-4f25-a93c-5a22bae2b549", title: "Design an On-Call Escalation System", difficulty: "medium", companies: ["PagerDuty", "Opsgenie", "Google"] },
      { order: 6, id: "07e63b98-cb39-487a-b3af-f04112d8acd3", title: "Design a Notification Service at Scale", difficulty: "hard", companies: ["Meta", "Apple", "Google", "Amazon"] },
      { order: 7, id: "eb3604e3-a0e3-41ba-a3c4-612f83cbb0ca", title: "Design a Distributed Queue like RabbitMQ", difficulty: "hard", companies: ["Amazon", "Google", "Confluent"] }
    ]
  },
  {
    pattern: 4,
    name: "Rate Limiting & Throttling",
    description: "Token bucket, sliding window, distributed rate limiting",
    key_concepts: ["Token bucket", "leaky bucket", "sliding window", "Redis + Lua"],
    questions: [
      { order: 8, id: "337ef0fb-0da1-45b0-acbc-63812e1e5e64", title: "Design an API Rate Limiter", difficulty: "hard", companies: ["Cloudflare", "Amazon", "Google", "Stripe"] },
      { order: 9, id: "5c0b6c58-b6d1-4f68-8ba8-985a65189fdf", title: "Netflix: Limit the Number of Screens Each User Can Watch", difficulty: "hard", companies: ["Netflix", "Spotify", "Disney+"] }
    ]
  },
  {
    pattern: 5,
    name: "Real-time & Pub/Sub",
    description: "WebSockets, long polling, Server-Sent Events, presence",
    key_concepts: ["WebSocket management", "heartbeats", "presence channels", "delivery receipts"],
    questions: [
      { order: 10, id: "7dc1f5fb-2bb9-438c-8ca2-386474c5e132", title: "Design a Feature to Show the Number of Users Viewing a Page", difficulty: "easy", companies: ["Meta", "LinkedIn", "Airbnb"] },
      { order: 11, id: "705c790f-84ae-48fc-bce1-b2baa6bcb481", title: "Design Facebook Likes Feature with Live Updates", difficulty: "easy", companies: ["Meta", "Instagram", "TikTok"] },
      { order: 12, id: "f6f1a359-e388-42a4-8226-e82decd94761", title: "Design Facebook Messenger or WhatsApp", difficulty: "medium", companies: ["Meta", "Slack", "Discord"] },
      { order: 13, id: "907e0938-2181-4f00-bbe9-e92fc9295c86", title: "Design a Live Comments Feature for Facebook", difficulty: "hard", companies: ["Meta", "YouTube", "Twitch"] }
    ]
  },
  {
    pattern: 6,
    name: "Fan-out & Feed Generation",
    description: "Push vs pull model, timeline generation, ranking",
    key_concepts: ["Fan-out on write", "fan-out on read", "hybrid for celebrities", "ranking"],
    questions: [
      { order: 14, id: "299e1d17-ee6f-46e2-a828-c583850cd74f", title: "Design Twitter for millions of users", difficulty: "easy", companies: ["Twitter/X", "Meta", "LinkedIn"] },
      { order: 15, id: "12238f38-f776-4629-8e44-c0b131d9e2c5", title: "Design Instagram", difficulty: "easy", companies: ["Meta", "Pinterest", "Snap"] },
      { order: 16, id: "a19e0d2f-89e3-485a-96c0-36ee3a6f82a1", title: "Design Facebook's News Feed", difficulty: "medium", companies: ["Meta", "LinkedIn", "Twitter"] },
      { order: 17, id: "c4f0619b-9076-4e51-a93f-336c5f310643", title: "Develop an Ads Management and Display System", difficulty: "hard", companies: ["Meta", "Google", "Amazon"] }
    ]
  },
  {
    pattern: 7,
    name: "Counting & Aggregation",
    description: "Approximate counting, HyperLogLog, Count-Min Sketch",
    key_concepts: ["HyperLogLog", "Count-Min Sketch", "sliding windows", "materialized views"],
    questions: [
      { order: 18, id: "609291b9-16e6-408a-a6a4-d91cd9003a24", title: "Count Facebook Likes for High-Profile Users", difficulty: "medium", companies: ["Meta", "Twitter", "TikTok"] },
      { order: 19, id: "d6c7a40f-d331-4483-a5b3-352b0ed211ff", title: "Top K Elements: App Store Rankings", difficulty: "easy", companies: ["Amazon", "Apple", "Google"] },
      { order: 20, id: "c73a28b8-7457-40c1-b882-e3ab72893b24", title: "K Most Shared Articles in Time Windows", difficulty: "hard", companies: ["Meta", "Twitter", "Reddit"] }
    ]
  },
  {
    pattern: 8,
    name: "Time-Series & Metrics",
    description: "Time-series databases, downsampling, rollups",
    key_concepts: ["LSM trees", "downsampling", "retention policies", "push vs pull"],
    questions: [
      { order: 21, id: "34383a15-054f-4e90-8d66-13057d8c129e", title: "Design a System to View Latest Stock Prices", difficulty: "easy", companies: ["Bloomberg", "Robinhood", "Yahoo"] },
      { order: 22, id: "eb8045b2-df90-4c97-864c-5b52a4c16243", title: "Design a System to Monitor Cluster Health", difficulty: "medium", companies: ["Google", "Amazon", "Microsoft"] },
      { order: 23, id: "34f08db9-7b75-4a16-923d-3ab3d17b2bfc", title: "Collect Metrics from Thousands of Servers", difficulty: "hard", companies: ["Datadog", "New Relic", "Google"] },
      { order: 24, id: "192ef3f8-a991-4d88-8ab4-f5c2c6b6e6ff", title: "Design a Distributed Metrics Logging System", difficulty: "hard", companies: ["Splunk", "Datadog", "Elastic"] },
      { order: 25, id: "de5387a7-86a4-4b16-be9f-f2ea314dc746", title: "Design Google Analytics", difficulty: "hard", companies: ["Google", "Amplitude", "Mixpanel"] }
    ]
  },
  {
    pattern: 9,
    name: "Event Streaming",
    description: "Event sourcing, CQRS, stream processing, windowing",
    key_concepts: ["Partitioning", "consumer groups", "exactly-once", "windowing"],
    questions: [
      { order: 26, id: "454cbc02-a71b-4504-871f-8aa93815ec89", title: "Design a Stream Processing System like Kafka", difficulty: "hard", companies: ["Confluent", "LinkedIn", "Uber"] },
      { order: 27, id: "33f943ce-378a-4b8e-9e4a-b6c61debb4bf", title: "Surge Pricing System: Uber", difficulty: "hard", companies: ["Uber", "Lyft", "DoorDash"] }
    ]
  },
  {
    pattern: 10,
    name: "Search & Indexing",
    description: "Inverted index, autocomplete, typeahead, ranking",
    key_concepts: ["Tries", "inverted indexes", "Elasticsearch", "BM25 ranking"],
    questions: [
      { order: 28, id: "2ca8d484-841c-40e9-9b9b-83edcf1c1126", title: "Design Typeahead Suggestion/Autocomplete", difficulty: "hard", companies: ["Google", "Amazon", "Uber"] },
      { order: 29, id: "faeca22c-c273-44c6-98cd-e408adc07498", title: "Design Web Crawler", difficulty: "medium", companies: ["Google", "Bing", "Amazon"] }
    ]
  },
  {
    pattern: 11,
    name: "Blob Storage & CDN",
    description: "Object storage, chunking, content delivery networks",
    key_concepts: ["Chunking", "delta sync", "CDN edge caching", "adaptive bitrate"],
    questions: [
      { order: 30, id: "99c2fc7a-6283-4349-bd6f-e59a8ef9b7f7", title: "Design Dropbox or Google Drive", difficulty: "medium", companies: ["Dropbox", "Google", "Microsoft"] },
      { order: 31, id: "ac14c236-f669-487c-84ec-1c17d3d9078a", title: "Design a Photo Sharing Platform", difficulty: "medium", companies: ["Google", "Meta", "Apple"] },
      { order: 32, id: "3d558854-6adf-47f0-b115-5c0f48c3a35c", title: "Design Youtube or Netflix", difficulty: "medium", companies: ["Netflix", "YouTube", "Twitch"] },
      { order: 33, id: "7168603a-e93b-4467-a72d-fa8f011bf9ba", title: "Design a File Downloader Library", difficulty: "hard", companies: ["Dropbox", "Google", "Microsoft"] },
      { order: 34, id: "1462f474-7d58-4711-8752-4ef6354fd122", title: "Design a Distributed File Transfer System", difficulty: "hard", companies: ["Dropbox", "Cloudflare", "Akamai"] }
    ]
  },
  {
    pattern: 12,
    name: "Collaborative Editing",
    description: "Operational transformation, CRDTs, version vectors",
    key_concepts: ["OT", "CRDTs", "version vectors", "presence awareness"],
    questions: [
      { order: 35, id: "b92e0d92-961e-46a2-9509-34271cb9c1e6", title: "Design a Document Management System like Google Docs", difficulty: "easy", companies: ["Google", "Notion", "Microsoft"] }
    ]
  },
  {
    pattern: 13,
    name: "Geo-Spatial & Proximity",
    description: "Geohashing, quadtrees, R-trees, proximity search",
    key_concepts: ["Geohashing", "quadtrees", "PostGIS", "Redis geospatial"],
    questions: [
      { order: 36, id: "9001db02-2ed8-4104-8eef-00f5314c8b8c", title: "Design Yelp or Nearby Friends", difficulty: "hard", companies: ["Uber", "Lyft", "DoorDash"] },
      { order: 37, id: "c4427142-e3ad-4019-8fbb-1802e7646015", title: "Design an ETA Service for Uber", difficulty: "hard", companies: ["Uber", "Lyft", "DoorDash"] }
    ]
  },
  {
    pattern: 14,
    name: "Booking & Inventory",
    description: "Distributed locking, optimistic concurrency, double-booking prevention",
    key_concepts: ["Pessimistic vs optimistic locking", "inventory reservation", "conflict resolution"],
    questions: [
      { order: 38, id: "907e6551-a485-42e8-815b-4a59341562ba", title: "Design a Hotel Booking System", difficulty: "medium", companies: ["Airbnb", "Booking.com", "Expedia"] },
      { order: 39, id: "d2fcd3a9-9dcb-480c-9767-8582a0cb0ca6", title: "Design Google Calendar", difficulty: "medium", companies: ["Google", "Microsoft", "Calendly"] },
      { order: 40, id: "8c60dd63-ff2a-469c-ae1a-140afe3c4c19", title: "Distribute 6 Million Burgers in One Hour", difficulty: "medium", companies: ["McDonald's", "Uber Eats", "DoorDash"] }
    ]
  },
  {
    pattern: 15,
    name: "Financial Transactions",
    description: "Exactly-once processing, saga pattern, two-phase commit",
    key_concepts: ["Idempotency keys", "saga pattern", "compensating transactions", "audit trails"],
    questions: [
      { order: 41, id: "22d7770d-c5e1-433b-950d-40a696fb0a35", title: "Design a Credit Card Processing System", difficulty: "hard", companies: ["Stripe", "Square", "PayPal"] },
      { order: 42, id: "3a0fddef-656b-4f5f-ae19-eea4dc7a650e", title: "Design a Wire Transfer API", difficulty: "hard", companies: ["Stripe", "Plaid", "Wise"] }
    ]
  },
  {
    pattern: 16,
    name: "Event-Driven Triggers",
    description: "Rule engines, threshold monitoring, event-condition-action",
    key_concepts: ["Rule engine", "threshold evaluation", "notification deduplication"],
    questions: [
      { order: 43, id: "70b52e66-96d9-4de8-87e2-2dce7e915189", title: "Design a Price Alert System", difficulty: "easy", companies: ["Amazon", "Robinhood", "Bloomberg"] },
      { order: 44, id: "feaf9d43-c50f-4a62-afed-c8fa01835ba8", title: "Develop a Weather Application", difficulty: "easy", companies: ["Apple", "Google", "Weather.com"] }
    ]
  },
  {
    pattern: 17,
    name: "Authentication & Sessions",
    description: "JWT, OAuth, session stores, device fingerprinting",
    key_concepts: ["JWT vs sessions", "refresh tokens", "OAuth 2.0", "MFA"],
    questions: [
      { order: 45, id: "ccf23282-6935-425a-8d0c-df065adc6670", title: "Design a User Login and Authentication System", difficulty: "medium", companies: ["Auth0", "Okta", "Google"] }
    ]
  },
  {
    pattern: 18,
    name: "Experimentation & A/B Testing",
    description: "A/B testing, gradual rollouts, statistical significance",
    key_concepts: ["Feature flags", "percentage rollouts", "user bucketing", "guardrail metrics"],
    questions: [
      { order: 46, id: "19c9d11f-820d-45b4-ae5e-05b41e65f178", title: "Design an A/B Testing System", difficulty: "hard", companies: ["Meta", "Google", "Netflix"] }
    ]
  },
  {
    pattern: 19,
    name: "Distributed Coordination",
    description: "Leader election, distributed locks, Raft/Paxos",
    key_concepts: ["Raft consensus", "leader election", "ZooKeeper/etcd", "split-brain"],
    questions: [
      { order: 47, id: "b3643f2f-6fb2-4ac2-b334-0b081d17ff7a", title: "Design a Control Plane for a Distributed Database", difficulty: "hard", companies: ["CockroachDB", "Google", "Amazon"] }
    ]
  },
  {
    pattern: 20,
    name: "Batch Processing",
    description: "MapReduce, ETL, bulk operations, checkpointing",
    key_concepts: ["External merge sort", "MapReduce", "checkpointing", "idempotent migrations"],
    questions: [
      { order: 48, id: "a92fb0a0-e5a8-4494-9d3f-ffb3dea98563", title: "Design a System for Sorting Large Data Sets", difficulty: "easy", companies: ["Google", "Amazon", "Meta"] },
      { order: 49, id: "8be31c26-10da-4ca4-9917-4a130f8dd61c", title: "Design a Large Data Migration System", difficulty: "hard", companies: ["Google", "Amazon", "Microsoft"] }
    ]
  },
  {
    pattern: 21,
    name: "E-commerce & Catalog",
    description: "Product graphs, compatibility matrices, search faceting",
    key_concepts: ["Product catalog design", "compatibility graphs", "faceted search"],
    questions: [
      { order: 50, id: "c02c892f-afec-474b-8819-a07e64f32123", title: "Build a Marketplace Feature for Facebook", difficulty: "easy", companies: ["Meta", "Amazon", "eBay"] },
      { order: 51, id: "b5a66f92-44ad-4959-b43b-81b2c5b4f298", title: "Design a Parts Compatibility Feature", difficulty: "easy", companies: ["Amazon", "eBay", "Walmart"] }
    ]
  },
  {
    pattern: 22,
    name: "Specialized Systems",
    description: "Miscellaneous advanced patterns",
    key_concepts: ["IoC containers", "dependency injection", "distributed systems security"],
    questions: [
      { order: 52, id: "2267dbbf-f1af-4ff9-9ff5-fe72420c4971", title: "Design an IoC/Dependency Injection Framework", difficulty: "hard", companies: ["Microsoft", "Google", "Spring"] },
      { order: 53, id: "b8e1b33f-8ad2-4ad6-bca5-0f3d032dec51", title: "Design a Distributed Botnet", difficulty: "hard", companies: ["Security companies", "Cloudflare"] }
    ]
  }
]

// Pattern tier groupings for System Design
const PATTERN_TIERS = [
  { name: "Start Here", emoji: "🟢", patterns: [1, 2, 3], description: "Foundational patterns everyone should master first" },
  { name: "Core Patterns", emoji: "🟡", patterns: [4, 5, 6, 7], description: "Essential patterns for most system designs" },
  { name: "Data Patterns", emoji: "🟠", patterns: [8, 9, 10], description: "Handle data at scale" },
  { name: "Storage Patterns", emoji: "🔵", patterns: [11, 12], description: "Store and serve large files" },
  { name: "Domain Patterns", emoji: "🟣", patterns: [13, 14, 15, 16, 17], description: "Industry-specific patterns" },
  { name: "Advanced", emoji: "🔴", patterns: [18, 19, 20, 21, 22], description: "Complex distributed systems" }
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const userIsAdmin = isAdmin(user)
  // Non-admin users default to system_design tab (NeetCode tab is hidden for them)
  const [activeTab, setActiveTab] = useState<Tab>(userIsAdmin ? 'neetcode' : 'system_design')
  const [evaluations, setEvaluations] = useState<EvaluationWithInterview[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false)

  const [topics, setTopics] = useState<TopicWithProgress[]>([])
  const [selectedTopic, setSelectedTopic] = useState<TopicWithProgress | null>(null)
  const [isLoadingRoadmap, setIsLoadingRoadmap] = useState(true)
  const hasLoadedRoadmapRef = useRef(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [selectedPattern, setSelectedPattern] = useState<RoadmapPattern | null>(null)

  // Ensure non-admin users can't access neetcode tab
  // This handles race conditions where user loads after initial render
  useEffect(() => {
    if (user && !userIsAdmin && activeTab === 'neetcode') {
      setActiveTab('system_design')
    }
  }, [user, userIsAdmin, activeTab])

  // Handle upgrade success query param
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

  // System Design Roadmap helpers
  const isPro = subscription?.tier === 'pro'

  const isPatternUnlocked = (patternNum: number) => {
    if (isPro) return true
    return patternNum === FREE_PATTERN
  }

  const isSDQuestionCompleted = (questionId: string) => {
    return evaluations.some(
      e => e.interview?.question_id === questionId && e.overall_score && e.overall_score >= 70
    )
  }

  const getSDQuestionScore = (questionId: string) => {
    const evaluation = evaluations.find(e => e.interview?.question_id === questionId)
    return evaluation?.overall_score
  }

  const getPatternProgress = (pattern: RoadmapPattern) => {
    const completed = pattern.questions.filter(q => isSDQuestionCompleted(q.id)).length
    return { completed, total: pattern.questions.length }
  }

  const getTierProgress = (tier: typeof PATTERN_TIERS[0]) => {
    let completed = 0
    let total = 0
    tier.patterns.forEach(patternNum => {
      const pattern = SYSTEM_DESIGN_ROADMAP.find(p => p.pattern === patternNum)
      if (pattern) {
        const progress = getPatternProgress(pattern)
        completed += progress.completed
        total += progress.total
      }
    })
    return { completed, total }
  }

  const handleStartSDPractice = (question: RoadmapQuestion, patternNum: number) => {
    if (!isPatternUnlocked(patternNum)) {
      setShowPaywall(true)
      return
    }
    navigate('/onboarding', {
      state: {
        selectedQuestion: {
          id: question.id,
          title: question.title,
          difficulty: question.difficulty,
          type: 'system_design'
        }
      }
    })
  }

  const getProgressBarColor = (completed: number, total: number) => {
    if (total === 0) return 'bg-[rgba(0,0,0,0.1)]'
    const ratio = completed / total
    if (ratio === 1) return 'bg-[#4CAF50]'
    if (ratio > 0) return 'bg-[var(--accent-purple)]'
    return 'bg-[rgba(0,0,0,0.1)]'
  }

  const getTotalSDProgress = () => {
    return evaluations.filter(e =>
      e.overall_score && e.overall_score >= 70 &&
      e.interview?.session_type === 'system_design'
    ).length
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
              {userIsAdmin ? 'Practice Interview Questions' : 'Practice System Design'}
            </h1>
            <p className="text-[var(--text-secondary)] mt-1">
              {userIsAdmin
                ? 'Master system design and coding interviews with AI-powered feedback'
                : 'Master system design interviews with AI-powered feedback'
              }
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
          {userIsAdmin && (
            <button
              onClick={() => setActiveTab('neetcode')}
              className={`tab ${activeTab === 'neetcode' ? 'tab-active' : ''}`}
            >
              <span className="flex items-center gap-2">
                NeetCode 150
              </span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('system_design')}
            className={`tab ${activeTab === 'system_design' ? 'tab-active' : ''}`}
          >
            <span className="flex items-center gap-2">
              System Design
            </span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`tab ${activeTab === 'history' ? 'tab-active' : ''}`}
          >
            <span className="flex items-center gap-2">
              Past Submissions
              {evaluations.length > 0 && (
                <span className="badge badge-neutral">
                  {evaluations.length}
                </span>
              )}
            </span>
          </button>
        </div>

        {/* Tab description */}
        <p className="text-[var(--text-muted)] text-sm mb-6">
          {activeTab === 'system_design' && 'Resources to prepare for system design interviews. Practice designing scalable systems.'}
          {activeTab === 'neetcode' && userIsAdmin && 'The NeetCode 150 - a curated list of the most important LeetCode problems.'}
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
        ) : activeTab === 'neetcode' && userIsAdmin ? (
          // NeetCode 150 Roadmap (admin only)
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
          // System Design Pattern-based Roadmap
          <div>
            {/* Free tier banner */}
            {!isPro && (
              <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-[#FFF8E1] text-[#F57C00] rounded-xl text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Free tier: Pattern 1 unlocked (2 questions).
                <button
                  onClick={() => setShowPaywall(true)}
                  className="font-medium underline hover:no-underline"
                >
                  Upgrade to Pro
                </button>
              </div>
            )}

            {/* Overall Progress */}
            {user && (
              <div className="card p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[var(--text-muted)] text-sm">Overall Progress</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-2xl font-bold text-[var(--text-primary)]">
                        {getTotalSDProgress()}
                      </span>
                      <span className="text-[var(--text-muted)]">/</span>
                      <span className="text-[var(--text-secondary)]">
                        53 problems
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#4CAF50]"></div>
                      <span className="text-[var(--text-muted)]">Complete</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[var(--accent-purple)]"></div>
                      <span className="text-[var(--text-muted)]">In Progress</span>
                    </div>
                    {!isPro && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[rgba(0,0,0,0.2)]"></div>
                        <span className="text-[var(--text-muted)]">Locked</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-6">
              {/* Pattern Tiers */}
              <div className="flex-1 space-y-6">
                {PATTERN_TIERS.map((tier) => {
                  const tierProgress = getTierProgress(tier)
                  return (
                    <div key={tier.name} className="card p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{tier.emoji}</span>
                          <div>
                            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{tier.name}</h2>
                            <p className="text-sm text-[var(--text-muted)]">{tier.description}</p>
                          </div>
                        </div>
                        {user && (
                          <div className="text-right">
                            <span className="text-sm text-[var(--text-muted)]">
                              {tierProgress.completed}/{tierProgress.total}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {tier.patterns.map((patternNum) => {
                          const pattern = SYSTEM_DESIGN_ROADMAP.find(p => p.pattern === patternNum)
                          if (!pattern) return null

                          const progress = getPatternProgress(pattern)
                          const isSelected = selectedPattern?.pattern === pattern.pattern
                          const patternUnlocked = isPatternUnlocked(pattern.pattern)

                          return (
                            <button
                              key={pattern.pattern}
                              onClick={() => setSelectedPattern(isSelected ? null : pattern)}
                              className={`relative p-4 rounded-xl border-2 transition-all hover:scale-[1.02] text-left ${
                                isSelected
                                  ? 'border-[var(--accent-purple)] bg-[#F3E5F5]'
                                  : !patternUnlocked
                                  ? 'border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.02)] opacity-70'
                                  : 'border-[rgba(0,0,0,0.1)] bg-white hover:border-[var(--text-muted)]'
                              }`}
                            >
                              {/* Progress badge */}
                              {user && progress.total > 0 && (
                                <div className="absolute -top-2 -right-2">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                    progress.completed === progress.total
                                      ? 'bg-[#4CAF50] text-white'
                                      : progress.completed > 0
                                      ? 'bg-[var(--accent-purple)] text-white'
                                      : 'bg-[var(--bg-section)] text-[var(--text-muted)]'
                                  }`}>
                                    {progress.completed === progress.total ? '✓' : progress.completed}
                                  </div>
                                </div>
                              )}

                              <h3 className="font-medium text-[var(--text-primary)] text-sm mb-1 flex items-center gap-1">
                                {!patternUnlocked && (
                                  <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                )}
                                {pattern.pattern}. {pattern.name}
                              </h3>
                              <p className="text-xs text-[var(--text-muted)] mb-2">
                                {pattern.questions.length} question{pattern.questions.length !== 1 ? 's' : ''}
                              </p>

                              {/* Progress bar */}
                              {user && progress.total > 0 && (
                                <div className="h-1 bg-[rgba(0,0,0,0.08)] rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${getProgressBarColor(progress.completed, progress.total)}`}
                                    style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                                  />
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Question Panel */}
              {selectedPattern && (
                <div className="w-96 card p-4 h-fit sticky top-4">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                      {selectedPattern.pattern}. {selectedPattern.name}
                    </h2>
                    <button
                      onClick={() => setSelectedPattern(null)}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <p className="text-sm text-[var(--text-muted)] mb-3">
                    {selectedPattern.description}
                  </p>

                  {/* Key concepts */}
                  <div className="mb-4">
                    <p className="text-xs font-medium text-[var(--text-muted)] uppercase mb-2">Key Concepts</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedPattern.key_concepts.map((concept, i) => (
                        <span key={i} className="badge badge-neutral text-xs">
                          {concept}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Questions */}
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    {selectedPattern.questions.map((question) => {
                      const unlocked = isPatternUnlocked(selectedPattern.pattern)
                      const completed = isSDQuestionCompleted(question.id)
                      const score = getSDQuestionScore(question.id)

                      return (
                        <button
                          key={question.id}
                          onClick={() => handleStartSDPractice(question, selectedPattern.pattern)}
                          disabled={!unlocked}
                          className={`w-full text-left p-3 rounded-xl border transition-colors ${
                            !unlocked
                              ? 'border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.03)] cursor-not-allowed opacity-60'
                              : completed
                              ? 'border-[#C8E6C9] bg-[#E8F5E9] hover:bg-[#C8E6C9]'
                              : 'border-[rgba(0,0,0,0.08)] bg-[var(--bg-section)] hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {!unlocked ? (
                              <svg className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            ) : completed ? (
                              <svg className="w-4 h-4 text-[#4CAF50] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : null}
                            <span className={`text-sm ${!unlocked ? 'text-[var(--text-muted)]' : completed ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
                              <span className="text-[var(--text-muted)] mr-1">#{question.order}</span>
                              {question.title}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className={`badge ${getDifficultyColor(question.difficulty)}`}>
                              {question.difficulty}
                            </span>
                            {score !== undefined && (
                              <span className={`text-xs font-medium ${score >= 70 ? 'score-success' : score >= 50 ? 'score-warning' : 'score-error'}`}>
                                {score}/100
                              </span>
                            )}
                          </div>
                          {/* Companies */}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {question.companies.slice(0, 3).map((company, i) => (
                              <span key={i} className="text-xs text-[var(--text-muted)]">
                                {company}{i < Math.min(question.companies.length, 3) - 1 ? ',' : ''}
                              </span>
                            ))}
                            {question.companies.length > 3 && (
                              <span className="text-xs text-[var(--text-muted)]">+{question.companies.length - 3} more</span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Empty state when no pattern selected */}
            {!selectedPattern && (
              <div className="text-center py-8 text-[var(--text-muted)]">
                Click on a pattern to see its questions
              </div>
            )}
          </div>
        )}
      </div>

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        existingInterview={subscription?.existingInterview || null}
      />
    </div>
  )
}
