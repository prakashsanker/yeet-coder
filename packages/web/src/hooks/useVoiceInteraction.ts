import { useState, useRef, useCallback, useEffect } from 'react'
import type { VoiceState } from '@/components/interview/VoiceAvatar'

// Use relative URLs - WebSocket URL is derived from current page location
const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}`
}
const API_URL = import.meta.env.VITE_API_URL || ''

// Voice Activity Detection settings
const VAD_THRESHOLD = 0.02 // Volume level to detect speech (adjust as needed)
const SILENCE_TIMEOUT_MS = 1500 // How long to wait after silence before sending

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
  const [currentTranscript, setCurrentTranscript] = useState<string>('')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAlwaysListening, setIsAlwaysListening] = useState(false)
  const [isSpeechDetected, setIsSpeechDetected] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)

  // Always-listening mode refs
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const vadAnimationRef = useRef<number | null>(null)
  const isRecordingRef = useRef(false)

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    const ws = new WebSocket(`${getWsUrl()}/ws/interview`)

    ws.onopen = () => {
      console.log('WebSocket connected')
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
        console.error('Failed to parse WebSocket message:', err)
      }
    }

    ws.onerror = (event) => {
      console.error('WebSocket error:', event)
      setError('Connection error')
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      setIsConnected(false)
    }

    wsRef.current = ws
  }, [interviewId])

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case 'joined':
          console.log('Joined interview:', message.interview_id)
          break

        case 'voice_ready':
          console.log('Voice ready')
          break

        case 'transcript':
          setCurrentTranscript(message.text)
          if (message.is_final && message.text.trim()) {
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
            setCurrentTranscript('')
            setVoiceState('processing')
          }
          break

        case 'interviewer_response':
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
            setVoiceState('idle')
          }
          break

        case 'error':
          setError(message.message)
          setVoiceState('idle')
          break
      }
    },
    [onTranscriptUpdate, onInterviewerResponse]
  )

  // Play audio from base64
  const playAudio = useCallback(async (base64Audio: string) => {
    if (!base64Audio) {
      setVoiceState('idle')
      return
    }

    setVoiceState('speaking')

    try {
      // Create audio context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }

      // Decode base64 to audio buffer
      const binaryString = atob(base64Audio)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer)

      // Play the audio
      const source = audioContextRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContextRef.current.destination)

      source.onended = () => {
        setVoiceState('idle')
      }

      source.start(0)
    } catch (err) {
      console.error('Failed to play audio:', err)
      setVoiceState('idle')
    }
  }, [])

  // Helper function for REST API fallback
  const sendTextInputRest = useCallback(
    async (_text: string, existingTranscript?: TranscriptEntry[]) => {
      try {
        const response = await fetch(`${API_URL}/api/voice/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: existingTranscript || transcript,
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
        console.error('Failed to send text input:', err)
        setError('Failed to communicate with server')
        setVoiceState('idle')
      }
    },
    [transcript, currentQuestion, userCode, onTranscriptUpdate, onInterviewerResponse, playAudio]
  )

  // Start listening (microphone recording)
  const startListening = useCallback(async () => {
    if (voiceState !== 'idle') return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Clear previous audio chunks
      audioChunksRef.current = []

      // Create MediaRecorder for audio chunks
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Collect chunks locally for batch transcription
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(100) // Collect chunks every 100ms

      // Notify server we're starting
      wsRef.current?.send(JSON.stringify({ type: 'voice_start' }))

      setVoiceState('listening')
      setError(null)
    } catch (err) {
      console.error('Failed to access microphone:', err)
      setError('Microphone access denied')
    }
  }, [voiceState])

  // Stop listening
  const stopListening = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return
    }

    // Stop the media recorder - this will trigger one final ondataavailable
    const mediaRecorder = mediaRecorderRef.current
    mediaRecorder.stop()
    mediaRecorder.stream.getTracks().forEach((track) => track.stop())
    mediaRecorderRef.current = null

    setVoiceState('processing')

    // Wait a tick for the final chunk to be collected
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Combine all audio chunks into a single blob
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
    audioChunksRef.current = []

    if (audioBlob.size === 0) {
      setError('No audio recorded')
      setVoiceState('idle')
      return
    }

    // Convert blob to base64
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64Audio = (reader.result as string).split(',')[1]

      try {
        // Send audio to transcribe endpoint
        const response = await fetch(`${API_URL}/api/voice/transcribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio: base64Audio,
            mime_type: 'audio/webm',
          }),
        })

        const data = await response.json()

        if (data.success && data.text?.trim()) {
          // Add user message to transcript
          const userEntry: TranscriptEntry = {
            timestamp: Date.now(),
            speaker: 'user',
            text: data.text,
          }
          setTranscript((prev) => {
            const updated = [...prev, userEntry]
            onTranscriptUpdate?.(updated)
            return updated
          })

          // Now get AI response via text_input (WebSocket) or REST
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'text_input',
                text: data.text,
              })
            )
          } else {
            // Fallback to REST
            await sendTextInputRest(data.text)
          }
        } else {
          setError('No speech detected')
          setVoiceState('idle')
        }
      } catch (err) {
        console.error('Failed to transcribe audio:', err)
        setError('Failed to transcribe audio')
        setVoiceState('idle')
      }
    }
    reader.readAsDataURL(audioBlob)
  }, [onTranscriptUpdate, sendTextInputRest])

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
        await sendTextInputRest(text, [...transcript, userEntry])
      }
    },
    [transcript, onTranscriptUpdate, sendTextInputRest]
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
      console.error('Failed to request hint:', err)
      setError('Failed to get hint')
      setVoiceState('idle')
    }
  }, [currentQuestion, userCode, transcript, onTranscriptUpdate, onInterviewerResponse, playAudio])

  // Request introduction (auto-called when interview starts)
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
      console.error('Failed to request introduction:', err)
      setError('Failed to get introduction')
      setVoiceState('idle')
    }
  }, [currentQuestion, onTranscriptUpdate, onInterviewerResponse, playAudio])

  // Play a pre-cached introduction immediately
  const playCachedIntroduction = useCallback(
    (cachedIntro: { text: string; audio?: string }) => {
      console.log('[VOICE] Playing cached introduction')

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

      // Play audio if available
      if (cachedIntro.audio) {
        playAudio(cachedIntro.audio)
      } else {
        setVoiceState('idle')
      }
    },
    [onTranscriptUpdate, onInterviewerResponse, playAudio]
  )

  // Process recorded audio and send for transcription + response
  const processAndSendAudio = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
      setVoiceState('idle')
      return
    }

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
    audioChunksRef.current = []

    if (audioBlob.size < 1000) {
      // Too small, probably just noise
      setVoiceState('idle')
      return
    }

    setVoiceState('processing')

    // Convert blob to base64
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64Audio = (reader.result as string).split(',')[1]

      try {
        // Send audio to transcribe endpoint
        const response = await fetch(`${API_URL}/api/voice/transcribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio: base64Audio,
            mime_type: 'audio/webm',
          }),
        })

        const data = await response.json()

        if (data.success && data.text?.trim()) {
          console.log('[SPEECH INPUT]', data.text)
          // Add user message to transcript
          const userEntry: TranscriptEntry = {
            timestamp: Date.now(),
            speaker: 'user',
            text: data.text,
          }

          // Build updated transcript to pass to sendTextInputRest
          // (can't rely on setState being synchronous)
          const updatedTranscript = [...transcript, userEntry]

          setTranscript((prev) => {
            const updated = [...prev, userEntry]
            onTranscriptUpdate?.(updated)
            return updated
          })

          // Get AI response via REST - pass the updated transcript directly
          await sendTextInputRest(data.text, updatedTranscript)
        } else {
          // No speech detected, go back to idle
          setVoiceState('idle')
        }
      } catch (err) {
        console.error('Failed to transcribe audio:', err)
        setError('Failed to transcribe audio')
        setVoiceState('idle')
      }
    }
    reader.readAsDataURL(audioBlob)
  }, [transcript, onTranscriptUpdate, sendTextInputRest, isAlwaysListening])

  // Start recording audio (used by VAD when speech is detected)
  const startRecording = useCallback(() => {
    if (isRecordingRef.current || !streamRef.current) return

    audioChunksRef.current = []

    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: 'audio/webm;codecs=opus',
    })

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data)
      }
    }

    mediaRecorderRef.current = mediaRecorder
    mediaRecorder.start(100)
    isRecordingRef.current = true
    setVoiceState('listening')
  }, [])

  // Stop recording and send audio
  const stopRecordingAndSend = useCallback(async () => {
    if (!isRecordingRef.current || !mediaRecorderRef.current) return

    isRecordingRef.current = false

    const mediaRecorder = mediaRecorderRef.current
    mediaRecorder.stop()
    mediaRecorderRef.current = null

    // Wait for final chunk
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Process and send the audio
    await processAndSendAudio()
  }, [processAndSendAudio])

  // Voice Activity Detection loop
  const runVAD = useCallback(() => {
    if (!analyserRef.current || !isAlwaysListening) return

    const analyser = analyserRef.current
    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    const checkAudio = () => {
      if (!isAlwaysListening || voiceState === 'processing' || voiceState === 'speaking') {
        vadAnimationRef.current = requestAnimationFrame(checkAudio)
        return
      }

      analyser.getByteFrequencyData(dataArray)

      // Calculate average volume
      const sum = dataArray.reduce((a, b) => a + b, 0)
      const average = sum / dataArray.length / 255 // Normalize to 0-1

      if (average > VAD_THRESHOLD) {
        // Speech detected
        setIsSpeechDetected(true)

        // Clear any pending silence timeout
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current)
          silenceTimeoutRef.current = null
        }

        // Start recording if not already
        if (!isRecordingRef.current && voiceState === 'idle') {
          startRecording()
        }
      } else if (isSpeechDetected || isRecordingRef.current) {
        // Silence after speech - start timeout
        if (!silenceTimeoutRef.current) {
          silenceTimeoutRef.current = setTimeout(() => {
            setIsSpeechDetected(false)
            silenceTimeoutRef.current = null

            // Stop recording and send
            if (isRecordingRef.current) {
              stopRecordingAndSend()
            }
          }, SILENCE_TIMEOUT_MS)
        }
      }

      vadAnimationRef.current = requestAnimationFrame(checkAudio)
    }

    vadAnimationRef.current = requestAnimationFrame(checkAudio)
  }, [isAlwaysListening, voiceState, isSpeechDetected, startRecording, stopRecordingAndSend])

  // Enable always-listening mode
  const enableAlwaysListening = useCallback(async () => {
    try {
      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Create audio context and analyser for VAD
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      audioContextRef.current = audioContext
      analyserRef.current = analyser

      setIsAlwaysListening(true)
      setError(null)
    } catch (err) {
      console.error('Failed to enable always-listening:', err)
      setError('Microphone access denied')
    }
  }, [])

  // Disable always-listening mode
  const disableAlwaysListening = useCallback(() => {
    // Stop VAD loop
    if (vadAnimationRef.current) {
      cancelAnimationFrame(vadAnimationRef.current)
      vadAnimationRef.current = null
    }

    // Clear silence timeout
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }

    // Stop any ongoing recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
    isRecordingRef.current = false

    // Stop microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    // Clean up audio context (keep the playback one)
    analyserRef.current = null

    setIsAlwaysListening(false)
    setIsSpeechDetected(false)
    setVoiceState('idle')
  }, [])

  // Run VAD when always-listening is enabled
  useEffect(() => {
    if (isAlwaysListening) {
      runVAD()
    }
    return () => {
      if (vadAnimationRef.current) {
        cancelAnimationFrame(vadAnimationRef.current)
      }
    }
  }, [isAlwaysListening, runVAD])

  // Connect on mount
  useEffect(() => {
    connect()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop()
        if (mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (vadAnimationRef.current) {
        cancelAnimationFrame(vadAnimationRef.current)
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [connect])

  return {
    voiceState,
    currentTranscript,
    transcript,
    isConnected,
    error,
    startListening,
    stopListening,
    sendTextInput,
    requestHint,
    requestIntroduction,
    playCachedIntroduction,
    // Always-listening mode
    isAlwaysListening,
    isSpeechDetected,
    enableAlwaysListening,
    disableAlwaysListening,
  }
}
