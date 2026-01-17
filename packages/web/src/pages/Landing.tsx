import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopicSelectModal from '../components/landing/TopicSelectModal'
import WeaknessSelectModal from '../components/landing/WeaknessSelectModal'
import type { Topic } from '../lib/api'

export default function Landing() {
  const navigate = useNavigate()
  const [showTopicModal, setShowTopicModal] = useState(false)
  const [showWeaknessModal, setShowWeaknessModal] = useState(false)

  const handleTopicSelect = (topic: Topic) => {
    setShowTopicModal(false)
    // Navigate to interview with selected topic
    navigate(`/interview?topic=${topic.slug}`)
  }

  const handleWeaknessSelect = (topic: Topic) => {
    setShowWeaknessModal(false)
    // Navigate to interview with selected topic
    navigate(`/interview?topic=${topic.slug}`)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900">
      <h1 className="text-4xl font-bold text-white mb-12">YeetCoder</h1>

      <div className="flex flex-col gap-4 w-80">
        <button
          onClick={() => setShowTopicModal(true)}
          className="w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors"
        >
          Pick Topic
        </button>

        <button
          onClick={() => setShowWeaknessModal(true)}
          className="w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors"
        >
          Test My Weaknesses
        </button>
      </div>

      <TopicSelectModal
        isOpen={showTopicModal}
        onClose={() => setShowTopicModal(false)}
        onSelect={handleTopicSelect}
      />

      <WeaknessSelectModal
        isOpen={showWeaknessModal}
        onClose={() => setShowWeaknessModal(false)}
        onSelect={handleWeaknessSelect}
      />
    </div>
  )
}
