import { useState, useRef, useCallback, useEffect } from 'react'
import type { VoiceState } from '@/components/interview/VoiceAvatar'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface TranscriptEntry {
  timestamp: number
  speaker: 'user' | 'interviewer'
  text: string
}

interface UseVoiceInteractionOptions {
  interviewId: string
  currentQuestion?: string
  userCode?: string
  onTranscriptUpdate?: (transcript: TranscriptEntry[]) => void
  onInterviewerResponse?: (text: string) => void
}

type WebSocketMessage =
  | { type: 'joined'; interview_id: string }
  | { type: 'transcript'; text: string; is_final: boolean }
  | { type: 'interviewer_response'; text: string; audio?: string }
  | { type: 'voice_ready' }
  | { type: 'error'; message: string }

export function useVoiceInteraction({
  interviewId,
  currentQuestion = '',
  userCode = '',
  onTranscriptUpdate,
  onInterviewerResponse,
}: UseVoiceInteractionOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const playbackContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    const ws = new WebSocket(`${WS_URL}/ws/interview`)

    ws.onopen = () => {
      console.log('[WS] Connected')
      setIsConnected(true)
      setError(null)

      // Join the interview
      ws.send(JSON.stringify({ type: 'join_interview', interview_id: interviewId }))
    }

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        handleWebSocketMessage(message)
      } catch (err) {
        console.error('[WS] Failed to parse message:', err)
      }
    }

    ws.onerror = (event) => {
      console.error('[WS] Error:', event)
      setError('Connection error')
    }

    ws.onclose = () => {
      console.log('[WS] Disconnected')
      setIsConnected(false)
    }

    wsRef.current = ws
  }, [interviewId])

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case 'joined':
          console.log('[WS] Joined interview:', message.interview_id)
          break

        case 'voice_ready':
          console.log('[WS] Voice session ready - streaming to Cartesia')
          setVoiceState('listening')
          break

        case 'transcript':
          // We only get final transcript after Cartesia detects silence
          if (message.is_final && message.text.trim()) {
            console.log('[WS] Final transcript:', message.text)
            const newEntry: TranscriptEntry = {
              timestamp: Date.now(),
              speaker: 'user',
              text: message.text,
            }
            setTranscript((prev) => {
              const updated = [...prev, newEntry]
              onTranscriptUpdate?.(updated)
              return updated
            })
            setVoiceState('processing')
          }
          break

        case 'interviewer_response':
          console.log('[WS] Interviewer response received')
          const responseEntry: TranscriptEntry = {
            timestamp: Date.now(),
            speaker: 'interviewer',
            text: message.text,
          }
          setTranscript((prev) => {
            const updated = [...prev, responseEntry]
            onTranscriptUpdate?.(updated)
            return updated
          })
          onInterviewerResponse?.(message.text)

          // Play audio if available
          if (message.audio) {
            playAudio(message.audio)
          } else {
            // Go back to listening if still in listening mode
            if (isListening) {
              restartVoiceSession()
            } else {
              setVoiceState('idle')
            }
          }
          break

        case 'error':
          console.error('[WS] Error:', message.message)
          setError(message.message)
          setVoiceState('idle')
          break
      }
    },
    [onTranscriptUpdate, onInterviewerResponse, isListening]
  )

  // Play audio from base64
  const playAudio = useCallback(async (base64Audio: string) => {
    if (!base64Audio) {
      setVoiceState('idle')
      return
    }

    setVoiceState('speaking')

    try {
      // Create playback audio context if needed (separate from recording context)
      if (!playbackContextRef.current) {
        playbackContextRef.current = new AudioContext()
      }

      // Decode base64 to audio buffer
      const binaryString = atob(base64Audio)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const audioBuffer = await playbackContextRef.current.decodeAudioData(bytes.buffer)

      // Play the audio
      const source = playbackContextRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(playbackContextRef.current.destination)

      source.onended = () => {
        // After speaking, restart voice session if still listening
        if (isListening) {
          restartVoiceSession()
        } else {
          setVoiceState('idle')
        }
      }

      source.start(0)
    } catch (err) {
      console.error('[AUDIO] Failed to play:', err)
      setVoiceState('idle')
    }
  }, [isListening])

  // Restart voice session (for continuous listening mode)
  const restartVoiceSession = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    console.log('[VOICE] Restarting voice session for next utterance')
    wsRef.current.send(JSON.stringify({ type: 'voice_start' }))
  }, [])

  // Convert Float32 audio samples to Int16 (PCM s16le)
  const float32ToInt16 = useCallback((float32Array: Float32Array): Int16Array => {
    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp to [-1, 1] and scale to Int16 range
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return int16Array
  }, [])

  // Convert Int16Array to base64
  const int16ToBase64 = useCallback((int16Array: Int16Array): string => {
    const bytes = new Uint8Array(int16Array.buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }, [])

  // Start streaming audio to server
  const startListening = useCallback(async () => {
    if (voiceState !== 'idle') return

    try {
      console.log('[MIC] Requesting microphone access...')
      // Request microphone with specific sample rate
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      streamRef.current = stream

      // Create AudioContext at 16kHz for recording
      // Note: Browser may not honor the sample rate, so we'll resample if needed
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      // Create source from microphone stream
      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source

      // Create ScriptProcessorNode to capture raw PCM samples
      // Buffer size of 4096 at 16kHz = 256ms of audio per chunk
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return

        // Get raw float32 audio data from input channel
        const float32Data = e.inputBuffer.getChannelData(0)

        // Convert to Int16 (PCM s16le) format
        const int16Data = float32ToInt16(float32Data)

        // Convert to base64 and send to server
        const base64Audio = int16ToBase64(int16Data)

        wsRef.current.send(
          JSON.stringify({
            type: 'audio_chunk',
            data: base64Audio,
          })
        )
      }

      // Connect: source -> processor -> destination (required for processor to work)
      source.connect(processor)
      processor.connect(audioContext.destination)

      console.log('[MIC] Recording started at', audioContext.sampleRate, 'Hz, streaming PCM to server')

      // Tell server to start voice session (connects to Cartesia)
      // Pass the actual sample rate so server can configure Cartesia correctly
      wsRef.current?.send(
        JSON.stringify({
          type: 'voice_start',
          sample_rate: audioContext.sampleRate,
        })
      )

      setIsListening(true)
      setError(null)
    } catch (err) {
      console.error('[MIC] Failed to access microphone:', err)
      setError('Microphone access denied')
    }
  }, [voiceState, float32ToInt16, int16ToBase64])

  // Stop listening
  const stopListening = useCallback(() => {
    console.log('[MIC] Stopping listening')

    // Disconnect and clean up audio processor
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }

    // Close audio context (but keep playback context)
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    // Stop microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    // Tell server to stop voice session
    wsRef.current?.send(JSON.stringify({ type: 'voice_stop' }))

    setIsListening(false)
    setVoiceState('idle')
  }, [])

  // Send text input (fallback for no-mic scenarios)
  const sendTextInput = useCallback(
    async (text: string) => {
      if (!text.trim()) return

      // Add user message to transcript
      const userEntry: TranscriptEntry = {
        timestamp: Date.now(),
        speaker: 'user',
        text,
      }
      setTranscript((prev) => {
        const updated = [...prev, userEntry]
        onTranscriptUpdate?.(updated)
        return updated
      })

      setVoiceState('processing')

      // Send via WebSocket if connected
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'text_input',
            text,
          })
        )
      } else {
        // Fallback to REST API
        await sendTextInputRest(text)
      }
    },
    [onTranscriptUpdate]
  )

  // REST API fallback for text input
  const sendTextInputRest = useCallback(
    async (_text: string) => {
      try {
        const response = await fetch(`${API_URL}/api/voice/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript,
            current_question: currentQuestion,
            user_code: userCode,
            include_audio: true,
          }),
        })

        const data = await response.json()

        if (data.success) {
          const responseEntry: TranscriptEntry = {
            timestamp: Date.now(),
            speaker: 'interviewer',
            text: data.text,
          }
          setTranscript((prev) => {
            const updated = [...prev, responseEntry]
            onTranscriptUpdate?.(updated)
            return updated
          })
          onInterviewerResponse?.(data.text)

          if (data.audio) {
            playAudio(data.audio)
          } else {
            setVoiceState('idle')
          }
        } else {
          setError(data.error || 'Failed to get response')
          setVoiceState('idle')
        }
      } catch (err) {
        console.error('[REST] Failed to send text input:', err)
        setError('Failed to communicate with server')
        setVoiceState('idle')
      }
    },
    [transcript, currentQuestion, userCode, onTranscriptUpdate, onInterviewerResponse, playAudio]
  )

  // Request a hint
  const requestHint = useCallback(async () => {
    setVoiceState('processing')

    try {
      const response = await fetch(`${API_URL}/api/voice/hint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_question: currentQuestion,
          user_code: userCode,
          transcript,
          include_audio: true,
        }),
      })

      const data = await response.json()

      if (data.success) {
        const hintEntry: TranscriptEntry = {
          timestamp: Date.now(),
          speaker: 'interviewer',
          text: `Hint: ${data.text}`,
        }
        setTranscript((prev) => {
          const updated = [...prev, hintEntry]
          onTranscriptUpdate?.(updated)
          return updated
        })
        onInterviewerResponse?.(data.text)

        if (data.audio) {
          playAudio(data.audio)
        } else {
          setVoiceState('idle')
        }
      } else {
        setError(data.error || 'Failed to get hint')
        setVoiceState('idle')
      }
    } catch (err) {
      console.error('[REST] Failed to request hint:', err)
      setError('Failed to get hint')
      setVoiceState('idle')
    }
  }, [currentQuestion, userCode, transcript, onTranscriptUpdate, onInterviewerResponse, playAudio])

  // Request introduction
  const requestIntroduction = useCallback(async () => {
    if (!currentQuestion) return

    setVoiceState('processing')

    try {
      const response = await fetch(`${API_URL}/api/voice/introduce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_question: currentQuestion,
          include_audio: true,
        }),
      })

      const data = await response.json()

      if (data.success) {
        const introEntry: TranscriptEntry = {
          timestamp: Date.now(),
          speaker: 'interviewer',
          text: data.text,
        }
        setTranscript((prev) => {
          const updated = [...prev, introEntry]
          onTranscriptUpdate?.(updated)
          return updated
        })
        onInterviewerResponse?.(data.text)

        if (data.audio) {
          playAudio(data.audio)
        } else {
          setVoiceState('idle')
        }
      } else {
        setError(data.error || 'Failed to get introduction')
        setVoiceState('idle')
      }
    } catch (err) {
      console.error('[REST] Failed to request introduction:', err)
      setError('Failed to get introduction')
      setVoiceState('idle')
    }
  }, [currentQuestion, onTranscriptUpdate, onInterviewerResponse, playAudio])

  // Play a pre-cached introduction
  const playCachedIntroduction = useCallback(
    (cachedIntro: { text: string; audio?: string }) => {
      console.log('[VOICE] Playing cached introduction')

      const introEntry: TranscriptEntry = {
        timestamp: Date.now(),
        speaker: 'interviewer',
        text: cachedIntro.text,
      }
      setTranscript((prev) => {
        const updated = [...prev, introEntry]
        onTranscriptUpdate?.(updated)
        return updated
      })
      onInterviewerResponse?.(cachedIntro.text)

      if (cachedIntro.audio) {
        playAudio(cachedIntro.audio)
      } else {
        setVoiceState('idle')
      }
    },
    [onTranscriptUpdate, onInterviewerResponse, playAudio]
  )

  // Connect on mount
  useEffect(() => {
    connect()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (processorRef.current) {
        processorRef.current.disconnect()
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      if (playbackContextRef.current) {
        playbackContextRef.current.close()
      }
    }
  }, [connect])

  return {
    voiceState,
    transcript,
    isConnected,
    error,
    isListening,
    startListening,
    stopListening,
    sendTextInput,
    requestHint,
    requestIntroduction,
    playCachedIntroduction,
    // Backwards compatibility aliases
    isAlwaysListening: isListening,
    isSpeechDetected: voiceState === 'listening',
    enableAlwaysListening: startListening,
    disableAlwaysListening: stopListening,
    currentTranscript: '', // No longer used - we don't show partial transcripts
  }
}
