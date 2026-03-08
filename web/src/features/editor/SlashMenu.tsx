import { ReactRenderer } from '@tiptap/react'
import { type SuggestionOptions } from '@tiptap/suggestion'
import { Extension } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
} from 'react'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import type { Editor } from '@tiptap/react'

interface SlashItem {
  title: string
  description: string
  icon: string
  command: (editor: Editor) => void
}

const SLASH_ITEMS: SlashItem[] = [
  {
    title: 'Bloc de code',
    description: 'Bloc avec coloration syntaxique',
    icon: '</>',
    command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: 'Image',
    description: 'Inserer une image',
    icon: '\uD83D\uDDBC',
    command: (editor) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/png,image/jpeg,image/gif,image/webp'
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) return
        const documentId = ((editor.storage as unknown as Record<string, unknown>).imageDrop as { documentId?: string | null })?.documentId
        if (!documentId) {
          alert('Sauvegardez le document avant d\'ajouter des images.')
          return
        }
        import('./ImageUpload').then(({ uploadImage }) => {
          uploadImage(file, documentId).then(
            (data) => editor.chain().focus().setImage({ src: data.filepath }).run(),
            (err) => alert((err as Error).message),
          )
        })
      }
      input.click()
    },
  },
  {
    title: 'Tableau',
    description: 'Inserer un tableau 3x3',
    icon: '\uD83D\uDCCA',
    command: (editor) =>
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: 'Alerte info',
    description: 'Bloc informatif bleu',
    icon: '\uD83D\uDCA1',
    command: (editor) => editor.chain().focus().setAlert({ type: 'tip' }).run(),
  },
  {
    title: 'Alerte attention',
    description: 'Bloc avertissement orange',
    icon: '\u26A0\uFE0F',
    command: (editor) => editor.chain().focus().setAlert({ type: 'warning' }).run(),
  },
  {
    title: 'Alerte danger',
    description: 'Bloc danger rouge',
    icon: '\uD83D\uDD34',
    command: (editor) => editor.chain().focus().setAlert({ type: 'danger' }).run(),
  },
  {
    title: 'Lien interne',
    description: 'Lien vers un autre document',
    icon: '\uD83D\uDD17',
    command: (editor) => editor.chain().focus().insertContent('[[').run(),
  },
  {
    title: 'Separateur',
    description: 'Ligne horizontale',
    icon: '\u2014',
    command: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
]

interface SlashListProps {
  items: SlashItem[]
  command: (item: SlashItem) => void
}

interface SlashListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

const SlashList = forwardRef<SlashListRef, SlashListProps>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0)

  useEffect(() => setSelected(0), [items])

  const select = useCallback(
    (index: number) => {
      const item = items[index]
      if (item) command(item)
    },
    [items, command],
  )

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelected((s) => (s + items.length - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelected((s) => (s + 1) % items.length)
        return true
      }
      if (event.key === 'Enter') {
        select(selected)
        return true
      }
      return false
    },
  }))

  if (!items.length) {
    return (
      <div className="bg-bg rounded-lg shadow-lg border p-3 text-sm text-ink-45">
        Aucune commande trouvee
      </div>
    )
  }

  return (
    <div className="bg-bg rounded-lg shadow-lg border overflow-hidden min-w-[220px] max-h-[300px] overflow-y-auto">
      {items.map((item, i) => (
        <button
          key={item.title}
          className={`flex items-center gap-3 w-full text-left px-3 py-2 text-sm ${i === selected ? 'bg-blue/10 text-blue' : 'hover:bg-ink-05'}`}
          onClick={() => select(i)}
        >
          <span className="w-6 text-center text-base flex-shrink-0">{item.icon}</span>
          <div>
            <div className="font-medium">{item.title}</div>
            <div className="text-xs text-ink-45">{item.description}</div>
          </div>
        </button>
      ))}
    </div>
  )
})
SlashList.displayName = 'SlashList'

const slashSuggestion: Omit<SuggestionOptions, 'editor'> = {
  char: '/',
  startOfLine: true,
  items: ({ query }) => {
    return SLASH_ITEMS.filter((item) =>
      item.title.toLowerCase().includes(query.toLowerCase()),
    )
  },
  render: () => {
    let component: ReactRenderer<SlashListRef> | null = null
    let popup: TippyInstance[] | null = null

    return {
      onStart: (props) => {
        component = new ReactRenderer(SlashList, {
          props,
          editor: props.editor,
        })
        if (!props.clientRect) return
        popup = tippy('body', {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        })
      },
      onUpdate(props) {
        component?.updateProps(props)
        if (popup?.[0] && props.clientRect) {
          popup[0].setProps({ getReferenceClientRect: props.clientRect as () => DOMRect })
        }
      },
      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide()
          return true
        }
        return component?.ref?.onKeyDown(props) ?? false
      },
      onExit() {
        popup?.[0]?.destroy()
        component?.destroy()
      },
    }
  },
  command: ({ editor, range, props }) => {
    const item = props as unknown as SlashItem
    editor.chain().focus().deleteRange(range).run()
    item.command(editor)
  },
}

export const SlashMenuExtension = Extension.create({
  name: 'slashMenu',
  addOptions() {
    return { suggestion: slashSuggestion }
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: new PluginKey('slashMenu'),
        ...this.options.suggestion,
      }),
    ]
  },
})
