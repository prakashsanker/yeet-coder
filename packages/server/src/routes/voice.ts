import { Router, type Request, type Response } from 'express'
import {
  textToSpeech as cartesiaTTS,
  speechToText as cartesiaSTT,
  getAvailableVoices as getCartesiaVoices,
  isConfigured as isCartesiaConfigured,
  type CartesiaVoice,
} from '../services/cartesia'
import { getInterviewerResponse, generateHint, analyzeApproach } from '../services/interviewer'

const router = Router()

interface TranscriptEntry {
  timestamp: number
  speaker: 'user' | 'interviewer'
  text: string
}

// POST /api/voice/synthesize - Convert text to speech (using Cartesia)
router.post('/synthesize', async (req: Request, res: Response) => {
  try {
    const { text, voice, speed } = req.body

    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text is required' })
      return
    }

    if (!isCartesiaConfigured()) {
      res.status(503).json({ error: 'Cartesia TTS not configured' })
      return
    }

    const audio = await cartesiaTTS(text, {
      voice: voice as CartesiaVoice,
      speed,
    })

    res.json({
      success: true,
      audio, // base64 encoded MP3
      format: 'mp3',
    })
  } catch (error) {
    console.error('Synthesize error:', error)
    res.status(500).json({
      error: 'Failed to synthesize speech',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// POST /api/voice/transcribe - Convert speech to text (using Cartesia Ink)
router.post('/transcribe', async (req: Request, res: Response) => {
  console.log('[VOICE] /transcribe endpoint called')
  try {
    const { audio, mime_type } = req.body as {
      audio: string // base64 encoded
      mime_type?: string
    }

    console.log('[VOICE] Audio present:', !!audio, 'length:', audio?.length || 0)
    console.log('[VOICE] MIME type:', mime_type)

    if (!audio) {
      console.log('[VOICE] Error: No audio data')
      res.status(400).json({ error: 'Audio data is required' })
      return
    }

    if (!isCartesiaConfigured()) {
      console.log('[VOICE] Error: Cartesia not configured')
      res.status(503).json({ error: 'Cartesia STT not configured' })
      return
    }

    const text = await cartesiaSTT(audio, mime_type || 'audio/webm')
    console.log('[VOICE] Transcription successful:', text)

    res.json({
      success: true,
      text,
    })
  } catch (error) {
    console.error('[VOICE] Transcribe error:', error)
    res.status(500).json({
      error: 'Failed to transcribe audio',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// POST /api/voice/respond - Get AI interviewer response (text-based fallback)
router.post('/respond', async (req: Request, res: Response) => {
  console.log('[VOICE] /respond endpoint called')
  try {
    const { transcript, current_question, user_code, include_audio } = req.body as {
      transcript: TranscriptEntry[]
      current_question: string
      user_code: string
      include_audio?: boolean
    }

    console.log('[VOICE] Transcript entries:', transcript?.length || 0)
    console.log('[VOICE] Last user message:', transcript?.filter(t => t.speaker === 'user').slice(-1)[0]?.text || 'none')
    console.log('[VOICE] Include audio:', include_audio)

    if (!Array.isArray(transcript)) {
      console.log('[VOICE] Error: Invalid transcript')
      res.status(400).json({ error: 'Transcript array is required' })
      return
    }

    // Get AI response
    console.log('[VOICE] Getting AI response...')
    const response = await getInterviewerResponse(transcript, current_question || '', user_code || '')
    console.log('[VOICE] AI response:', response.slice(0, 100) + (response.length > 100 ? '...' : ''))

    // Optionally synthesize to audio using Cartesia
    let audio: string | undefined
    if (include_audio && isCartesiaConfigured()) {
      try {
        console.log('[VOICE] Generating TTS audio with Cartesia...')
        audio = await cartesiaTTS(response)
        console.log('[VOICE] TTS audio generated, length:', audio?.length || 0)
      } catch (error) {
        console.error('[VOICE] TTS failed:', error)
        // Continue without audio
      }
    }

    res.json({
      success: true,
      text: response,
      audio,
    })
  } catch (error) {
    console.error('[VOICE] Respond error:', error)
    res.status(500).json({
      error: 'Failed to generate response',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// POST /api/voice/introduce - Get an introduction for the interview
router.post('/introduce', async (req: Request, res: Response) => {
  try {
    const { current_question, include_audio } = req.body as {
      current_question: string
      include_audio?: boolean
    }

    if (!current_question) {
      res.status(400).json({ error: 'Current question is required' })
      return
    }

    // Generate introduction using the interviewer
    const introduction = await getInterviewerResponse([], current_question, '')

    let audio: string | undefined
    if (include_audio && isCartesiaConfigured()) {
      try {
        audio = await cartesiaTTS(introduction)
      } catch (error) {
        console.error('TTS failed:', error)
      }
    }

    res.json({
      success: true,
      text: introduction,
      audio,
    })
  } catch (error) {
    console.error('Introduction error:', error)
    res.status(500).json({
      error: 'Failed to generate introduction',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// POST /api/voice/hint - Get a hint for the current problem
router.post('/hint', async (req: Request, res: Response) => {
  try {
    const { current_question, user_code, transcript, include_audio } = req.body as {
      current_question: string
      user_code: string
      transcript: TranscriptEntry[]
      include_audio?: boolean
    }

    if (!current_question) {
      res.status(400).json({ error: 'Current question is required' })
      return
    }

    const hint = await generateHint(current_question, user_code || '', transcript || [])

    let audio: string | undefined
    if (include_audio && isCartesiaConfigured()) {
      try {
        audio = await cartesiaTTS(hint)
      } catch (error) {
        console.error('TTS failed:', error)
      }
    }

    res.json({
      success: true,
      text: hint,
      audio,
    })
  } catch (error) {
    console.error('Hint error:', error)
    res.status(500).json({
      error: 'Failed to generate hint',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// POST /api/voice/analyze - Analyze candidate's approach
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { current_question, user_code, explanation } = req.body as {
      current_question: string
      user_code: string
      explanation: string
    }

    if (!current_question || !explanation) {
      res.status(400).json({ error: 'Question and explanation are required' })
      return
    }

    const analysis = await analyzeApproach(current_question, user_code || '', explanation)

    res.json({
      success: true,
      ...analysis,
    })
  } catch (error) {
    console.error('Analyze error:', error)
    res.status(500).json({
      error: 'Failed to analyze approach',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// GET /api/voice/voices - Get available TTS voices (Cartesia)
router.get('/voices', (_req: Request, res: Response) => {
  const voices = getCartesiaVoices()
  res.json({ voices })
})

// GET /api/voice/status - Check voice service status
router.get('/status', (_req: Request, res: Response) => {
  const llmConfigured = !!process.env.OPENROUTER_API_KEY
  const cartesiaConfigured = isCartesiaConfigured()

  res.json({
    llm: {
      available: llmConfigured,
      provider: 'openrouter',
      model: 'anthropic/claude-opus-4',
    },
    tts: {
      available: cartesiaConfigured,
      provider: 'cartesia',
      model: 'sonic-3',
    },
    stt: {
      available: cartesiaConfigured,
      provider: 'cartesia',
      model: 'ink-whisper',
    },
    websocket: {
      available: true,
      path: '/ws/interview',
    },
  })
})

export default router
