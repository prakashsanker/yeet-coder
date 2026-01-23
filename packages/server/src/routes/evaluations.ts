import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../db/supabase'
import { optionalAuthMiddleware, AuthenticatedRequest } from '../middleware/auth'
import { evaluationService, type EvaluationInput } from '../services/evaluationService'
import type { Evaluation, TestCase, TranscriptEntry, Question } from '../types'

const router = Router()

// Validation schemas
const testCaseSchema = z.object({
  input: z.string(),
  expected_output: z.string(),
})

const testResultsSchema = z.object({
  visible: z.object({
    passed: z.number(),
    total: z.number(),
  }),
  hidden: z.object({
    passed: z.number(),
    total: z.number(),
  }),
})

const createEvaluationSchema = z.object({
  interview_id: z.string().uuid(),
  test_results: testResultsSchema.optional(),
  user_test_cases: z.array(testCaseSchema).optional(),
})

// POST /api/evaluations - Create a new evaluation for an interview
router.post('/', optionalAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = createEvaluationSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parseResult.error.errors,
      })
    }

    const { interview_id, test_results, user_test_cases } = parseResult.data

    // Fetch interview with question data
    const { data: interview, error: interviewError } = await supabase
      .from('interview_sessions')
      .select(`
        *,
        question:questions(*)
      `)
      .eq('id', interview_id)
      .single()

    if (interviewError || !interview) {
      console.error('Error fetching interview:', interviewError)
      return res.status(404).json({ error: 'Interview not found' })
    }

    // Check if evaluation already exists for this interview
    const { data: existingEvaluation } = await supabase
      .from('evaluations')
      .select('*')
      .eq('interview_id', interview_id)
      .single()

    if (existingEvaluation) {
      // Return existing evaluation with full data
      console.log(`[EVALUATION] Evaluation already exists for interview ${interview_id}`)
      return res.json({
        success: true,
        evaluation: existingEvaluation as Evaluation,
        existing: true,
      })
    }

    // Prepare evaluation input
    const question = interview.question as Question | null
    const metadata = question?.metadata as {
      constraints?: string[]
      visible_test_cases?: TestCase[]
      hidden_test_cases?: TestCase[]
    } | null

    // Default test results if not provided
    const defaultTestResults = {
      visible: { passed: 0, total: 0 },
      hidden: { passed: 0, total: 0 },
    }

    const evalInput: EvaluationInput = {
      interviewId: interview_id,
      questionTitle: question?.title || 'Unknown',
      questionDescription: question?.description || '',
      questionConstraints: metadata?.constraints || [],
      questionDifficulty: (question?.difficulty || 'medium') as 'easy' | 'medium' | 'hard',
      finalCode: interview.final_code || '',
      language: interview.language,
      testResults: test_results || defaultTestResults,
      userTestCases: (user_test_cases || []) as TestCase[],
      transcript: (interview.transcript || []) as TranscriptEntry[],
      timeSpentSeconds: interview.time_spent_seconds || 0,
      timeLimitSeconds: interview.time_limit_seconds || 3600,
      runCount: interview.run_count || 0,
      submitCount: interview.submit_count || 0,
    }

    console.log(`[EVALUATION] Running AI evaluation for interview ${interview_id}`)

    // Run AI evaluation
    let evaluationResult
    try {
      evaluationResult = await evaluationService.evaluate(evalInput)
      console.log(`[EVALUATION] AI evaluation completed: ${evaluationResult.verdict} (${evaluationResult.overall_score}/100)`)
    } catch (evalError) {
      console.error('[EVALUATION] AI evaluation failed:', evalError)
      // Create evaluation without AI scores (will be pending)
      evaluationResult = null
    }

    // Create evaluation record
    const evaluationData: Record<string, unknown> = {
      interview_id,
      test_results: test_results || defaultTestResults,
      user_test_cases: user_test_cases || [],
      solution_code: interview.final_code || null,
    }

    // Add AI evaluation results if available
    if (evaluationResult) {
      Object.assign(evaluationData, {
        test_case_coverage_score: evaluationResult.test_case_coverage_score,
        thought_process_score: evaluationResult.thought_process_score,
        clarifying_questions_score: evaluationResult.clarifying_questions_score,
        edge_case_score: evaluationResult.edge_case_score,
        time_management_score: evaluationResult.time_management_score,
        complexity_analysis_score: evaluationResult.complexity_analysis_score,
        code_quality_score: evaluationResult.code_quality_score,
        overall_score: evaluationResult.overall_score,
        verdict: evaluationResult.verdict,
        feedback: evaluationResult.feedback,
      })
    }

    const { data: evaluation, error } = await supabase
      .from('evaluations')
      .insert(evaluationData)
      .select()
      .single()

    if (error) {
      console.error('Error creating evaluation:', error)
      return res.status(500).json({ error: 'Failed to create evaluation' })
    }

    console.log(`[EVALUATION] Created evaluation ${evaluation.id} for interview ${interview_id}`)

    return res.status(201).json({
      success: true,
      evaluation: evaluation as Evaluation,
    })
  } catch (err) {
    console.error('Unexpected error creating evaluation:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/evaluations/:id/rerun - Re-run AI evaluation for an existing evaluation
router.post('/:id/rerun', optionalAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params

    // Fetch evaluation with interview and question data
    const { data: evaluation, error: fetchError } = await supabase
      .from('evaluations')
      .select(`
        *,
        interview:interview_sessions(
          *,
          question:questions(*)
        )
      `)
      .eq('id', id)
      .single()

    if (fetchError || !evaluation) {
      return res.status(404).json({ error: 'Evaluation not found' })
    }

    const interview = evaluation.interview as {
      final_code?: string
      language: string
      transcript?: TranscriptEntry[]
      time_spent_seconds?: number
      time_limit_seconds?: number
      run_count?: number
      submit_count?: number
      question?: Question
    }

    const question = interview?.question
    const metadata = question?.metadata as {
      constraints?: string[]
    } | null

    const evalInput: EvaluationInput = {
      interviewId: evaluation.interview_id,
      questionTitle: question?.title || 'Unknown',
      questionDescription: question?.description || '',
      questionConstraints: metadata?.constraints || [],
      questionDifficulty: (question?.difficulty || 'medium') as 'easy' | 'medium' | 'hard',
      finalCode: interview?.final_code || '',
      language: interview?.language || 'python',
      testResults: (evaluation.test_results as EvaluationInput['testResults']) || {
        visible: { passed: 0, total: 0 },
        hidden: { passed: 0, total: 0 },
      },
      userTestCases: (evaluation.user_test_cases as TestCase[]) || [],
      transcript: (interview?.transcript || []) as TranscriptEntry[],
      timeSpentSeconds: interview?.time_spent_seconds || 0,
      timeLimitSeconds: interview?.time_limit_seconds || 3600,
      runCount: interview?.run_count || 0,
      submitCount: interview?.submit_count || 0,
    }

    console.log(`[EVALUATION] Re-running AI evaluation for ${id}`)

    const evaluationResult = await evaluationService.evaluate(evalInput)

    // Update evaluation with new results
    const { data: updatedEvaluation, error: updateError } = await supabase
      .from('evaluations')
      .update({
        test_case_coverage_score: evaluationResult.test_case_coverage_score,
        thought_process_score: evaluationResult.thought_process_score,
        clarifying_questions_score: evaluationResult.clarifying_questions_score,
        edge_case_score: evaluationResult.edge_case_score,
        time_management_score: evaluationResult.time_management_score,
        complexity_analysis_score: evaluationResult.complexity_analysis_score,
        code_quality_score: evaluationResult.code_quality_score,
        overall_score: evaluationResult.overall_score,
        verdict: evaluationResult.verdict,
        feedback: evaluationResult.feedback,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating evaluation:', updateError)
      return res.status(500).json({ error: 'Failed to update evaluation' })
    }

    console.log(`[EVALUATION] Re-run completed: ${evaluationResult.verdict} (${evaluationResult.overall_score}/100)`)

    return res.json({
      success: true,
      evaluation: updatedEvaluation as Evaluation,
    })
  } catch (err) {
    console.error('Unexpected error re-running evaluation:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/evaluations/:id - Get evaluation by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { data: evaluation, error } = await supabase
      .from('evaluations')
      .select(`
        *,
        interview:interview_sessions(
          *,
          question:questions(*)
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Evaluation not found' })
      }
      console.error('Error fetching evaluation:', error)
      return res.status(500).json({ error: 'Failed to fetch evaluation' })
    }

    return res.json({
      success: true,
      evaluation: evaluation as Evaluation & { interview: unknown },
    })
  } catch (err) {
    console.error('Unexpected error fetching evaluation:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/evaluations/interview/:interviewId - Get evaluation by interview ID
router.get('/interview/:interviewId', async (req: Request, res: Response) => {
  try {
    const { interviewId } = req.params

    const { data: evaluation, error } = await supabase
      .from('evaluations')
      .select(`
        *,
        interview:interview_sessions(
          *,
          question:questions(*)
        )
      `)
      .eq('interview_id', interviewId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Evaluation not found for this interview' })
      }
      console.error('Error fetching evaluation:', error)
      return res.status(500).json({ error: 'Failed to fetch evaluation' })
    }

    return res.json({
      success: true,
      evaluation: evaluation as Evaluation & { interview: unknown },
    })
  } catch (err) {
    console.error('Unexpected error fetching evaluation:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
