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
  autoStartListening?: boolean // Auto-start listening after intro
}

type WebSocketMessage =
  | { type: 'joined'; interview_id: string }
  | { type: 'transcript'; text: string; is_final: boolean }
  | { type: 'interviewer_response'; text: string; audio?: string }
  | { type: 'voice_ready' }
  | { type: 'continue_listening' } // Interviewer decided not to respond, keep listening
  | { type: 'error'; message: string }

export function useVoiceInteraction({
  interviewId,
  currentQuestion = '',
  userCode = '',
  onTranscriptUpdate,
  onInterviewerResponse,
  autoStartListening = true,
}: UseVoiceInteractionOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Use ref for isListening so callbacks always get current value
  const isListeningRef = useRef(false)
  const [isListening, setIsListeningState] = useState(false)

  // Track if microphone is set up
  const isMicSetupRef = useRef(false)

  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const playbackContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  // Sync ref with state
  const setIsListening = useCallback((value: boolean) => {
    isListeningRef.current = value
    setIsListeningState(value)
  }, [])

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

  // Start a new STT session (assumes microphone is already set up)
  const startSTTSession = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[VOICE] Cannot start STT session: WebSocket not connected')
      return
    }

    const sampleRate = audioContextRef.current?.sampleRate || 16000
    console.log('[VOICE] Starting new STT session with sample rate:', sampleRate)
    wsRef.current.send(
      JSON.stringify({
        type: 'voice_start',
        sample_rate: sampleRate,
      })
    )
  }, [])

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
            // No audio - restart listening immediately if in always-on mode
            if (isListeningRef.current) {
              console.log('[VOICE] No audio, restarting STT session immediately')
              startSTTSession()
            } else {
              setVoiceState('idle')
            }
          }
          break

        case 'continue_listening':
          // Interviewer decided not to respond - keep listening for more input
          console.log('[WS] Interviewer chose not to respond, continuing to listen')
          if (isListeningRef.current) {
            startSTTSession()
          } else {
            setVoiceState('idle')
          }
          break

        case 'error':
          console.error('[WS] Error:', message.message)
          setError(message.message)
          // On error, try to restart if in always-on mode
          if (isListeningRef.current) {
            console.log('[VOICE] Error occurred, will retry STT session in 1s')
            setTimeout(() => {
              if (isListeningRef.current) {
                startSTTSession()
              }
            }, 1000)
          } else {
            setVoiceState('idle')
          }
          break
      }
    },
    [onTranscriptUpdate, onInterviewerResponse, startSTTSession]
  )

  // Play audio from base64
  const playAudio = useCallback(async (base64Audio: string) => {
    if (!base64Audio) {
      if (isListeningRef.current) {
        startSTTSession()
      } else {
        setVoiceState('idle')
      }
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
        console.log('[AUDIO] Playback ended, isListening:', isListeningRef.current)
        // After speaking, restart STT session if in always-on mode
        if (isListeningRef.current) {
          console.log('[VOICE] Audio finished, starting new STT session')
          startSTTSession()
        } else {
          setVoiceState('idle')
        }
      }

      source.start(0)
    } catch (err) {
      console.error('[AUDIO] Failed to play:', err)
      if (isListeningRef.current) {
        startSTTSession()
      } else {
        setVoiceState('idle')
      }
    }
  }, [startSTTSession])

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

  // Set up microphone (one-time setup)
  const setupMicrophone = useCallback(async () => {
    if (isMicSetupRef.current) {
      console.log('[MIC] Already set up')
      return true
    }

    try {
      console.log('[MIC] Requesting microphone access...')
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
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      // Create source from microphone stream
      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source

      // Create ScriptProcessorNode to capture raw PCM samples
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        // Only send if WebSocket is open and we're in listening mode
        if (wsRef.current?.readyState !== WebSocket.OPEN) return
        if (!isListeningRef.current) return

        const float32Data = e.inputBuffer.getChannelData(0)
        const int16Data = float32ToInt16(float32Data)
        const base64Audio = int16ToBase64(int16Data)

        wsRef.current.send(
          JSON.stringify({
            type: 'audio_chunk',
            data: base64Audio,
          })
        )
      }

      // Connect: source -> processor -> destination
      source.connect(processor)
      processor.connect(audioContext.destination)

      console.log('[MIC] Setup complete, sample rate:', audioContext.sampleRate)
      isMicSetupRef.current = true
      return true
    } catch (err) {
      console.error('[MIC] Failed to access microphone:', err)
      setError('Microphone access denied')
      return false
    }
  }, [float32ToInt16, int16ToBase64])

  // Enable always-on listening mode
  const enableAlwaysListening = useCallback(async () => {
    console.log('[VOICE] Enabling always-on listening')

    // Set up microphone if not already done
    const micReady = await setupMicrophone()
    if (!micReady) {
      console.error('[VOICE] Failed to set up microphone')
      return
    }

    setIsListening(true)
    setError(null)

    // Start the first STT session
    startSTTSession()
  }, [setupMicrophone, setIsListening, startSTTSession])

  // Disable always-on listening mode
  const disableAlwaysListening = useCallback(() => {
    console.log('[VOICE] Disabling always-on listening')
    setIsListening(false)

    // Tell server to stop current voice session
    wsRef.current?.send(JSON.stringify({ type: 'voice_stop' }))
    setVoiceState('idle')
  }, [setIsListening])

  // Legacy startListening for backwards compatibility
  const startListening = enableAlwaysListening
  const stopListening = disableAlwaysListening

  // Send text input (fallback for no-mic scenarios)
  const sendTextInput = useCallback(
    async (text: string) => {
      if (!text.trim()) return

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

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'text_input',
            text,
          })
        )
      } else {
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

  // Play a pre-cached introduction and auto-enable listening after
  const playCachedIntroduction = useCallback(
    async (cachedIntro: { text: string; audio?: string }) => {
      console.log('[VOICE] Playing cached introduction, autoStartListening:', autoStartListening)

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

      // If auto-start is enabled, set up microphone and enable listening
      // This way when audio finishes, it will auto-start the STT session
      if (autoStartListening) {
        console.log('[VOICE] Setting up microphone for always-on listening')
        const micReady = await setupMicrophone()
        if (micReady) {
          setIsListening(true)
        }
      }

      if (cachedIntro.audio) {
        playAudio(cachedIntro.audio)
      } else {
        // No audio - start listening immediately if enabled
        if (autoStartListening && isListeningRef.current) {
          startSTTSession()
        } else {
          setVoiceState('idle')
        }
      }
    },
    [onTranscriptUpdate, onInterviewerResponse, playAudio, autoStartListening, setupMicrophone, setIsListening, startSTTSession]
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
    // Always-listening mode
    isAlwaysListening: isListening,
    isSpeechDetected: voiceState === 'listening',
    enableAlwaysListening,
    disableAlwaysListening,
    currentTranscript: '', // No longer used - we don't show partial transcripts
  }
}
