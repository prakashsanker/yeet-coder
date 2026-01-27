import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../db/supabase.js'
import { optionalAuthMiddleware, AuthenticatedRequest } from '../middleware/auth.js'
import { evaluationService, type EvaluationInput } from '../services/evaluationService.js'
import { systemDesignEvaluationService, type SystemDesignEvaluationInput } from '../services/systemDesignEvaluationService.js'
import type { Evaluation, TestCase, TranscriptEntry, Question, ExcalidrawData, SystemDesignReferenceSolutions } from '../types/index.js'

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
      key_considerations?: string[]
      reference_solutions?: SystemDesignReferenceSolutions
    } | null

    // Branch based on session type
    const sessionType = interview.session_type || 'coding'

    console.log(`[EVALUATION] Running AI evaluation for interview ${interview_id} (type: ${sessionType})`)

    // Create evaluation record based on session type
    let evaluationData: Record<string, unknown> = {
      interview_id,
    }

    if (sessionType === 'system_design') {
      // System design evaluation
      const sdEvalInput: SystemDesignEvaluationInput = {
        interviewId: interview_id,
        questionTitle: question?.title || 'Unknown',
        questionDescription: question?.description || '',
        questionDifficulty: (question?.difficulty || 'medium') as 'easy' | 'medium' | 'hard',
        keyConsiderations: metadata?.key_considerations || [],
        referenceSolutions: metadata?.reference_solutions,  // Pass the answer key
        drawingData: interview.drawing_data as ExcalidrawData | null,
        notes: interview.notes as string | null,
        transcript: (interview.transcript || []) as TranscriptEntry[],
        timeSpentSeconds: interview.time_spent_seconds || 0,
        timeLimitSeconds: interview.time_limit_seconds || 3600,
      }

      try {
        const sdResult = await systemDesignEvaluationService.evaluate(sdEvalInput)
        console.log(`[EVALUATION] System design evaluation completed: style=${sdResult.style_rating}, completeness=${sdResult.completeness_rating}`)

        Object.assign(evaluationData, {
          // New qualitative ratings
          style_rating: sdResult.style_rating,
          completeness_rating: sdResult.completeness_rating,
          // Numeric scores (for backward compatibility)
          clarity_score: sdResult.clarity_score,
          structure_score: sdResult.structure_score,
          correctness_score: sdResult.correctness_score,
          requirements_gathering_score: sdResult.requirements_gathering_score,
          system_components_score: sdResult.system_components_score,
          scalability_score: sdResult.scalability_score,
          data_model_score: sdResult.data_model_score,
          api_design_score: sdResult.api_design_score,
          trade_offs_score: sdResult.trade_offs_score,
          communication_score: sdResult.communication_score,
          overall_score: sdResult.overall_score,
          feedback: sdResult.feedback,
          evaluated_drawing: interview.drawing_data,
          evaluated_notes: interview.notes,
        })
      } catch (evalError) {
        console.error('[EVALUATION] System design evaluation failed:', evalError)
        // Create evaluation without AI scores
        Object.assign(evaluationData, {
          evaluated_drawing: interview.drawing_data,
          evaluated_notes: interview.notes,
        })
      }
    } else {
      // Coding evaluation (existing logic)
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
        language: interview.language || 'python',
        testResults: test_results || defaultTestResults,
        userTestCases: (user_test_cases || []) as TestCase[],
        transcript: (interview.transcript || []) as TranscriptEntry[],
        timeSpentSeconds: interview.time_spent_seconds || 0,
        timeLimitSeconds: interview.time_limit_seconds || 3600,
        runCount: interview.run_count || 0,
        submitCount: interview.submit_count || 0,
      }

      evaluationData.test_results = test_results || defaultTestResults
      evaluationData.user_test_cases = user_test_cases || []
      evaluationData.solution_code = interview.final_code || null

      try {
        const evaluationResult = await evaluationService.evaluate(evalInput)
        console.log(`[EVALUATION] Coding evaluation completed: ${evaluationResult.verdict} (${evaluationResult.overall_score}/100)`)

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
      } catch (evalError) {
        console.error('[EVALUATION] Coding evaluation failed:', evalError)
        // Create evaluation without AI scores (will be pending)
      }
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

// GET /api/evaluations - List user's evaluations with interview and question data
router.get('/', optionalAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id
    const limit = parseInt(req.query.limit as string) || 20

    if (!userId) {
      return res.json({
        success: true,
        evaluations: [],
      })
    }

    // Fetch evaluations with interview and question data for the user
    const { data: evaluations, error } = await supabase
      .from('evaluations')
      .select(`
        *,
        interview:interview_sessions(
          *,
          question:questions(*)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching evaluations:', error)
      return res.status(500).json({ error: 'Failed to fetch evaluations' })
    }

    // Filter to only include evaluations for this user's interviews
    const userEvaluations = evaluations.filter(
      (e) => e.interview?.user_id === userId
    )

    return res.json({
      success: true,
      evaluations: userEvaluations,
    })
  } catch (err) {
    console.error('Unexpected error fetching evaluations:', err)
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
