import { useState, useEffect, useCallback } from 'react'
import { api, ApiError } from '@/lib/api'

interface Domain {
  id: string
  name: string
  slug: string
  color: string
  icon: string
  doc_count: number
  features_enabled: string[]
}

interface DomainForm {
  name: string
  color: string
  icon: string
  features_enabled: string[]
}

const emptyForm: DomainForm = { name: '', color: '#3B82F6', icon: '', features_enabled: ['documents'] }

export default function DomainsAdmin() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<DomainForm>(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<Domain | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    api.get<Domain[]>('/admin/domains')
      .then(setDomains)
      .catch(() => setError('Erreur lors du chargement des domaines'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
    setError('')
  }

  function openEdit(d: Domain) {
    setEditing(d.id)
    setForm({ name: d.name, color: d.color, icon: d.icon, features_enabled: d.features_enabled || ['documents'] })
    setShowForm(true)
    setError('')
  }

  async function save() {
    setError('')
    try {
      if (editing) {
        await api.put(`/admin/domains/${editing}`, form)
      } else {
        await api.post('/admin/domains', form)
      }
      setShowForm(false)
      load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde')
    }
  }

  async function handleDelete(d: Domain) {
    setDeleteError('')
    try {
      await api.delete(`/admin/domains/${d.id}`)
      setDeleteConfirm(null)
      load()
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setDeleteError(`Ce domaine contient ${d.doc_count} documents. Deplacez-les ou supprimez-les avant de supprimer le domaine.`)
      } else {
        setDeleteError(e instanceof ApiError ? e.message : 'Erreur lors de la suppression')
      }
    }
  }

  if (loading) return <p className="text-ink-45">Chargement...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ink">Domaines</h2>
        <button onClick={openCreate} className="px-4 py-2 bg-blue text-white text-sm font-medium rounded-md hover:bg-blue/90">
          + Nouveau domaine
        </button>
      </div>

      {error && <p className="text-red text-sm mb-4">{error}</p>}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-10 text-left text-ink-45">
            <th className="py-3 pr-4 font-medium">Nom</th>
            <th className="py-3 pr-4 font-medium">Couleur</th>
            <th className="py-3 pr-4 font-medium">Documents</th>
            <th className="py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((d) => (
            <tr key={d.id} className="border-b border-ink-05 even:bg-bg hover:bg-ink-05">
              <td className="py-3 pr-4">
                <span className="flex items-center">
                  <span className="w-3 h-3 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="font-medium text-ink">{d.name}</span>
                </span>
              </td>
              <td className="py-3 pr-4 text-ink-70 font-mono text-xs">{d.color}</td>
              <td className="py-3 pr-4 text-ink-70">{d.doc_count}</td>
              <td className="py-3 text-right space-x-2">
                <button onClick={() => openEdit(d)} className="text-blue hover:text-blue/80 text-sm">Modifier</button>
                <button onClick={() => { setDeleteConfirm(d); setDeleteError('') }} className="text-red hover:text-red/80 text-sm">Supprimer</button>
              </td>
            </tr>
          ))}
          {domains.length === 0 && (
            <tr><td colSpan={4} className="py-8 text-center text-ink-45">Aucun domaine</td></tr>
          )}
        </tbody>
      </table>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50" onClick={() => setShowForm(false)}>
          <div className="bg-bg rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink mb-4">
              {editing ? 'Modifier le domaine' : 'Nouveau domaine'}
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
                <label className="block text-sm font-medium text-ink-70 mb-1">Couleur</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-10 h-10 rounded border border-ink-10 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="flex-1 border border-ink-10 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
                    placeholder="#3B82F6"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-70 mb-1">Icone</label>
                <input
                  type="text"
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  className="w-full border border-ink-10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
                  placeholder="ex: server, shield, code"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-70 mb-1">Features activees</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-ink-45">
                    <input type="checkbox" checked disabled className="accent-blue" />
                    Documents
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={form.features_enabled.includes('cartography')}
                      onChange={(e) => {
                        const features = e.target.checked
                          ? [...form.features_enabled, 'cartography']
                          : form.features_enabled.filter((f) => f !== 'cartography')
                        setForm({ ...form, features_enabled: features })
                      }}
                      className="accent-blue"
                    />
                    Cartographie
                  </label>
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

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-bg rounded-lg shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink mb-2">Confirmer la suppression</h3>
            <p className="text-sm text-ink-70 mb-4">
              Supprimer le domaine "{deleteConfirm.name}" ?
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
