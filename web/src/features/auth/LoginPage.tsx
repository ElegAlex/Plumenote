import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { ApiError } from '@/lib/api'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError('Identifiant ou mot de passe incorrect')
      } else {
        setError('Une erreur est survenue. Veuillez reessayer.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="max-w-md w-full bg-bg rounded-lg shadow-sm border border-ink-10 p-8">
        <h1 className="text-2xl font-bold text-ink text-center mb-2">PlumeNote</h1>
        <p className="text-ink-45 text-center text-sm mb-6">Connectez-vous pour acceder a votre espace</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red/10 border border-red/30 text-red text-sm rounded-md px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-ink-70 mb-1">
              Identifiant
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              className="w-full px-3 py-2 border border-ink-10 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink-70 mb-1">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-ink-10 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 px-4 bg-blue text-white text-sm font-medium rounded-md hover:bg-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}
