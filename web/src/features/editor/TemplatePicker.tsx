import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Editor } from '@tiptap/react'

interface Template {
  id: string
  name: string
  description: string
  content: string
  type_id: string
}

interface TemplatePickerProps {
  editor: Editor | null
  visible: boolean
  onUsed: (template: Template) => void
}

export default function TemplatePicker({ editor, visible, onUsed }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    api.get<Template[]>('/admin/templates').then(setTemplates).catch(() => {})
  }, [])

  if (!visible || !templates.length || !editor) return null

  const displayed = showAll ? templates : templates.slice(0, 5)

  const apply = (template: Template) => {
    try {
      const parsed = JSON.parse(template.content)
      editor.commands.setContent(parsed)
    } catch {
      editor.commands.setContent(template.content)
    }
    onUsed(template)
  }

  return (
    <div className="bg-gray-50 border rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">Demarrer avec un modele</h3>
        {!showAll && templates.length > 5 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            + Voir tous
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {displayed.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => apply(t)}
            className="text-left p-3 bg-white border rounded-lg hover:border-blue-300 hover:shadow-sm transition-colors"
          >
            <div className="font-medium text-sm text-gray-800 truncate">{t.name}</div>
            {t.description && (
              <div className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
