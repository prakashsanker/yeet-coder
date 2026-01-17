import { Router, Request, Response } from 'express'
import { supabase } from '../db/supabase'
import { Topic } from '../types'

const router = Router()

// GET /api/topics - List all topics ordered by difficulty
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { data: topics, error } = await supabase
      .from('topics')
      .select('*')
      .order('difficulty_order', { ascending: true })

    if (error) {
      console.error('Error fetching topics:', error)
      return res.status(500).json({ error: 'Failed to fetch topics' })
    }

    return res.json({ topics: topics as Topic[] })
  } catch (err) {
    console.error('Unexpected error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/topics/weakest - Get user's 3 weakest topics
router.get('/weakest', async (req: Request, res: Response) => {
  try {
    // For now, we'll return topics without user context
    // In the future, this will use auth middleware to get user_id
    const userId = req.headers['x-user-id'] as string | undefined

    if (!userId) {
      // If no user, return random 3 topics for demo
      const { data: topics, error } = await supabase
        .from('topics')
        .select('*')
        .order('difficulty_order', { ascending: true })
        .limit(3)

      if (error) {
        console.error('Error fetching topics:', error)
        return res.status(500).json({ error: 'Failed to fetch topics' })
      }

      return res.json({
        topics: topics as Topic[],
        message: 'No user context - returning beginner topics'
      })
    }

    // Get user's weakest topics based on progress
    const { data: progress, error: progressError } = await supabase
      .from('user_topic_progress')
      .select(`
        topic_id,
        weakness_score,
        topics (*)
      `)
      .eq('user_id', userId)
      .order('weakness_score', { ascending: false })
      .limit(3)

    if (progressError) {
      console.error('Error fetching user progress:', progressError)
      return res.status(500).json({ error: 'Failed to fetch user progress' })
    }

    if (!progress || progress.length === 0) {
      // User has no progress, return first 3 topics
      const { data: topics, error } = await supabase
        .from('topics')
        .select('*')
        .order('difficulty_order', { ascending: true })
        .limit(3)

      if (error) {
        console.error('Error fetching topics:', error)
        return res.status(500).json({ error: 'Failed to fetch topics' })
      }

      return res.json({
        topics: topics as Topic[],
        message: 'No progress data - returning beginner topics'
      })
    }

    // Extract topics from progress data
    const weakestTopics = progress
      .map(p => p.topics as unknown as Topic)
      .filter(Boolean)

    return res.json({ topics: weakestTopics })
  } catch (err) {
    console.error('Unexpected error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/topics/:id/progress - Get user's progress for a specific topic
router.get('/:id/progress', async (req: Request, res: Response) => {
  try {
    const { id: topicId } = req.params
    const userId = req.headers['x-user-id'] as string | undefined

    if (!userId) {
      return res.json({
        progress: null,
        message: 'No user context'
      })
    }

    const { data: progress, error } = await supabase
      .from('user_topic_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('topic_id', topicId)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      console.error('Error fetching progress:', error)
      return res.status(500).json({ error: 'Failed to fetch progress' })
    }

    return res.json({ progress })
  } catch (err) {
    console.error('Unexpected error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
