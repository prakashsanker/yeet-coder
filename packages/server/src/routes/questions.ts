import { Router } from 'express'
import { z } from 'zod'
import { questionGenerator, type Difficulty } from '../services/questionGenerator.js'

const router = Router()

const generateQuestionSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  topicId: z.string().optional(),
})

router.post('/generate', async (req, res) => {
  try {
    const body = generateQuestionSchema.parse(req.body)

    const question = await questionGenerator.generate({
      topic: body.topic,
      difficulty: body.difficulty as Difficulty,
    })

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
