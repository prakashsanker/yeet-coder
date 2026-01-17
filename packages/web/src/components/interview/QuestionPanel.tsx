import type { QuestionData } from '@/types'

interface QuestionPanelProps {
  question: QuestionData
}

export default function QuestionPanel({ question }: QuestionPanelProps) {
  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-700 border-b border-gray-600">
        <h2 className="text-lg font-semibold text-white">{question.title}</h2>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Description */}
        <div className="prose prose-invert prose-sm max-w-none">
          <p className="text-gray-300 whitespace-pre-wrap">{question.description}</p>
        </div>

        {/* Examples */}
        {question.examples.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-200">Examples</h3>
            {question.examples.map((example, index) => (
              <div key={index} className="bg-gray-700 rounded-lg p-3 space-y-2">
                <div className="text-sm text-gray-400">Example {index + 1}</div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500">Input:</div>
                  <pre className="text-sm text-gray-200 bg-gray-800 rounded p-2 overflow-x-auto">
                    {example.input}
                  </pre>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500">Output:</div>
                  <pre className="text-sm text-gray-200 bg-gray-800 rounded p-2 overflow-x-auto">
                    {example.output}
                  </pre>
                </div>
                {example.explanation && (
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500">Explanation:</div>
                    <p className="text-sm text-gray-300">{example.explanation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Constraints */}
        {question.constraints.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-200">Constraints</h3>
            <ul className="list-disc list-inside space-y-1">
              {question.constraints.map((constraint, index) => (
                <li key={index} className="text-sm text-gray-300">
                  <code className="text-primary-400">{constraint}</code>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
