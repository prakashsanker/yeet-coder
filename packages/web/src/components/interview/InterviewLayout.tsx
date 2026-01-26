import { useState, useRef, useCallback, type ReactNode } from 'react'

interface InterviewLayoutProps {
  leftPanel: ReactNode
  rightTopPanel: ReactNode
  rightBottomPanel: ReactNode
  header?: ReactNode
}

export default function InterviewLayout({
  leftPanel,
  rightTopPanel,
  rightBottomPanel,
  header,
}: InterviewLayoutProps) {
  // Horizontal split (left/right panels)
  const [leftWidth, setLeftWidth] = useState(40) // percentage
  // Vertical split (right top/bottom panels)
  const [topHeight, setTopHeight] = useState(60) // percentage

  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingHorizontal = useRef(false)
  const isDraggingVertical = useRef(false)

  const handleHorizontalMouseDown = useCallback(() => {
    isDraggingHorizontal.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const handleVerticalMouseDown = useCallback(() => {
    isDraggingVertical.current = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const handleMouseUp = useCallback(() => {
    isDraggingHorizontal.current = false
    isDraggingVertical.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return

    if (isDraggingHorizontal.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100
      setLeftWidth(Math.min(Math.max(newWidth, 20), 80))
    }

    if (isDraggingVertical.current) {
      const rightPanel = containerRef.current.querySelector('[data-right-panel]')
      if (rightPanel) {
        const rect = rightPanel.getBoundingClientRect()
        const newHeight = ((e.clientY - rect.top) / rect.height) * 100
        setTopHeight(Math.min(Math.max(newHeight, 20), 80))
      }
    }
  }, [])

  return (
    <div
      className="flex flex-col h-screen bg-[var(--bg-page)]"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header */}
      {header && (
        <div className="flex-shrink-0">
          {header}
        </div>
      )}

      {/* Main Content */}
      <div
        ref={containerRef}
        className="flex-1 flex overflow-hidden p-2 gap-1"
      >
        {/* Left Panel (Question) */}
        <div
          className="overflow-hidden"
          style={{ width: `${leftWidth}%` }}
        >
          {leftPanel}
        </div>

        {/* Horizontal Resizer */}
        <div
          className="w-1 hover:w-2 bg-[rgba(0,0,0,0.08)] hover:bg-[var(--accent-purple)] cursor-col-resize transition-all flex-shrink-0 rounded"
          onMouseDown={handleHorizontalMouseDown}
        />

        {/* Right Panel Container */}
        <div
          data-right-panel
          className="flex-1 flex flex-col overflow-hidden gap-1"
        >
          {/* Right Top Panel (Code Editor) */}
          <div
            className="overflow-hidden"
            style={{ height: `${topHeight}%` }}
          >
            {rightTopPanel}
          </div>

          {/* Vertical Resizer */}
          <div
            className="h-1 hover:h-2 bg-[rgba(0,0,0,0.08)] hover:bg-[var(--accent-purple)] cursor-row-resize transition-all flex-shrink-0 rounded"
            onMouseDown={handleVerticalMouseDown}
          />

          {/* Right Bottom Panel (Test Cases) */}
          <div className="flex-1 overflow-hidden">
            {rightBottomPanel}
          </div>
        </div>
      </div>
    </div>
  )
}
