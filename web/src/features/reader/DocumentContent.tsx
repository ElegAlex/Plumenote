import { useEffect, useMemo, useRef, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { common, createLowlight } from 'lowlight'
import { codeToHtml, type BundledLanguage, type BundledTheme } from 'shiki'
import { useNavigate } from 'react-router-dom'
import { AlertBlock } from '@/features/editor/AlertBlock'

const MermaidBlock = lazy(() => import('@/components/ui/MermaidBlock'))

const lowlight = createLowlight(common)
const SHIKI_THEME: BundledTheme = 'github-dark'

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

interface TocItem {
  id: string
  text: string
}

interface DocumentContentProps {
  content: Record<string, unknown>
  onTocExtracted?: (items: TocItem[]) => void
}

function generateHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

export default function DocumentContent({ content, onTocExtracted }: DocumentContentProps) {
  const navigate = useNavigate()
  const contentRef = useRef<HTMLDivElement>(null)

  const extensions = useMemo(
    () => [
      StarterKit.configure({ codeBlock: false }),
      Image,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      CodeBlockLowlight.configure({ lowlight }),
      Highlight,
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      AlertBlock,
    ],
    []
  )

  const editor = useEditor({
    extensions,
    content,
    editable: false,
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none',
      },
    },
  })

  // Extract TOC from H2 headings
  useEffect(() => {
    if (!editor || !onTocExtracted) return

    const items: TocItem[] = []
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading' && node.attrs.level === 2) {
        const text = node.textContent
        items.push({ id: generateHeadingId(text), text })
      }
    })
    onTocExtracted(items)
  }, [editor, onTocExtracted])

  // Add IDs to H2 headings in the DOM
  useEffect(() => {
    if (!contentRef.current) return

    const headings = contentRef.current.querySelectorAll('h2')
    headings.forEach((h) => {
      if (!h.id) {
        h.id = generateHeadingId(h.textContent || '')
      }
    })
  }, [editor])

  // Handle internal links via SPA navigation
  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    const handleClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a')
      if (!link) return

      const href = link.getAttribute('href')
      if (href && href.startsWith('/documents/')) {
        e.preventDefault()
        navigate(href)
      }
    }

    el.addEventListener('click', handleClick)
    return () => el.removeEventListener('click', handleClick)
  }, [navigate])

  // Apply Shiki highlighting to code blocks + add copy buttons
  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    const mermaidRoots: Array<ReturnType<typeof createRoot>> = []

    const codeBlocks = el.querySelectorAll('pre > code')
    codeBlocks.forEach(async (codeEl) => {
      const pre = codeEl.parentElement as HTMLPreElement
      if (!pre || pre.dataset.enhanced) return
      pre.dataset.enhanced = 'true'

      const code = codeEl.textContent || ''
      const normalizedCode = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

      // Check if this is a mermaid block
      const langClass = Array.from(codeEl.classList).find((c) => c.startsWith('language-'))
      const langKey = langClass?.replace('language-', '')?.toLowerCase() || ''

      if (langKey === 'mermaid') {
        const wrapper = document.createElement('div')
        pre.replaceWith(wrapper)
        const root = createRoot(wrapper)
        mermaidRoots.push(root)
        root.render(
          <Suspense fallback={<div className="p-4 text-sm text-ink-45">Chargement du diagramme...</div>}>
            <MermaidBlock code={normalizedCode} />
          </Suspense>
        )
        return
      }

      // Create outer wrapper that holds code + overlay button
      const outerWrapper = document.createElement('div')
      outerWrapper.className = 'relative isolate group my-4'

      // Apply Shiki highlighting
      const shikiLang = SUPPORTED_LANGUAGES[langKey]

      if (shikiLang) {
        try {
          const html = await codeToHtml(normalizedCode, { lang: shikiLang, theme: SHIKI_THEME })
          const codeDiv = document.createElement('div')
          codeDiv.innerHTML = html
          codeDiv.className = 'rounded-lg overflow-x-auto text-sm [&>pre]:p-4 [&>pre]:!bg-[#1a1a2e]'
          outerWrapper.appendChild(codeDiv)
        } catch {
          // Keep lowlight fallback with dark theme
          const clone = pre.cloneNode(true) as HTMLPreElement
          clone.className = 'rounded-lg p-4 overflow-x-auto text-sm'
          clone.style.background = '#1a1a2e'
          clone.style.color = '#e2e8f0'
          outerWrapper.appendChild(clone)
        }
      } else {
        const clone = pre.cloneNode(true) as HTMLPreElement
        clone.className = 'rounded-lg p-4 overflow-x-auto text-sm font-mono whitespace-pre-wrap break-words'
        clone.style.background = '#1a1a2e'
        clone.style.color = '#e2e8f0'
        outerWrapper.appendChild(clone)
      }

      // Language label (painted after code div, always on top)
      if (langKey) {
        const langLabel = document.createElement('span')
        langLabel.textContent = langKey
        langLabel.className = 'absolute top-2 left-3 z-20 text-[10px] font-mono uppercase tracking-wider text-white/50 opacity-0 group-hover:opacity-100 transition-opacity select-none pointer-events-none'
        outerWrapper.appendChild(langLabel)
      }

      // Copy button (painted after code div, always on top)
      const copyBtn = document.createElement('button')
      copyBtn.textContent = 'Copier'
      copyBtn.className =
        'absolute top-2 right-2 z-20 px-2 py-1 text-xs rounded bg-white/10 text-white/70 hover:bg-white/20 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity'
      copyBtn.onclick = async () => {
        await navigator.clipboard.writeText(normalizedCode)
        copyBtn.textContent = 'Copié !'
        setTimeout(() => (copyBtn.textContent = 'Copier'), 2000)
      }
      outerWrapper.appendChild(copyBtn)

      pre.replaceWith(outerWrapper)
    })

    return () => {
      mermaidRoots.forEach((root) => root.unmount())
    }
  }, [editor])

  if (!editor) return null

  return (
    <div ref={contentRef}>
      <EditorContent editor={editor} />
    </div>
  )
}
