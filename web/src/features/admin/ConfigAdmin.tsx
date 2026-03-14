import { useState, useEffect } from 'react'
import { api, ApiError } from '@/lib/api'
import { useEntityLabel, useUpdateEntityLabel } from '@/lib/hooks'

interface FreshnessConfig {
  green_days: number
  yellow_days: number
}

interface TicketUrlConfig {
  url: string
}

export default function ConfigAdmin() {
  const { data: entityLabelConfig } = useEntityLabel()
  const updateEntityLabel = useUpdateEntityLabel()
  const [entityLabelValue, setEntityLabelValue] = useState('')
  const [entityLabelSuccess, setEntityLabelSuccess] = useState('')
  const [entityLabelError, setEntityLabelError] = useState('')

  useEffect(() => {
    if (entityLabelConfig) setEntityLabelValue(entityLabelConfig.label)
  }, [entityLabelConfig])

  async function saveEntityLabel() {
    setEntityLabelError('')
    setEntityLabelSuccess('')
    if (!entityLabelValue.trim()) {
      setEntityLabelError('Le label ne peut pas etre vide')
      return
    }
    try {
      await updateEntityLabel.mutateAsync(entityLabelValue.trim())
      setEntityLabelSuccess('Label mis a jour')
    } catch (e) {
      setEntityLabelError(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde')
    }
  }

  const [freshness, setFreshness] = useState<FreshnessConfig>({ green_days: 30, yellow_days: 180 })
  const [ticketUrl, setTicketUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [freshnessError, setFreshnessError] = useState('')
  const [freshnessSuccess, setFreshnessSuccess] = useState('')
  const [ticketError, setTicketError] = useState('')
  const [ticketSuccess, setTicketSuccess] = useState('')
  const [maxVersions, setMaxVersions] = useState(50)
  const [maxVersionsSaving, setMaxVersionsSaving] = useState(false)
  const [maxVersionsSuccess, setMaxVersionsSuccess] = useState('')

  useEffect(() => {
    Promise.all([
      api.get<FreshnessConfig>('/admin/config/freshness'),
      api.get<TicketUrlConfig>('/admin/config/ticket-url'),
      api.get<{ max_versions: number }>('/admin/config/max-versions'),
    ])
      .then(([f, t, mv]) => {
        setFreshness(f)
        setTicketUrl(t.url)
        setMaxVersions(mv.max_versions)
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

  async function saveMaxVersions() {
    setMaxVersionsSaving(true)
    setMaxVersionsSuccess('')
    try {
      await api.put('/admin/config/max-versions', { max_versions: maxVersions })
      setMaxVersionsSuccess('Retention mise a jour')
    } catch { /* ignore */ }
    setMaxVersionsSaving(false)
  }

  if (loading) return <p className="text-ink-45">Chargement...</p>

  return (
    <div className="space-y-8">
      {/* Entity Label */}
      <section>
        <h2 className="text-lg font-semibold text-ink mb-4">Label des fiches</h2>
        <div className="bg-bg border border-ink-10 rounded-lg p-6 space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-ink-70 mb-1">Nom affiche (ex: Fiche, Entite, Composant)</label>
            <input
              type="text"
              value={entityLabelValue}
              onChange={(e) => setEntityLabelValue(e.target.value)}
              className="w-full border border-ink-10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
              placeholder="Fiche"
            />
          </div>

          {entityLabelError && <p className="text-red text-sm">{entityLabelError}</p>}
          {entityLabelSuccess && <p className="text-[#2D8B4E] text-sm">{entityLabelSuccess}</p>}

          <button onClick={saveEntityLabel} className="px-4 py-2 bg-blue text-white text-sm font-medium rounded-md hover:bg-blue/90">
            Sauvegarder
          </button>
        </div>
      </section>

      {/* Freshness thresholds */}
      <section>
        <h2 className="text-lg font-semibold text-ink mb-4">Seuils de fraicheur</h2>
        <div className="bg-bg border border-ink-10 rounded-lg p-6 space-y-4 max-w-lg">
          <div className="flex items-center space-x-3">
            <span className="w-3 h-3 rounded-full bg-[#2D8B4E]/100 flex-shrink-0" />
            <label className="text-sm text-ink-70 flex-shrink-0 w-40">Frais : moins de</label>
            <input
              type="number"
              min={1}
              value={freshness.green_days}
              onChange={(e) => setFreshness({ ...freshness, green_days: parseInt(e.target.value) || 0 })}
              className="w-20 border border-ink-10 rounded-md px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
            />
            <span className="text-sm text-ink-45">jours</span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="w-3 h-3 rounded-full bg-yellow-400 flex-shrink-0" />
            <label className="text-sm text-ink-70 flex-shrink-0 w-40">A verifier : jusqu'a</label>
            <input
              type="number"
              min={1}
              value={freshness.yellow_days}
              onChange={(e) => setFreshness({ ...freshness, yellow_days: parseInt(e.target.value) || 0 })}
              className="w-20 border border-ink-10 rounded-md px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
            />
            <span className="text-sm text-ink-45">jours</span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="w-3 h-3 rounded-full bg-red/100 flex-shrink-0" />
            <label className="text-sm text-ink-70 flex-shrink-0 w-40">Perime : plus de</label>
            <span className="text-sm text-ink-70 font-medium">{freshness.yellow_days} jours</span>
          </div>

          {freshnessError && <p className="text-red text-sm">{freshnessError}</p>}
          {freshnessSuccess && <p className="text-[#2D8B4E] text-sm">{freshnessSuccess}</p>}

          <button onClick={saveFreshness} className="px-4 py-2 bg-blue text-white text-sm font-medium rounded-md hover:bg-blue/90">
            Sauvegarder
          </button>
        </div>
      </section>

      {/* Ticket URL */}
      <section>
        <h2 className="text-lg font-semibold text-ink mb-4">URL du systeme de tickets</h2>
        <div className="bg-bg border border-ink-10 rounded-lg p-6 space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-ink-70 mb-1">URL du portail de tickets (GLPI)</label>
            <input
              type="text"
              value={ticketUrl}
              onChange={(e) => setTicketUrl(e.target.value)}
              className="w-full border border-ink-10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
              placeholder="https://glpi.example.com/front/ticket.form.php"
            />
          </div>

          {ticketError && <p className="text-red text-sm">{ticketError}</p>}
          {ticketSuccess && <p className="text-[#2D8B4E] text-sm">{ticketSuccess}</p>}

          <button onClick={saveTicketUrl} className="px-4 py-2 bg-blue text-white text-sm font-medium rounded-md hover:bg-blue/90">
            Sauvegarder
          </button>
        </div>
      </section>

      {/* Version retention */}
      <section>
        <h2 className="text-lg font-semibold text-ink mb-4">Retention des versions</h2>
        <div className="bg-bg border border-ink-10 rounded-lg p-6 space-y-4 max-w-lg">
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              value={maxVersions}
              onChange={(e) => setMaxVersions(Number(e.target.value))}
              className="w-20 border border-ink-10 rounded-md px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
            />
            <span className="text-sm text-ink-45">versions max par document</span>
          </div>

          {maxVersionsSuccess && <p className="text-[#2D8B4E] text-sm">{maxVersionsSuccess}</p>}

          <button
            onClick={saveMaxVersions}
            disabled={maxVersionsSaving}
            className="px-4 py-2 bg-blue text-white text-sm font-medium rounded-md hover:bg-blue/90 disabled:opacity-50"
          >
            {maxVersionsSaving ? '...' : 'Sauvegarder'}
          </button>
        </div>
      </section>
    </div>
  )
}
