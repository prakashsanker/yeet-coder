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
import { OpenAIRealtimeClient, type RealtimeSessionConfig } from '../services/openai-realtime.js'
import { supabase } from '../db/supabase.js'
import type { InterviewType } from '../services/interviewerPersona.js'

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

    case 'request_introduction':
      // Generate introduction using Realtime API voice
      console.log('[RealtimeHandler] Generating introduction via Realtime API...')
      await handleIntroductionRequest(ws, message.text)
      break
  }
}

/**
 * Fetch interview metadata for building the session config
 */
async function fetchInterviewMetadata(interviewId: string): Promise<{
  interviewType: InterviewType
  problemTitle?: string
  problemDescription?: string
  keyConsiderations?: string[]
}> {
  try {
    const { data: interview, error } = await supabase
      .from('interview_sessions')
      .select(`
        session_type,
        question:questions(
          title,
          description,
          metadata
        )
      `)
      .eq('id', interviewId)
      .single()

    if (error || !interview) {
      console.warn(`[RealtimeHandler] Could not fetch interview ${interviewId}:`, error)
      return { interviewType: 'coding' }
    }

    const sessionType = (interview.session_type || 'coding') as InterviewType
    const question = interview.question as {
      title?: string
      description?: string
      metadata?: { key_considerations?: string[] }
    } | null

    return {
      interviewType: sessionType,
      problemTitle: question?.title,
      problemDescription: question?.description,
      keyConsiderations: question?.metadata?.key_considerations,
    }
  } catch (err) {
    console.error(`[RealtimeHandler] Error fetching interview metadata:`, err)
    return { interviewType: 'coding' }
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

  // Fetch interview metadata to configure the persona correctly
  const interviewMeta = await fetchInterviewMetadata(ws.interviewId)
  console.log(`[RealtimeHandler] Interview type: ${interviewMeta.interviewType}, problem: ${interviewMeta.problemTitle || 'N/A'}`)

  // Get stored context from the WebSocket object
  const storedContext = ws.interviewContext || { currentQuestion: '', userCode: '' }
  console.log(`[RealtimeHandler] Using stored context - question length: ${storedContext.currentQuestion.length}, code length: ${storedContext.userCode.length}`)

  // Build session config with interview-specific persona
  const sessionConfig: RealtimeSessionConfig = {
    voice: 'ash',
    turnDetection: 'server_vad', // Let OpenAI handle turn detection
    temperature: 0.6,
    // Pass interview type and problem context for persona configuration
    interviewType: interviewMeta.interviewType,
    problemTitle: interviewMeta.problemTitle,
    problemDescription: interviewMeta.problemDescription,
    keyConsiderations: interviewMeta.keyConsiderations,
  }

  // Create event handlers that relay to the client WebSocket
  const realtimeClient = new OpenAIRealtimeClient(
    sessionConfig,
    {
      onSessionCreated: () => {
        console.log(`[RealtimeHandler] Session created for ${ws.interviewId}`)
        // Apply stored context to the session
        if (storedContext.currentQuestion || storedContext.userCode) {
          realtimeClient.updateContext(storedContext.currentQuestion, storedContext.userCode)
        }
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
 * Handle introduction request - generate introduction audio using Realtime API voice
 * This ensures the introduction uses the same voice as the conversation
 */
async function handleIntroductionRequest(ws: InterviewWebSocket, introductionText: string): Promise<void> {
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

  // Clean up any existing session first
  if (ws.realtimeSession) {
    ws.realtimeSession.cleanup()
  }

  console.log(`[RealtimeHandler] Generating introduction for interview ${ws.interviewId}`)

  // Fetch interview metadata to use correct persona
  const interviewMeta = await fetchInterviewMetadata(ws.interviewId)

  // Create a temporary Realtime client for the introduction with correct persona
  const realtimeClient = new OpenAIRealtimeClient(
    {
      voice: 'ash', // Same voice as conversation
      turnDetection: 'none', // No VAD needed for introduction
      temperature: 0.6,
      // Use correct persona based on interview type
      interviewType: interviewMeta.interviewType,
      problemTitle: interviewMeta.problemTitle,
      problemDescription: interviewMeta.problemDescription,
      keyConsiderations: interviewMeta.keyConsiderations,
    },
    {
      onSessionCreated: () => {
        console.log(`[RealtimeHandler] Introduction session created`)
        // Now speak the introduction text
        realtimeClient.speakText(introductionText)
      },

      onResponseAudioDelta: (delta, _itemId) => {
        // Accumulate audio
        if (ws.realtimeSession) {
          ws.realtimeSession.audioResponseBuffer.push(delta)
        }
      },

      onResponseTextDelta: (delta, _itemId) => {
        // Accumulate transcript (though for intro we already know the text)
        if (ws.realtimeSession) {
          ws.realtimeSession.currentTranscript += delta
        }
      },

      onResponseDone: () => {
        console.log(`[RealtimeHandler] Introduction audio generated`)

        // Send the introduction response with audio
        const audioBuffer = ws.realtimeSession?.audioResponseBuffer || []
        const combinedAudio = audioBuffer.length > 0 ? audioBuffer.join('') : undefined

        sendMessage(ws, {
          type: 'introduction_ready',
          text: introductionText,
          audio: combinedAudio,
        })

        // Reset buffers
        if (ws.realtimeSession) {
          ws.realtimeSession.audioResponseBuffer = []
          ws.realtimeSession.currentTranscript = ''
        }
      },

      onError: (error) => {
        console.error(`[RealtimeHandler] Introduction error:`, error)
        sendMessage(ws, {
          type: 'error',
          message: `Failed to generate introduction: ${error.message}`,
        })
      },

      onClose: () => {
        console.log(`[RealtimeHandler] Introduction session closed`)
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

  // Connect and generate introduction
  try {
    await realtimeClient.connect()
  } catch (error) {
    console.error(`[RealtimeHandler] Failed to connect for introduction:`, error)
    sendMessage(ws, {
      type: 'error',
      message: 'Failed to connect to Realtime API for introduction',
    })
    ws.realtimeSession.cleanup()
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
