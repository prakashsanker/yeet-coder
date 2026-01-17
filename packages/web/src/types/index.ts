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
  examples: Example[]
  constraints: string[]
  visible_test_cases: TestCase[]
  hidden_test_cases: TestCase[]
  starter_code: StarterCode
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

export interface Evaluation {
  id: string
  interview_id: string
  test_case_coverage_score: number
  thought_process_score: number
  clarifying_questions_score: number
  edge_case_score: number
  time_management_score: number
  complexity_analysis_score: number
  code_quality_score: number
  overall_score: number
  verdict: 'PASS' | 'FAIL'
  feedback: EvaluationFeedback
  solution_code: string
  solution_explanation: SolutionStep[]
}

export interface EvaluationFeedback {
  strengths: string[]
  improvements: string[]
  detailed_notes: string
}

export interface SolutionStep {
  line_number: number
  explanation: string
  variables: Record<string, unknown>
  visualization_data?: unknown
}
