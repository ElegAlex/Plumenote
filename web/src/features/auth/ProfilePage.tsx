import { useState, type FormEvent } from 'react'
import { useAuth } from '@/lib/auth-context'
import { api, ApiError } from '@/lib/api'

export default function ProfilePage() {
  const { user } = useAuth()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    setSubmitting(true)
    try {
      await api.put('/auth/password', { old_password: oldPassword, new_password: newPassword })
      setSuccess('Mot de passe modifie avec succes')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError('Mot de passe actuel incorrect')
      } else {
        setError('Une erreur est survenue')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-ink mb-6">Mon profil</h1>

      <div className="bg-bg rounded-lg border border-ink-10 shadow-sm p-6 mb-6">
        <div className="space-y-3">
          <div>
            <span className="text-sm text-ink-45">Nom d'affichage</span>
            <p className="text-sm font-medium text-ink">{user?.display_name}</p>
          </div>
          <div>
            <span className="text-sm text-ink-45">Identifiant</span>
            <p className="text-sm font-medium text-ink">{user?.username}</p>
          </div>
          <div>
            <span className="text-sm text-ink-45">Role</span>
            <p className="text-sm font-medium text-ink capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      <div className="bg-bg rounded-lg border border-ink-10 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-ink mb-4">Changer le mot de passe</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red/10 border border-red/30 text-red text-sm rounded-md px-4 py-3">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-[#2D8B4E]/10 border border-[#2D8B4E]/30 text-[#2D8B4E] text-sm rounded-md px-4 py-3">
              {success}
            </div>
          )}

          <div>
            <label htmlFor="old-password" className="block text-sm font-medium text-ink-70 mb-1">
              Mot de passe actuel
            </label>
            <input
              id="old-password"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-ink-10 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
            />
          </div>

          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-ink-70 mb-1">
              Nouveau mot de passe
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-ink-10 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
            />
            <p className="text-xs text-ink-45 mt-1">Minimum 8 caracteres</p>
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-ink-70 mb-1">
              Confirmer le nouveau mot de passe
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-ink-10 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="py-2 px-4 bg-blue text-white text-sm font-medium rounded-md hover:bg-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  )
}
