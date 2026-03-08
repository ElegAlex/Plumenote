import { useState, useCallback } from 'react'
import { ApiError } from '@/lib/api'
import { useRelationTypes, useCreateRelationType, useDeleteRelationType } from '@/lib/hooks'
import type { RelationType } from '@/lib/types'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

interface FormState {
  name: string
  inverse_name: string
}

const emptyForm: FormState = { name: '', inverse_name: '' }

export default function RelationTypesAdmin() {
  const { data: relationTypes, isLoading } = useRelationTypes()
  const createRelationType = useCreateRelationType()
  const deleteRelationType = useDeleteRelationType()

  const [form, setForm] = useState<FormState>(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<RelationType | null>(null)
  const [deleteError, setDeleteError] = useState('')

  function openCreate() {
    setForm(emptyForm)
    setShowForm(true)
    setError('')
  }

  const save = useCallback(async () => {
    setError('')
    if (!form.name.trim() || !form.inverse_name.trim()) {
      setError('Les deux noms sont requis')
      return
    }
    try {
      await createRelationType.mutateAsync({
        name: form.name,
        slug: slugify(form.name),
        inverse_name: form.inverse_name,
        inverse_slug: slugify(form.inverse_name),
      })
      setShowForm(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde')
    }
  }, [form, createRelationType])

  async function handleDelete(rt: RelationType) {
    setDeleteError('')
    try {
      await deleteRelationType.mutateAsync(rt.id)
      setDeleteConfirm(null)
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setDeleteError('Ce type de relation est utilise. Supprimez les relations avant.')
      } else {
        setDeleteError(e instanceof ApiError ? e.message : 'Erreur lors de la suppression')
      }
    }
  }

  if (isLoading) return <p className="text-ink-45">Chargement...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ink">Types de relations</h2>
        <button onClick={openCreate} className="px-4 py-2 bg-blue text-white text-sm font-medium rounded-md hover:bg-blue/90">
          + Nouveau type
        </button>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-10 text-left text-ink-45">
            <th className="py-3 pr-4 font-medium">Nom</th>
            <th className="py-3 pr-4 font-medium">Nom inverse</th>
            <th className="py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {relationTypes?.map((rt) => (
            <tr key={rt.id} className="border-b border-ink-05 even:bg-bg hover:bg-ink-05">
              <td className="py-3 pr-4 font-medium text-ink">{rt.name}</td>
              <td className="py-3 pr-4 text-ink-70">{rt.inverse_name}</td>
              <td className="py-3 text-right">
                <button onClick={() => { setDeleteConfirm(rt); setDeleteError('') }} className="text-red hover:text-red/80 text-sm">Supprimer</button>
              </td>
            </tr>
          ))}
          {(!relationTypes || relationTypes.length === 0) && (
            <tr><td colSpan={3} className="py-8 text-center text-ink-45">Aucun type de relation</td></tr>
          )}
        </tbody>
      </table>

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50" onClick={() => setShowForm(false)}>
          <div className="bg-bg rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink mb-4">Nouveau type de relation</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-70 mb-1">Nom (ex: "heberge sur")</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-ink-10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
                />
                <p className="text-xs text-ink-45 mt-1">Slug: {slugify(form.name) || '—'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-70 mb-1">Nom inverse (ex: "heberge")</label>
                <input
                  type="text"
                  value={form.inverse_name}
                  onChange={(e) => setForm({ ...form, inverse_name: e.target.value })}
                  className="w-full border border-ink-10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
                />
                <p className="text-xs text-ink-45 mt-1">Slug: {slugify(form.inverse_name) || '—'}</p>
              </div>
            </div>

            {error && <p className="text-red text-sm mt-3">{error}</p>}

            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-ink-70 border border-ink-10 rounded-md hover:bg-ink-05">
                Annuler
              </button>
              <button onClick={save} className="px-4 py-2 text-sm text-white bg-blue rounded-md hover:bg-blue/90">
                Creer
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
