interface InterviewTypeModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectLeetCode: () => void
  onSelectSystemDesign: () => void
}

export default function InterviewTypeModal({
  isOpen,
  onClose,
  onSelectLeetCode,
  onSelectSystemDesign,
}: InterviewTypeModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-lc-bg-layer-1 rounded-xl p-6 w-full max-w-md border border-lc-border">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-lc-text-primary">Choose Practice Type</h2>
          <button
            onClick={onClose}
            className="text-lc-text-muted hover:text-lc-text-primary transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Free trial banner */}
        <div className="bg-lc-green/10 border border-lc-green/20 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-lc-green rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            </div>
            <div>
              <p className="text-lc-green font-semibold">Your first AI interview is FREE!</p>
              <p className="text-lc-text-muted text-sm">No credit card required</p>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {/* LeetCode Option */}
          <button
            onClick={onSelectLeetCode}
            className="w-full text-left p-4 bg-lc-bg-layer-2 hover:bg-lc-bg-layer-3 rounded-lg transition-colors border border-lc-border hover:border-lc-green/50 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-brand-orange/10 rounded-lg flex items-center justify-center group-hover:bg-brand-orange/20 transition-colors">
                <svg className="w-6 h-6 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lc-text-primary font-semibold">LeetCode Practice</h3>
                <p className="text-lc-text-muted text-sm">Coding problems with AI interviewer</p>
              </div>
              <svg className="w-5 h-5 text-lc-text-muted group-hover:text-lc-text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* System Design Option */}
          <button
            onClick={onSelectSystemDesign}
            className="w-full text-left p-4 bg-lc-bg-layer-2 hover:bg-lc-bg-layer-3 rounded-lg transition-colors border border-lc-border hover:border-lc-teal/50 group relative"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-lc-teal/10 rounded-lg flex items-center justify-center group-hover:bg-lc-teal/20 transition-colors">
                <svg className="w-6 h-6 text-lc-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lc-text-primary font-semibold">System Design</h3>
                <p className="text-lc-text-muted text-sm">Design scalable systems with AI feedback</p>
              </div>
              <svg className="w-5 h-5 text-lc-text-muted group-hover:text-lc-text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>

        {/* Footer */}
        <p className="text-lc-text-muted text-xs text-center mt-6">
          Select a practice type to begin your mock interview
        </p>
      </div>
    </div>
  )
}
