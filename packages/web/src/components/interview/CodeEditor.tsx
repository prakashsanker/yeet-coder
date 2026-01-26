import Editor from '@monaco-editor/react'
import { useCodeEditor, languageConfig, type SupportedLanguage } from '@/hooks/useCodeEditor'

interface CodeEditorProps {
  initialCode?: string
  initialLanguage?: SupportedLanguage
  onChange?: (code: string) => void
  onLanguageChange?: (language: SupportedLanguage) => void
  readOnly?: boolean
}

export default function CodeEditor({
  initialCode,
  initialLanguage = 'python',
  onChange,
  onLanguageChange,
  readOnly = false,
}: CodeEditorProps) {
  const {
    code,
    language,
    setLanguage,
    handleEditorMount,
    handleEditorChange,
  } = useCodeEditor({
    initialCode,
    initialLanguage,
    onChange,
  })

  const handleLanguageSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value as SupportedLanguage
    setLanguage(newLanguage)
    onLanguageChange?.(newLanguage)
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg overflow-hidden border border-[rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-section)] border-b border-[rgba(0,0,0,0.08)]">
        <span className="text-sm text-[var(--text-secondary)]">Solution</span>
        <select
          value={language}
          onChange={handleLanguageSelect}
          disabled={readOnly}
          className="bg-white text-[var(--text-primary)] text-sm rounded-lg px-2 py-1 border border-[rgba(0,0,0,0.08)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-purple)]"
        >
          {Object.entries(languageConfig).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          language={languageConfig[language].monacoId}
          value={code}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            fontSize: 14,
            fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            glyphMargin: false,
            folding: true,
            lineDecorationsWidth: 10,
            lineNumbersMinChars: 3,
            renderLineHighlight: 'line',
            tabSize: 4,
            insertSpaces: true,
            automaticLayout: true,
            wordWrap: 'on',
            padding: { top: 12, bottom: 12 },
            readOnly,
          }}
        />
      </div>
    </div>
  )
}
