/**
 * Cartesia TTS Service
 * Uses Cartesia Sonic-3 for low-latency, expressive text-to-speech
 *
 * Docs: https://docs.cartesia.ai/api-reference/tts/bytes
 */

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY
const CARTESIA_API_URL = 'https://api.cartesia.ai/tts/bytes'
const CARTESIA_VERSION = '2025-04-16'

// Available Cartesia voices
export type CartesiaVoice =
  | 'theo'        // Male, steady, confident - good for interviews
  | 'ronald'      // Male, deep, thoughtful
  | 'kiefer'      // Male, professional
  | 'katie'       // Female, friendly
  | 'blake'       // Male, energetic support

// Voice ID mapping
const VOICE_IDS: Record<CartesiaVoice, string> = {
  'theo': '79f8b5fb-2cc8-479a-80df-29f7a7cf1a3e',      // Steady, enunciating, confident young male
  'ronald': '5ee9feff-1265-424a-9d7f-8e4d431a12c7',   // Intense, deep young adult male
  'kiefer': '228fca29-3a0a-435c-8728-5cb483251068',   // Professional male
  'katie': 'f786b574-daa5-4673-aa0c-cbe3e8534c02',    // Friendly female
  'blake': 'a167e0f3-df7e-4d52-a9c3-f949145efdab',    // Energetic adult male
}

export interface CartesiaTTSOptions {
  voice?: CartesiaVoice
  speed?: number // Speed multiplier: 0.6 (slow) to 1.5 (fast), 1.0 = normal
  language?: string
}

/**
 * Convert text to speech using Cartesia Sonic-3
 * Returns base64-encoded MP3 audio
 */
export async function textToSpeech(
  text: string,
  options: CartesiaTTSOptions = {}
): Promise<string> {
  console.log('[CARTESIA] Starting text-to-speech conversion')
  console.log('[CARTESIA] Input text length:', text.length)
  console.log('[CARTESIA] Input text preview:', text.slice(0, 100) + (text.length > 100 ? '...' : ''))

  if (!CARTESIA_API_KEY) {
    throw new Error('CARTESIA_API_KEY is not configured')
  }

  // Default to Ronald (deep, thoughtful voice) at slightly slower speed
  // Valid range: 0.6 (slow) to 1.5 (fast), 1.0 = normal
  const { voice = 'kiefer', speed = 1.0, language = 'en' } = options
  const voiceId = VOICE_IDS[voice]

  console.log('[CARTESIA] Using voice:', voice, 'voiceId:', voiceId, 'speed:', speed)

  const requestBody = {
    model_id: 'sonic-3',
    transcript: text,
    voice: {
      mode: 'id',
      id: voiceId,
    },
    output_format: {
      container: 'mp3',
      sample_rate: 44100,  // CD quality - higher fidelity
      bit_rate: 192000,    // Higher bitrate for better quality
    },
    language,
    // Only include speed if not default (1.0)
    ...(speed !== 1.0 && {
      generation_config: {
        speed,
      },
    }),
  }

  console.log('[CARTESIA] Sending request to Cartesia API...')

  const response = await fetch(CARTESIA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CARTESIA_API_KEY}`,
      'Cartesia-Version': CARTESIA_VERSION,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[CARTESIA] API error:', response.status, errorText)
    throw new Error(`Cartesia API error: ${response.status} - ${errorText}`)
  }

  // Convert response to base64
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const base64 = buffer.toString('base64')

  console.log('[CARTESIA] Generated audio size:', buffer.length, 'bytes')
  console.log('[CARTESIA] Base64 length:', base64.length)

  return base64
}

/**
 * Get available TTS voices
 */
export function getAvailableVoices(): { id: CartesiaVoice; name: string; description: string }[] {
  return [
    { id: 'theo', name: 'Theo', description: 'Steady, confident male - ideal for interviews (default)' },
    { id: 'ronald', name: 'Ronald', description: 'Deep, thoughtful male voice' },
    { id: 'kiefer', name: 'Kiefer', description: 'Professional male voice' },
    { id: 'katie', name: 'Katie', description: 'Friendly female voice' },
    { id: 'blake', name: 'Blake', description: 'Energetic male voice' },
  ]
}

/**
 * Check if Cartesia TTS is configured
 */
export function isConfigured(): boolean {
  return !!CARTESIA_API_KEY
}

// ============================================================================
// Speech-to-Text (STT) using Cartesia Ink Whisper
// Docs: https://docs.cartesia.ai/api-reference/stt/stt
// ============================================================================

import WebSocket from 'ws'

const CARTESIA_STT_URL = 'wss://api.cartesia.ai/stt/websocket'

export interface CartesiaSTTOptions {
  language?: string
  encoding?: 'pcm_s16le' | 'pcm_f32le'
  sampleRate?: number
}

interface CartesiaSTTMessage {
  type: 'transcript' | 'flush_done' | 'done' | 'error'
  text?: string
  is_final?: boolean
  message?: string
}

/**
 * Transcribe audio using Cartesia Ink Whisper (WebSocket streaming)
 * Accepts base64-encoded audio - batch mode for single audio files
 */
export async function speechToText(
  audioBase64: string,
  mimeType: string = 'audio/webm'
): Promise<string> {
  console.log('[CARTESIA STT] Starting speech-to-text transcription')
  console.log('[CARTESIA STT] Input base64 length:', audioBase64.length)
  console.log('[CARTESIA STT] MIME type:', mimeType)

  if (!CARTESIA_API_KEY) {
    throw new Error('CARTESIA_API_KEY is not configured')
  }

  // Convert base64 to buffer
  const audioBuffer = Buffer.from(audioBase64, 'base64')
  console.log('[CARTESIA STT] Audio buffer size:', audioBuffer.length, 'bytes')

  return new Promise((resolve, reject) => {
    // Build WebSocket URL with query params
    const params = new URLSearchParams({
      model: 'ink-whisper',
      language: 'en',
      api_key: CARTESIA_API_KEY!,
    })

    const wsUrl = `${CARTESIA_STT_URL}?${params.toString()}`
    console.log('[CARTESIA STT] Connecting to WebSocket...')

    const ws = new WebSocket(wsUrl)
    let transcriptionText = ''
    let connectionTimeout: NodeJS.Timeout

    // Set connection timeout
    connectionTimeout = setTimeout(() => {
      console.error('[CARTESIA STT] Connection timeout')
      ws.close()
      reject(new Error('Cartesia STT connection timeout'))
    }, 30000)

    ws.on('open', () => {
      console.log('[CARTESIA STT] WebSocket connected, sending audio...')
      clearTimeout(connectionTimeout)

      // Send audio data as binary
      ws.send(audioBuffer)

      // Signal we're done sending audio
      setTimeout(() => {
        console.log('[CARTESIA STT] Sending done signal...')
        ws.send(JSON.stringify({ type: 'done' }))
      }, 100)
    })

    ws.on('message', (data) => {
      try {
        const message: CartesiaSTTMessage = JSON.parse(data.toString())
        console.log('[CARTESIA STT] Received message:', message.type, message.is_final ? '(final)' : '')

        if (message.type === 'transcript' && message.text) {
          if (message.is_final) {
            transcriptionText = message.text
            console.log('[CARTESIA STT] Final transcript:', transcriptionText)
          }
        } else if (message.type === 'done') {
          console.log('[CARTESIA STT] Done, closing connection')
          ws.close()
          resolve(transcriptionText)
        } else if (message.type === 'error') {
          console.error('[CARTESIA STT] Error:', message.message)
          ws.close()
          reject(new Error(message.message || 'Cartesia STT error'))
        }
      } catch (err) {
        console.error('[CARTESIA STT] Failed to parse message:', err)
      }
    })

    ws.on('error', (error) => {
      console.error('[CARTESIA STT] WebSocket error:', error)
      clearTimeout(connectionTimeout)
      reject(error)
    })

    ws.on('close', () => {
      console.log('[CARTESIA STT] WebSocket closed')
      clearTimeout(connectionTimeout)
      // If we haven't resolved yet, resolve with what we have
      if (transcriptionText) {
        resolve(transcriptionText)
      }
    })
  })
}

// ============================================================================
// Streaming STT Session - Maintains persistent WebSocket for real-time streaming
// ============================================================================

export interface StreamingSTTCallbacks {
  onTranscript: (text: string, isFinal: boolean) => void
  onError: (error: Error) => void
  onDone: (finalText: string) => void
}

export interface StreamingSTTOptions {
  sampleRate?: number // Audio sample rate in Hz (default: 16000)
}

/**
 * Streaming STT session that maintains a WebSocket connection to Cartesia
 * Client streams audio chunks, Cartesia detects silence and returns transcripts
 */
export class StreamingSTTSession {
  private ws: WebSocket | null = null
  private callbacks: StreamingSTTCallbacks
  private options: StreamingSTTOptions
  private isConnected = false
  private isEnded = false
  private isDoneSignaled = false // Track if we've signaled done to stop accepting audio
  private transcriptBuffer = ''
  private connectionTimeout: NodeJS.Timeout | null = null
  private silenceTimeout: NodeJS.Timeout | null = null
  private doneResponseTimeout: NodeJS.Timeout | null = null // Fallback if Cartesia doesn't respond
  private readonly SILENCE_TIMEOUT_MS = 2000 // 2 seconds of no new transcript = done
  private readonly DONE_RESPONSE_TIMEOUT_MS = 1000 // 1 second to wait for Cartesia's done response

  constructor(callbacks: StreamingSTTCallbacks, options: StreamingSTTOptions = {}) {
    this.callbacks = callbacks
    this.options = options
  }

  async connect(): Promise<void> {
    if (!CARTESIA_API_KEY) {
      throw new Error('CARTESIA_API_KEY is not configured')
    }

    const sampleRate = this.options.sampleRate || 16000

    return new Promise((resolve, reject) => {
      // Start with minimal required params, then add optional ones
      const params = new URLSearchParams({
        model: 'ink-whisper',
        language: 'en',
        encoding: 'pcm_s16le',
        sample_rate: String(sampleRate),
        api_key: CARTESIA_API_KEY!,
      })
      console.log('[CARTESIA STREAM] Using sample rate:', sampleRate)

      const wsUrl = `${CARTESIA_STT_URL}?${params.toString()}`
      console.log('[CARTESIA STREAM] Connecting to:', wsUrl.replace(CARTESIA_API_KEY!, 'sk-***'))

      // Connect with headers for additional auth (including required Cartesia-Version)
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'X-API-Key': CARTESIA_API_KEY!,
          'Cartesia-Version': CARTESIA_VERSION,
        },
      })

      this.connectionTimeout = setTimeout(() => {
        console.error('[CARTESIA STREAM] Connection timeout')
        this.ws?.close()
        reject(new Error('Cartesia STT connection timeout'))
      }, 10000)

      this.ws.on('open', () => {
        console.log('[CARTESIA STREAM] WebSocket connected, ready for streaming')
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout)
          this.connectionTimeout = null
        }
        this.isConnected = true
        resolve()
      })

      this.ws.on('message', (data) => {
        this.handleMessage(data)
      })

      this.ws.on('error', (error) => {
        console.error('[CARTESIA STREAM] WebSocket error:', error)
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout)
          this.connectionTimeout = null
        }
        this.callbacks.onError(error as Error)
        reject(error)
      })

      // Capture unexpected HTTP responses (like 400 errors)
      this.ws.on('unexpected-response', (_req, res) => {
        let body = ''
        res.on('data', (chunk: Buffer) => {
          body += chunk.toString()
        })
        res.on('end', () => {
          console.error('[CARTESIA STREAM] Unexpected response:', res.statusCode, body)
          const error = new Error(`Cartesia STT error ${res.statusCode}: ${body}`)
          this.callbacks.onError(error)
          reject(error)
        })
      })

      this.ws.on('close', () => {
        console.log('[CARTESIA STREAM] WebSocket closed')
        this.isConnected = false
        if (!this.isEnded) {
          // Closed unexpectedly, call onDone with what we have
          this.isEnded = true
          this.callbacks.onDone(this.transcriptBuffer)
        }
      })
    })
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message: CartesiaSTTMessage = JSON.parse(data.toString())
      console.log('[CARTESIA STREAM] Received:', message.type, message.is_final ? '(final)' : '', message.text?.slice(0, 50) || '')

      if (message.type === 'transcript' && message.text) {
        // Reset silence timeout since we're getting transcripts
        this.resetSilenceTimeout()

        if (message.is_final) {
          this.transcriptBuffer = message.text
          this.callbacks.onTranscript(message.text, true)
        } else {
          this.callbacks.onTranscript(message.text, false)
        }
      } else if (message.type === 'done') {
        console.log('[CARTESIA STREAM] Cartesia signaled done')
        this.endSession()
      } else if (message.type === 'error') {
        console.error('[CARTESIA STREAM] Error:', message.message)
        this.callbacks.onError(new Error(message.message || 'Cartesia STT error'))
      }
    } catch (err) {
      console.error('[CARTESIA STREAM] Failed to parse message:', err)
    }
  }

  /**
   * Send an audio chunk to Cartesia for transcription
   * @param audioData - Raw audio buffer (not base64)
   */
  sendAudioChunk(audioData: Buffer): void {
    if (!this.isConnected || !this.ws || this.isEnded || this.isDoneSignaled) {
      // Don't log warning for isDoneSignaled - it's expected behavior
      if (!this.isDoneSignaled) {
        console.warn('[CARTESIA STREAM] Cannot send: not connected or ended')
      }
      return
    }

    // Don't reset silence timeout here - only reset when we receive transcripts
    // This allows the timeout to fire after user stops speaking
    this.ws.send(audioData)
  }

  /**
   * Send base64-encoded audio chunk
   */
  sendAudioChunkBase64(base64Audio: string): void {
    const buffer = Buffer.from(base64Audio, 'base64')
    this.sendAudioChunk(buffer)
  }

  private resetSilenceTimeout(): void {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout)
    }
    console.log('[CARTESIA STREAM] Starting silence timeout (%dms)', this.SILENCE_TIMEOUT_MS)
    this.silenceTimeout = setTimeout(() => {
      console.log('[CARTESIA STREAM] Silence timeout fired - ending session')
      this.signalDone()
    }, this.SILENCE_TIMEOUT_MS)
  }

  /**
   * Signal to Cartesia that we're done sending audio
   */
  signalDone(): void {
    if (!this.isConnected || !this.ws || this.isEnded || this.isDoneSignaled) {
      return
    }

    console.log('[CARTESIA STREAM] Signaling done to Cartesia')
    this.isDoneSignaled = true // Stop accepting more audio

    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout)
      this.silenceTimeout = null
    }

    this.ws.send(JSON.stringify({ type: 'done' }))

    // Fallback: if Cartesia doesn't respond with 'done' within 1 second, end anyway
    this.doneResponseTimeout = setTimeout(() => {
      console.log('[CARTESIA STREAM] Cartesia did not respond with done, forcing end')
      this.endSession()
    }, this.DONE_RESPONSE_TIMEOUT_MS)
  }

  private endSession(): void {
    if (this.isEnded) return

    this.isEnded = true
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout)
      this.silenceTimeout = null
    }
    if (this.doneResponseTimeout) {
      clearTimeout(this.doneResponseTimeout)
      this.doneResponseTimeout = null
    }

    this.callbacks.onDone(this.transcriptBuffer)
    this.close()
  }

  close(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout)
      this.silenceTimeout = null
    }
    if (this.doneResponseTimeout) {
      clearTimeout(this.doneResponseTimeout)
      this.doneResponseTimeout = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isConnected = false
  }

  get connected(): boolean {
    return this.isConnected
  }
}
