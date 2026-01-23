/**
 * Realtime Voice Handler
 *
 * This handler uses OpenAI's Realtime API for low-latency speech-to-speech
 * interaction. It manages a persistent connection to OpenAI and relays
 * audio between the client and the Realtime API.
 *
 * Audio flow:
 * Client (browser) -> This handler -> OpenAI Realtime API -> This handler -> Client
 */

import type { InterviewWebSocket, WebSocketMessage } from './index.js'
import { sendMessage } from './index.js'
import { OpenAIRealtimeClient } from '../services/openai-realtime.js'

export interface RealtimeVoiceSession {
  realtimeClient: OpenAIRealtimeClient
  interviewId: string
  isActive: boolean
  // Buffer to accumulate audio response for clients that need complete audio
  audioResponseBuffer: string[]
  // Current transcript being built
  currentTranscript: string
  cleanup: () => void
}

interface InterviewContext {
  currentQuestion: string
  userCode: string
}

/**
 * Handle voice messages using OpenAI Realtime API
 */
export async function handleRealtimeVoiceMessage(
  ws: InterviewWebSocket,
  message: WebSocketMessage
): Promise<void> {
  console.log(`[RealtimeHandler] Handling message: ${message.type}`)
  switch (message.type) {
    case 'voice_start':
      console.log('[RealtimeHandler] Starting realtime session...')
      await startRealtimeSession(ws)
      break

    case 'voice_stop':
      // In Realtime API with VAD, we don't need to explicitly stop
      // The API handles turn detection automatically
      // But we can commit the buffer if using push-to-talk mode
      if (ws.realtimeSession?.realtimeClient) {
        ws.realtimeSession.realtimeClient.commitAudio()
      }
      break

    case 'audio_chunk':
      // Forward audio to Realtime API
      if (ws.realtimeSession?.realtimeClient) {
        ws.realtimeSession.realtimeClient.appendAudio(message.data)
      }
      break

    case 'text_input':
      // Handle text input as fallback
      await handleTextInput(ws, message.text)
      break
  }
}

/**
 * Start a new Realtime API session
 */
async function startRealtimeSession(ws: InterviewWebSocket): Promise<void> {
  if (!ws.interviewId) {
    sendMessage(ws, { type: 'error', message: 'Must join interview first' })
    return
  }

  // Check if Realtime API is configured
  if (!OpenAIRealtimeClient.isConfigured()) {
    sendMessage(ws, {
      type: 'error',
      message: 'OpenAI Realtime API not configured. Check OPENAI_API_KEY.',
    })
    return
  }

  // Clean up existing session if any
  if (ws.realtimeSession) {
    ws.realtimeSession.cleanup()
  }

  console.log(`[RealtimeHandler] Starting session for interview ${ws.interviewId}`)

  // Create event handlers that relay to the client WebSocket
  const realtimeClient = new OpenAIRealtimeClient(
    {
      voice: 'ash',
      turnDetection: 'server_vad', // Let OpenAI handle turn detection
      temperature: 0.6,
    },
    {
      onSessionCreated: () => {
        console.log(`[RealtimeHandler] Session created for ${ws.interviewId}`)
        sendMessage(ws, { type: 'voice_ready' })
      },

      onInputAudioTranscription: (transcript) => {
        // Send user's transcribed speech to client
        console.log(`[RealtimeHandler] User said: ${transcript}`)
        sendMessage(ws, {
          type: 'transcript',
          text: transcript,
          is_final: true,
        })
      },

      onResponseAudioDelta: (delta, _itemId) => {
        // Stream audio chunks to client as they arrive
        // The client can play these incrementally for lowest latency
        if (ws.realtimeSession) {
          ws.realtimeSession.audioResponseBuffer.push(delta)
        }
      },

      onResponseTextDelta: (delta, _itemId) => {
        // Accumulate transcript
        if (ws.realtimeSession) {
          ws.realtimeSession.currentTranscript += delta
        }
      },

      onResponseTextDone: (text, _itemId) => {
        console.log(`[RealtimeHandler] AI response: ${text}`)

        // Send complete response to client
        // Include accumulated audio if available
        const audioBuffer = ws.realtimeSession?.audioResponseBuffer || []
        const combinedAudio = audioBuffer.length > 0 ? audioBuffer.join('') : undefined

        sendMessage(ws, {
          type: 'interviewer_response',
          text,
          audio: combinedAudio,
        })

        // Reset buffers for next response
        if (ws.realtimeSession) {
          ws.realtimeSession.audioResponseBuffer = []
          ws.realtimeSession.currentTranscript = ''
        }
      },

      onError: (error) => {
        console.error(`[RealtimeHandler] Error:`, error)
        sendMessage(ws, {
          type: 'error',
          message: `Realtime API error: ${error.message}`,
        })
      },

      onClose: () => {
        console.log(`[RealtimeHandler] Connection closed for ${ws.interviewId}`)
        if (ws.realtimeSession) {
          ws.realtimeSession.isActive = false
        }
      },
    }
  )

  // Create session object
  ws.realtimeSession = {
    realtimeClient,
    interviewId: ws.interviewId,
    isActive: true,
    audioResponseBuffer: [],
    currentTranscript: '',
    cleanup: () => {
      realtimeClient.disconnect()
      ws.realtimeSession = undefined
    },
  }

  // Connect to OpenAI
  try {
    await realtimeClient.connect()
  } catch (error) {
    console.error(`[RealtimeHandler] Failed to connect:`, error)
    sendMessage(ws, {
      type: 'error',
      message: 'Failed to connect to Realtime API',
    })
    ws.realtimeSession.cleanup()
  }
}

/**
 * Handle text input (fallback when voice isn't working)
 */
async function handleTextInput(ws: InterviewWebSocket, text: string): Promise<void> {
  if (!ws.realtimeSession?.realtimeClient) {
    // Start a session first
    await startRealtimeSession(ws)
  }

  if (ws.realtimeSession?.realtimeClient) {
    // Send as user transcript
    sendMessage(ws, {
      type: 'transcript',
      text,
      is_final: true,
    })

    // Send text to Realtime API
    ws.realtimeSession.realtimeClient.sendTextMessage(text)
  }
}

/**
 * Update the interview context (problem and code) for the Realtime session
 */
export function updateRealtimeContext(
  ws: InterviewWebSocket,
  context: Partial<InterviewContext>
): void {
  if (ws.realtimeSession?.realtimeClient) {
    const currentQuestion = context.currentQuestion || ''
    const userCode = context.userCode || ''
    ws.realtimeSession.realtimeClient.updateContext(currentQuestion, userCode)
  }
}

/**
 * Clean up Realtime session when client disconnects
 */
export function cleanupRealtimeSession(ws: InterviewWebSocket): void {
  if (ws.realtimeSession) {
    ws.realtimeSession.cleanup()
  }
}
