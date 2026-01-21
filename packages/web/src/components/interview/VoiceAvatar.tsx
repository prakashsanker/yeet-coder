import { useState, useRef, useEffect, useCallback } from 'react'

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking'

interface VoiceAvatarProps {
  state: VoiceState
  transcript?: string
  onStartListening: () => void
  onStopListening: () => void
  onTextSubmit?: (text: string) => void
  className?: string
}

export default function VoiceAvatar({
  state,
  transcript,
  onStartListening,
  onStopListening,
  onTextSubmit,
  className = '',
}: VoiceAvatarProps) {
  const [textInput, setTextInput] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when showing text input
  useEffect(() => {
    if (showTextInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showTextInput])

  const handleMicClick = useCallback(() => {
    if (state === 'listening') {
      onStopListening()
    } else if (state === 'idle') {
      onStartListening()
    }
  }, [state, onStartListening, onStopListening])

  const handleTextSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (textInput.trim() && onTextSubmit) {
        onTextSubmit(textInput.trim())
        setTextInput('')
      }
    },
    [textInput, onTextSubmit]
  )

  const getStateColor = () => {
    switch (state) {
      case 'listening':
        return 'bg-red-500'
      case 'processing':
        return 'bg-yellow-500'
      case 'speaking':
        return 'bg-green-500'
      default:
        return 'bg-gray-600'
    }
  }

  const getStateLabel = () => {
    switch (state) {
      case 'listening':
        return 'Listening...'
      case 'processing':
        return 'Thinking...'
      case 'speaking':
        return 'Speaking...'
      default:
        return 'Click to speak'
    }
  }

  const getPulseAnimation = () => {
    if (state === 'listening') {
      return 'animate-pulse'
    }
    if (state === 'speaking') {
      return 'animate-bounce'
    }
    return ''
  }

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* Avatar Circle */}
      <div className="relative">
        {/* Outer ring animation */}
        <div
          className={`absolute inset-0 rounded-full ${getStateColor()} opacity-30 ${
            state === 'listening' || state === 'speaking' ? 'animate-ping' : ''
          }`}
          style={{ animationDuration: '1.5s' }}
        />

        {/* Main avatar button */}
        <button
          onClick={handleMicClick}
          disabled={state === 'processing' || state === 'speaking'}
          className={`
            relative w-16 h-16 rounded-full flex items-center justify-center
            ${getStateColor()} ${getPulseAnimation()}
            transition-all duration-300 hover:scale-105
            disabled:opacity-75 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
          `}
        >
          {/* Microphone icon */}
          {state === 'listening' ? (
            <MicrophoneOnIcon className="w-8 h-8 text-white" />
          ) : state === 'processing' ? (
            <LoadingIcon className="w-8 h-8 text-white animate-spin" />
          ) : state === 'speaking' ? (
            <SpeakerIcon className="w-8 h-8 text-white" />
          ) : (
            <MicrophoneOffIcon className="w-8 h-8 text-white" />
          )}
        </button>

        {/* Audio visualizer bars (when listening) */}
        {state === 'listening' && (
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-1 bg-red-400 rounded-full animate-pulse"
                style={{
                  height: `${8 + Math.random() * 8}px`,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: '0.3s',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* State label */}
      <span className="text-xs text-gray-400">{getStateLabel()}</span>

      {/* Live transcript */}
      {transcript && (
        <div className="max-w-xs text-center">
          <p className="text-sm text-gray-300 italic">"{transcript}"</p>
        </div>
      )}

      {/* Text input toggle */}
      <button
        onClick={() => setShowTextInput(!showTextInput)}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        {showTextInput ? 'Hide text input' : 'Type instead'}
      </button>

      {/* Text input fallback */}
      {showTextInput && (
        <form onSubmit={handleTextSubmit} className="w-full max-w-xs">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type your response..."
              disabled={state !== 'idle'}
              className="
                flex-1 px-3 py-2 text-sm
                bg-gray-800 border border-gray-700 rounded-lg
                text-white placeholder-gray-500
                focus:outline-none focus:border-primary-500
                disabled:opacity-50
              "
            />
            <button
              type="submit"
              disabled={!textInput.trim() || state !== 'idle'}
              className="
                px-3 py-2 text-sm font-medium
                bg-primary-600 text-white rounded-lg
                hover:bg-primary-500 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              Send
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// Icon components
function MicrophoneOnIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  )
}

function MicrophoneOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" opacity="0.5" />
      <path
        d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
        opacity="0.5"
      />
    </svg>
  )
}

function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  )
}

function LoadingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
