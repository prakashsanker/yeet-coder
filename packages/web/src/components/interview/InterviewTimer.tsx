import { useEffect } from 'react'
import { useTimer } from '@/hooks/useTimer'

interface InterviewTimerProps {
  durationSeconds?: number
  onComplete?: () => void
  autoStart?: boolean
}

export default function InterviewTimer({
  durationSeconds = 3600, // 1 hour default
  onComplete,
  autoStart = true,
}: InterviewTimerProps) {
  const { seconds, isRunning, isComplete, start, formatTime } = useTimer({
    initialSeconds: durationSeconds,
    onComplete,
    autoStart,
  })

  // Auto-start on mount if autoStart is true
  useEffect(() => {
    if (autoStart && !isRunning && !isComplete) {
      start()
    }
  }, [autoStart, isRunning, isComplete, start])

  // Determine urgency level for styling
  const getUrgencyClass = () => {
    if (seconds <= 60) return 'text-red-500 animate-pulse' // Last minute
    if (seconds <= 300) return 'text-red-400' // Last 5 minutes
    if (seconds <= 600) return 'text-yellow-400' // Last 10 minutes
    return 'text-gray-200'
  }

  return (
    <div className="flex items-center gap-2">
      <svg
        className={`w-5 h-5 ${getUrgencyClass()}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className={`font-mono text-lg font-semibold ${getUrgencyClass()}`}>
        {formatTime()}
      </span>
    </div>
  )
}
