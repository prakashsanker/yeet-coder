/**
 * useRealtimeVoice - Hook for OpenAI Realtime API voice interaction
 *
 * This hook streams raw PCM16 audio directly to the server which relays
 * it to OpenAI's Realtime API for low-latency speech-to-speech interaction.
 *
 * Key differences from useVoiceInteraction:
 * - Streams audio in real-time (not batched)
 * - Uses PCM16 format at 24kHz (Realtime API requirement)
 * - Server handles turn detection via OpenAI's VAD
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import type { VoiceState } from '@/components/interview/VoiceAvatar'

const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}`
}

interface TranscriptEntry {
  timestamp: number
  speaker: 'user' | 'interviewer'
  text: string
}

interface UseRealtimeVoiceOptions {
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

// AudioWorklet processor code for capturing PCM16 audio
const AUDIO_WORKLET_CODE = `
class PCM16Processor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2400; // 100ms at 24kHz
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const inputChannel = input[0];

    for (let i = 0; i < inputChannel.length; i++) {
      this.buffer[this.bufferIndex++] = inputChannel[i];

      if (this.bufferIndex >= this.bufferSize) {
        // Convert float32 to int16
        const int16Buffer = new Int16Array(this.bufferSize);
        for (let j = 0; j < this.bufferSize; j++) {
          const s = Math.max(-1, Math.min(1, this.buffer[j]));
          int16Buffer[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send to main thread
        this.port.postMessage({
          type: 'audio',
          buffer: int16Buffer.buffer
        }, [int16Buffer.buffer]);

        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('pcm16-processor', PCM16Processor);
`;

export function useRealtimeVoice({
  interviewId,
  currentQuestion = '',
  userCode = '',
  onTranscriptUpdate,
  onInterviewerResponse,
}: UseRealtimeVoiceOptions) {
  console.log('[RealtimeVoice] Hook initialized - this is the REALTIME API hook, NOT the pipeline hook')
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [currentTranscript, setCurrentTranscript] = useState<string>('')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  // For compatibility with useVoiceInteraction API
  const [isSpeechDetected, setIsSpeechDetected] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const playbackContextRef = useRef<AudioContext | null>(null)

  // Track if we've sent question context
  const sentContextRef = useRef(false)

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    const ws = new WebSocket(`${getWsUrl()}/ws/interview`)

    ws.onopen = () => {
      console.log('[RealtimeVoice] WebSocket connected')
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
        console.error('[RealtimeVoice] Failed to parse message:', err)
      }
    }

    ws.onerror = (event) => {
      console.error('[RealtimeVoice] WebSocket error:', event)
      setError('Connection error')
    }

    ws.onclose = () => {
      console.log('[RealtimeVoice] WebSocket disconnected')
      setIsConnected(false)
    }

    wsRef.current = ws
  }, [interviewId])

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case 'joined':
          console.log('[RealtimeVoice] Joined interview:', message.interview_id)
          break

        case 'voice_ready':
          console.log('[RealtimeVoice] Voice session ready')
          setVoiceState('idle')
          break

        case 'transcript':
          // User's speech transcribed
          if (message.is_final && message.text.trim()) {
            setCurrentTranscript('')
            setIsSpeechDetected(false)
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
          } else if (!message.is_final) {
            // Partial transcript - show in real-time
            setCurrentTranscript(message.text)
            setIsSpeechDetected(true)
          }
          break

        case 'interviewer_response':
          // AI response received
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
            playPCM16Audio(message.audio)
          } else {
            setVoiceState('idle')
          }
          break

        case 'error':
          console.error('[RealtimeVoice] Server error:', message.message)
          setError(message.message)
          setVoiceState('idle')
          break
      }
    },
    [onTranscriptUpdate, onInterviewerResponse]
  )

  // Play PCM16 audio from base64
  const playPCM16Audio = useCallback(async (base64Audio: string) => {
    setVoiceState('speaking')

    try {
      // Decode base64 to ArrayBuffer
      const binaryString = atob(base64Audio)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      // Convert PCM16 to Float32 for Web Audio API
      const int16Array = new Int16Array(bytes.buffer)
      const float32Array = new Float32Array(int16Array.length)
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768
      }

      // Use separate playback context to avoid conflicts with recording
      if (!playbackContextRef.current || playbackContextRef.current.state === 'closed') {
        playbackContextRef.current = new AudioContext({ sampleRate: 24000 })
      }

      const playbackContext = playbackContextRef.current
      if (playbackContext.state === 'suspended') {
        await playbackContext.resume()
      }

      // Create audio buffer
      const audioBuffer = playbackContext.createBuffer(1, float32Array.length, 24000)
      audioBuffer.getChannelData(0).set(float32Array)

      // Play
      const source = playbackContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(playbackContext.destination)

      source.onended = () => {
        setVoiceState('idle')
      }

      source.start(0)
    } catch (err) {
      console.error('[RealtimeVoice] Failed to play audio:', err)
      setVoiceState('idle')
    }
  }, [])

  // Play MP3 audio (for compatibility with pipeline mode cached intros)
  const playMP3Audio = useCallback(async (base64Audio: string) => {
    setVoiceState('speaking')

    try {
      const audioDataUrl = `data:audio/mp3;base64,${base64Audio}`
      const audio = new Audio(audioDataUrl)

      audio.onended = () => {
        setVoiceState('idle')
      }

      audio.onerror = () => {
        console.error('[RealtimeVoice] Failed to play MP3 audio')
        setVoiceState('idle')
      }

      await audio.play()
    } catch (err) {
      console.error('[RealtimeVoice] Failed to play MP3:', err)
      setVoiceState('idle')
    }
  }, [])

  // Play cached introduction (compatibility with useVoiceInteraction)
  const playCachedIntroduction = useCallback(
    (cachedIntro: { text: string; audio?: string }) => {
      console.log('[RealtimeVoice] Playing cached introduction')

      // Add to transcript
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

      // Play audio if available (likely MP3 from pipeline mode)
      if (cachedIntro.audio) {
        playMP3Audio(cachedIntro.audio)
      } else {
        setVoiceState('idle')
      }
    },
    [onTranscriptUpdate, onInterviewerResponse, playMP3Audio]
  )

  // Send audio chunk to server
  const sendAudioChunk = useCallback((buffer: ArrayBuffer) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return

    // Convert ArrayBuffer to base64
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)

    // Only send if WebSocket is open
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'audio_chunk',
          data: base64,
        })
      )
    }
  }, [])

  // Start listening with real-time audio streaming
  const startListening = useCallback(async () => {
    console.log('[RealtimeVoice] startListening called, isListening:', isListening, 'wsState:', wsRef.current?.readyState)
    if (isListening) return

    try {
      console.log('[RealtimeVoice] Starting listening...')

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      streamRef.current = stream

      // Create audio context at 24kHz
      const audioContext = new AudioContext({ sampleRate: 24000 })
      audioContextRef.current = audioContext

      // Create and register the AudioWorklet processor
      const blob = new Blob([AUDIO_WORKLET_CODE], { type: 'application/javascript' })
      const workletUrl = URL.createObjectURL(blob)

      await audioContext.audioWorklet.addModule(workletUrl)
      URL.revokeObjectURL(workletUrl)

      // Create the worklet node
      const workletNode = new AudioWorkletNode(audioContext, 'pcm16-processor')
      workletNodeRef.current = workletNode

      // Handle audio data from worklet
      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio') {
          sendAudioChunk(event.data.buffer)
        }
      }

      // Connect microphone -> worklet
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(workletNode)

      // Tell server to start voice session
      console.log('[RealtimeVoice] Sending voice_start message to server, ws readyState:', wsRef.current?.readyState)
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'voice_start' }))
        console.log('[RealtimeVoice] voice_start message sent!')
      } else {
        console.error('[RealtimeVoice] WebSocket not open! Cannot send voice_start')
      }

      // Send current context to server (only if WebSocket is open)
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        if (!sentContextRef.current && currentQuestion) {
          wsRef.current.send(
            JSON.stringify({
              type: 'question_update',
              question: currentQuestion,
            })
          )
          sentContextRef.current = true
        }

        if (userCode) {
          wsRef.current.send(
            JSON.stringify({
              type: 'code_update',
              code: userCode,
            })
          )
        }
      }

      setIsListening(true)
      setVoiceState('listening')
      setError(null)

      console.log('[RealtimeVoice] Listening started')
    } catch (err) {
      console.error('[RealtimeVoice] Failed to start listening:', err)
      setError('Microphone access denied')
    }
  }, [isListening, sendAudioChunk, currentQuestion, userCode])

  // Stop listening
  const stopListening = useCallback(() => {
    console.log('[RealtimeVoice] Stopping listening...')

    // Stop worklet
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect()
      workletNodeRef.current = null
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    // Stop microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    // Tell server to stop (only if WebSocket is open)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'voice_stop' }))
    }

    setIsListening(false)
    setVoiceState('idle')
  }, [])

  // Send text input (fallback)
  const sendTextInput = useCallback(
    (text: string) => {
      if (!text.trim()) return

      // Add to transcript
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

      // Send via WebSocket (only if open)
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'text_input',
            text,
          })
        )
      }
    },
    [onTranscriptUpdate]
  )

  // Update context when question/code changes
  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    if (currentQuestion) {
      wsRef.current.send(
        JSON.stringify({
          type: 'question_update',
          question: currentQuestion,
        })
      )
    }
  }, [currentQuestion])

  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    if (userCode) {
      wsRef.current.send(
        JSON.stringify({
          type: 'code_update',
          code: userCode,
        })
      )
    }
  }, [userCode])

  // Connect on mount
  useEffect(() => {
    connect()

    return () => {
      // Cleanup
      stopListening()
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  // Compatibility aliases for useVoiceInteraction API
  const enableAlwaysListening = startListening
  const disableAlwaysListening = stopListening
  const isAlwaysListening = isListening

  return {
    voiceState,
    currentTranscript,
    transcript,
    isConnected,
    error,
    isListening,
    startListening,
    stopListening,
    sendTextInput,
    playCachedIntroduction,
    // Compatibility with useVoiceInteraction
    isAlwaysListening,
    isSpeechDetected,
    enableAlwaysListening,
    disableAlwaysListening,
  }
}
