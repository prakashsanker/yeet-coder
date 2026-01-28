import { Router } from 'express'
import { z } from 'zod'
import { questionGenerator, type Difficulty } from '../services/questionGenerator.js'
import { supabase } from '../db/supabase.js'

const router = Router()

// In-memory cache for questions (refreshes every 30 minutes)
const CACHE_TTL_MS = 30 * 60 * 1000
interface QuestionCache {
  data: unknown[]
  timestamp: number
}
const questionsCache: Map<string, QuestionCache> = new Map()

function getCacheKey(type?: string, topic_id?: string, difficulty?: string): string {
  return `${type || 'all'}_${topic_id || 'all'}_${difficulty || 'all'}`
}

function getCachedQuestions(key: string): unknown[] | null {
  const cached = questionsCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }
  return null
}

function setCachedQuestions(key: string, data: unknown[]): void {
  questionsCache.set(key, { data, timestamp: Date.now() })
}

// Warm the cache on server startup for common queries
export async function warmQuestionsCache(): Promise<void> {
  const startTime = performance.now()
  console.log('[Questions] Warming cache...')
  try {
    // Pre-fetch system design questions (most commonly accessed)
    const sdStart = performance.now()
    const { data: systemDesignQuestions, error: sdError } = await supabase
      .from('questions')
      .select('*')
      .eq('type', 'system_design')
      .order('difficulty', { ascending: true })
      .limit(50)

    if (!sdError && systemDesignQuestions) {
      setCachedQuestions(getCacheKey('system_design', undefined, undefined), systemDesignQuestions)
      console.log(`[Questions] Cached ${systemDesignQuestions.length} system design questions (${(performance.now() - sdStart).toFixed(2)}ms)`)
    }

    // Pre-fetch coding questions
    const cStart = performance.now()
    const { data: codingQuestions, error: cError } = await supabase
      .from('questions')
      .select('*')
      .eq('type', 'coding')
      .order('difficulty', { ascending: true })
      .limit(50)

    if (!cError && codingQuestions) {
      setCachedQuestions(getCacheKey('coding', undefined, undefined), codingQuestions)
      console.log(`[Questions] Cached ${codingQuestions.length} coding questions (${(performance.now() - cStart).toFixed(2)}ms)`)
    }

    console.log(`[Questions] Cache warming complete (total: ${(performance.now() - startTime).toFixed(2)}ms)`)
  } catch (err) {
    console.error('[Questions] Cache warming failed:', err)
  }
}

const generateQuestionSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  topicId: z.string().optional(),
})

// GET /api/questions - List questions with optional filters
router.get('/', async (req, res) => {
  const startTime = performance.now()
  try {
    const { type, topic_id, difficulty, limit = '50' } = req.query
    const cacheKey = getCacheKey(type as string, topic_id as string, difficulty as string)

    // Check cache first
    const cachedQuestions = getCachedQuestions(cacheKey)
    if (cachedQuestions) {
      const duration = (performance.now() - startTime).toFixed(2)
      console.log(`[Questions] GET / - CACHE HIT (${duration}ms) - ${cachedQuestions.length} questions`)
      return res.json({ questions: cachedQuestions.slice(0, parseInt(limit as string)) })
    }

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
    const duration = (performance.now() - startTime).toFixed(2)

    if (error) {
      console.error('Error fetching questions:', error)
      return res.status(500).json({ error: 'Failed to fetch questions' })
    }

    console.log(`[Questions] GET / - CACHE MISS (${duration}ms) - fetched ${questions?.length || 0} questions from Supabase`)

    // Cache the results
    setCachedQuestions(cacheKey, questions || [])

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
