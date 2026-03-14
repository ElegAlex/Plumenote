import { useState } from 'react'
import { api } from '@/lib/api'

interface Props {
  domainId: string
  parentId: string | null
  onCreated: () => void
  onClose: () => void
}

export default function CreateFolderModal({ domainId, parentId, onCreated, onClose }: Props) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      await api.post('/folders', { name: name.trim(), domain_id: domainId, parent_id: parentId })
      onCreated()
    } catch {
      setError('Erreur lors de la creation')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-bg border border-ink-10 rounded-xl shadow-xl p-6 w-96">
        <h2 className="text-lg font-semibold text-ink mb-4">Nouveau dossier</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du dossier"
          className="w-full border border-ink-10 rounded-md px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        {error && <p className="text-red text-sm mb-3">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md hover:bg-ink-05">
            Annuler
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm bg-blue text-white rounded-md hover:bg-blue/90 disabled:opacity-50"
          >
            {saving ? '...' : 'Creer'}
          </button>
        </div>
      </div>
    </div>
  )
}
