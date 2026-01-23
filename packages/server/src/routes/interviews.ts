import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../db/supabase'
import { optionalAuthMiddleware, AuthenticatedRequest } from '../middleware/auth'
import type { InterviewSession, TranscriptEntry, Question } from '../types'

const router = Router()

// Validation schemas
// New schema: uses question_id to reference questions table
const createInterviewSchema = z.object({
  question_id: z.string().uuid(),
  language: z.string().default('python'),
  time_limit_seconds: z.number().optional().default(3600),
})

const updateInterviewSchema = z.object({
  code: z.string().optional(),
  language: z.string().optional(),
  time_spent_seconds: z.number().optional(),
  increment_run_count: z.boolean().optional(),
  transcript_entry: z.object({
    timestamp: z.number(),
    speaker: z.enum(['user', 'interviewer']),
    text: z.string(),
  }).optional(),
  // System design specific fields
  drawing_data: z.object({
    elements: z.array(z.any()),
  }).optional(),
  notes: z.string().optional(),
})

const endInterviewSchema = z.object({
  final_code: z.string().optional(), // Optional for system design interviews
  reason: z.enum(['submit', 'give_up', 'timeout']),
  time_spent_seconds: z.number(),
})

// POST /api/interviews - Start a new interview
router.post('/', optionalAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = createInterviewSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parseResult.error.errors,
      })
    }

    const { question_id, language, time_limit_seconds } = parseResult.data

    // Fetch the question to get topic_id and validate it exists
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('*')
      .eq('id', question_id)
      .single()

    if (questionError || !question) {
      console.error('Error fetching question:', questionError)
      return res.status(404).json({ error: 'Question not found' })
    }

    const topic_id = question.topic_id

    // Determine session type based on question type
    const session_type = question.type === 'system_design' ? 'system_design' : 'coding'

    // Check if user is authenticated
    const userId = req.user?.id

    // For anonymous users, return a local-only interview (not persisted to DB)
    if (!userId) {
      // Anonymous users cannot start interviews - must sign in
      return res.status(401).json({
        error: 'authentication_required',
        message: 'Please sign in to start an interview',
      })
    }

    // Check subscription tier and enforce free tier limit
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single()

    const subscriptionTier = profile?.subscription_tier || 'free'

    if (subscriptionTier === 'free') {
      // Count existing interviews for this user
      const { count } = await supabase
        .from('interview_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (count && count >= 1) {
        // Get their existing interview for resume link
        const { data: existingInterview } = await supabase
          .from('interview_sessions')
          .select('id, question_id, session_type, status')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        console.log(`[INTERVIEW] Free tier limit reached for user ${userId}`)

        return res.status(403).json({
          error: 'free_tier_limit',
          message: 'Free tier allows 1 interview. Upgrade to Pro for unlimited access.',
          existingInterview,
        })
      }
    }

    // Ensure user profile exists (create if missing - handles case where trigger didn't run)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (!existingProfile) {
      console.log(`[INTERVIEW] Creating missing profile for user ${userId}`)
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: userId })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        // Continue anyway - the interview insert will fail with FK error if profile still doesn't exist
      }
    }

    const { data: interview, error } = await supabase
      .from('interview_sessions')
      .insert({
        user_id: userId,
        topic_id,
        question_id,
        session_type,
        language: session_type === 'coding' ? language : null,
        time_limit_seconds,
        status: 'in_progress',
        run_count: 0,
        submit_count: 0,
        transcript: [],
        drawing_data: null,
        notes: null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating interview:', error)
      return res.status(500).json({ error: 'Failed to create interview' })
    }

    // Return interview with joined question data
    const interviewWithQuestion = {
      ...interview,
      question: question as Question,
    }

    console.log(`[INTERVIEW] Created new interview ${interview.id} for question ${question_id}`)

    return res.status(201).json({
      success: true,
      interview: interviewWithQuestion as InterviewSession,
    })
  } catch (err) {
    console.error('Unexpected error creating interview:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/interviews - List user's interviews with question data
router.get('/', optionalAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id
    const status = req.query.status as string | undefined
    const limit = parseInt(req.query.limit as string) || 20

    let query = supabase
      .from('interview_sessions')
      .select(`
        *,
        question:questions(*)
      `)
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

// GET /api/interviews/:id - Get interview state with question data
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Fetch interview with joined question data
    const { data: interview, error } = await supabase
      .from('interview_sessions')
      .select(`
        *,
        question:questions(*)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Interview not found' })
      }
      console.error('Error fetching interview:', error)
      return res.status(500).json({ error: 'Failed to fetch interview' })
    }

    // If interview has question_id but join failed (shouldn't happen), fetch separately
    if (interview.question_id && !interview.question) {
      const { data: question } = await supabase
        .from('questions')
        .select('*')
        .eq('id', interview.question_id)
        .single()

      if (question) {
        interview.question = question
      }
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

    const { code, language, time_spent_seconds, increment_run_count, transcript_entry, drawing_data, notes } = parseResult.data

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

    if (time_spent_seconds !== undefined) {
      updateData.time_spent_seconds = time_spent_seconds
    }

    if (increment_run_count) {
      updateData.run_count = (currentInterview.run_count || 0) + 1
    }

    if (transcript_entry) {
      const currentTranscript = (currentInterview.transcript || []) as TranscriptEntry[]
      updateData.transcript = [...currentTranscript, transcript_entry]
    }

    // System design specific updates
    if (drawing_data !== undefined) {
      updateData.drawing_data = drawing_data
    }

    if (notes !== undefined) {
      updateData.notes = notes
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
      hasDrawing: !!drawing_data,
      hasNotes: !!notes,
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

    // Build update object - final_code is optional for system design interviews
    const updateObj: Record<string, unknown> = {
      status,
      time_spent_seconds,
      ended_at: new Date().toISOString(),
    }

    if (final_code !== undefined) {
      updateObj.final_code = final_code
    }

    const { data: interview, error } = await supabase
      .from('interview_sessions')
      .update(updateObj)
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
