export interface Topic {
  id: string
  name: string
  slug: string
  description?: string
  difficulty_order: number
  parent_topic_id?: string
}

export interface UserTopicProgress {
  id: string
  user_id: string
  topic_id: string
  interviews_attempted: number
  interviews_passed: number
  weakness_score: number
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

export interface QuestionData {
  title: string
  description: string
  examples: Example[]
  constraints: string[]
  visible_test_cases: TestCase[]
  hidden_test_cases: TestCase[]
}

export interface Example {
  input: string
  output: string
  explanation?: string
}

export interface TestCase {
  input: string
  expected_output: string
}

export interface TranscriptEntry {
  timestamp: number
  speaker: 'user' | 'interviewer'
  text: string
}

export interface ExecutionRequest {
  interview_id: string
  code: string
  language: string
  test_cases: TestCase[]
  execution_type: 'run' | 'submit'
}

export interface ExecutionResult {
  test_case_index: number
  status: 'Accepted' | 'Wrong Answer' | 'Time Limit Exceeded' | 'Runtime Error' | 'Compilation Error'
  actual_output?: string
  expected_output: string
  execution_time_ms?: number
  memory_kb?: number
  error?: string
}
