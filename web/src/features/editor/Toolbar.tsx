import type { Editor } from '@tiptap/react'
import type { AlertType } from './AlertBlock'
import { useState, useRef, useEffect } from 'react'
import { uploadImage } from './ImageUpload'

interface ToolbarProps {
  editor: Editor | null
  documentId: string | null
}

interface BtnProps {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}

function Btn({ onClick, active, title, children }: BtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-2 rounded text-sm font-medium transition-colors ${
        active ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div className="w-px h-6 bg-gray-200 mx-1" />
}

export default function Toolbar({ editor, documentId }: ToolbarProps) {
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

  const insertImage = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/gif,image/webp'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      if (!documentId) {
        alert('Sauvegardez le document avant d\'ajouter des images.')
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

  const insertAlert = (type: AlertType) => {
    editor.chain().focus().setAlert({ type }).run()
    setShowAlertMenu(false)
  }

  return (
    <div className="sticky top-0 z-10 bg-white border-b px-3 py-1.5 flex items-center gap-0.5 flex-wrap">
      <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Gras (Ctrl+B)">
        B
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italique (Ctrl+I)">
        <em>I</em>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        title="Titre 1"
      >
        H1
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Titre 2"
      >
        H2
      </Btn>

      <Sep />

      <Btn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Liste a puces"
      >
        UL
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Liste numerotee"
      >
        OL
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Citation"
      >
        Quote
      </Btn>

      <Sep />

      <Btn
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        title="Bloc de code"
      >
        Code
      </Btn>
      <Btn onClick={insertImage} title="Image">
        Image
      </Btn>
      <Btn onClick={insertLink} active={editor.isActive('link')} title="Lien">
        Link
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        title="Tableau"
      >
        Table
      </Btn>

      <div className="relative" ref={alertRef}>
        <Btn onClick={() => setShowAlertMenu(!showAlertMenu)} active={editor.isActive('alertBlock')} title="Bloc alerte">
          Alert
        </Btn>
        {showAlertMenu && (
          <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg overflow-hidden z-20">
            <button type="button" onClick={() => insertAlert('tip')} className="block w-full text-left px-3 py-2 text-sm hover:bg-blue-50">
              Info
            </button>
            <button type="button" onClick={() => insertAlert('warning')} className="block w-full text-left px-3 py-2 text-sm hover:bg-amber-50">
              Attention
            </button>
            <button type="button" onClick={() => insertAlert('danger')} className="block w-full text-left px-3 py-2 text-sm hover:bg-red-50">
              Danger
            </button>
          </div>
        )}
      </div>

      <Sep />

      <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Separateur">
        &mdash;
      </Btn>
    </div>
  )
}
