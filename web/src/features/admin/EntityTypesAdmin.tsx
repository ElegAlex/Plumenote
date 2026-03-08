import { useState, useCallback } from 'react'
import { ApiError } from '@/lib/api'
import {
  useEntityTypes,
  useCreateEntityType,
  useUpdateEntityType,
  useDeleteEntityType,
  useEntityLabel,
} from '@/lib/hooks'
import type { EntityTypeSchemaField, EntityType } from '@/lib/types'

const FIELD_TYPES = ['text', 'textarea', 'url', 'number', 'date', 'select'] as const

const emptyField: EntityTypeSchemaField = { name: '', label: '', type: 'text', required: false }

interface FormState {
  name: string
  icon: string
  schema: EntityTypeSchemaField[]
}

const emptyForm: FormState = { name: '', icon: '', schema: [] }

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export default function EntityTypesAdmin() {
  const { data: entityTypes, isLoading } = useEntityTypes()
  const createEntityType = useCreateEntityType()
  const updateEntityType = useUpdateEntityType()
  const deleteEntityType = useDeleteEntityType()
  const { data: entityLabelConfig } = useEntityLabel()
  const entityLabel = entityLabelConfig?.label ?? 'Fiche'

  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<EntityType | null>(null)
  const [deleteError, setDeleteError] = useState('')

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
    setError('')
  }

  function openEdit(et: EntityType) {
    setEditing(et.id)
    setForm({ name: et.name, icon: et.icon, schema: [...et.schema] })
    setShowForm(true)
    setError('')
  }

  const save = useCallback(async () => {
    setError('')
    if (!form.name.trim()) {
      setError('Le nom est requis')
      return
    }
    // Auto-generate field names from labels
    const schema = form.schema.map((f) => ({
      ...f,
      name: f.name || slugify(f.label),
    }))

    try {
      if (editing) {
        await updateEntityType.mutateAsync({ id: editing, name: form.name, icon: form.icon, schema })
      } else {
        await createEntityType.mutateAsync({ name: form.name, icon: form.icon, schema })
      }
      setShowForm(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde')
    }
  }, [form, editing, createEntityType, updateEntityType])

  async function handleDelete(et: EntityType) {
    setDeleteError('')
    try {
      await deleteEntityType.mutateAsync(et.id)
      setDeleteConfirm(null)
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setDeleteError(`Ce type contient ${et.entity_count} ${entityLabel.toLowerCase()}(s). Supprimez-les avant.`)
      } else {
        setDeleteError(e instanceof ApiError ? e.message : 'Erreur lors de la suppression')
      }
    }
  }

  function addField() {
    setForm({ ...form, schema: [...form.schema, { ...emptyField }] })
  }

  function removeField(index: number) {
    setForm({ ...form, schema: form.schema.filter((_, i) => i !== index) })
  }

  function updateField(index: number, patch: Partial<EntityTypeSchemaField>) {
    const schema = form.schema.map((f, i) => i === index ? { ...f, ...patch } : f)
    setForm({ ...form, schema })
  }

  function moveField(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= form.schema.length) return
    const schema = [...form.schema]
    ;[schema[index], schema[target]] = [schema[target], schema[index]]
    setForm({ ...form, schema })
  }

  if (isLoading) return <p className="text-ink-45">Chargement...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ink">Types de {entityLabel.toLowerCase()}</h2>
        <button onClick={openCreate} className="px-4 py-2 bg-blue text-white text-sm font-medium rounded-md hover:bg-blue/90">
          + Nouveau type
        </button>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-10 text-left text-ink-45">
            <th className="py-3 pr-4 font-medium">Icone</th>
            <th className="py-3 pr-4 font-medium">Nom</th>
            <th className="py-3 pr-4 font-medium">Champs</th>
            <th className="py-3 pr-4 font-medium">{entityLabel}s</th>
            <th className="py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {entityTypes?.map((et) => (
            <tr key={et.id} className="border-b border-ink-05 even:bg-bg hover:bg-ink-05">
              <td className="py-3 pr-4 text-lg">{et.icon}</td>
              <td className="py-3 pr-4 font-medium text-ink">{et.name}</td>
              <td className="py-3 pr-4 text-ink-70">{et.schema.length}</td>
              <td className="py-3 pr-4 text-ink-70">{et.entity_count}</td>
              <td className="py-3 text-right space-x-2">
                <button onClick={() => openEdit(et)} className="text-blue hover:text-blue/80 text-sm">Modifier</button>
                <button onClick={() => { setDeleteConfirm(et); setDeleteError('') }} className="text-red hover:text-red/80 text-sm">Supprimer</button>
              </td>
            </tr>
          ))}
          {(!entityTypes || entityTypes.length === 0) && (
            <tr><td colSpan={5} className="py-8 text-center text-ink-45">Aucun type</td></tr>
          )}
        </tbody>
      </table>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] bg-ink/50 overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="bg-bg rounded-lg shadow-xl w-full max-w-2xl p-6 my-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink mb-4">
              {editing ? 'Modifier le type' : 'Nouveau type'}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                  <label className="block text-sm font-medium text-ink-70 mb-1">Icone (emoji)</label>
                  <input
                    type="text"
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    className="w-full border border-ink-10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
                    placeholder="ex: &#x1F4E6;"
                  />
                </div>
              </div>

              {/* Schema editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-ink-70">Champs du schema</label>
                  <button onClick={addField} className="text-sm text-blue hover:text-blue/80">+ Ajouter un champ</button>
                </div>

                {form.schema.length === 0 && (
                  <p className="text-sm text-ink-45 py-4 text-center border border-dashed border-ink-10 rounded-md">
                    Aucun champ. Cliquez sur &laquo;&nbsp;Ajouter un champ&nbsp;&raquo;.
                  </p>
                )}

                <div className="space-y-3">
                  {form.schema.map((field, i) => (
                    <div key={i} className="border border-ink-10 rounded-md p-3 bg-ink-05/50">
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div>
                          <label className="block text-xs text-ink-45 mb-0.5">Label</label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateField(i, { label: e.target.value, name: slugify(e.target.value) })}
                            className="w-full border border-ink-10 rounded px-2 py-1 text-sm bg-bg focus:outline-none focus:ring-1 focus:ring-blue"
                            placeholder="ex: Adresse IP"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-ink-45 mb-0.5">Type</label>
                          <select
                            value={field.type}
                            onChange={(e) => updateField(i, { type: e.target.value as EntityTypeSchemaField['type'] })}
                            className="w-full border border-ink-10 rounded px-2 py-1 text-sm bg-bg focus:outline-none focus:ring-1 focus:ring-blue"
                          >
                            {FIELD_TYPES.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-end gap-2">
                          <label className="flex items-center gap-1 text-xs text-ink-70">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateField(i, { required: e.target.checked })}
                              className="accent-blue"
                            />
                            Requis
                          </label>
                          <div className="flex gap-1 ml-auto">
                            <button onClick={() => moveField(i, -1)} disabled={i === 0} className="text-ink-45 hover:text-ink disabled:opacity-25 text-xs px-1">&uarr;</button>
                            <button onClick={() => moveField(i, 1)} disabled={i === form.schema.length - 1} className="text-ink-45 hover:text-ink disabled:opacity-25 text-xs px-1">&darr;</button>
                            <button onClick={() => removeField(i)} className="text-red hover:text-red/80 text-xs px-1">&times;</button>
                          </div>
                        </div>
                      </div>
                      {field.type === 'select' && (
                        <div>
                          <label className="block text-xs text-ink-45 mb-0.5">Options (separees par des virgules)</label>
                          <input
                            type="text"
                            value={field.options?.join(', ') ?? ''}
                            onChange={(e) => updateField(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                            className="w-full border border-ink-10 rounded px-2 py-1 text-sm bg-bg focus:outline-none focus:ring-1 focus:ring-blue"
                            placeholder="ex: Option A, Option B, Option C"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-bg rounded-lg shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink mb-2">Confirmer la suppression</h3>
            <p className="text-sm text-ink-70 mb-4">
              Supprimer le type &laquo;&nbsp;{deleteConfirm.name}&nbsp;&raquo; ?
            </p>
            {deleteError && <p className="text-red text-sm mb-4">{deleteError}</p>}
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
