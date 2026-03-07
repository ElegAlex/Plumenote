import { useState, useEffect, useCallback } from 'react'
import { api, ApiError } from '@/lib/api'
import TipTapEditor from '@/features/editor/TipTapEditor'

interface Template {
  id: string
  name: string
  description: string
  type: string
  content: unknown
  usage_count: number
}

interface TemplateForm {
  name: string
  description: string
  type: string
  content: string
}

const emptyForm: TemplateForm = { name: '', description: '', type: '', content: '{}' }

export default function TemplatesAdmin() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<TemplateForm>(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    api.get<Template[]>('/admin/templates')
      .then(setTemplates)
      .catch(() => setError('Erreur lors du chargement des templates'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
    setError('')
  }

  function openEdit(t: Template) {
    setEditing(t.id)
    setForm({
      name: t.name,
      description: t.description,
      type: t.type,
      content: JSON.stringify(t.content, null, 2),
    })
    setShowForm(true)
    setError('')
  }

  async function save() {
    setError('')
    let parsedContent: unknown
    try {
      parsedContent = JSON.parse(form.content)
    } catch {
      setError('Le contenu JSON est invalide')
      return
    }

    const payload = { name: form.name, description: form.description, type: form.type, content: parsedContent }

    try {
      if (editing) {
        await api.put(`/admin/templates/${editing}`, payload)
      } else {
        await api.post('/admin/templates', payload)
      }
      setShowForm(false)
      load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde')
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/admin/templates/${id}`)
      setDeleteConfirm(null)
      load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors de la suppression')
      setDeleteConfirm(null)
    }
  }

  if (loading) return <p className="text-ink-45">Chargement...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ink">Templates</h2>
        <button onClick={openCreate} className="px-4 py-2 bg-blue text-white text-sm font-medium rounded-md hover:bg-blue/90">
          + Nouveau template
        </button>
      </div>

      {error && <p className="text-red text-sm mb-4">{error}</p>}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-10 text-left text-ink-45">
            <th className="py-3 pr-4 font-medium">Nom</th>
            <th className="py-3 pr-4 font-medium">Type</th>
            <th className="py-3 pr-4 font-medium">Utilisations</th>
            <th className="py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t.id} className="border-b border-ink-05 even:bg-bg hover:bg-ink-05">
              <td className="py-3 pr-4">
                <div className="font-medium text-ink">{t.name}</div>
                {t.description && <div className="text-ink-45 text-xs mt-0.5">{t.description}</div>}
              </td>
              <td className="py-3 pr-4 text-ink-70">{t.type}</td>
              <td className="py-3 pr-4 text-ink-70">{t.usage_count}</td>
              <td className="py-3 text-right space-x-2">
                <button onClick={() => openEdit(t)} className="text-blue hover:text-blue/80 text-sm">Modifier</button>
                <button onClick={() => setDeleteConfirm(t.id)} className="text-red hover:text-red/80 text-sm">Supprimer</button>
              </td>
            </tr>
          ))}
          {templates.length === 0 && (
            <tr><td colSpan={4} className="py-8 text-center text-ink-45">Aucun template</td></tr>
          )}
        </tbody>
      </table>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50" onClick={() => setShowForm(false)}>
          <div className="bg-bg rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink mb-4">
              {editing ? 'Modifier le template' : 'Nouveau template'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-70 mb-1">Nom</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-ink-10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-70 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-ink-10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-70 mb-1">Type</label>
                <input
                  type="text"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full border border-ink-10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-70 mb-1">Contenu du template</label>
                <TipTapEditor
                  content={form.content}
                  documentId={null}
                  onChange={(json) => setForm({ ...form, content: json })}
                />
              </div>
            </div>

            {error && <p className="text-red text-sm mt-3">{error}</p>}

            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-ink-70 border border-ink-10 rounded-md hover:bg-ink-05">
                Annuler
              </button>
              <button onClick={save} className="px-4 py-2 text-sm text-white bg-blue rounded-md hover:bg-blue/90">
                {editing ? 'Enregistrer' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-bg rounded-lg shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink mb-2">Confirmer la suppression</h3>
            <p className="text-sm text-ink-70 mb-4">
              Le template ne sera plus propose lors de la creation de pages. Les documents existants ne seront pas impactes.
            </p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-ink-70 border border-ink-10 rounded-md hover:bg-ink-05">
                Annuler
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 text-sm text-white bg-red rounded-md hover:bg-red/90">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
