import { useState, useEffect } from 'react'
import { api, ApiError } from '@/lib/api'

interface FreshnessConfig {
  green_days: number
  yellow_days: number
}

interface TicketUrlConfig {
  url: string
}

export default function ConfigAdmin() {
  const [freshness, setFreshness] = useState<FreshnessConfig>({ green_days: 30, yellow_days: 180 })
  const [ticketUrl, setTicketUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [freshnessError, setFreshnessError] = useState('')
  const [freshnessSuccess, setFreshnessSuccess] = useState('')
  const [ticketError, setTicketError] = useState('')
  const [ticketSuccess, setTicketSuccess] = useState('')

  useEffect(() => {
    Promise.all([
      api.get<FreshnessConfig>('/admin/config/freshness'),
      api.get<TicketUrlConfig>('/admin/config/ticket-url'),
    ])
      .then(([f, t]) => {
        setFreshness(f)
        setTicketUrl(t.url)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function saveFreshness() {
    setFreshnessError('')
    setFreshnessSuccess('')

    if (freshness.green_days <= 0 || freshness.yellow_days <= 0) {
      setFreshnessError('Les seuils doivent etre superieurs a 0')
      return
    }
    if (freshness.green_days >= freshness.yellow_days) {
      setFreshnessError('Le seuil vert doit etre inferieur au seuil jaune')
      return
    }

    try {
      await api.put('/admin/config/freshness', freshness)
      setFreshnessSuccess('Seuils mis a jour')
    } catch (e) {
      setFreshnessError(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde')
    }
  }

  async function saveTicketUrl() {
    setTicketError('')
    setTicketSuccess('')
    try {
      await api.put('/admin/config/ticket-url', { url: ticketUrl })
      setTicketSuccess('URL mise a jour')
    } catch (e) {
      setTicketError(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde')
    }
  }

  if (loading) return <p className="text-gray-500">Chargement...</p>

  return (
    <div className="space-y-8">
      {/* Freshness thresholds */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Seuils de fraicheur</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4 max-w-lg">
          <div className="flex items-center space-x-3">
            <span className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
            <label className="text-sm text-gray-700 flex-shrink-0 w-40">Frais : moins de</label>
            <input
              type="number"
              min={1}
              value={freshness.green_days}
              onChange={(e) => setFreshness({ ...freshness, green_days: parseInt(e.target.value) || 0 })}
              className="w-20 border border-gray-300 rounded-md px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-sm text-gray-500">jours</span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="w-3 h-3 rounded-full bg-yellow-400 flex-shrink-0" />
            <label className="text-sm text-gray-700 flex-shrink-0 w-40">A verifier : jusqu'a</label>
            <input
              type="number"
              min={1}
              value={freshness.yellow_days}
              onChange={(e) => setFreshness({ ...freshness, yellow_days: parseInt(e.target.value) || 0 })}
              className="w-20 border border-gray-300 rounded-md px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-sm text-gray-500">jours</span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
            <label className="text-sm text-gray-700 flex-shrink-0 w-40">Perime : plus de</label>
            <span className="text-sm text-gray-600 font-medium">{freshness.yellow_days} jours</span>
          </div>

          {freshnessError && <p className="text-red-600 text-sm">{freshnessError}</p>}
          {freshnessSuccess && <p className="text-green-600 text-sm">{freshnessSuccess}</p>}

          <button onClick={saveFreshness} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
            Sauvegarder
          </button>
        </div>
      </section>

      {/* Ticket URL */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">URL du systeme de tickets</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL du portail de tickets (GLPI)</label>
            <input
              type="text"
              value={ticketUrl}
              onChange={(e) => setTicketUrl(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://glpi.example.com/front/ticket.form.php"
            />
          </div>

          {ticketError && <p className="text-red-600 text-sm">{ticketError}</p>}
          {ticketSuccess && <p className="text-green-600 text-sm">{ticketSuccess}</p>}

          <button onClick={saveTicketUrl} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
            Sauvegarder
          </button>
        </div>
      </section>
    </div>
  )
}
