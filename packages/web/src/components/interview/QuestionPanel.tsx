import type { QuestionData } from '@/types'

interface QuestionPanelProps {
  question: QuestionData
}

export default function QuestionPanel({ question }: QuestionPanelProps) {
  return (
    <div className="flex flex-col h-full bg-white rounded-lg overflow-hidden border border-[rgba(0,0,0,0.08)]">
      <div className="px-4 py-3 bg-[var(--bg-section)] border-b border-[rgba(0,0,0,0.08)]">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{question.title}</h2>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Description */}
        <div className="prose prose-sm max-w-none">
          <p className="text-[var(--text-secondary)] whitespace-pre-wrap">{question.description}</p>
        </div>

        {/* Examples */}
        {question.examples.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Examples</h3>
            {question.examples.map((example, index) => (
              <div key={index} className="bg-[var(--bg-section)] rounded-lg p-3 space-y-2 border border-[rgba(0,0,0,0.08)]">
                <div className="text-sm text-[var(--text-muted)]">Example {index + 1}</div>
                <div className="space-y-1">
                  <div className="text-xs text-[var(--text-muted)]">Input:</div>
                  <pre className="text-sm text-[var(--text-primary)] bg-white rounded p-2 overflow-x-auto border border-[rgba(0,0,0,0.08)] font-mono">
                    {example.input}
                  </pre>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-[var(--text-muted)]">Output:</div>
                  <pre className="text-sm text-[var(--text-primary)] bg-white rounded p-2 overflow-x-auto border border-[rgba(0,0,0,0.08)] font-mono">
                    {example.output}
                  </pre>
                </div>
                {example.explanation && (
                  <div className="space-y-1">
                    <div className="text-xs text-[var(--text-muted)]">Explanation:</div>
                    <p className="text-sm text-[var(--text-secondary)]">{example.explanation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Constraints */}
        {question.constraints.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Constraints</h3>
            <ul className="list-disc list-inside space-y-1">
              {question.constraints.map((constraint, index) => (
                <li key={index} className="text-sm text-[var(--text-secondary)]">
                  <code className="text-[var(--accent-purple)] bg-[#F3E5F5] px-1 rounded">{constraint}</code>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
