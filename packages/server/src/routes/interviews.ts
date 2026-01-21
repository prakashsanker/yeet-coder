import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../db/supabase'
import type { InterviewSession, TranscriptEntry } from '../types'

const router = Router()

// Validation schemas
const createInterviewSchema = z.object({
  topic_id: z.string().uuid(),
  question_data: z.object({
    title: z.string(),
    description: z.string(),
    examples: z.array(z.object({
      input: z.string(),
      output: z.string(),
      explanation: z.string().optional(),
    })),
    constraints: z.array(z.string()),
    visible_test_cases: z.array(z.object({
      input: z.string(),
      expected_output: z.string(),
    })),
    hidden_test_cases: z.array(z.object({
      input: z.string(),
      expected_output: z.string(),
    })),
    starter_code: z.object({
      python: z.string(),
      javascript: z.string(),
      typescript: z.string(),
      java: z.string(),
      cpp: z.string(),
    }),
  }),
  language: z.string().default('python'),
  time_limit_seconds: z.number().optional().default(3600),
})

const updateInterviewSchema = z.object({
  code: z.string().optional(),
  language: z.string().optional(),
  increment_run_count: z.boolean().optional(),
  transcript_entry: z.object({
    timestamp: z.number(),
    speaker: z.enum(['user', 'interviewer']),
    text: z.string(),
  }).optional(),
})

const endInterviewSchema = z.object({
  final_code: z.string(),
  reason: z.enum(['submit', 'give_up', 'timeout']),
  time_spent_seconds: z.number(),
})

// POST /api/interviews - Start a new interview
router.post('/', async (req: Request, res: Response) => {
  try {
    const parseResult = createInterviewSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parseResult.error.errors,
      })
    }

    const { topic_id, question_data, language, time_limit_seconds } = parseResult.data

    // For now, use a demo user ID (in production, this comes from auth middleware)
    const userId = req.headers['x-user-id'] as string || '00000000-0000-0000-0000-000000000000'

    const { data: interview, error } = await supabase
      .from('interview_sessions')
      .insert({
        user_id: userId,
        topic_id,
        question_data,
        language,
        time_limit_seconds,
        status: 'in_progress',
        run_count: 0,
        submit_count: 0,
        transcript: [],
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating interview:', error)
      return res.status(500).json({ error: 'Failed to create interview' })
    }

    console.log(`[INTERVIEW] Created new interview ${interview.id} for topic ${topic_id}`)

    return res.status(201).json({
      success: true,
      interview: interview as InterviewSession,
    })
  } catch (err) {
    console.error('Unexpected error creating interview:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/interviews - List user's interviews
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string
    const status = req.query.status as string | undefined
    const limit = parseInt(req.query.limit as string) || 20

    let query = supabase
      .from('interview_sessions')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: interviews, error } = await query

    if (error) {
      console.error('Error fetching interviews:', error)
      return res.status(500).json({ error: 'Failed to fetch interviews' })
    }

    return res.json({
      success: true,
      interviews: interviews as InterviewSession[],
    })
  } catch (err) {
    console.error('Unexpected error fetching interviews:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/interviews/:id - Get interview state
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { data: interview, error } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Interview not found' })
      }
      console.error('Error fetching interview:', error)
      return res.status(500).json({ error: 'Failed to fetch interview' })
    }

    return res.json({
      success: true,
      interview: interview as InterviewSession,
    })
  } catch (err) {
    console.error('Unexpected error fetching interview:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/interviews/:id - Update code, increment run count, or add transcript
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const parseResult = updateInterviewSchema.safeParse(req.body)

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parseResult.error.errors,
      })
    }

    const { code, language, increment_run_count, transcript_entry } = parseResult.data

    // First, get the current interview state
    const { data: currentInterview, error: fetchError } = await supabase
      .from('interview_sessions')
      .select('run_count, transcript')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Interview not found' })
      }
      console.error('Error fetching interview:', fetchError)
      return res.status(500).json({ error: 'Failed to fetch interview' })
    }

    // Build the update object
    const updateData: Record<string, unknown> = {}

    if (code !== undefined) {
      updateData.final_code = code
    }

    if (language !== undefined) {
      updateData.language = language
    }

    if (increment_run_count) {
      updateData.run_count = (currentInterview.run_count || 0) + 1
    }

    if (transcript_entry) {
      const currentTranscript = (currentInterview.transcript || []) as TranscriptEntry[]
      updateData.transcript = [...currentTranscript, transcript_entry]
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No updates provided' })
    }

    const { data: interview, error } = await supabase
      .from('interview_sessions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating interview:', error)
      return res.status(500).json({ error: 'Failed to update interview' })
    }

    console.log(`[INTERVIEW] Updated interview ${id}`, {
      hasCode: !!code,
      incrementedRun: !!increment_run_count,
      newRunCount: interview.run_count,
      transcriptLength: interview.transcript?.length || 0,
    })

    return res.json({
      success: true,
      interview: interview as InterviewSession,
    })
  } catch (err) {
    console.error('Unexpected error updating interview:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/interviews/:id/submit - Submit solution (run all tests)
router.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { final_code, time_spent_seconds } = req.body

    // Get the current interview
    const { data: currentInterview, error: fetchError } = await supabase
      .from('interview_sessions')
      .select('submit_count, question_data')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Interview not found' })
      }
      console.error('Error fetching interview:', fetchError)
      return res.status(500).json({ error: 'Failed to fetch interview' })
    }

    // Update interview with submission
    const { data: interview, error } = await supabase
      .from('interview_sessions')
      .update({
        final_code,
        submit_count: (currentInterview.submit_count || 0) + 1,
        time_spent_seconds,
        status: 'completed',
        ended_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error submitting interview:', error)
      return res.status(500).json({ error: 'Failed to submit interview' })
    }

    console.log(`[INTERVIEW] Interview ${id} submitted`, {
      submitCount: interview.submit_count,
      timeSpent: time_spent_seconds,
    })

    return res.json({
      success: true,
      interview: interview as InterviewSession,
    })
  } catch (err) {
    console.error('Unexpected error submitting interview:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/interviews/:id/end - End interview (give up or timeout)
router.post('/:id/end', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const parseResult = endInterviewSchema.safeParse(req.body)

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parseResult.error.errors,
      })
    }

    const { final_code, reason, time_spent_seconds } = parseResult.data

    const status = reason === 'submit' ? 'completed' : 'abandoned'

    const { data: interview, error } = await supabase
      .from('interview_sessions')
      .update({
        final_code,
        status,
        time_spent_seconds,
        ended_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Interview not found' })
      }
      console.error('Error ending interview:', error)
      return res.status(500).json({ error: 'Failed to end interview' })
    }

    console.log(`[INTERVIEW] Interview ${id} ended`, {
      reason,
      status,
      timeSpent: time_spent_seconds,
    })

    return res.json({
      success: true,
      interview: interview as InterviewSession,
    })
  } catch (err) {
    console.error('Unexpected error ending interview:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
