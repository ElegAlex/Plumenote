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
import { api } from '@/lib/api'

interface DocResult {
  id: string
  title: string
  slug: string
}

interface LinkListProps {
  items: DocResult[]
  command: (item: DocResult) => void
}

interface LinkListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

const LinkList = forwardRef<LinkListRef, LinkListProps>(({ items, command }, ref) => {
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
      <div className="bg-white rounded-xl shadow-[0_18px_40px_rgba(20,35,92,0.15)] border border-line p-3 text-[13px] text-ink-muted min-w-[260px]">
        Aucun document trouvé
      </div>
    )
  }

  return (
    <div
      className="bg-white rounded-xl shadow-[0_18px_40px_rgba(20,35,92,0.15)] border border-line overflow-hidden min-w-[260px]"
      role="menu"
    >
      {items.map((item, i) => {
        const focused = i === selected
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className={`relative block w-full text-left px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
              focused ? 'bg-cream-light text-navy-800' : 'text-ink hover:bg-cream-light hover:text-navy-800'
            }`}
            onClick={() => select(i)}
          >
            {focused && (
              <span
                aria-hidden
                className="absolute left-0 top-2 bottom-2 w-[3px] bg-coral rounded-r"
              />
            )}
            {item.title}
          </button>
        )
      })}
    </div>
  )
})
LinkList.displayName = 'LinkList'

const suggestion: Omit<SuggestionOptions, 'editor'> = {
  char: '[[',
  items: async ({ query }) => {
    if (!query) return []
    try {
      return await api.get<DocResult[]>(`/documents?q=${encodeURIComponent(query)}&limit=5`)
    } catch {
      return []
    }
  },
  render: () => {
    let component: ReactRenderer<LinkListRef> | null = null
    let popup: TippyInstance[] | null = null

    return {
      onStart: (props) => {
        component = new ReactRenderer(LinkList, {
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
    const doc = props as unknown as DocResult
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .setLink({ href: `/documents/${doc.slug}` })
      .insertContent(doc.title)
      .unsetLink()
      .run()
  },
}

export const InternalLinkExtension = Extension.create({
  name: 'internalLink',
  addOptions() {
    return { suggestion }
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: new PluginKey('internalLink'),
        ...this.options.suggestion,
      }),
    ]
  },
})
