/**
 * OpenAI Realtime API Service
 *
 * This service provides a unified speech-to-speech experience using OpenAI's
 * Realtime API. Unlike the traditional pipeline (STT -> LLM -> TTS), this
 * processes audio directly in a single model for lower latency.
 *
 * Audio format: PCM16, 24kHz, mono
 */

import WebSocket from 'ws'
import {
  getPersona,
  buildLiveInterviewInstructions,
  type InterviewType,
} from './interviewerPersona.js'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// Realtime API models
export type RealtimeModel = 'gpt-4o-realtime-preview' | 'gpt-4o-realtime-preview-2024-12-17' | 'gpt-4o-mini-realtime-preview' | 'gpt-realtime' | 'gpt-realtime-mini'

// Available voices for Realtime API
export type RealtimeVoice = 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse'

export interface RealtimeSessionConfig {
  model?: RealtimeModel
  voice?: RealtimeVoice
  instructions?: string
  inputAudioTranscription?: boolean
  turnDetection?: 'server_vad' | 'none'
  temperature?: number
  // Interview context for persona
  interviewType?: InterviewType
  problemTitle?: string
  problemDescription?: string
  keyConsiderations?: string[]
  // Introduction that was already given (for context continuity)
  introductionGiven?: string
  // Conversation history context (may be compacted for long conversations)
  conversationContext?: string
}

export interface RealtimeEventHandlers {
  onSessionCreated?: (session: unknown) => void
  onResponseAudioDelta?: (delta: string, itemId: string) => void
  onResponseAudioDone?: (itemId: string) => void
  onResponseTextDelta?: (delta: string, itemId: string) => void
  onResponseTextDone?: (text: string, itemId: string) => void
  onInputAudioTranscription?: (transcript: string) => void
  onResponseDone?: (response: unknown) => void
  onError?: (error: Error) => void
  onClose?: () => void
}

/**
 * OpenAI Realtime API client for server-side WebSocket connections
 */
export class OpenAIRealtimeClient {
  private ws: WebSocket | null = null
  private config: RealtimeSessionConfig
  private handlers: RealtimeEventHandlers
  private isConnected = false
  private currentQuestion = ''
  private currentCode = ''
  private interviewType: InterviewType

  constructor(config: RealtimeSessionConfig = {}, handlers: RealtimeEventHandlers = {}) {
    this.interviewType = config.interviewType || 'coding'

    // Get persona-based instructions if no custom instructions provided
    const persona = getPersona(this.interviewType)
    const defaultInstructions = config.instructions || (
      config.problemTitle
        ? buildLiveInterviewInstructions(persona, {
            title: config.problemTitle,
            description: config.problemDescription || '',
            keyConsiderations: config.keyConsiderations,
          })
        : persona.liveInterviewInstructions
    )

    this.config = {
      model: 'gpt-realtime-mini',
      voice: 'ash', // Good for interviews - clear, professional
      inputAudioTranscription: true,
      turnDetection: 'server_vad',
      temperature: 0.6,
      ...config,
      // Use custom instructions if provided, otherwise use persona-based instructions
      instructions: config.instructions || defaultInstructions,
    }
    this.handlers = handlers
  }

  /**
   * Check if OpenAI Realtime API is configured
   */
  static isConfigured(): boolean {
    return !!OPENAI_API_KEY && OPENAI_API_KEY !== 'your-openai-api-key'
  }

  /**
   * Connect to OpenAI Realtime API
   */
  async connect(): Promise<void> {
    if (!OpenAIRealtimeClient.isConfigured()) {
      throw new Error('OPENAI_API_KEY is not configured')
    }

    return new Promise((resolve, reject) => {
      const url = `wss://api.openai.com/v1/realtime?model=${this.config.model}`

      console.log('[Realtime] Connecting to OpenAI Realtime API...')
      console.log('[Realtime] URL:', url)
      console.log('[Realtime] API Key configured:', OPENAI_API_KEY ? `${OPENAI_API_KEY.substring(0, 8)}...` : 'NOT SET')

      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      })

      this.ws.on('open', () => {
        console.log('[Realtime] WebSocket connected successfully!')
        this.isConnected = true
        this.configureSession()
        resolve()
      })

      this.ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString())
          this.handleServerEvent(event)
        } catch (error) {
          console.error('[Realtime] Failed to parse server event:', error)
        }
      })

      this.ws.on('error', (error: Error & { code?: string }) => {
        console.error('[Realtime] WebSocket error:', error.message)
        console.error('[Realtime] Error code:', error.code)
        console.error('[Realtime] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
        this.handlers.onError?.(error as Error)
        reject(error)
      })

      this.ws.on('close', (code: number, reason: Buffer) => {
        console.log('[Realtime] WebSocket closed')
        console.log('[Realtime] Close code:', code)
        console.log('[Realtime] Close reason:', reason.toString())
        this.isConnected = false
        this.handlers.onClose?.()
      })

      // Add unexpected response handler
      this.ws.on('unexpected-response', (_request, response) => {
        console.error('[Realtime] Unexpected response from server!')
        console.error('[Realtime] Response status:', response.statusCode)
        console.error('[Realtime] Response headers:', JSON.stringify(response.headers))
        let body = ''
        response.on('data', (chunk: Buffer) => {
          body += chunk.toString()
        })
        response.on('end', () => {
          console.error('[Realtime] Response body:', body)
          reject(new Error(`Unexpected response: ${response.statusCode} - ${body}`))
        })
      })
    })
  }

  /**
   * Configure the session after connection
   */
  private configureSession(): void {
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: this.buildInstructions(),
        voice: this.config.voice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: this.config.inputAudioTranscription
          ? { model: 'whisper-1' }
          : null,
        turn_detection: this.config.turnDetection === 'server_vad'
          ? {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500, // Respond quickly after silence
            }
          : null,
        temperature: this.config.temperature,
      },
    }

    this.sendEvent(sessionConfig)
    console.log('[Realtime] Session configured')
  }

  /**
   * Build instructions including current problem context
   */
  private buildInstructions(): string {
    // Use the config instructions which are already persona-based
    const persona = getPersona(this.interviewType)
    let instructions = this.config.instructions || persona.liveInterviewInstructions

    // Include the introduction that was already given for context continuity
    if (this.config.introductionGiven) {
      instructions += `\n\n---\n\nYou already introduced yourself and the problem. Your introduction was:\n"${this.config.introductionGiven}"\n\nDo NOT repeat the introduction. The candidate may now ask clarifying questions or start working on the problem.`
    }

    // Include conversation history (may be compacted for long conversations)
    if (this.config.conversationContext) {
      instructions += `\n\n---\n\n${this.config.conversationContext}`
    }

    if (this.currentQuestion) {
      instructions += `\n\nCurrent problem:\n${this.currentQuestion}`
    }

    if (this.currentCode) {
      instructions += `\n\nCandidate's current code:\n\`\`\`\n${this.currentCode}\n\`\`\``
    }

    return instructions
  }

  /**
   * Update the interview context (problem and code)
   */
  updateContext(question: string, code: string): void {
    this.currentQuestion = question
    this.currentCode = code

    // Update session with new instructions if connected
    if (this.isConnected) {
      this.sendEvent({
        type: 'session.update',
        session: {
          instructions: this.buildInstructions(),
        },
      })
    }
  }

  /**
   * Update the conversation context (for long conversations)
   * This is typically called after compacting the history
   */
  updateConversationContext(context: string): void {
    this.config.conversationContext = context

    // Update session with new instructions if connected
    if (this.isConnected) {
      this.sendEvent({
        type: 'session.update',
        session: {
          instructions: this.buildInstructions(),
        },
      })
      console.log('[Realtime] Updated conversation context')
    }
  }

  /**
   * Handle events from the OpenAI Realtime API server
   */
  private handleServerEvent(event: Record<string, unknown>): void {
    const eventType = event.type as string

    switch (eventType) {
      case 'session.created':
        console.log('[Realtime] Session created')
        this.handlers.onSessionCreated?.(event.session)
        break

      case 'session.updated':
        console.log('[Realtime] Session updated')
        break

      case 'response.audio.delta':
        // Audio chunk received (base64 encoded PCM16)
        this.handlers.onResponseAudioDelta?.(
          event.delta as string,
          event.item_id as string
        )
        break

      case 'response.audio.done':
        this.handlers.onResponseAudioDone?.(event.item_id as string)
        break

      case 'response.audio_transcript.delta':
        // Real-time transcript of what the AI is saying
        this.handlers.onResponseTextDelta?.(
          event.delta as string,
          event.item_id as string
        )
        break

      case 'response.audio_transcript.done':
        this.handlers.onResponseTextDone?.(
          event.transcript as string,
          event.item_id as string
        )
        break

      case 'conversation.item.input_audio_transcription.completed':
        // Transcript of what the user said
        this.handlers.onInputAudioTranscription?.(event.transcript as string)
        break

      case 'conversation.item.input_audio_transcription.failed':
        // Transcription failed - log full error details
        console.error('[Realtime] Input audio transcription FAILED!')
        console.error('[Realtime] Failure details:', JSON.stringify(event, null, 2))
        break

      case 'response.done':
        this.handlers.onResponseDone?.(event.response)
        break

      case 'error':
        console.error('[Realtime] Server error:', event.error)
        this.handlers.onError?.(new Error(JSON.stringify(event.error)))
        break

      case 'input_audio_buffer.speech_started':
        console.log('[Realtime] User started speaking')
        break

      case 'input_audio_buffer.speech_stopped':
        console.log('[Realtime] User stopped speaking')
        break

      case 'input_audio_buffer.committed':
        console.log('[Realtime] Audio buffer committed')
        break

      case 'response.created':
        console.log('[Realtime] Response generation started')
        break

      default:
        // Log unknown events for debugging
        if (!eventType.startsWith('rate_limits')) {
          console.log(`[Realtime] Event: ${eventType}`)
        }
    }
  }

  /**
   * Send audio data to the Realtime API
   * @param audioData Base64 encoded PCM16 audio at 24kHz
   */
  appendAudio(audioData: string): void {
    if (!this.isConnected) {
      console.warn('[Realtime] Cannot append audio: not connected')
      return
    }

    this.sendEvent({
      type: 'input_audio_buffer.append',
      audio: audioData,
    })
  }

  /**
   * Commit the audio buffer and trigger a response
   * Use this in push-to-talk mode (when turn_detection is 'none')
   */
  commitAudio(): void {
    if (!this.isConnected) return

    this.sendEvent({
      type: 'input_audio_buffer.commit',
    })
  }

  /**
   * Request the model to generate a response
   * Use after committing audio in push-to-talk mode
   */
  createResponse(): void {
    if (!this.isConnected) return

    this.sendEvent({
      type: 'response.create',
    })
  }

  /**
   * Cancel an in-progress response (for interruptions)
   */
  cancelResponse(): void {
    if (!this.isConnected) return

    this.sendEvent({
      type: 'response.cancel',
    })
  }

  /**
   * Clear the audio input buffer
   */
  clearAudioBuffer(): void {
    if (!this.isConnected) return

    this.sendEvent({
      type: 'input_audio_buffer.clear',
    })
  }

  /**
   * Send a text message (for testing or text fallback)
   */
  sendTextMessage(text: string): void {
    if (!this.isConnected) return

    this.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text,
          },
        ],
      },
    })

    this.createResponse()
  }

  /**
   * Have the AI speak a specific text (for introductions, prompts, etc.)
   * This sends a user instruction to deliver the text, and the model responds with audio.
   */
  speakText(text: string): void {
    if (!this.isConnected) return

    // Create a user message instructing the model to deliver this introduction
    this.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Please deliver this introduction to the candidate exactly as written, speaking naturally and warmly:\n\n"${text}"`,
          },
        ],
      },
    })

    // Trigger audio response
    this.sendEvent({
      type: 'response.create',
      response: {
        modalities: ['audio', 'text'],
      },
    })
  }

  /**
   * Send an event to the Realtime API
   */
  private sendEvent(event: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[Realtime] Cannot send event: WebSocket not open')
      return
    }

    this.ws.send(JSON.stringify(event))
  }

  /**
   * Disconnect from the Realtime API
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isConnected = false
  }

  /**
   * Check if currently connected
   */
  get connected(): boolean {
    return this.isConnected
  }
}

/**
 * Convert webm/opus audio to PCM16 format
 * Note: This is a placeholder - in production, you'd use ffmpeg or a proper audio conversion library
 * For now, we'll rely on the client sending PCM16 directly
 */
export function convertToPCM16(audioBase64: string, _inputFormat: string): string {
  // TODO: Implement actual conversion using ffmpeg or similar
  // For now, assume client sends PCM16
  console.warn('[Realtime] Audio conversion not implemented - assuming PCM16 input')
  return audioBase64
}

/**
 * Get available voices for the Realtime API
 */
export function getRealtimeVoices(): { id: RealtimeVoice; name: string; description: string }[] {
  return [
    { id: 'ash', name: 'Ash', description: 'Clear, professional voice - good for interviews' },
    { id: 'ballad', name: 'Ballad', description: 'Warm, expressive voice' },
    { id: 'coral', name: 'Coral', description: 'Friendly, conversational voice' },
    { id: 'sage', name: 'Sage', description: 'Calm, measured voice' },
    { id: 'alloy', name: 'Alloy', description: 'Neutral, balanced voice' },
    { id: 'echo', name: 'Echo', description: 'Warm male voice' },
    { id: 'shimmer', name: 'Shimmer', description: 'Clear female voice' },
    { id: 'verse', name: 'Verse', description: 'Articulate, precise voice' },
  ]
}
