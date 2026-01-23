import { Router } from 'express'
import { z } from 'zod'
import { executeCode, isConfigured } from '../services/judge0.js'

const router = Router()

const testCaseSchema = z.object({
  input: z.string(),
  expected_output: z.string(),
})

const executeRequestSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  language: z.enum(['python', 'javascript', 'typescript', 'java', 'cpp', 'go']),
  test_cases: z.array(testCaseSchema).min(1, 'At least one test case is required'),
  interview_id: z.string().optional(),
  execution_type: z.enum(['run', 'submit']).optional().default('run'),
})

// POST /api/execute - Execute code against test cases
router.post('/', async (req, res) => {
  try {
    // Check if Judge0 is configured
    if (!isConfigured()) {
      return res.status(503).json({
        error: 'Code execution service not configured',
        message: 'RAPIDAPI_KEY environment variable is not set',
      })
    }

    // Validate request body
    const parseResult = executeRequestSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parseResult.error.errors,
      })
    }

    const { code, language, test_cases } = parseResult.data

    // Execute the code
    const results = await executeCode(code, language, test_cases)

    // Calculate summary
    const passed = results.filter((r) => r.status === 'Accepted').length
    const total = results.length
    const allPassed = passed === total

    return res.json({
      success: true,
      results,
      summary: {
        passed,
        total,
        all_passed: allPassed,
      },
    })
  } catch (error) {
    console.error('Execution error:', error)
    return res.status(500).json({
      error: 'Execution failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// GET /api/execute/status - Check if code execution is available
router.get('/status', (_req, res) => {
  res.json({
    available: isConfigured(),
    message: isConfigured()
      ? 'Code execution service is ready'
      : 'Code execution service is not configured (missing RAPIDAPI_KEY)',
  })
})

export default router
