import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { X, Plus } from 'lucide-react'

interface Permission { user_id: string; display_name: string; role: string }
interface User { id: string; display_name: string }

interface Props {
  folderId: string
  folderName: string
  onClose: () => void
}

export default function FolderPermissionsModal({ folderId, folderName, onClose }: Props) {
  const [perms, setPerms] = useState<Permission[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [saving, setSaving] = useState(false)
  const [newUserId, setNewUserId] = useState('')
  const [newRole, setNewRole] = useState('reader')

  useEffect(() => {
    api.get<Permission[]>(`/folders/${folderId}/permissions`).then(setPerms).catch(() => {})
    api.get<User[]>('/admin/users').then(setUsers).catch(() => {})
  }, [folderId])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/folders/${folderId}/permissions`, {
        permissions: perms.map((p) => ({ user_id: p.user_id, role: p.role })),
      })
      onClose()
    } catch { /* ignore */ }
    setSaving(false)
  }

  const addUser = () => {
    if (!newUserId) return
    const user = users.find((u) => u.id === newUserId)
    if (!user || perms.some((p) => p.user_id === newUserId)) return
    setPerms([...perms, { user_id: newUserId, display_name: user.display_name, role: newRole }])
    setNewUserId('')
  }

  const removeUser = (userId: string) => {
    setPerms(perms.filter((p) => p.user_id !== userId))
  }

  const changeRole = (userId: string, role: string) => {
    setPerms(perms.map((p) => (p.user_id === userId ? { ...p, role } : p)))
  }

  const availableUsers = users.filter((u) => !perms.some((p) => p.user_id === u.id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-bg border border-ink-10 rounded-xl shadow-xl p-6 w-[32rem] max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">Permissions — {folderName}</h2>
          <button onClick={onClose} className="p-1 hover:bg-ink-05 rounded"><X size={16} /></button>
        </div>

        <div className="space-y-2 mb-4">
          {perms.map((p) => (
            <div key={p.user_id} className="flex items-center gap-3 p-2 border border-ink-05 rounded-lg">
              <span className="flex-1 text-sm text-ink">{p.display_name}</span>
              <select
                value={p.role}
                onChange={(e) => changeRole(p.user_id, e.target.value)}
                className="text-sm border border-ink-10 rounded px-2 py-1"
              >
                <option value="reader">Lecteur</option>
                <option value="editor">Editeur</option>
                <option value="manager">Gestionnaire</option>
              </select>
              <button onClick={() => removeUser(p.user_id)} className="text-red hover:text-red/80">
                <X size={14} />
              </button>
            </div>
          ))}
          {perms.length === 0 && (
            <p className="text-sm text-ink-45">Aucune permission explicite.</p>
          )}
        </div>

        <div className="flex items-center gap-2 mb-4">
          <select
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            className="flex-1 text-sm border border-ink-10 rounded px-2 py-1.5"
          >
            <option value="">Ajouter un utilisateur...</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.display_name}</option>
            ))}
          </select>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="text-sm border border-ink-10 rounded px-2 py-1.5"
          >
            <option value="reader">Lecteur</option>
            <option value="editor">Editeur</option>
            <option value="manager">Gestionnaire</option>
          </select>
          <button onClick={addUser} disabled={!newUserId} className="p-1.5 bg-blue text-white rounded disabled:opacity-50">
            <Plus size={14} />
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md hover:bg-ink-05">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-blue text-white rounded-md hover:bg-blue/90 disabled:opacity-50">
            {saving ? '...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
