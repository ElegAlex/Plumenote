import { useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Highlight from '@tiptap/extension-highlight'
import { common, createLowlight } from 'lowlight'
import { AlertBlock } from '@/features/editor/AlertBlock'
import { diffTipTapNodes, type DiffNode } from '@/lib/diff'

const lowlight = createLowlight(common)

interface Props {
  oldBody: Record<string, unknown>
  newBody: Record<string, unknown>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MiniRenderer({ extensions, content }: { extensions: any[]; content: Record<string, unknown> }) {
  const editor = useEditor({
    extensions,
    content,
    editable: false,
    editorProps: { attributes: { class: 'prose prose-sm max-w-none' } },
  })
  if (!editor) return null
  return <EditorContent editor={editor} />
}

function DiffColumn({ nodes }: { nodes: DiffNode[] }) {
  const extensions = useMemo(() => [
    StarterKit.configure({ codeBlock: false }),
    CodeBlockLowlight.configure({ lowlight }),
    Highlight,
    AlertBlock,
  ], [])

  return (
    <div className="flex-1 min-w-0 border border-ink-10 rounded-lg overflow-auto max-h-[70vh]">
      <div className="p-4 space-y-1">
        {nodes.map((dn, i) => {
          const bgClass =
            dn.type === 'delete' ? 'bg-red-50 border-l-4 border-red-300' :
            dn.type === 'insert' ? 'bg-green-50 border-l-4 border-green-300' :
            ''
          return (
            <div key={i} className={`rounded px-2 py-1 ${bgClass}`}>
              <MiniRenderer extensions={extensions} content={{ type: 'doc', content: [dn.node] }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function DiffVisualView({ oldBody, newBody }: Props) {
  const { left, right } = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oldNodes = (oldBody as any)?.content ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newNodes = (newBody as any)?.content ?? []
    return diffTipTapNodes(oldNodes, newNodes)
  }, [oldBody, newBody])

  return (
    <div className="flex gap-4">
      <DiffColumn nodes={left} />
      <DiffColumn nodes={right} />
    </div>
  )
}
