import type { Editor } from '@tiptap/react'
import { useEffect, useRef } from 'react'

interface TableContextMenuProps {
  editor: Editor
  x: number
  y: number
  onClose: () => void
}

const ACTIONS = [
  { label: 'Ajouter une ligne au-dessus', action: (e: Editor) => e.chain().focus().addRowBefore().run() },
  { label: 'Ajouter une ligne en-dessous', action: (e: Editor) => e.chain().focus().addRowAfter().run() },
  { label: 'Ajouter une colonne a gauche', action: (e: Editor) => e.chain().focus().addColumnBefore().run() },
  { label: 'Ajouter une colonne a droite', action: (e: Editor) => e.chain().focus().addColumnAfter().run() },
  { separator: true } as const,
  { label: 'Supprimer la ligne', action: (e: Editor) => e.chain().focus().deleteRow().run() },
  { label: 'Supprimer la colonne', action: (e: Editor) => e.chain().focus().deleteColumn().run() },
] as const

type ActionItem = { label: string; action: (e: Editor) => void } | { separator: true }

export default function TableContextMenu({ editor, x, y, onClose }: TableContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const viewportW = window.innerWidth
  const viewportH = window.innerHeight
  const posX = x + 200 > viewportW ? x - 200 : x
  const posY = y + 250 > viewportH ? y - 250 : y

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white border border-line rounded-xl shadow-[0_18px_40px_rgba(20,35,92,0.15)] py-1.5 min-w-[220px]"
      style={{ left: posX, top: posY }}
      role="menu"
    >
      {(ACTIONS as readonly ActionItem[]).map((item, i) =>
        'separator' in item ? (
          <div key={i} className="border-t border-line-soft my-1" aria-hidden />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className="block w-full text-left px-3.5 py-2 text-[13px] font-medium text-ink hover:bg-cream-light hover:text-navy-800 transition-colors"
            onClick={() => {
              item.action(editor)
              onClose()
            }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  )
}
