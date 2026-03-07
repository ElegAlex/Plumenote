import { useState, useEffect, useCallback } from 'react'
import { api, ApiError } from '@/lib/api'

interface UserRecord {
  id: string
  username: string
  display_name: string
  role: 'public' | 'dsi' | 'admin'
  domain_id: string | null
  domain_name?: string
  last_login: string | null
}

interface Domain {
  id: string
  name: string
}

interface UserForm {
  username: string
  display_name: string
  password: string
  role: 'public' | 'dsi' | 'admin'
  domain_id: string
}

const emptyForm: UserForm = { username: '', display_name: '', password: '', role: 'dsi', domain_id: '' }

const roleBadge: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  dsi: 'bg-blue-100 text-blue-700',
  public: 'bg-gray-100 text-gray-600',
}

function relativeDate(dateStr: string | null): string {
  if (!dateStr) return 'Jamais'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  if (diffDays < 30) return `Il y a ${diffDays} jours`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `Il y a ${diffMonths} mois`
  return `Il y a ${Math.floor(diffMonths / 12)} an(s)`
}

export default function UsersAdmin() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [resetResult, setResetResult] = useState<{ password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get<UserRecord[]>('/admin/users'),
      api.get<Domain[]>('/admin/domains'),
    ])
      .then(([u, d]) => { setUsers(u); setDomains(d) })
      .catch(() => setError('Erreur lors du chargement'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
    setError('')
  }

  function openEdit(u: UserRecord) {
    setEditing(u.id)
    setForm({
      username: u.username,
      display_name: u.display_name,
      password: '',
      role: u.role,
      domain_id: u.domain_id || '',
    })
    setShowForm(true)
    setError('')
  }

  async function save() {
    setError('')
    const payload: Record<string, unknown> = {
      username: form.username,
      display_name: form.display_name,
      role: form.role,
      domain_id: form.domain_id || null,
    }
    if (!editing) {
      payload.password = form.password
    }

    try {
      if (editing) {
        await api.put(`/admin/users/${editing}`, payload)
      } else {
        await api.post('/admin/users', payload)
      }
      setShowForm(false)
      load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde')
    }
  }

  async function resetPassword(userId: string) {
    setError('')
    setCopied(false)
    try {
      const result = await api.post<{ password: string }>(`/admin/users/${userId}/reset-password`, {})
      setResetResult(result)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors de la reinitialisation')
    }
  }

  function copyPassword() {
    if (resetResult) {
      navigator.clipboard.writeText(resetResult.password)
      setCopied(true)
    }
  }

  if (loading) return <p className="text-gray-500">Chargement...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Utilisateurs</h2>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
          + Nouvel utilisateur
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-3 pr-4 font-medium">Nom</th>
            <th className="py-3 pr-4 font-medium">Login</th>
            <th className="py-3 pr-4 font-medium">Role</th>
            <th className="py-3 pr-4 font-medium">Domaine</th>
            <th className="py-3 pr-4 font-medium">Derniere connexion</th>
            <th className="py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-gray-100 even:bg-gray-50 hover:bg-gray-100">
              <td className="py-3 pr-4 font-medium text-gray-900">{u.display_name}</td>
              <td className="py-3 pr-4 text-gray-600">{u.username}</td>
              <td className="py-3 pr-4">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge[u.role]}`}>
                  {u.role}
                </span>
              </td>
              <td className="py-3 pr-4 text-gray-600">{u.domain_name || '-'}</td>
              <td className="py-3 pr-4 text-gray-500 text-xs">{relativeDate(u.last_login)}</td>
              <td className="py-3 text-right space-x-2">
                <button onClick={() => openEdit(u)} className="text-blue-600 hover:text-blue-800 text-sm">Modifier</button>
                <button onClick={() => resetPassword(u.id)} className="text-amber-600 hover:text-amber-800 text-sm">Reinit. MDP</button>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr><td colSpan={6} className="py-8 text-center text-gray-400">Aucun utilisateur</td></tr>
          )}
        </tbody>
      </table>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editing ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Login</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={!!editing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                <input
                  type="text"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {!editing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserForm['role'] })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="public">Public</option>
                  <option value="dsi">DSI</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Domaine</label>
                <select
                  value={form.domain_id}
                  onChange={(e) => setForm({ ...form, domain_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Aucun --</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={save} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700">
                {editing ? 'Enregistrer' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password result modal */}
      {resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Mot de passe temporaire</h3>
            <p className="text-sm text-amber-600 mb-4">Ce mot de passe ne sera plus affiche.</p>
            <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-md p-3">
              <code className="flex-1 text-sm font-mono text-gray-900 select-all">{resetResult.password}</code>
              <button
                onClick={copyPassword}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {copied ? 'Copie !' : 'Copier'}
              </button>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setResetResult(null)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
