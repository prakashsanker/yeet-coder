import OpenAI from 'openai'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

function getClient(): OpenAI {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key') {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return new OpenAI({ apiKey: OPENAI_API_KEY })
}

// TTS Voices available from OpenAI
export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'

export interface TTSOptions {
  voice?: OpenAIVoice
  speed?: number // 0.25 to 4.0
}

/**
 * Convert text to speech using OpenAI TTS
 * Returns base64-encoded MP3 audio
 */
export async function textToSpeech(
  text: string,
  options: TTSOptions = {}
): Promise<string> {
  console.log('[TTS] Starting text-to-speech conversion')
  console.log('[TTS] Input text length:', text.length)
  console.log('[TTS] Input text preview:', text.slice(0, 100) + (text.length > 100 ? '...' : ''))

  const client = getClient()
  const { voice = 'onyx', speed = 1.0 } = options

  console.log('[TTS] Using voice:', voice, 'speed:', speed)

  const response = await client.audio.speech.create({
    model: 'tts-1',
    voice,
    input: text,
    speed,
    response_format: 'mp3',
  })

  // Convert response to base64
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const base64 = buffer.toString('base64')

  console.log('[TTS] Generated audio size:', buffer.length, 'bytes')
  console.log('[TTS] Base64 length:', base64.length)

  return base64
}

/**
 * Transcribe audio using OpenAI Whisper
 * Accepts base64-encoded audio (webm, mp3, wav, etc.)
 */
export async function speechToText(
  audioBase64: string,
  mimeType: string = 'audio/webm'
): Promise<string> {
  console.log('[STT] Starting speech-to-text transcription')
  console.log('[STT] Input base64 length:', audioBase64.length)
  console.log('[STT] MIME type:', mimeType)

  const client = getClient()

  // Convert base64 to buffer
  const audioBuffer = Buffer.from(audioBase64, 'base64')
  console.log('[STT] Audio buffer size:', audioBuffer.length, 'bytes')

  // Determine file extension from mime type
  const extMap: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/m4a': 'm4a',
  }
  const ext = extMap[mimeType] || 'webm'
  console.log('[STT] Using file extension:', ext)

  // Create a File-like object for the API
  const file = new File([audioBuffer], `audio.${ext}`, { type: mimeType })

  console.log('[STT] Sending to Whisper API...')
  const transcription = await client.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    language: 'en',
  })

  console.log('[STT] Transcription result:', transcription.text)
  console.log('[STT] Transcription length:', transcription.text.length)

  return transcription.text
}

/**
 * Get available TTS voices
 */
export function getAvailableVoices(): { id: OpenAIVoice; name: string; description: string }[] {
  return [
    { id: 'onyx', name: 'Onyx', description: 'Deep, authoritative male voice - good for interviews' },
    { id: 'alloy', name: 'Alloy', description: 'Neutral, balanced voice' },
    { id: 'echo', name: 'Echo', description: 'Warm, conversational male voice' },
    { id: 'fable', name: 'Fable', description: 'Expressive, British-accented voice' },
    { id: 'nova', name: 'Nova', description: 'Friendly, upbeat female voice' },
    { id: 'shimmer', name: 'Shimmer', description: 'Clear, professional female voice' },
  ]
}

/**
 * Check if OpenAI voice services are configured
 */
export function isConfigured(): boolean {
  return !!OPENAI_API_KEY && OPENAI_API_KEY !== 'your-openai-api-key'
}
