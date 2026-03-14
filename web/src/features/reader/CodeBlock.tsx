import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { type BundledLanguage, type BundledTheme, codeToHtml } from 'shiki'

const MermaidBlock = lazy(() => import('@/components/ui/MermaidBlock'))

const SUPPORTED_LANGUAGES: Record<string, BundledLanguage> = {
  bash: 'bash', shell: 'bash', sh: 'bash',
  powershell: 'powershell', ps1: 'powershell',
  sql: 'sql',
  python: 'python', py: 'python',
  json: 'json', jsonc: 'jsonc',
  xml: 'xml',
  html: 'html', htm: 'html',
  css: 'css', scss: 'scss',
  javascript: 'javascript', js: 'javascript', jsx: 'jsx',
  typescript: 'typescript', ts: 'typescript', tsx: 'tsx',
  yaml: 'yaml', yml: 'yaml',
  markdown: 'markdown', md: 'markdown',
  go: 'go', golang: 'go',
  java: 'java',
  c: 'c', cpp: 'cpp', 'c++': 'cpp',
  csharp: 'csharp', 'c#': 'csharp', cs: 'csharp',
  ruby: 'ruby', rb: 'ruby',
  php: 'php',
  rust: 'rust', rs: 'rust',
  swift: 'swift',
  kotlin: 'kotlin', kt: 'kotlin',
  docker: 'docker', dockerfile: 'docker',
  nginx: 'nginx',
  ini: 'ini', toml: 'toml',
  diff: 'diff',
  graphql: 'graphql', gql: 'graphql',
  lua: 'lua',
  r: 'r',
  perl: 'perl',
  makefile: 'makefile', make: 'makefile',
  gherkin: 'gherkin', feature: 'gherkin',
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

  // Render mermaid blocks
  if (lang === 'mermaid') {
    return (
      <Suspense fallback={<div className="p-4 text-sm text-ink-45">Chargement du diagramme...</div>}>
        <MermaidBlock code={normalizedCode} />
      </Suspense>
    )
  }

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
    <div className="relative isolate group my-4">
      {shikiLang && html ? (
        <div
          className="rounded-lg overflow-x-auto text-sm [&>pre]:p-4 [&>pre]:!bg-[#1a1a2e]"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="rounded-lg p-4 overflow-x-auto text-sm font-mono whitespace-pre-wrap break-words" style={{ background: '#1a1a2e', color: '#e2e8f0' }}>
          <code>{normalizedCode}</code>
        </pre>
      )}
      {lang && (
        <span className="absolute top-2 left-3 z-20 text-[10px] font-mono uppercase tracking-wider text-white/50 opacity-0 group-hover:opacity-100 transition-opacity select-none pointer-events-none">
          {lang}
        </span>
      )}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 z-20 px-2 py-1 text-xs rounded bg-white/10 text-white/70 hover:bg-white/20 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? 'Copié !' : 'Copier'}
      </button>
    </div>
  )
}
