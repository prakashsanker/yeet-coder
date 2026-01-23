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
  question_id?: string // New: references questions table
  status: 'in_progress' | 'completed' | 'abandoned'
  session_type: 'coding' | 'system_design'
  question_data?: QuestionData // Legacy: kept for backward compatibility
  language?: string // Nullable for system design interviews
  final_code?: string
  started_at: string
  ended_at?: string
  time_spent_seconds?: number
  time_limit_seconds?: number
  run_count: number
  submit_count: number
  transcript: TranscriptEntry[]
  // System design specific fields
  drawing_data?: ExcalidrawData | null
  notes?: string | null
  // Joined data (populated when fetching)
  question?: Question
}

// Excalidraw diagram data
export interface ExcalidrawData {
  elements: ExcalidrawElement[]
}

export interface ExcalidrawElement {
  id: string
  type: string
  x: number
  y: number
  width?: number
  height?: number
  text?: string
  originalText?: string
  startBinding?: { elementId: string }
  endBinding?: { elementId: string }
  [key: string]: unknown
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
  examples?: Example[]
  metadata?: {
    constraints?: string[]
    visible_test_cases?: TestCase[]
    hidden_test_cases?: TestCase[]
    starter_code?: StarterCode
  }
  hints?: string[]
  solution_explanation?: string
  created_at: string
  updated_at: string
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
  feedback?: EvaluationFeedback | SystemDesignFeedback
  solution_code?: string
  solution_explanation?: SolutionStep[]
  // System design snapshots
  evaluated_drawing?: ExcalidrawData | null
  evaluated_notes?: string | null
  created_at: string
}

// Coding interview feedback
export interface EvaluationFeedback {
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

export interface SolutionStep {
  line_number: number
  explanation: string
  variables: Record<string, unknown>
  visualization_data?: unknown
}
