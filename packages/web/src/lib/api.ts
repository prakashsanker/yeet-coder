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
