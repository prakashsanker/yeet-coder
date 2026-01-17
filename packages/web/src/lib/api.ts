const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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

export const api = {
  topics: {
    list: () => fetchApi<{ topics: Topic[] }>('/api/topics'),
    weakest: () => fetchApi<{ topics: Topic[]; message?: string }>('/api/topics/weakest'),
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
