import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import { handleVoiceMessage, type VoiceSession } from './voiceHandler'

export interface InterviewWebSocket extends WebSocket {
  interviewId?: string
  voiceSession?: VoiceSession
}

export type WebSocketMessage =
  | { type: 'join_interview'; interview_id: string }
  | { type: 'audio_chunk'; data: string } // base64 encoded audio
  | { type: 'code_update'; code: string }
  | { type: 'voice_start' }
  | { type: 'voice_stop' }
  | { type: 'text_input'; text: string } // For text-based fallback

export type WebSocketResponse =
  | { type: 'joined'; interview_id: string }
  | { type: 'transcript'; text: string; is_final: boolean }
  | { type: 'interviewer_response'; text: string; audio?: string } // audio is base64
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
      if (ws.voiceSession) {
        ws.voiceSession.cleanup()
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
      await handleVoiceMessage(ws, message)
      break

    case 'code_update':
      // Store code update for interview session
      // Will be implemented in Phase 6
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
