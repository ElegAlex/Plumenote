import { Node, mergeAttributes } from '@tiptap/react'

export type AlertType = 'tip' | 'warning' | 'danger'

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    alertBlock: {
      setAlert: (attrs: { type: AlertType }) => ReturnType
    }
  }
}

export const AlertBlock = Node.create({
  name: 'alertBlock',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      type: {
        default: 'tip' as AlertType,
        parseHTML: (el) => el.getAttribute('data-alert-type') || 'tip',
        renderHTML: (attrs) => ({ 'data-alert-type': attrs.type }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-alert-type]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const type = HTMLAttributes['data-alert-type'] || 'tip'
    const styles: Record<AlertType, string> = {
      tip: 'bg-blue/10 border-blue/30',
      warning: 'bg-amber-50 border-amber-200',
      danger: 'bg-red/10 border-red/30',
    }
    const icons: Record<AlertType, string> = {
      tip: '\u{1F4A1}',
      warning: '\u26A0\uFE0F',
      danger: '\u{1F534}',
    }
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: `alert-block border-l-4 rounded-r p-4 my-3 ${styles[type as AlertType] || styles.tip}`,
      }),
      [
        'div',
        { class: 'flex gap-2' },
        ['span', { class: 'select-none', contenteditable: 'false' }, icons[type as AlertType] || icons.tip],
        ['div', { class: 'flex-1 min-w-0' }, 0],
      ],
    ]
  },

  addCommands() {
    return {
      setAlert:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
            content: [{ type: 'paragraph' }],
          })
        },
    }
  },
})
