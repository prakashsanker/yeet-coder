import { useState, useCallback, useRef } from 'react'
import type { editor } from 'monaco-editor'

export type SupportedLanguage = 'python' | 'javascript' | 'typescript' | 'java' | 'cpp' | 'go'

interface UseCodeEditorOptions {
  initialCode?: string
  initialLanguage?: SupportedLanguage
  onChange?: (code: string) => void
}

interface UseCodeEditorReturn {
  code: string
  language: SupportedLanguage
  setCode: (code: string) => void
  setLanguage: (language: SupportedLanguage) => void
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>
  handleEditorMount: (editor: editor.IStandaloneCodeEditor) => void
  handleEditorChange: (value: string | undefined) => void
  formatCode: () => void
  getSelectedText: () => string | undefined
}

const languageTemplates: Record<SupportedLanguage, string> = {
  python: `def solution(nums: list[int]) -> int:
    # Write your solution here
    pass
`,
  javascript: `function solution(nums) {
    // Write your solution here

}
`,
  typescript: `function solution(nums: number[]): number {
    // Write your solution here

}
`,
  java: `class Solution {
    public int solution(int[] nums) {
        // Write your solution here
        return 0;
    }
}
`,
  cpp: `class Solution {
public:
    int solution(vector<int>& nums) {
        // Write your solution here
        return 0;
    }
};
`,
  go: `func solution(nums []int) int {
    // Write your solution here
    return 0
}
`,
}

export const languageConfig: Record<SupportedLanguage, { label: string; monacoId: string }> = {
  python: { label: 'Python', monacoId: 'python' },
  javascript: { label: 'JavaScript', monacoId: 'javascript' },
  typescript: { label: 'TypeScript', monacoId: 'typescript' },
  java: { label: 'Java', monacoId: 'java' },
  cpp: { label: 'C++', monacoId: 'cpp' },
  go: { label: 'Go', monacoId: 'go' },
}

export function useCodeEditor({
  initialCode,
  initialLanguage = 'python',
  onChange,
}: UseCodeEditorOptions = {}): UseCodeEditorReturn {
  const [code, setCodeState] = useState(initialCode ?? languageTemplates[initialLanguage])
  const [language, setLanguageState] = useState<SupportedLanguage>(initialLanguage)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const onChangeRef = useRef(onChange)

  // Keep onChange ref updated
  onChangeRef.current = onChange

  const setCode = useCallback((newCode: string) => {
    setCodeState(newCode)
    onChangeRef.current?.(newCode)
  }, [])

  const setLanguage = useCallback((newLanguage: SupportedLanguage) => {
    setLanguageState(newLanguage)
    // Optionally reset to template when language changes
    const template = languageTemplates[newLanguage]
    setCodeState(template)
    onChangeRef.current?.(template)
  }, [])

  const handleEditorMount = useCallback((editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor
    // Focus the editor
    editor.focus()
  }, [])

  const handleEditorChange = useCallback((value: string | undefined) => {
    const newCode = value ?? ''
    setCodeState(newCode)
    onChangeRef.current?.(newCode)
  }, [])

  const formatCode = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run()
    }
  }, [])

  const getSelectedText = useCallback(() => {
    if (editorRef.current) {
      const selection = editorRef.current.getSelection()
      if (selection) {
        return editorRef.current.getModel()?.getValueInRange(selection)
      }
    }
    return undefined
  }, [])

  return {
    code,
    language,
    setCode,
    setLanguage,
    editorRef,
    handleEditorMount,
    handleEditorChange,
    formatCode,
    getSelectedText,
  }
}

export { languageTemplates }
