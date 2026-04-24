import type { Editor } from '@tiptap/react'
import type { AlertType } from './AlertBlock'
import { useState, useRef, useEffect } from 'react'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  CheckSquare,
  Link2,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Code2,
  AlertTriangle,
  Lightbulb,
  AlertOctagon,
  Minus,
  Quote,
} from 'lucide-react'
import {
  Toolbar as ToolbarRoot,
  ToolbarGroup,
  ToolbarSeparator,
  ToolbarButton,
  ToolbarSelect,
  Kbd,
} from '@/components/ui'
import { uploadImage } from './ImageUpload'

interface ToolbarProps {
  editor: Editor | null
  documentId: string | null
  /** Offset sticky top (par défaut 68 = header Shell). Peut être ajusté si header plus grand. */
  stickyTop?: number
}

type BlockChoice = 'p' | 'h1' | 'h2' | 'h3' | 'quote'

function getActiveBlock(editor: Editor | null): BlockChoice {
  if (!editor) return 'p'
  if (editor.isActive('heading', { level: 1 })) return 'h1'
  if (editor.isActive('heading', { level: 2 })) return 'h2'
  if (editor.isActive('heading', { level: 3 })) return 'h3'
  if (editor.isActive('blockquote')) return 'quote'
  return 'p'
}

export default function Toolbar({ editor, documentId, stickyTop = 68 }: ToolbarProps) {
  const [showAlertMenu, setShowAlertMenu] = useState(false)
  const alertRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (alertRef.current && !alertRef.current.contains(e.target as Node)) {
        setShowAlertMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!editor) return null

  const active = getActiveBlock(editor)

  const onBlockChange = (v: BlockChoice) => {
    const chain = editor.chain().focus()
    switch (v) {
      case 'p':
        chain.setParagraph().run()
        break
      case 'h1':
        chain.toggleHeading({ level: 1 }).run()
        break
      case 'h2':
        chain.toggleHeading({ level: 2 }).run()
        break
      case 'h3':
        chain.toggleHeading({ level: 3 }).run()
        break
      case 'quote':
        chain.toggleBlockquote().run()
        break
    }
  }

  const insertImage = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/gif,image/webp'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      if (!documentId) {
        alert("Sauvegardez le document avant d'ajouter des images.")
        return
      }
      uploadImage(file, documentId).then(
        (data) => editor.chain().focus().setImage({ src: data.filepath }).run(),
        (err) => alert((err as Error).message),
      )
    }
    input.click()
  }

  const insertLink = () => {
    const url = window.prompt('URL du lien :')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  const insertInternalLink = () => {
    editor.chain().focus().insertContent('[[').run()
  }

  const insertAlert = (type: AlertType) => {
    editor.chain().focus().setAlert({ type }).run()
    setShowAlertMenu(false)
  }

  return (
    <ToolbarRoot stickyTop={stickyTop}>
      <ToolbarGroup>
        <ToolbarSelect
          value={active}
          onChange={(e) => onBlockChange(e.target.value as BlockChoice)}
          aria-label="Style de bloc"
        >
          <option value="p">Paragraphe</option>
          <option value="h1">Titre 1</option>
          <option value="h2">Titre 2</option>
          <option value="h3">Titre 3</option>
          <option value="quote">Citation</option>
        </ToolbarSelect>
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Gras (Ctrl+B)"
          aria-label="Gras"
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italique (Ctrl+I)"
          aria-label="Italique"
        >
          <Italic />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Barré"
          aria-label="Barré"
        >
          <Strikethrough />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          title="Code en ligne"
          aria-label="Code en ligne"
        >
          <Code />
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Liste à puces"
          aria-label="Liste à puces"
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Liste numérotée"
          aria-label="Liste numérotée"
        >
          <ListOrdered />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive('taskList')}
          title="Liste de tâches"
          aria-label="Liste de tâches"
        >
          <CheckSquare />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Citation"
          aria-label="Citation"
        >
          <Quote />
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ToolbarButton
          onClick={insertLink}
          active={editor.isActive('link')}
          title="Lien"
          aria-label="Lien"
        >
          <LinkIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={insertInternalLink}
          title="Lien interne [[...]]"
          aria-label="Lien interne"
        >
          <Link2 />
        </ToolbarButton>
        <ToolbarButton onClick={insertImage} title="Image" aria-label="Image">
          <ImageIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
          title="Tableau"
          aria-label="Tableau"
        >
          <TableIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          title="Bloc de code"
          aria-label="Bloc de code"
        >
          <Code2 />
        </ToolbarButton>

        <div className="relative" ref={alertRef}>
          <ToolbarButton
            onClick={() => setShowAlertMenu((v) => !v)}
            active={editor.isActive('alertBlock') || showAlertMenu}
            title="Alerte / Astuce"
            aria-label="Alerte"
            aria-haspopup="menu"
            aria-expanded={showAlertMenu}
          >
            <AlertTriangle />
          </ToolbarButton>
          {showAlertMenu && (
            <div
              role="menu"
              className="absolute top-full left-0 mt-1.5 bg-white border border-line rounded-xl shadow-[0_18px_40px_rgba(20,35,92,0.15)] overflow-hidden z-20 min-w-[200px]"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => insertAlert('tip')}
                className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-[13px] font-medium text-ink hover:bg-cream-light hover:text-navy-800 transition-colors"
              >
                <span className="w-7 h-7 grid place-items-center rounded-lg bg-coral-bg text-coral [&_svg]:w-4 [&_svg]:h-4">
                  <Lightbulb />
                </span>
                Astuce / Info
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => insertAlert('warning')}
                className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-[13px] font-medium text-ink hover:bg-cream-light hover:text-navy-800 transition-colors"
              >
                <span className="w-7 h-7 grid place-items-center rounded-lg bg-warn-bg text-warn [&_svg]:w-4 [&_svg]:h-4">
                  <AlertTriangle />
                </span>
                Attention
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => insertAlert('danger')}
                className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-[13px] font-medium text-ink hover:bg-cream-light hover:text-navy-800 transition-colors"
              >
                <span className="w-7 h-7 grid place-items-center rounded-lg bg-danger-bg text-danger [&_svg]:w-4 [&_svg]:h-4">
                  <AlertOctagon />
                </span>
                Danger
              </button>
            </div>
          )}
        </div>

        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Séparateur horizontal"
          aria-label="Séparateur"
        >
          <Minus />
        </ToolbarButton>
      </ToolbarGroup>

      <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-line rounded-[7px] text-[11px] font-semibold text-ink-soft">
        Tapez <Kbd>/</Kbd> pour ouvrir le menu
      </span>
    </ToolbarRoot>
  )
}
