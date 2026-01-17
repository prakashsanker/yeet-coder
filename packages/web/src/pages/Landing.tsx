export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900">
      <h1 className="text-4xl font-bold text-white mb-12">YeetCoder</h1>

      <div className="flex flex-col gap-4 w-80">
        <button className="w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors">
          Pick Topic
        </button>

        <button className="w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors">
          Test My Weaknesses
        </button>
      </div>
    </div>
  )
}
