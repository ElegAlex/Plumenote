import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Editor } from '@tiptap/react'
import { Field, FieldLabel, Select } from '@/components/ui'

export interface Template {
  id: string
  name: string
  description: string
  content: string
  type_id: string
}

interface TemplatePickerProps {
  editor: Editor | null
  /** Ne rend rien tant que l'éditeur n'est pas prêt. */
  visible: boolean
  onUsed: (template: Template) => void
}

/**
 * TemplatePicker — sélecteur de modèle de document rendu comme champ
 * "Template" dans la Card Classement (gabarit g6). Remplace l'ancienne grille
 * de cartes qui occupait l'espace au-dessus de l'éditeur.
 *
 * Lorsqu'un template est choisi, son contenu est injecté dans l'éditeur via
 * `editor.commands.setContent(parsed)` (logique TipTap inchangée) et le
 * handler `onUsed` informe le parent (pour préselectionner le type de
 * document associé, par exemple).
 */
export default function TemplatePicker({ editor, visible, onUsed }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selected, setSelected] = useState<string>('')

  useEffect(() => {
    api.get<Template[]>('/admin/templates').then(setTemplates).catch(() => {})
  }, [])

  if (!visible || !templates.length || !editor) return null

  const apply = (templateId: string) => {
    setSelected(templateId)
    if (!templateId) return
    const template = templates.find((t) => t.id === templateId)
    if (!template) return
    try {
      const parsed = JSON.parse(template.content)
      editor.commands.setContent(parsed)
    } catch {
      editor.commands.setContent(template.content)
    }
    onUsed(template)
  }

  return (
    <Field>
      <FieldLabel>Modèle</FieldLabel>
      <Select value={selected} onChange={(e) => apply(e.target.value)}>
        <option value="">Aucun</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>
    </Field>
  )
}
