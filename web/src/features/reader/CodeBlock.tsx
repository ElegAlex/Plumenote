import { useState, useEffect, useCallback } from 'react'
import { type BundledLanguage, type BundledTheme, codeToHtml } from 'shiki'

const SUPPORTED_LANGUAGES: Record<string, BundledLanguage> = {
  bash: 'bash',
  shell: 'bash',
  sh: 'bash',
  powershell: 'powershell',
  ps1: 'powershell',
  sql: 'sql',
  python: 'python',
  py: 'python',
  json: 'json',
  xml: 'xml',
  html: 'html',
  javascript: 'javascript',
  js: 'javascript',
  typescript: 'typescript',
  ts: 'typescript',
  yaml: 'yaml',
  yml: 'yaml',
}

const SHIKI_THEME: BundledTheme = 'github-dark'

interface CodeBlockProps {
  code: string
  language?: string | null
}

export default function CodeBlock({ code, language }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const normalizedCode = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lang = language?.toLowerCase() || ''
  const shikiLang = SUPPORTED_LANGUAGES[lang]

  useEffect(() => {
    if (!shikiLang) return

    let cancelled = false
    codeToHtml(normalizedCode, { lang: shikiLang, theme: SHIKI_THEME }).then((result) => {
      if (!cancelled) setHtml(result)
    })
    return () => { cancelled = true }
  }, [normalizedCode, shikiLang])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(normalizedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [normalizedCode])

  return (
    <div className="relative group my-4">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 z-10 px-2 py-1 text-xs rounded bg-ink-70 text-ink-45 hover:bg-ink-70 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? 'Copie !' : 'Copier'}
      </button>

      {shikiLang && html ? (
        <div
          className="rounded-lg overflow-x-auto text-sm [&>pre]:p-4 [&>pre]:!bg-[#1a1a2e]"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="bg-[#1a1a2e] text-ink rounded-lg p-4 overflow-x-auto text-sm font-mono">
          <code>{normalizedCode}</code>
        </pre>
      )}
    </div>
  )
}
