import { useState, useEffect, useCallback, useRef } from 'react'

interface UseTimerOptions {
  initialSeconds: number
  onComplete?: () => void
  autoStart?: boolean
}

interface UseTimerReturn {
  seconds: number
  isRunning: boolean
  isComplete: boolean
  start: () => void
  pause: () => void
  reset: () => void
  formatTime: () => string
}

export function useTimer({
  initialSeconds,
  onComplete,
  autoStart = false,
}: UseTimerOptions): UseTimerReturn {
  const [seconds, setSeconds] = useState(initialSeconds)
  const [isRunning, setIsRunning] = useState(autoStart)
  const [isComplete, setIsComplete] = useState(false)
  const intervalRef = useRef<number | null>(null)
  const onCompleteRef = useRef(onComplete)

  // Keep onComplete ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  // Countdown effect
  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = window.setInterval(() => {
        setSeconds((prev) => {
          if (prev <= 1) {
            setIsRunning(false)
            setIsComplete(true)
            onCompleteRef.current?.()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, seconds])

  const start = useCallback(() => {
    if (seconds > 0) {
      setIsRunning(true)
    }
  }, [seconds])

  const pause = useCallback(() => {
    setIsRunning(false)
  }, [])

  const reset = useCallback(() => {
    setIsRunning(false)
    setIsComplete(false)
    setSeconds(initialSeconds)
  }, [initialSeconds])

  const formatTime = useCallback(() => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }, [seconds])

  return {
    seconds,
    isRunning,
    isComplete,
    start,
    pause,
    reset,
    formatTime,
  }
}
