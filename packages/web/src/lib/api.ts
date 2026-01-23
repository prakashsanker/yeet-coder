import { supabase } from './supabase'

// Use relative URLs by default so requests go through Vite's proxy
const API_URL = import.meta.env.VITE_API_URL || ''

export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data: { session } } = await supabase.auth.getSession()

    console.log('[API] Session check:', {
      hasSession: !!session,
      hasAccessToken: !!session?.access_token,
      expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      now: new Date().toISOString(),
    })

    if (session?.access_token) {
      // Check if token is expired or about to expire (within 60 seconds)
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0
      const now = Date.now()

      console.log('[API] Token expiry check:', { expiresAt, now, isExpired: expiresAt < now + 60000 })

      if (expiresAt && expiresAt < now + 60000) {
        // Token expired or expiring soon, try to refresh
        console.log('[API] Token expired, attempting refresh...')
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()

        console.log('[API] Refresh result:', {
          hasNewSession: !!refreshData?.session,
          error: refreshError?.message,
        })

        if (refreshError || !refreshData.session) {
          console.warn('[API] Failed to refresh session:', refreshError)
          // Sign out to force re-login
          await supabase.auth.signOut()
          return {}
        }

        console.log('[API] Using refreshed token')
        return { Authorization: `Bearer ${refreshData.session.access_token}` }
      }

      return { Authorization: `Bearer ${session.access_token}` }
    }
  } catch (error) {
    console.warn('Failed to get auth session:', error)
  }
  return {}
}

// Custom error class for API errors with additional data
export class ApiError extends Error {
  status: number
  code?: string
  data?: Record<string, unknown>

  constructor(message: string, status: number, code?: string, data?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.data = data
  }
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders()

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))

    // If we get a 401, the token is invalid - force clear session and redirect
    if (response.status === 401) {
      console.log('[API] Got 401, clearing session and redirecting to login')
      // Clear all Supabase auth data from localStorage
      const keysToRemove = Object.keys(localStorage).filter(
        (key) => key.startsWith('sb-') && key.includes('-auth-')
      )
      keysToRemove.forEach((key) => localStorage.removeItem(key))
      // Redirect to home page
      window.location.href = '/'
      return undefined as T // Won't actually return, page will reload
    }

    const error = new ApiError(
      errorData.message || errorData.error || `HTTP ${response.status}`,
      response.status,
      errorData.error,
      errorData
    )
    throw error
  }

  return response.json()
}

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface StarterCode {
  python: string
  javascript: string
  typescript: string
  java: string
  cpp: string
}

export interface QuestionData {
  title: string
  description: string
  examples: { input: string; output: string; explanation?: string }[]
  constraints: string[]
  visible_test_cases: { input: string; expected_output: string }[]
  hidden_test_cases: { input: string; expected_output: string }[]
  starter_code: StarterCode
}

export interface ExcalidrawData {
  elements: unknown[]  // Use unknown[] to avoid type conflicts with Excalidraw's complex internal types
}

export interface InterviewSession {
  id: string
  user_id: string
  topic_id: string
  question_id?: string // References questions table
  status: 'in_progress' | 'completed' | 'abandoned'
  session_type: 'coding' | 'system_design'
  question_data?: QuestionData // Legacy, kept for backward compatibility
  question?: Question // Joined question data (new)
  language?: string // Nullable for system design
  final_code?: string
  started_at: string
  ended_at?: string
  time_spent_seconds?: number
  time_limit_seconds?: number
  run_count: number
  submit_count: number
  transcript: TranscriptEntry[]
  // System design specific
  drawing_data?: ExcalidrawData | null
  notes?: string | null
}

export interface TranscriptEntry {
  timestamp: number
  speaker: 'user' | 'interviewer'
  text: string
}

export interface CreateInterviewParams {
  question_id: string
  language?: string
  time_limit_seconds?: number
}

export interface UpdateInterviewParams {
  code?: string
  language?: string
  time_spent_seconds?: number
  increment_run_count?: boolean
  transcript_entry?: TranscriptEntry
  // System design specific
  drawing_data?: ExcalidrawData
  notes?: string
}

export interface EndInterviewParams {
  final_code?: string // Optional for system design
  reason: 'submit' | 'give_up' | 'timeout'
  time_spent_seconds: number
}

export const api = {
  topics: {
    list: () => fetchApi<{ topics: Topic[] }>('/api/topics'),
    weakest: () => fetchApi<{ topics: Topic[]; message?: string }>('/api/topics/weakest'),
  },
  questions: {
    list: (params?: { type?: 'coding' | 'system_design'; topic_id?: string; difficulty?: Difficulty; limit?: number }) => {
      const searchParams = new URLSearchParams()
      if (params?.type) searchParams.set('type', params.type)
      if (params?.topic_id) searchParams.set('topic_id', params.topic_id)
      if (params?.difficulty) searchParams.set('difficulty', params.difficulty)
      if (params?.limit) searchParams.set('limit', params.limit.toString())
      const query = searchParams.toString()
      return fetchApi<{ questions: Question[] }>(`/api/questions${query ? `?${query}` : ''}`)
    },
    get: (id: string) => fetchApi<{ question: Question }>(`/api/questions/${id}`),
    generate: (params: { topic: string; difficulty: Difficulty; topicId?: string }) =>
      fetchApi<{ question: QuestionData; topicId?: string }>('/api/questions/generate', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
  },
  interviews: {
    create: (params: CreateInterviewParams) =>
      fetchApi<{ success: boolean; interview: InterviewSession }>('/api/interviews', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    get: (id: string) =>
      fetchApi<{ success: boolean; interview: InterviewSession }>(`/api/interviews/${id}`),
    list: (params?: { status?: string; limit?: number }) => {
      const searchParams = new URLSearchParams()
      if (params?.status) searchParams.set('status', params.status)
      if (params?.limit) searchParams.set('limit', params.limit.toString())
      const query = searchParams.toString()
      return fetchApi<{ success: boolean; interviews: InterviewSession[] }>(
        `/api/interviews${query ? `?${query}` : ''}`
      )
    },
    update: (id: string, params: UpdateInterviewParams) =>
      fetchApi<{ success: boolean; interview: InterviewSession }>(`/api/interviews/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(params),
      }),
    submit: (id: string, params: { final_code: string; time_spent_seconds: number }) =>
      fetchApi<{ success: boolean; interview: InterviewSession }>(`/api/interviews/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    end: (id: string, params: EndInterviewParams) =>
      fetchApi<{ success: boolean; interview: InterviewSession }>(`/api/interviews/${id}/end`, {
        method: 'POST',
        body: JSON.stringify(params),
      }),
  },
  evaluations: {
    list: (params?: { limit?: number }) => {
      const searchParams = new URLSearchParams()
      if (params?.limit) searchParams.set('limit', params.limit.toString())
      const query = searchParams.toString()
      return fetchApi<{ success: boolean; evaluations: (Evaluation & { interview: InterviewSession })[] }>(
        `/api/evaluations${query ? `?${query}` : ''}`
      )
    },
    create: (params: CreateEvaluationParams) =>
      fetchApi<{ success: boolean; evaluation: Evaluation; existing?: boolean }>('/api/evaluations', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    get: (id: string) =>
      fetchApi<{ success: boolean; evaluation: Evaluation }>(`/api/evaluations/${id}`),
    getByInterview: (interviewId: string) =>
      fetchApi<{ success: boolean; evaluation: Evaluation }>(`/api/evaluations/interview/${interviewId}`),
    rerun: (id: string) =>
      fetchApi<{ success: boolean; evaluation: Evaluation }>(`/api/evaluations/${id}/rerun`, {
        method: 'POST',
      }),
  },
  subscription: {
    getStatus: () =>
      fetchApi<{
        success: boolean
        subscription: {
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
      }>('/api/users/subscription'),
    getDetails: () =>
      fetchApi<{
        success: boolean
        subscription: {
          tier: 'free' | 'pro'
          status: string | null
          cancelAtPeriodEnd: boolean
          currentPeriodEnd: string | null
        }
      }>('/api/stripe/subscription-details'),
    createCheckout: () =>
      fetchApi<{ success: boolean; url: string }>('/api/stripe/create-checkout-session', {
        method: 'POST',
      }),
    cancel: () =>
      fetchApi<{ success: boolean; message: string; cancelAt: string | null }>(
        '/api/stripe/cancel-subscription',
        { method: 'POST' }
      ),
  },
}

export interface CreateEvaluationParams {
  interview_id: string
  test_results?: {
    visible: { passed: number; total: number }
    hidden: { passed: number; total: number }
  }
  user_test_cases?: { input: string; expected_output: string }[]
}

// Coding interview feedback
export interface CodingFeedback {
  strengths: string[]
  improvements: string[]
  detailed_notes: string
}

// System design interview feedback
export interface SystemDesignFeedback {
  summary: string
  good_points: string[]
  areas_for_improvement: string[]
  detailed_notes: {
    requirements: string
    architecture: string
    scalability: string
    data_model: string
    api_design: string
    trade_offs: string
    communication: string
  }
  missed_components: string[]
  study_recommendations: string[]
  key_takeaway: string
}

export interface Evaluation {
  id: string
  interview_id: string
  // Coding interview scores
  test_case_coverage_score?: number
  thought_process_score?: number
  clarifying_questions_score?: number
  edge_case_score?: number
  time_management_score?: number
  complexity_analysis_score?: number
  code_quality_score?: number
  // System design interview scores
  requirements_gathering_score?: number
  system_components_score?: number
  scalability_score?: number
  data_model_score?: number
  api_design_score?: number
  trade_offs_score?: number
  communication_score?: number
  // Common fields
  overall_score?: number
  verdict?: 'PASS' | 'FAIL'
  feedback?: CodingFeedback | SystemDesignFeedback
  solution_code?: string
  // System design snapshots
  evaluated_drawing?: ExcalidrawData | null
  evaluated_notes?: string | null
  created_at: string
  // Joined data
  interview?: InterviewSession
}

interface Topic {
  id: string
  name: string
  slug: string
  description?: string
  difficulty_order: number
  parent_topic_id?: string
  type?: 'coding' | 'system_design'
}

export interface Question {
  id: string
  title: string
  slug: string
  description: string
  type: 'coding' | 'system_design'
  difficulty: 'easy' | 'medium' | 'hard'
  topic_id?: string
  source?: string
  source_url?: string
  leetcode_number?: number
  examples?: { input: string; output: string; explanation?: string }[]
  metadata?: Record<string, unknown>
  hints?: string[]
  solution_explanation?: string
  created_at: string
  updated_at: string
}

export type { Topic }
