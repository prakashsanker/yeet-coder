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
    // System design specific metadata
    key_considerations?: string[]
    companies?: string[]
    solution_links?: Array<{ label: string; url: string }>
    // Reference solutions for grading (multiple sources combined)
    reference_solutions?: SystemDesignReferenceSolutions
  }
  hints?: string[]
  solution_explanation?: string
  created_at: string
  updated_at: string
}

// A single scraped reference solution from an external resource
export interface ScrapedSolution {
  // The scraped solution content
  solution_text: string
  // Source URL where the solution was scraped from
  source_url: string
  // Source label (e.g., "Substack", "Dev.to", "Medium")
  source_label: string
  // When the solution was scraped
  scraped_at: string
}

// Collection of reference solutions for system design questions (used as answer key for grading)
export interface SystemDesignReferenceSolutions {
  // All scraped solutions combined make up the comprehensive answer key
  solutions: ScrapedSolution[]
  // LLM-synthesized answer key combining all sources (used for grading if available)
  synthesized_answer_key?: string
  // When the answer key was generated
  generated_at?: string
  // When the collection was last updated (legacy field)
  last_updated?: string
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
  // Enhanced system design evaluation
  clarity_score?: number
  structure_score?: number
  correctness_score?: number
  // Qualitative ratings (new approach)
  style_rating?: 'strong' | 'adequate' | 'needs_improvement'
  completeness_rating?: 'comprehensive' | 'adequate' | 'incomplete'
  // Common fields
  overall_score?: number
  verdict?: 'PASS' | 'FAIL'
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

// System design interview feedback - focused on Style and Completeness
export interface SystemDesignFeedback {
  // === STYLE ASSESSMENT ===
  // How they approached the problem: clarity, structure, diagrams, trade-off consideration
  style: {
    // Overall rating for style
    rating: 'strong' | 'adequate' | 'needs_improvement'
    // Long-form narrative assessment of their style
    assessment: string
    // How well did they gather requirements?
    requirements_gathering?: 'thorough' | 'partial' | 'skipped'
    // Did they clarify functional requirements (features, scope)?
    functional_requirements_covered?: boolean
    // Did they clarify non-functional requirements (scale, latency, availability)?
    non_functional_requirements_covered?: boolean
    // Did they do capacity estimates (QPS, storage, bandwidth, memory)?
    did_capacity_estimates?: boolean
    // Were estimates prompted by interviewer (vs unprompted)?
    capacity_estimates_prompted?: boolean
    // Specific things they did well (with examples from their answer)
    strengths: Array<{
      point: string
      example: string  // Quote or reference from their actual answer
    }>
    // Specific areas to improve (with concrete suggestions)
    improvements: Array<{
      point: string
      what_they_did: string      // What they actually said/did
      what_would_be_better: string  // How to improve
    }>
  }

  // === COMPLETENESS ASSESSMENT ===
  // What they covered vs the answer key
  completeness: {
    // Overall rating for completeness
    rating: 'comprehensive' | 'adequate' | 'incomplete'
    // Long-form narrative of what was covered vs missed
    assessment: string
    // Percentage of answer key topics covered (0-100)
    answer_key_coverage_percent?: number
    // Features/topics they covered well
    covered_well: Array<{
      topic: string
      detail: string  // How well they covered it
    }>
    // Features/topics that were missing or incomplete
    gaps: Array<{
      topic: string
      importance: 'critical' | 'important' | 'minor'
      what_candidate_said: string  // What they actually said (or "Not mentioned")
      what_was_missing: string     // Brief description of the gap
      answer_key_excerpt: string   // Direct quote/excerpt from answer key showing what they SHOULD have said
      example_good_response: string // Concrete example of what a strong candidate would say
    }>
  }

  // === KEY RECOMMENDATIONS ===
  // Top 3-5 actionable recommendations to improve
  recommendations: Array<{
    title: string
    explanation: string
    example?: string  // Optional concrete example
  }>

  // Overall summary (1-2 paragraphs)
  summary: string

  // Legacy fields for backward compatibility
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
}

export interface SolutionStep {
  line_number: number
  explanation: string
  variables: Record<string, unknown>
  visualization_data?: unknown
}
