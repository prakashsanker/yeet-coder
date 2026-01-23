import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import { handleVoiceMessage, type VoiceSession } from './voiceHandler.js'
import {
  handleRealtimeVoiceMessage,
  cleanupRealtimeSession,
  updateRealtimeContext,
  type RealtimeVoiceSession,
} from './realtimeVoiceHandler.js'

// Voice mode configuration
// 'realtime' = OpenAI Realtime API (low-latency, speech-to-speech)
// 'pipeline' = Traditional pipeline (STT -> LLM -> TTS)
export type VoiceMode = 'realtime' | 'pipeline'

const VOICE_MODE: VoiceMode = (process.env.VOICE_MODE as VoiceMode) || 'pipeline'

console.log(`[WebSocket] Voice mode: ${VOICE_MODE}`)

export interface InterviewWebSocket extends WebSocket {
  interviewId?: string
  voiceSession?: VoiceSession // Traditional pipeline session
  realtimeSession?: RealtimeVoiceSession // Realtime API session
  // Store context independently so it persists across session recreations
  interviewContext?: {
    currentQuestion: string
    userCode: string
  }
}

export type WebSocketMessage =
  | { type: 'join_interview'; interview_id: string }
  | { type: 'audio_chunk'; data: string } // base64 encoded audio
  | { type: 'code_update'; code: string }
  | { type: 'question_update'; question: string } // Update current problem
  | { type: 'voice_start' }
  | { type: 'voice_stop' }
  | { type: 'text_input'; text: string } // For text-based fallback
  | { type: 'request_introduction'; text: string } // Request intro using Realtime API voice

export type WebSocketResponse =
  | { type: 'joined'; interview_id: string }
  | { type: 'transcript'; text: string; is_final: boolean }
  | { type: 'interviewer_response'; text: string; audio?: string } // audio is base64
  | { type: 'introduction_ready'; text: string; audio?: string } // intro with Realtime API voice
  | { type: 'interview_state'; state: unknown }
  | { type: 'error'; message: string }
  | { type: 'voice_ready' }

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws/interview' })

  wss.on('connection', (ws: InterviewWebSocket) => {
    console.log('WebSocket client connected')

    ws.on('message', async (data) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString())
        await handleMessage(ws, message)
      } catch (error) {
        console.error('WebSocket message error:', error)
        sendMessage(ws, {
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })

    ws.on('close', () => {
      console.log('WebSocket client disconnected')
      // Clean up based on voice mode
      if (ws.voiceSession) {
        ws.voiceSession.cleanup()
      }
      if (ws.realtimeSession) {
        cleanupRealtimeSession(ws)
      }
    })

    ws.on('error', (error) => {
      console.error('WebSocket error:', error)
    })
  })

  return wss
}

async function handleMessage(ws: InterviewWebSocket, message: WebSocketMessage): Promise<void> {
  switch (message.type) {
    case 'join_interview':
      ws.interviewId = message.interview_id
      sendMessage(ws, { type: 'joined', interview_id: message.interview_id })
      break

    case 'audio_chunk':
    case 'voice_start':
    case 'voice_stop':
    case 'text_input':
      // Route to appropriate handler based on voice mode
      console.log(`[WebSocket] Received ${message.type}, routing to ${VOICE_MODE} handler`)
      if (VOICE_MODE === 'realtime') {
        await handleRealtimeVoiceMessage(ws, message)
      } else {
        await handleVoiceMessage(ws, message)
      }
      break

    case 'request_introduction':
      // Always use Realtime API for introductions to ensure voice consistency
      console.log(`[WebSocket] Received request_introduction, routing to realtime handler`)
      await handleRealtimeVoiceMessage(ws, message)
      break

    case 'code_update':
      // Store context on WebSocket object (persists across session recreations)
      if (!ws.interviewContext) {
        ws.interviewContext = { currentQuestion: '', userCode: '' }
      }
      ws.interviewContext.userCode = message.code
      // Also update active session if it exists
      if (VOICE_MODE === 'realtime' && ws.realtimeSession) {
        updateRealtimeContext(ws, { userCode: message.code })
      } else if (ws.voiceSession) {
        ws.voiceSession.interviewContext.userCode = message.code
      }
      break

    case 'question_update':
      // Store context on WebSocket object (persists across session recreations)
      if (!ws.interviewContext) {
        ws.interviewContext = { currentQuestion: '', userCode: '' }
      }
      ws.interviewContext.currentQuestion = message.question
      // Also update active session if it exists
      if (VOICE_MODE === 'realtime' && ws.realtimeSession) {
        updateRealtimeContext(ws, { currentQuestion: message.question })
      } else if (ws.voiceSession) {
        ws.voiceSession.interviewContext.currentQuestion = message.question
      }
      break

    default:
      sendMessage(ws, { type: 'error', message: 'Unknown message type' })
  }
}

export function sendMessage(ws: WebSocket, message: WebSocketResponse): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  }
}
