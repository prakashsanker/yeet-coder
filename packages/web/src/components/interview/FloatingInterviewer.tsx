import { useState, useEffect, useCallback } from 'react'

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking'

interface FloatingInterviewerProps {
  state: VoiceState
  transcript?: string
  onStartListening: () => void
  onStopListening: () => void
  hasIntroduced?: boolean
  // Always-listening mode
  isAlwaysListening?: boolean
  isSpeechDetected?: boolean
  onEnableAlwaysListening?: () => void
  onDisableAlwaysListening?: () => void
}

export default function FloatingInterviewer({
  state,
  transcript,
  onStartListening: _onStartListening,
  onStopListening: _onStopListening,
  hasIntroduced = false,
  isAlwaysListening = false,
  isSpeechDetected = false,
  onEnableAlwaysListening,
  onDisableAlwaysListening,
}: FloatingInterviewerProps) {
  const [isMinimized, setIsMinimized] = useState(false)

  // Auto-enable always-listening after introduction completes
  useEffect(() => {
    if (hasIntroduced && !isAlwaysListening && state === 'idle' && onEnableAlwaysListening) {
      // Small delay after speaking ends
      const timer = setTimeout(() => {
        onEnableAlwaysListening()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [hasIntroduced, isAlwaysListening, state, onEnableAlwaysListening])

  const handleMicClick = useCallback(() => {
    // Toggle always-listening mode
    if (isAlwaysListening) {
      onDisableAlwaysListening?.()
    } else {
      onEnableAlwaysListening?.()
    }
  }, [isAlwaysListening, onEnableAlwaysListening, onDisableAlwaysListening])

  const getAvatarPulse = () => {
    switch (state) {
      case 'listening':
        return 'ring-4 ring-red-500/50 animate-pulse'
      case 'processing':
        return 'ring-4 ring-yellow-500/50'
      case 'speaking':
        return 'ring-4 ring-green-500/50 animate-pulse'
      default:
        // Show subtle green ring when always-listening is active
        if (isAlwaysListening) {
          return isSpeechDetected ? 'ring-4 ring-blue-500/50 animate-pulse' : 'ring-2 ring-green-500/30'
        }
        return 'ring-2 ring-gray-600'
    }
  }

  const getStatusText = () => {
    switch (state) {
      case 'listening':
        return 'Hearing you...'
      case 'processing':
        return 'Thinking...'
      case 'speaking':
        return 'Speaking...'
      default:
        if (isAlwaysListening) {
          return isSpeechDetected ? 'Hearing you...' : 'Listening'
        }
        return 'AI Interviewer'
    }
  }

  const getStatusColor = () => {
    switch (state) {
      case 'listening':
        return 'text-red-400'
      case 'processing':
        return 'text-yellow-400'
      case 'speaking':
        return 'text-green-400'
      default:
        if (isAlwaysListening) {
          return isSpeechDetected ? 'text-blue-400' : 'text-green-400'
        }
        return 'text-gray-400'
    }
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="w-16 h-16 rounded-full bg-gray-800 border-2 border-gray-700 shadow-2xl flex items-center justify-center hover:scale-105 transition-transform"
        >
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center ${state !== 'idle' || isSpeechDetected ? 'animate-pulse' : ''}`}>
            <InterviewerIcon className="w-6 h-6 text-white" />
          </div>
        </button>
        {(state !== 'idle' || isAlwaysListening) && (
          <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-800 ${isSpeechDetected ? 'bg-blue-500 animate-pulse' : isAlwaysListening ? 'bg-green-500' : 'bg-green-500 animate-pulse'}`} />
        )}
      </div>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${state !== 'idle' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
          <span className={`text-sm font-medium ${getStatusColor()}`}>{getStatusText()}</span>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
        >
          <MinimizeIcon className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Avatar section */}
      <div className="p-4 flex flex-col items-center">
        {/* Dummy avatar */}
        <div className={`relative w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center ${getAvatarPulse()} transition-all duration-300`}>
          <InterviewerIcon className="w-10 h-10 text-white" />

          {/* Speaking animation waves */}
          {state === 'speaking' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute w-full h-full rounded-full border-2 border-green-400 animate-ping opacity-30" />
              <div className="absolute w-[120%] h-[120%] rounded-full border border-green-400 animate-ping opacity-20" style={{ animationDelay: '0.2s' }} />
            </div>
          )}

          {/* Listening animation */}
          {state === 'listening' && (
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-1.5 bg-red-400 rounded-full"
                  style={{
                    height: `${10 + Math.sin(Date.now() / 200 + i) * 8}px`,
                    animation: 'audioBar 0.3s ease-in-out infinite alternate',
                    animationDelay: `${i * 0.05}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Live transcript */}
        {transcript && state === 'listening' && (
          <div className="mt-3 w-full">
            <p className="text-xs text-red-300 text-center italic">
              "{transcript}"
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 pb-4">
        {/* Mic button - toggles mute/unmute for always-listening */}
        <div className="flex items-center justify-center">
          <button
            onClick={handleMicClick}
            disabled={state === 'processing' || state === 'speaking'}
            className={`
              w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200
              ${isAlwaysListening
                ? isSpeechDetected
                  ? 'bg-blue-500 hover:bg-blue-600 scale-110'
                  : 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-700 hover:bg-gray-600'}
              disabled:opacity-50 disabled:cursor-not-allowed
              shadow-lg hover:shadow-xl
            `}
            title={isAlwaysListening ? 'Click to mute' : 'Click to unmute'}
          >
            {state === 'processing' ? (
              <LoadingIcon className="w-5 h-5 text-white animate-spin" />
            ) : isAlwaysListening ? (
              <MicOnIcon className="w-5 h-5 text-white" />
            ) : (
              <MicOffIcon className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes audioBar {
          0% { height: 6px; }
          100% { height: 18px; }
        }
      `}</style>
    </div>
  )
}

// Icons
function InterviewerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
    </svg>
  )
}

function MinimizeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function MicOnIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  )
}

function MicOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" opacity="0.6" />
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" opacity="0.6" />
    </svg>
  )
}

function LoadingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}
