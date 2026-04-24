import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useState, useEffect, useRef, lazy, Suspense } from 'react'

const MermaidBlock = lazy(() => import('@/components/ui/MermaidBlock'))

const LANGUAGES = [
  { label: 'Plain text', value: '' },
  { label: 'Bash', value: 'bash' },
  { label: 'C', value: 'c' },
  { label: 'C++', value: 'cpp' },
  { label: 'C#', value: 'csharp' },
  { label: 'CSS', value: 'css' },
  { label: 'Diff', value: 'diff' },
  { label: 'Docker', value: 'docker' },
  { label: 'Go', value: 'go' },
  { label: 'GraphQL', value: 'graphql' },
  { label: 'HTML', value: 'html' },
  { label: 'Java', value: 'java' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'JSON', value: 'json' },
  { label: 'Kotlin', value: 'kotlin' },
  { label: 'Lua', value: 'lua' },
  { label: 'Makefile', value: 'makefile' },
  { label: 'Markdown', value: 'markdown' },
  { label: 'Mermaid', value: 'mermaid' },
  { label: 'Nginx', value: 'nginx' },
  { label: 'PHP', value: 'php' },
  { label: 'PowerShell', value: 'powershell' },
  { label: 'Python', value: 'python' },
  { label: 'R', value: 'r' },
  { label: 'Ruby', value: 'ruby' },
  { label: 'Rust', value: 'rust' },
  { label: 'SCSS', value: 'scss' },
  { label: 'SQL', value: 'sql' },
  { label: 'Swift', value: 'swift' },
  { label: 'TOML', value: 'toml' },
  { label: 'TSX', value: 'tsx' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'XML', value: 'xml' },
  { label: 'YAML', value: 'yaml' },
]

export default function CodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const [focused, setFocused] = useState(false)
  const language = (node.attrs.language as string) || ''
  const isMermaid = language === 'mermaid'

  // Debounced mermaid code for preview
  const [debouncedCode, setDebouncedCode] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isMermaid) return
    const code = node.textContent || ''
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setDebouncedCode(code)
    }, 500)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [node.textContent, isMermaid])

  return (
    <NodeViewWrapper className="relative group">
      <select
        contentEditable={false}
        value={language}
        onChange={(e) => updateAttributes({ language: e.target.value })}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`absolute top-2.5 right-2.5 z-10 text-[11px] font-sans font-semibold bg-navy-900 text-coral-soft border border-ink-25 rounded-md px-2 py-0.5 cursor-pointer transition-opacity focus:outline-none focus:ring-1 focus:ring-coral ${
          focused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>
      <pre>
        <NodeViewContent as={'code' as 'div'} />
      </pre>
      {isMermaid && debouncedCode.trim() && (
        <div contentEditable={false} className="mt-1">
          <Suspense fallback={<div className="p-4 text-sm text-ink-muted">Chargement du diagramme...</div>}>
            <MermaidBlock code={debouncedCode} showToggle={false} />
          </Suspense>
        </div>
      )}
    </NodeViewWrapper>
  )
}
