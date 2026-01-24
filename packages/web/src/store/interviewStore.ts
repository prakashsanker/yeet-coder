import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { QuestionData, TranscriptEntry, InterviewSession } from '@/types'
import { getAuthHeaders, API_URL } from '@/lib/api'

export type InterviewStatus = 'idle' | 'loading' | 'ready' | 'in_progress' | 'submitting' | 'completed' | 'abandoned'

interface InterviewState {
  // Interview session data
  interviewId: string | null
  topicId: string | null
  topicSlug: string | null
  status: InterviewStatus
  question: QuestionData | null

  // Code state
  code: string
  language: string

  // Metrics
  runCount: number
  submitCount: number
  startedAt: number | null
  timeSpentSeconds: number

  // Transcript
  transcript: TranscriptEntry[]

  // Error state
  error: string | null
}

interface InterviewActions {
  // Session management
  startInterview: (params: {
    topicId: string
    topicSlug: string
    question: QuestionData
    language?: string
  }) => Promise<string | null>
  setInterviewId: (id: string) => void
  loadInterview: (id: string) => Promise<boolean>
  resetInterview: () => void

  // Code updates
  setCode: (code: string) => void
  setLanguage: (language: string) => void

  // Metrics tracking
  incrementRunCount: () => void
  syncToBackend: () => Promise<void>

  // Transcript management
  addTranscriptEntry: (entry: TranscriptEntry) => void

  // Interview completion
  submitInterview: (allPassed: boolean) => Promise<boolean>
  endInterview: (reason: 'give_up' | 'timeout') => Promise<boolean>

  // Error handling
  setError: (error: string | null) => void

  // Time tracking
  updateTimeSpent: () => void
}

type InterviewStore = InterviewState & InterviewActions

const initialState: InterviewState = {
  interviewId: null,
  topicId: null,
  topicSlug: null,
  status: 'idle',
  question: null,
  code: '',
  language: 'python',
  runCount: 0,
  submitCount: 0,
  startedAt: null,
  timeSpentSeconds: 0,
  transcript: [],
  error: null,
}

export const useInterviewStore = create<InterviewStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        startInterview: async ({ topicId, topicSlug, question, language = 'python' }) => {
          set({ status: 'loading', error: null })

          try {
            const authHeaders = await getAuthHeaders()
            const response = await fetch(`${API_URL}/api/interviews`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify({
                topic_id: topicId,
                question_data: question,
                language,
              }),
            })

            if (!response.ok) {
              const errorData = await response.json()
              console.error('[STORE] Interview creation failed:', {
                status: response.status,
                error: errorData.error,
                details: errorData.details,
                sentData: { topic_id: topicId, question_data: question, language }
              })
              throw new Error(errorData.error || 'Failed to create interview')
            }

            const { interview } = await response.json() as { interview: InterviewSession }

            const starterCode = question.starter_code?.[language as keyof typeof question.starter_code] || ''

            set({
              interviewId: interview.id,
              topicId,
              topicSlug,
              status: 'ready',
              question,
              code: starterCode,
              language,
              runCount: 0,
              submitCount: 0,
              startedAt: Date.now(),
              timeSpentSeconds: 0,
              transcript: [],
              error: null,
            })

            console.log('[STORE] Interview created:', interview.id)
            return interview.id
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to start interview'
            set({ status: 'idle', error: message })
            console.error('[STORE] Failed to start interview:', error)
            return null
          }
        },

        setInterviewId: (id: string) => {
          set({ interviewId: id })
        },

        loadInterview: async (id: string) => {
          set({ status: 'loading', error: null })

          try {
            const authHeaders = await getAuthHeaders()
            const response = await fetch(`${API_URL}/api/interviews/${id}`, {
              headers: authHeaders,
            })
            if (!response.ok) {
              throw new Error('Interview not found')
            }

            const { interview } = await response.json() as { interview: InterviewSession }

            set({
              interviewId: interview.id,
              topicId: interview.topic_id,
              status: interview.status === 'in_progress' ? 'in_progress' :
                      interview.status === 'completed' ? 'completed' : 'abandoned',
              question: interview.question_data,
              code: interview.final_code || '',
              language: interview.language,
              runCount: interview.run_count,
              submitCount: interview.submit_count,
              startedAt: new Date(interview.started_at).getTime(),
              timeSpentSeconds: interview.time_spent_seconds || 0,
              transcript: interview.transcript || [],
              error: null,
            })

            return true
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load interview'
            set({ status: 'idle', error: message })
            return false
          }
        },

        resetInterview: () => {
          set(initialState)
        },

        setCode: (code: string) => {
          set({ code })
        },

        setLanguage: (language: string) => {
          const { question } = get()
          if (question?.starter_code) {
            const starterCode = question.starter_code[language as keyof typeof question.starter_code] || ''
            set({ language, code: starterCode })
          } else {
            set({ language })
          }
        },

        incrementRunCount: () => {
          set((state) => ({ runCount: state.runCount + 1 }))
        },

        syncToBackend: async () => {
          const { interviewId, code, language } = get()
          if (!interviewId || interviewId.startsWith('temp-') || interviewId.startsWith('local-')) {
            return // Don't sync temp/local interviews
          }

          try {
            const authHeaders = await getAuthHeaders()
            await fetch(`${API_URL}/api/interviews/${interviewId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify({
                code,
                language,
              }),
            })
          } catch (error) {
            console.error('[STORE] Failed to sync to backend:', error)
          }
        },

        addTranscriptEntry: (entry: TranscriptEntry) => {
          set((state) => ({
            transcript: [...state.transcript, entry],
          }))

          // Sync transcript to backend
          const { interviewId } = get()
          if (interviewId && !interviewId.startsWith('temp-') && !interviewId.startsWith('local-')) {
            // Fire-and-forget async call with auth headers
            (async () => {
              try {
                const authHeaders = await getAuthHeaders()
                await fetch(`${API_URL}/api/interviews/${interviewId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json', ...authHeaders },
                  body: JSON.stringify({
                    transcript_entry: entry,
                  }),
                })
              } catch (error) {
                console.error('[STORE] Failed to sync transcript:', error)
              }
            })()
          }
        },

        submitInterview: async (allPassed: boolean) => {
          const { interviewId, code, timeSpentSeconds } = get()

          set({ status: 'submitting' })

          try {
            if (interviewId && !interviewId.startsWith('temp-') && !interviewId.startsWith('local-')) {
              const authHeaders = await getAuthHeaders()
              await fetch(`${API_URL}/api/interviews/${interviewId}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                  final_code: code,
                  time_spent_seconds: timeSpentSeconds,
                }),
              })
            }

            set({
              status: 'completed',
              submitCount: get().submitCount + 1,
            })

            console.log('[STORE] Interview submitted', { allPassed })
            return true
          } catch (error) {
            console.error('[STORE] Failed to submit interview:', error)
            set({ status: 'in_progress' })
            return false
          }
        },

        endInterview: async (reason: 'give_up' | 'timeout') => {
          const { interviewId, code, timeSpentSeconds } = get()

          try {
            if (interviewId && !interviewId.startsWith('temp-') && !interviewId.startsWith('local-')) {
              const authHeaders = await getAuthHeaders()
              await fetch(`${API_URL}/api/interviews/${interviewId}/end`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                  final_code: code,
                  reason,
                  time_spent_seconds: timeSpentSeconds,
                }),
              })
            }

            set({ status: 'abandoned' })

            console.log('[STORE] Interview ended', { reason })
            return true
          } catch (error) {
            console.error('[STORE] Failed to end interview:', error)
            return false
          }
        },

        setError: (error: string | null) => {
          set({ error })
        },

        updateTimeSpent: () => {
          const { startedAt, status } = get()
          if (startedAt && (status === 'in_progress' || status === 'ready')) {
            const elapsed = Math.floor((Date.now() - startedAt) / 1000)
            set({ timeSpentSeconds: elapsed })
          }
        },
      }),
      {
        name: 'interview-store',
        partialize: (state) => ({
          // Only persist these fields
          interviewId: state.interviewId,
          topicId: state.topicId,
          topicSlug: state.topicSlug,
          code: state.code,
          language: state.language,
          startedAt: state.startedAt,
        }),
      }
    ),
    { name: 'InterviewStore' }
  )
)

// Selector hooks for common use cases
export const useInterviewId = () => useInterviewStore((state) => state.interviewId)
export const useInterviewStatus = () => useInterviewStore((state) => state.status)
export const useInterviewQuestion = () => useInterviewStore((state) => state.question)
export const useInterviewCode = () => useInterviewStore((state) => state.code)
export const useInterviewLanguage = () => useInterviewStore((state) => state.language)
export const useInterviewMetrics = () =>
  useInterviewStore((state) => ({
    runCount: state.runCount,
    submitCount: state.submitCount,
    timeSpentSeconds: state.timeSpentSeconds,
  }))
