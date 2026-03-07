import { useEffect, useMemo, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { codeToHtml, type BundledLanguage, type BundledTheme } from 'shiki'
import { useNavigate } from 'react-router-dom'
import { AlertBlock } from '@/features/editor/AlertBlock'

const lowlight = createLowlight(common)
const SHIKI_THEME: BundledTheme = 'github-dark'

const SUPPORTED_LANGUAGES: Record<string, BundledLanguage> = {
  bash: 'bash', shell: 'bash', sh: 'bash',
  powershell: 'powershell', ps1: 'powershell',
  sql: 'sql', python: 'python', py: 'python',
  json: 'json', xml: 'xml', html: 'html',
  javascript: 'javascript', js: 'javascript',
  typescript: 'typescript', ts: 'typescript',
  yaml: 'yaml', yml: 'yaml',
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

    const codeBlocks = el.querySelectorAll('pre > code')
    codeBlocks.forEach(async (codeEl) => {
      const pre = codeEl.parentElement as HTMLPreElement
      if (!pre || pre.dataset.enhanced) return
      pre.dataset.enhanced = 'true'

      const code = codeEl.textContent || ''
      const normalizedCode = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

      // Add copy button
      const copyBtn = document.createElement('button')
      copyBtn.textContent = 'Copier'
      copyBtn.className =
        'absolute top-2 right-2 z-10 px-2 py-1 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity'
      copyBtn.onclick = async () => {
        await navigator.clipboard.writeText(normalizedCode)
        copyBtn.textContent = 'Copie !'
        setTimeout(() => (copyBtn.textContent = 'Copier'), 2000)
      }

      pre.style.position = 'relative'
      pre.classList.add('group')
      pre.appendChild(copyBtn)

      // Apply Shiki highlighting
      const langClass = Array.from(codeEl.classList).find((c) => c.startsWith('language-'))
      const langKey = langClass?.replace('language-', '')?.toLowerCase() || ''
      const shikiLang = SUPPORTED_LANGUAGES[langKey]

      if (shikiLang) {
        try {
          const html = await codeToHtml(normalizedCode, { lang: shikiLang, theme: SHIKI_THEME })
          const wrapper = document.createElement('div')
          wrapper.innerHTML = html
          wrapper.className = 'rounded-lg overflow-x-auto text-sm [&>pre]:p-4 [&>pre]:!bg-gray-900 relative group'

          // Re-add copy button to wrapper
          const newCopyBtn = copyBtn.cloneNode(true) as HTMLButtonElement
          newCopyBtn.onclick = async () => {
            await navigator.clipboard.writeText(normalizedCode)
            newCopyBtn.textContent = 'Copie !'
            setTimeout(() => (newCopyBtn.textContent = 'Copier'), 2000)
          }
          wrapper.appendChild(newCopyBtn)

          pre.replaceWith(wrapper)
        } catch {
          // Keep lowlight fallback
          pre.classList.add('bg-gray-900', 'text-gray-100', 'rounded-lg', 'p-4', 'overflow-x-auto', 'text-sm')
        }
      } else {
        pre.classList.add('bg-gray-900', 'text-gray-100', 'rounded-lg', 'p-4', 'overflow-x-auto', 'text-sm', 'font-mono')
      }
    })
  }, [editor])

  if (!editor) return null

  return (
    <div ref={contentRef}>
      <EditorContent editor={editor} />
    </div>
  )
}
