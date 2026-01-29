/**
 * Quiz API routes for system design concept practice.
 *
 * Endpoints:
 * - POST /api/quiz/sessions - Create a new quiz session
 * - GET /api/quiz/sessions/:id - Get quiz session with questions
 * - POST /api/quiz/sessions/:id/answer - Submit an answer
 * - GET /api/quiz/performance - Get user's quiz performance by topic
 * - GET /api/quiz/weak-areas - Get weak areas from recent evaluations
 */

import { Router, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../db/supabase.js'
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js'
import { quizService, type QuestionType, type DifficultyLevel } from '../services/quizService.js'

const router = Router()

// All quiz routes require authentication
router.use(authMiddleware)

// Validation schemas
const createSessionSchema = z.object({
  topic: z.string().min(1),
  pattern_id: z.number().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  question_type: z.enum(['multiple_choice', 'true_false', 'scenario']),
  total_questions: z.number().min(1).max(20),
})

const submitAnswerSchema = z.object({
  question_id: z.string().uuid(),
  answer: z.string(),
})

// POST /api/quiz/sessions - Create a new quiz session and generate questions
router.post('/sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const parseResult = createSessionSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parseResult.error.errors,
      })
    }

    const { topic, pattern_id, difficulty, question_type, total_questions } = parseResult.data

    // Get existing question hashes for this user to avoid repetition
    const { data: existingQuestions } = await supabase
      .from('quiz_questions')
      .select('content_hash, session:quiz_sessions!inner(user_id)')
      .eq('session.user_id', userId)
      .not('content_hash', 'is', null)

    const existingHashes = existingQuestions?.map(q => q.content_hash).filter(Boolean) || []

    // Generate questions
    const questions = await quizService.generateQuestions({
      topic,
      difficulty: difficulty as DifficultyLevel,
      questionType: question_type as QuestionType,
      count: total_questions,
      existingHashes,
    })

    if (questions.length === 0) {
      return res.status(500).json({ error: 'Failed to generate questions' })
    }

    // Create quiz session
    const { data: session, error: sessionError } = await supabase
      .from('quiz_sessions')
      .insert({
        user_id: userId,
        topic,
        pattern_id,
        difficulty,
        question_type,
        total_questions: questions.length,
      })
      .select()
      .single()

    if (sessionError || !session) {
      console.error('Error creating quiz session:', sessionError)
      return res.status(500).json({ error: 'Failed to create quiz session' })
    }

    // Insert questions
    const questionRecords = questions.map((q, index) => ({
      session_id: session.id,
      question_order: index + 1,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      wrong_explanations: q.wrong_explanations,
      content_hash: q.content_hash,
    }))

    const { data: insertedQuestions, error: questionsError } = await supabase
      .from('quiz_questions')
      .insert(questionRecords)
      .select()

    if (questionsError) {
      console.error('Error inserting questions:', questionsError)
      // Clean up session
      await supabase.from('quiz_sessions').delete().eq('id', session.id)
      return res.status(500).json({ error: 'Failed to save questions' })
    }

    console.log(`[QUIZ] Created session ${session.id} with ${insertedQuestions?.length} questions`)

    return res.status(201).json({
      success: true,
      session: {
        ...session,
        questions: insertedQuestions?.map(q => ({
          id: q.id,
          question_order: q.question_order,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          // Don't expose correct answer yet
        })),
      },
    })
  } catch (err) {
    console.error('Unexpected error creating quiz session:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/quiz/sessions/:id - Get quiz session with questions
router.get('/sessions/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { id } = req.params

    const { data: session, error } = await supabase
      .from('quiz_sessions')
      .select(`
        *,
        questions:quiz_questions(*)
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !session) {
      return res.status(404).json({ error: 'Quiz session not found' })
    }

    // Sort questions by order
    const questions = (session.questions || []).sort(
      (a: { question_order: number }, b: { question_order: number }) =>
        a.question_order - b.question_order
    )

    // Format questions based on whether they've been answered
    const formattedQuestions = questions.map((q: {
      id: string
      question_order: number
      question_text: string
      question_type: string
      options: unknown
      user_answer: string | null
      is_correct: boolean | null
      correct_answer: string
      explanation: string
      wrong_explanations: unknown
    }) => {
      const base = {
        id: q.id,
        question_order: q.question_order,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        user_answer: q.user_answer,
        is_correct: q.is_correct,
      }

      // Only include explanation and correct answer if answered
      if (q.user_answer !== null) {
        return {
          ...base,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          wrong_explanations: q.wrong_explanations,
        }
      }

      return base
    })

    return res.json({
      success: true,
      session: {
        id: session.id,
        topic: session.topic,
        pattern_id: session.pattern_id,
        difficulty: session.difficulty,
        question_type: session.question_type,
        total_questions: session.total_questions,
        correct_count: session.correct_count,
        completed_at: session.completed_at,
        created_at: session.created_at,
        questions: formattedQuestions,
      },
    })
  } catch (err) {
    console.error('Unexpected error fetching quiz session:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/quiz/sessions/:id/answer - Submit an answer
router.post('/sessions/:id/answer', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { id: sessionId } = req.params

    const parseResult = submitAnswerSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parseResult.error.errors,
      })
    }

    const { question_id, answer } = parseResult.data

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('quiz_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single()

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Quiz session not found' })
    }

    // Get the question
    const { data: question, error: questionError } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('id', question_id)
      .eq('session_id', sessionId)
      .single()

    if (questionError || !question) {
      return res.status(404).json({ error: 'Question not found' })
    }

    // Check if already answered
    if (question.user_answer !== null) {
      return res.status(400).json({ error: 'Question already answered' })
    }

    // Check if correct
    const isCorrect = answer === question.correct_answer

    // Update question with answer
    const { error: updateError } = await supabase
      .from('quiz_questions')
      .update({
        user_answer: answer,
        is_correct: isCorrect,
        answered_at: new Date().toISOString(),
      })
      .eq('id', question_id)

    if (updateError) {
      console.error('Error updating question:', updateError)
      return res.status(500).json({ error: 'Failed to save answer' })
    }

    // Update session correct count
    if (isCorrect) {
      await supabase
        .from('quiz_sessions')
        .update({ correct_count: (session.correct_count || 0) + 1 })
        .eq('id', sessionId)
    }

    // Check if all questions answered
    const { data: allQuestions } = await supabase
      .from('quiz_questions')
      .select('user_answer')
      .eq('session_id', sessionId)

    const allAnswered = allQuestions?.every((q: { user_answer: string | null }) => q.user_answer !== null)

    if (allAnswered) {
      // Mark session as completed
      await supabase
        .from('quiz_sessions')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', sessionId)

      // Update user performance
      await updateUserPerformance(userId, session.topic, isCorrect)
    } else {
      // Still update performance for this question
      await updateUserPerformance(userId, session.topic, isCorrect)
    }

    return res.json({
      success: true,
      result: {
        is_correct: isCorrect,
        correct_answer: question.correct_answer,
        explanation: question.explanation,
        wrong_explanations: question.wrong_explanations,
        session_completed: allAnswered,
      },
    })
  } catch (err) {
    console.error('Unexpected error submitting answer:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Helper to update user performance
async function updateUserPerformance(userId: string, topic: string, isCorrect: boolean) {
  try {
    // Try to update existing record
    const { data: existing } = await supabase
      .from('user_quiz_performance')
      .select('*')
      .eq('user_id', userId)
      .eq('topic', topic)
      .single()

    if (existing) {
      await supabase
        .from('user_quiz_performance')
        .update({
          total_questions: existing.total_questions + 1,
          correct_count: existing.correct_count + (isCorrect ? 1 : 0),
          last_practiced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('user_quiz_performance')
        .insert({
          user_id: userId,
          topic,
          total_questions: 1,
          correct_count: isCorrect ? 1 : 0,
          last_practiced_at: new Date().toISOString(),
        })
    }
  } catch (error) {
    console.error('Error updating user performance:', error)
  }
}

// GET /api/quiz/performance - Get user's quiz performance by topic
router.get('/performance', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { data: performance, error } = await supabase
      .from('user_quiz_performance')
      .select('*')
      .eq('user_id', userId)
      .order('last_practiced_at', { ascending: false })

    if (error) {
      console.error('Error fetching performance:', error)
      return res.status(500).json({ error: 'Failed to fetch performance' })
    }

    return res.json({
      success: true,
      performance: performance || [],
    })
  } catch (err) {
    console.error('Unexpected error fetching performance:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/quiz/weak-areas - Get weak areas from recent evaluations
router.get('/weak-areas', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get recent evaluations with weak_areas
    const { data: evaluations, error } = await supabase
      .from('evaluations')
      .select(`
        weak_areas,
        created_at,
        interview:interview_sessions!inner(user_id)
      `)
      .not('weak_areas', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching weak areas:', error)
      return res.status(500).json({ error: 'Failed to fetch weak areas' })
    }

    // Filter for user's evaluations and aggregate weak areas
    interface EvalWithInterview {
      weak_areas: string[] | null
      created_at: string
      interview: { user_id: string } | { user_id: string }[]
    }

    const userEvaluations = evaluations?.filter((e: EvalWithInterview) => {
      const interview = Array.isArray(e.interview) ? e.interview[0] : e.interview
      return interview?.user_id === userId
    }) || []

    // Count occurrences of each weak area
    const weakAreaCounts: Record<string, number> = {}
    userEvaluations.forEach((e: EvalWithInterview) => {
      const areas = e.weak_areas || []
      areas.forEach((area: string) => {
        weakAreaCounts[area] = (weakAreaCounts[area] || 0) + 1
      })
    })

    // Sort by count and return
    const sortedWeakAreas = Object.entries(weakAreaCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([topic, count]) => ({ topic, count }))

    return res.json({
      success: true,
      weak_areas: sortedWeakAreas,
    })
  } catch (err) {
    console.error('Unexpected error fetching weak areas:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/quiz/sessions - List user's quiz sessions
router.get('/sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const limit = parseInt(req.query.limit as string) || 20

    const { data: sessions, error } = await supabase
      .from('quiz_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching sessions:', error)
      return res.status(500).json({ error: 'Failed to fetch sessions' })
    }

    return res.json({
      success: true,
      sessions: sessions || [],
    })
  } catch (err) {
    console.error('Unexpected error fetching sessions:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
