import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useState } from 'react'

const LANGUAGES = [
  { label: 'Plain text', value: '' },
  { label: 'Bash', value: 'bash' },
  { label: 'PowerShell', value: 'powershell' },
  { label: 'SQL', value: 'sql' },
  { label: 'Python', value: 'python' },
  { label: 'JSON', value: 'json' },
  { label: 'XML', value: 'xml' },
]

export default function CodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const [focused, setFocused] = useState(false)
  const language = (node.attrs.language as string) || ''

  return (
    <NodeViewWrapper className="relative group">
      <select
        contentEditable={false}
        value={language}
        onChange={(e) => updateAttributes({ language: e.target.value })}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`absolute top-2 right-2 z-10 text-xs bg-[#1a1a2e] text-ink-45 border border-ink-45 rounded px-1.5 py-0.5 cursor-pointer transition-opacity focus:outline-none focus:ring-1 focus:ring-blue ${
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
    </NodeViewWrapper>
  )
}
