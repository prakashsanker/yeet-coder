import { useEffect, useState } from 'react'
import { api, type Topic, type Question } from '../../lib/api'

interface LeetCodeSelectModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (question: Question) => void
}

export default function LeetCodeSelectModal({ isOpen, onClose, onSelect }: LeetCodeSelectModalProps) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)

  // Load topics on open
  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      setError(null)
      setSelectedTopic(null)
      setSelectedQuestion(null)
      setQuestions([])
      api.topics.list()
        .then(({ topics }) => {
          // Filter to only coding topics
          const codingTopics = topics.filter(t => t.type !== 'system_design')
          setTopics(codingTopics)
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [isOpen])

  // Load questions when topic is selected
  useEffect(() => {
    if (selectedTopic) {
      setLoading(true)
      setError(null)
      api.questions.list({ type: 'coding', topic_id: selectedTopic.id })
        .then(({ questions }) => setQuestions(questions))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [selectedTopic])

  if (!isOpen) return null

  const handleTopicClick = (topic: Topic) => {
    setSelectedTopic(topic)
    setSelectedQuestion(null)
  }

  const handleQuestionClick = (question: Question) => {
    setSelectedQuestion(question)
  }

  const handleStartPractice = () => {
    if (selectedQuestion) {
      onSelect(selectedQuestion)
    }
  }

  const handleBack = () => {
    if (selectedQuestion) {
      setSelectedQuestion(null)
    } else if (selectedTopic) {
      setSelectedTopic(null)
      setQuestions([])
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-lc-green bg-lc-green/10'
      case 'medium': return 'text-lc-yellow bg-lc-yellow/10'
      case 'hard': return 'text-lc-red bg-lc-red/10'
      default: return 'text-lc-text-muted bg-lc-bg-layer-2'
    }
  }

  const getTitle = () => {
    if (selectedQuestion) return selectedQuestion.title
    if (selectedTopic) return selectedTopic.name
    return 'Select a Topic'
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-lc-bg-layer-1 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-lc-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-lc-border">
          <div className="flex items-center gap-3">
            {(selectedTopic || selectedQuestion) && (
              <button
                onClick={handleBack}
                className="text-lc-text-muted hover:text-lc-text-primary transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="w-8 h-8 bg-brand-orange/10 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-lc-text-primary">
              {getTitle()}
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange"></div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-12">
              <p className="text-lc-red">{error}</p>
            </div>
          )}

          {/* Topic List */}
          {!loading && !error && !selectedTopic && (
            <div className="grid gap-2">
              {topics.map((topic, index) => (
                <button
                  key={topic.id}
                  onClick={() => handleTopicClick(topic)}
                  className="w-full text-left p-4 bg-lc-bg-layer-2 hover:bg-lc-bg-layer-3 rounded-lg transition-all border border-transparent hover:border-brand-orange/30 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-lc-bg-layer-3 rounded-lg flex items-center justify-center text-lc-text-muted text-sm font-medium group-hover:bg-brand-orange/10 group-hover:text-brand-orange transition-colors">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lc-text-primary font-medium">{topic.name}</h3>
                      {topic.description && (
                        <p className="text-lc-text-muted text-sm mt-0.5">{topic.description}</p>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-lc-text-muted group-hover:text-brand-orange transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Question List */}
          {!loading && !error && selectedTopic && !selectedQuestion && (
            <div className="space-y-4">
              {questions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-lc-text-muted">No questions available for this topic yet.</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {questions.map((question) => (
                    <button
                      key={question.id}
                      onClick={() => handleQuestionClick(question)}
                      className="w-full text-left p-4 bg-lc-bg-layer-2 hover:bg-lc-bg-layer-3 rounded-lg transition-all border border-transparent hover:border-brand-orange/30 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {question.leetcode_number && (
                              <span className="text-lc-text-muted text-sm">#{question.leetcode_number}</span>
                            )}
                            <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getDifficultyColor(question.difficulty)}`}>
                              {question.difficulty}
                            </span>
                          </div>
                          <h3 className="text-lc-text-primary font-medium">{question.title}</h3>
                        </div>
                        <svg className="w-4 h-4 text-lc-text-muted group-hover:text-brand-orange transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  {selectedQuestion.leetcode_number && (
                    <span className="text-lc-text-muted text-sm">#{selectedQuestion.leetcode_number}</span>
                  )}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getDifficultyColor(selectedQuestion.difficulty)}`}>
                    {selectedQuestion.difficulty}
                  </span>
                </div>
                <p className="text-lc-text-secondary text-sm line-clamp-4">
                  {selectedQuestion.description}
                </p>
              </div>

              {/* How it works */}
              <div className="bg-lc-bg-layer-2 rounded-lg p-4">
                <h4 className="text-lc-text-primary font-medium text-sm mb-2">How it works</h4>
                <ul className="text-lc-text-muted text-sm space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="text-brand-orange">1.</span>
                    <span>You'll see the full problem and can start coding</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-brand-orange">2.</span>
                    <span>Explain your approach out loud as you code</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-brand-orange">3.</span>
                    <span>The AI interviewer will ask clarifying questions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-brand-orange">4.</span>
                    <span>Get instant feedback when you're done</span>
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
