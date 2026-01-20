import type { InterviewWebSocket, WebSocketMessage } from './index'
import { sendMessage } from './index'
import { getInterviewerResponse } from '../services/interviewer'
import {
  textToSpeech,
  isConfigured as isCartesiaConfigured,
  StreamingSTTSession,
} from '../services/cartesia'

export interface VoiceSession {
  sttSession: StreamingSTTSession | null
  isRecording: boolean
  interviewContext: InterviewContext
  cleanup: () => void
}

interface InterviewContext {
  interviewId: string
  transcript: TranscriptEntry[]
  currentQuestion: string
  userCode: string
}

interface TranscriptEntry {
  timestamp: number
  speaker: 'user' | 'interviewer'
  text: string
}

export async function handleVoiceMessage(
  ws: InterviewWebSocket,
  message: WebSocketMessage
): Promise<void> {
  switch (message.type) {
    case 'voice_start':
      await startVoiceSession(ws, message.sample_rate)
      break

    case 'voice_stop':
      await stopVoiceSession(ws)
      break

    case 'audio_chunk':
      await processAudioChunk(ws, message.data)
      break

    case 'text_input':
      // Fallback for text-based input (no voice)
      await processTextInput(ws, message.text)
      break
  }
}

async function startVoiceSession(ws: InterviewWebSocket, sampleRate?: number): Promise<void> {
  if (!ws.interviewId) {
    sendMessage(ws, { type: 'error', message: 'Must join interview first' })
    return
  }

  // Check if Cartesia is configured
  if (!isCartesiaConfigured()) {
    sendMessage(ws, { type: 'error', message: 'Cartesia not configured - voice features unavailable' })
    return
  }

  const actualSampleRate = sampleRate || 16000
  console.log('[VOICE] Starting voice session with sample rate:', actualSampleRate)

  // Create streaming STT session with callbacks
  const sttSession = new StreamingSTTSession(
    {
      onTranscript: (text, isFinal) => {
        console.log('[VOICE] Transcript:', isFinal ? '(final)' : '(partial)', text.slice(0, 50))
        // We don't send partial transcripts to client per user request
        // Only final transcript is used when session ends
      },
      onError: (error) => {
        console.error('[VOICE] STT error:', error)
        sendMessage(ws, { type: 'error', message: error.message })
      },
      onDone: async (finalText) => {
        console.log('[VOICE] STT done, final text:', finalText)
        if (finalText.trim()) {
          // Send the final transcript to client
          sendMessage(ws, {
            type: 'transcript',
            text: finalText,
            is_final: true,
          })
          // Generate AI response
          await generateAndSendResponse(ws, finalText)
        } else {
          sendMessage(ws, { type: 'error', message: 'No speech detected' })
        }
        // Reset for next utterance
        ws.voiceSession!.isRecording = false
      },
    },
    { sampleRate: actualSampleRate }
  )

  // Initialize voice session
  ws.voiceSession = {
    sttSession,
    isRecording: true,
    interviewContext: {
      interviewId: ws.interviewId,
      transcript: [],
      currentQuestion: '',
      userCode: '',
    },
    cleanup: () => {
      sttSession.close()
      ws.voiceSession = undefined
    },
  }

  // Connect to Cartesia STT
  try {
    await sttSession.connect()
    console.log('[VOICE] Streaming STT session connected')
    sendMessage(ws, { type: 'voice_ready' })
  } catch (error) {
    console.error('[VOICE] Failed to connect STT session:', error)
    sendMessage(ws, { type: 'error', message: 'Failed to connect voice service' })
    ws.voiceSession = undefined
  }
}

async function stopVoiceSession(ws: InterviewWebSocket): Promise<void> {
  if (!ws.voiceSession) return

  console.log('[VOICE] Stopping voice session - signaling done to Cartesia')
  ws.voiceSession.isRecording = false

  // Signal to Cartesia that we're done sending audio
  // The onDone callback will handle the response
  if (ws.voiceSession.sttSession) {
    ws.voiceSession.sttSession.signalDone()
  }
}

async function processAudioChunk(ws: InterviewWebSocket, base64Audio: string): Promise<void> {
  if (!ws.voiceSession?.isRecording || !ws.voiceSession.sttSession) return

  // Stream audio chunk directly to Cartesia
  ws.voiceSession.sttSession.sendAudioChunkBase64(base64Audio)
}

async function processTextInput(ws: InterviewWebSocket, text: string): Promise<void> {
  if (!ws.interviewId) {
    sendMessage(ws, { type: 'error', message: 'Must join interview first' })
    return
  }

  // Initialize voice session if not exists (for text-only mode)
  if (!ws.voiceSession) {
    ws.voiceSession = {
      sttSession: null, // No STT session for text input
      isRecording: false,
      interviewContext: {
        interviewId: ws.interviewId,
        transcript: [],
        currentQuestion: '',
        userCode: '',
      },
      cleanup: () => {
        ws.voiceSession = undefined
      },
    }
  }

  // Send transcript back for display
  sendMessage(ws, {
    type: 'transcript',
    text: text,
    is_final: true,
  })

  // Generate and send response
  await generateAndSendResponse(ws, text)
}

async function generateAndSendResponse(ws: InterviewWebSocket, userText: string): Promise<void> {
  if (!ws.voiceSession) return

  // Add user message to transcript
  ws.voiceSession.interviewContext.transcript.push({
    timestamp: Date.now(),
    speaker: 'user',
    text: userText,
  })

  try {
    // Get AI interviewer response
    console.log('[VOICE] Getting AI response...')
    const response = await getInterviewerResponse(
      ws.voiceSession.interviewContext.transcript,
      ws.voiceSession.interviewContext.currentQuestion,
      ws.voiceSession.interviewContext.userCode
    )
    console.log('[VOICE] AI response:', response.slice(0, 100))

    // Add interviewer response to transcript
    ws.voiceSession.interviewContext.transcript.push({
      timestamp: Date.now(),
      speaker: 'interviewer',
      text: response,
    })

    // Try to synthesize speech using Cartesia TTS
    let audioBase64: string | undefined
    if (isCartesiaConfigured()) {
      try {
        console.log('[VOICE] Generating TTS audio with Cartesia...')
        audioBase64 = await textToSpeech(response)
        console.log('[VOICE] TTS audio generated')
      } catch (error) {
        console.error('[VOICE] TTS failed, sending text only:', error)
      }
    }

    // Send response to client
    sendMessage(ws, {
      type: 'interviewer_response',
      text: response,
      audio: audioBase64,
    })
  } catch (error) {
    console.error('[VOICE] Failed to generate interviewer response:', error)
    sendMessage(ws, {
      type: 'error',
      message: 'Failed to generate response',
    })
  }
}

export function updateInterviewContext(
  ws: InterviewWebSocket,
  updates: Partial<InterviewContext>
): void {
  if (ws.voiceSession) {
    ws.voiceSession.interviewContext = {
      ...ws.voiceSession.interviewContext,
      ...updates,
    }
  }
}
