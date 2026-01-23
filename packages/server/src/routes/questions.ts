import { Router } from 'express'
import { z } from 'zod'
import { questionGenerator, type Difficulty } from '../services/questionGenerator.js'
import { supabase } from '../db/supabase.js'

const router = Router()

const generateQuestionSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  topicId: z.string().optional(),
})

// GET /api/questions - List questions with optional filters
router.get('/', async (req, res) => {
  try {
    const { type, topic_id, difficulty, limit = '50' } = req.query

    let query = supabase
      .from('questions')
      .select('*')
      .order('difficulty', { ascending: true })
      .limit(parseInt(limit as string))

    if (type) {
      query = query.eq('type', type)
    }

    if (topic_id) {
      query = query.eq('topic_id', topic_id)
    }

    if (difficulty) {
      query = query.eq('difficulty', difficulty)
    }

    const { data: questions, error } = await query

    if (error) {
      console.error('Error fetching questions:', error)
      return res.status(500).json({ error: 'Failed to fetch questions' })
    }

    return res.json({ questions })
  } catch (err) {
    console.error('Unexpected error fetching questions:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/questions/:id - Get a specific question
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const { data: question, error } = await supabase
      .from('questions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Question not found' })
      }
      console.error('Error fetching question:', error)
      return res.status(500).json({ error: 'Failed to fetch question' })
    }

    return res.json({ question })
  } catch (err) {
    console.error('Unexpected error fetching question:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/generate', async (req, res) => {
  console.log('[Questions] POST /generate called', { topic: req.body.topic, difficulty: req.body.difficulty })

  try {
    const body = generateQuestionSchema.parse(req.body)

    console.log('[Questions] Generating question for topic:', body.topic)
    const question = await questionGenerator.generate({
      topic: body.topic,
      difficulty: body.difficulty as Difficulty,
    })
    console.log('[Questions] Question generated successfully:', question.title)

    res.json({ question, topicId: body.topicId })
  } catch (error) {
    console.error('Error generating question:', error)

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      })
    }

    res.status(500).json({
      error: 'Failed to generate question',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

export default router
