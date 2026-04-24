import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import ImageExt from '@tiptap/extension-image'
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
import { useEffect, useState, useCallback, type ReactNode } from 'react'

import { AlertBlock } from './AlertBlock'
import { ImageDrop } from './ImageUpload'
import { SlashMenuExtension } from './SlashMenu'
import { InternalLinkExtension } from './InternalLink'
import CodeBlockView from './CodeBlockView'
import TableContextMenu from './TableContextMenu'
import Toolbar from './Toolbar'

const lowlight = createLowlight(common)

interface TipTapEditorProps {
  content?: string
  documentId: string | null
  onChange?: (json: string) => void
  onFirstInput?: () => void
  onEditorReady?: (editor: ReturnType<typeof useEditor>) => void
  /**
   * Slot rendu en tête du corps de l'éditeur (titre + meta-row), à l'intérieur
   * du bloc .editor-body pour rester en continuité visuelle avec le contenu
   * TipTap (g6 : titre Fraunces + meta chips + prose).
   */
  headerSlot?: ReactNode
  /** Offset sticky top de la toolbar (default 68 = header Shell). */
  toolbarStickyTop?: number
}

export default function TipTapEditor({
  content,
  documentId,
  onChange,
  onFirstInput,
  onEditorReady,
  headerSlot,
  toolbarStickyTop = 68,
}: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3, 4] },
        link: false,
      }),
      Placeholder.configure({
        placeholder: 'Commencez a ecrire ou tapez / pour les commandes...',
      }),
      ImageExt.configure({ inline: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      CodeBlockLowlight.configure({ lowlight }).extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockView)
        },
      }),
      Highlight,
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      AlertBlock,
      ImageDrop,
      SlashMenuExtension,
      InternalLinkExtension,
    ],
    content: content || '',
    editorProps: {
      attributes: {
        // Corps du texte TipTap : prose PlumeNote (styles globaux),
        // rendu 15.5 / 1.75 aligné sur g6 .editor-body.
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[400px] text-[15.5px] leading-[1.75]',
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange?.(JSON.stringify(e.getJSON()))
    },
    onCreate: ({ editor: e }) => {
      if (content) {
        try {
          const parsed = JSON.parse(content)
          e.commands.setContent(parsed)
        } catch {
          e.commands.setContent(content)
        }
      }
    },
  })

  useEffect(() => {
    if (!editor) return
    onEditorReady?.(editor)
  }, [editor, onEditorReady])

  useEffect(() => {
    if (!editor || !documentId) return
    ;(editor.storage as unknown as Record<string, unknown>).imageDrop = { documentId }
  }, [editor, documentId])

  useEffect(() => {
    if (!editor || !onFirstInput) return
    let fired = false
    const handler = () => {
      if (fired) return
      fired = true
      onFirstInput()
    }
    editor.on('update', handler)
    return () => {
      editor.off('update', handler)
    }
  }, [editor, onFirstInput])

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!editor) return
      const cell = (e.target as HTMLElement).closest('td, th')
      if (!cell) return
      e.preventDefault()
      setCtxMenu({ x: e.clientX, y: e.clientY })
    },
    [editor],
  )

  return (
    <section
      className="bg-white border border-line rounded-[18px] overflow-hidden min-h-[600px] flex flex-col"
      onContextMenu={handleContextMenu}
    >
      <Toolbar editor={editor} documentId={documentId} stickyTop={toolbarStickyTop} />
      <div className="flex-1 px-12 pt-9 pb-12 relative">
        {headerSlot}
        <EditorContent editor={editor} />
      </div>
      {ctxMenu && editor && (
        <TableContextMenu
          editor={editor}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </section>
  )
}

export { useEditor }
