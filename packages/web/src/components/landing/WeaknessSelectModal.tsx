import { useEffect, useState } from 'react'
import { api, type Topic } from '../../lib/api'

interface WeaknessSelectModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (topic: Topic) => void
}

export default function WeaknessSelectModal({ isOpen, onClose, onSelect }: WeaknessSelectModalProps) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      setError(null)
      setMessage(null)
      api.topics.weakest()
        .then(({ topics, message }) => {
          setTopics(topics)
          setMessage(message || null)
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Your Weakest Topics</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {message && (
          <p className="text-gray-400 text-sm mb-4">{message}</p>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-8">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-3">
            {topics.map((topic, index) => (
              <button
                key={topic.id}
                onClick={() => onSelect(topic)}
                className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors border-l-4 border-primary-500"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-primary-500">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <h3 className="text-white font-medium">{topic.name}</h3>
                    {topic.description && (
                      <p className="text-gray-400 text-sm mt-1">{topic.description}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <p className="text-gray-500 text-xs mt-4 text-center">
          Practice your weakest areas to improve faster
        </p>
      </div>
    </div>
  )
}
