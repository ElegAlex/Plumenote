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
    // Tokens PlumeNote (coral / warn / danger) alignes sur g6 .callout.
    const styles: Record<AlertType, string> = {
      tip: 'bg-coral-bg border-coral',
      warning: 'bg-warn-bg border-warn',
      danger: 'bg-danger-bg border-danger',
    }
    const iconColors: Record<AlertType, string> = {
      tip: 'text-coral',
      warning: 'text-warn',
      danger: 'text-danger',
    }
    const icons: Record<AlertType, string> = {
      tip: '\u{1F4A1}',
      warning: '⚠️',
      danger: '\u{1F534}',
    }
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: `alert-block border-l-4 rounded-xl my-5 px-5 py-4 flex gap-3 ${styles[type as AlertType] || styles.tip}`,
      }),
      [
        'span',
        {
          class: `select-none grid place-items-center w-7 h-7 bg-white rounded-[7px] shrink-0 ${iconColors[type as AlertType] || iconColors.tip}`,
          contenteditable: 'false',
        },
        icons[type as AlertType] || icons.tip,
      ],
      ['div', { class: 'flex-1 min-w-0 text-[13.5px] leading-[1.55] text-ink' }, 0],
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
