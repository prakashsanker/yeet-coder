import type { InterviewWebSocket, WebSocketMessage } from './index'
import { sendMessage } from './index'
import { getInterviewerResponse } from '../services/interviewer'
import { textToSpeech, speechToText, isConfigured as isOpenAIConfigured } from '../services/openai-voice'

export interface VoiceSession {
  audioChunks: string[] // base64 audio chunks
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
      await startVoiceSession(ws)
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

async function startVoiceSession(ws: InterviewWebSocket): Promise<void> {
  if (!ws.interviewId) {
    sendMessage(ws, { type: 'error', message: 'Must join interview first' })
    return
  }

  // Initialize voice session
  ws.voiceSession = {
    audioChunks: [],
    isRecording: true,
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

  // Check if OpenAI is configured
  if (!isOpenAIConfigured()) {
    console.warn('OpenAI not configured - voice transcription will be limited')
  }

  sendMessage(ws, { type: 'voice_ready' })
}

async function stopVoiceSession(ws: InterviewWebSocket): Promise<void> {
  if (!ws.voiceSession) return

  ws.voiceSession.isRecording = false

  // Transcribe collected audio using OpenAI Whisper
  if (ws.voiceSession.audioChunks.length > 0) {
    try {
      // Combine all audio chunks
      const combinedAudio = ws.voiceSession.audioChunks.join('')
      ws.voiceSession.audioChunks = [] // Clear buffer

      if (isOpenAIConfigured()) {
        const transcribedText = await speechToText(combinedAudio, 'audio/webm')

        if (transcribedText.trim()) {
          // Send transcript to client
          sendMessage(ws, {
            type: 'transcript',
            text: transcribedText,
            is_final: true,
          })

          // Generate interviewer response
          await generateAndSendResponse(ws, transcribedText)
        } else {
          sendMessage(ws, { type: 'error', message: 'No speech detected' })
        }
      } else {
        sendMessage(ws, { type: 'error', message: 'Voice transcription not configured' })
      }
    } catch (error) {
      console.error('Transcription failed:', error)
      sendMessage(ws, {
        type: 'error',
        message: 'Failed to transcribe audio',
      })
    }
  }
}

async function processAudioChunk(ws: InterviewWebSocket, base64Audio: string): Promise<void> {
  if (!ws.voiceSession?.isRecording) return

  // Collect audio chunks for batch transcription when recording stops
  ws.voiceSession.audioChunks.push(base64Audio)
}

async function processTextInput(ws: InterviewWebSocket, text: string): Promise<void> {
  if (!ws.interviewId) {
    sendMessage(ws, { type: 'error', message: 'Must join interview first' })
    return
  }

  // Initialize voice session if not exists (for text-only mode)
  if (!ws.voiceSession) {
    ws.voiceSession = {
      audioChunks: [],
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
    const response = await getInterviewerResponse(
      ws.voiceSession.interviewContext.transcript,
      ws.voiceSession.interviewContext.currentQuestion,
      ws.voiceSession.interviewContext.userCode
    )

    // Add interviewer response to transcript
    ws.voiceSession.interviewContext.transcript.push({
      timestamp: Date.now(),
      speaker: 'interviewer',
      text: response,
    })

    // Try to synthesize speech using OpenAI TTS
    let audioBase64: string | undefined
    if (isOpenAIConfigured()) {
      try {
        audioBase64 = await textToSpeech(response)
      } catch (error) {
        console.error('TTS failed, sending text only:', error)
      }
    }

    // Send response to client
    sendMessage(ws, {
      type: 'interviewer_response',
      text: response,
      audio: audioBase64,
    })
  } catch (error) {
    console.error('Failed to generate interviewer response:', error)
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
