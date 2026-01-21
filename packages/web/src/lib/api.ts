// Use relative URLs by default so requests go through Vite's proxy
const API_URL = import.meta.env.VITE_API_URL || ''

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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
  status: 'in_progress' | 'completed' | 'abandoned'
  question_data: QuestionData
  language: string
  final_code?: string
  started_at: string
  ended_at?: string
  time_spent_seconds?: number
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
  topic_id: string
  question_data: QuestionData
  language?: string
  time_limit_seconds?: number
}

export interface UpdateInterviewParams {
  code?: string
  language?: string
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
}

export type { Topic }
