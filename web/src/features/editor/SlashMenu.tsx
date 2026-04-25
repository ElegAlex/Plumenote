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
  type ReactNode,
} from 'react'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import type { Editor } from '@tiptap/react'
import {
  Heading4,
  ListChecks,
  Code2,
  GitBranch,
  Image as ImageIcon,
  Table as TableIcon,
  Lightbulb,
  AlertTriangle,
  AlertOctagon,
  Link2,
  Minus,
} from 'lucide-react'
import { Kbd } from '@/components/ui'

interface SlashItem {
  title: string
  description: string
  icon: ReactNode
  /** Classes Tailwind pour la pastille icône (fond + couleur). */
  tone?: string
  command: (editor: Editor) => void
}

// Tons g6 : fond cream + navy par défaut, coral-bg + coral pour les alertes.
const TONE_DEFAULT = 'bg-cream text-navy-800'
const TONE_CORAL = 'bg-coral-bg text-coral'
const TONE_WARN = 'bg-warn-bg text-warn'
const TONE_DANGER = 'bg-danger-bg text-danger'

const SLASH_ITEMS: SlashItem[] = [
  {
    title: 'Titre 4',
    description: 'Sous-sous-titre',
    icon: <Heading4 />,
    command: (editor) => editor.chain().focus().toggleHeading({ level: 4 }).run(),
  },
  {
    title: 'Liste de tâches',
    description: 'Cases à cocher',
    icon: <ListChecks />,
    command: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    title: 'Bloc de code',
    description: 'Coloration syntaxique (14 langages)',
    icon: <Code2 />,
    command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: 'Diagramme Mermaid',
    description: 'Flowcharts, séquences, gantt',
    icon: <GitBranch />,
    command: (editor) =>
      editor
        .chain()
        .focus()
        .setCodeBlock({ language: 'mermaid' })
        .insertContent('flowchart TD\n    A[Start] --> B[End]')
        .run(),
  },
  {
    title: 'Image',
    description: 'Glisser-déposer ou parcourir. PNG, JPG, SVG, max 10 Mo',
    icon: <ImageIcon />,
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
    description: 'Insérer un tableau 3×3 éditable avec entêtes',
    icon: <TableIcon />,
    command: (editor) =>
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: 'Astuce / Info',
    description: 'Callout bloc informatif coral',
    icon: <Lightbulb />,
    tone: TONE_CORAL,
    command: (editor) => editor.chain().focus().setAlert({ type: 'tip' }).run(),
  },
  {
    title: 'Alerte attention',
    description: 'Bloc avertissement orange',
    icon: <AlertTriangle />,
    tone: TONE_WARN,
    command: (editor) => editor.chain().focus().setAlert({ type: 'warning' }).run(),
  },
  {
    title: 'Alerte danger',
    description: 'Bloc danger rouge',
    icon: <AlertOctagon />,
    tone: TONE_DANGER,
    command: (editor) => editor.chain().focus().setAlert({ type: 'danger' }).run(),
  },
  {
    title: 'Lien interne',
    description: 'Auto-complétion vers un autre document',
    icon: <Link2 />,
    command: (editor) => editor.chain().focus().insertContent('[[').run(),
  },
  {
    title: 'Séparateur',
    description: 'Ligne horizontale',
    icon: <Minus />,
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
      <div className="bg-white rounded-xl shadow-[0_18px_40px_rgba(20,35,92,0.15)] border border-line p-3 text-[13px] text-ink-muted min-w-[340px]">
        Aucune commande trouvée
      </div>
    )
  }

  return (
    <div
      className="bg-white rounded-xl shadow-[0_18px_40px_rgba(20,35,92,0.15)] border border-line overflow-hidden w-[340px] max-h-[360px] overflow-y-auto"
      role="menu"
    >
      <div className="px-3.5 py-2 bg-cream-light border-b border-line-soft text-[11px] font-bold tracking-[0.12em] uppercase text-ink-muted">
        Insérer un bloc · tapez pour filtrer
      </div>
      {items.map((item, i) => {
        const focused = i === selected
        return (
          <button
            key={item.title}
            type="button"
            role="menuitem"
            className={`relative flex items-center gap-3 w-full text-left px-3.5 py-2.5 transition-colors ${
              focused ? 'bg-cream-light' : 'hover:bg-cream-light'
            }`}
            onClick={() => select(i)}
          >
            {focused && (
              <span
                aria-hidden
                className="absolute left-0 top-2 bottom-2 w-[3px] bg-coral rounded-r"
              />
            )}
            <span
              className={`w-9 h-9 grid place-items-center rounded-lg shrink-0 ${item.tone ?? TONE_DEFAULT} [&_svg]:w-[17px] [&_svg]:h-[17px]`}
            >
              {item.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-semibold text-ink truncate">{item.title}</span>
              <span className="block text-[11.5px] text-ink-soft mt-0.5 truncate">{item.description}</span>
            </span>
            {focused && (
              <span className="shrink-0">
                <Kbd>↵</Kbd>
              </span>
            )}
          </button>
        )
      })}
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
