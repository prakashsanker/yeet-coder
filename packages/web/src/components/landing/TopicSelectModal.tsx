import { useEffect, useState } from 'react'
import { api, type Topic } from '../../lib/api'

interface TopicSelectModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (topic: Topic) => void
}

export default function TopicSelectModal({ isOpen, onClose, onSelect }: TopicSelectModalProps) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      setError(null)
      api.topics.list()
        .then(({ topics }) => setTopics(topics))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Pick a Topic</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        )}

        {error && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="flex-1 overflow-y-auto space-y-2">
            {topics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => onSelect(topic)}
                className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">{topic.name}</h3>
                    {topic.description && (
                      <p className="text-gray-400 text-sm mt-1">{topic.description}</p>
                    )}
                  </div>
                  <span className="text-gray-500 text-sm">#{topic.difficulty_order}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
