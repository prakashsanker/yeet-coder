import { supabase } from './supabase'

// Use relative URLs by default so requests go through Vite's proxy
const API_URL = import.meta.env.VITE_API_URL || ''

export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` }
    }
  } catch (error) {
    console.warn('Failed to get auth session:', error)
  }
  return {}
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
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
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

export interface InterviewSession {
  id: string
  user_id: string
  topic_id: string
  question_id?: string // References questions table
  status: 'in_progress' | 'completed' | 'abandoned'
  question_data?: QuestionData // Legacy, kept for backward compatibility
  question?: Question // Joined question data (new)
  language: string
  final_code?: string
  started_at: string
  ended_at?: string
  time_spent_seconds?: number
  time_limit_seconds?: number
  run_count: number
  submit_count: number
  transcript: TranscriptEntry[]
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
}

export interface EndInterviewParams {
  final_code: string
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
