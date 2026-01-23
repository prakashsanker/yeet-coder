import { useEffect, useState } from 'react'
import { api, type Question } from '../../lib/api'

interface SystemDesignSelectModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (question: Question) => void
}

export default function SystemDesignSelectModal({ isOpen, onClose, onSelect }: SystemDesignSelectModalProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      setError(null)
      setSelectedQuestion(null)
      api.questions.list({ type: 'system_design' })
        .then(({ questions }) => setQuestions(questions))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleQuestionClick = (question: Question) => {
    setSelectedQuestion(question)
  }

  const handleStartPractice = () => {
    if (selectedQuestion) {
      onSelect(selectedQuestion)
    }
  }

  const handleBack = () => {
    setSelectedQuestion(null)
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-lc-green bg-lc-green/10'
      case 'medium': return 'text-lc-yellow bg-lc-yellow/10'
      case 'hard': return 'text-lc-red bg-lc-red/10'
      default: return 'text-lc-text-muted bg-lc-bg-layer-2'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-lc-bg-layer-1 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-lc-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-lc-border">
          <div className="flex items-center gap-3">
            {selectedQuestion && (
              <button
                onClick={handleBack}
                className="text-lc-text-muted hover:text-lc-text-primary transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="w-8 h-8 bg-lc-teal/10 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-lc-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-lc-text-primary">
              {selectedQuestion ? selectedQuestion.title : 'System Design Questions'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-lc-text-muted hover:text-lc-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lc-teal"></div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-12">
              <p className="text-lc-red">{error}</p>
            </div>
          )}

          {/* Question List */}
          {!loading && !error && !selectedQuestion && (
            <div className="space-y-4">
              {questions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-lc-text-muted">No system design questions available yet.</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {questions.map((question) => (
                    <button
                      key={question.id}
                      onClick={() => handleQuestionClick(question)}
                      className="w-full text-left p-4 bg-lc-bg-layer-2 hover:bg-lc-bg-layer-3 rounded-lg transition-all border border-transparent hover:border-lc-teal/30 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getDifficultyColor(question.difficulty)}`}>
                              {question.difficulty}
                            </span>
                            {question.source && (
                              <span className="text-lc-text-muted text-xs">{question.source}</span>
                            )}
                          </div>
                          <h3 className="text-lc-text-primary font-medium">{question.title}</h3>
                        </div>
                        <svg className="w-4 h-4 text-lc-text-muted group-hover:text-lc-teal transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Question Detail / Confirmation */}
          {!loading && !error && selectedQuestion && (
            <div className="space-y-6">
              {/* Question info */}
              <div className="bg-lc-bg-layer-2 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getDifficultyColor(selectedQuestion.difficulty)}`}>
                    {selectedQuestion.difficulty}
                  </span>
                  {selectedQuestion.source && (
                    <span className="text-lc-text-muted text-xs">{selectedQuestion.source}</span>
                  )}
                </div>
                <p className="text-lc-text-secondary text-sm">
                  {selectedQuestion.description}
                </p>
              </div>

              {/* How it works */}
              <div className="bg-lc-bg-layer-2 rounded-lg p-4">
                <h4 className="text-lc-text-primary font-medium text-sm mb-2">How it works</h4>
                <ul className="text-lc-text-muted text-sm space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="text-lc-teal">1.</span>
                    <span>You'll discuss the system design problem with an AI interviewer</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-lc-teal">2.</span>
                    <span>Start by clarifying requirements and constraints</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-lc-teal">3.</span>
                    <span>Walk through your high-level design and component choices</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-lc-teal">4.</span>
                    <span>Dive deep into specific areas when prompted</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-lc-teal">5.</span>
                    <span>Get detailed feedback on your design decisions</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedQuestion && (
          <div className="p-4 border-t border-lc-border">
            <button
              onClick={handleStartPractice}
              className="w-full py-3 bg-lc-green hover:bg-lc-green-dark text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              Start Practice
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
