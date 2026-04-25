// web/src/features/admin/ConfigAdmin.tsx
// Vue "Configuration" — alignement tokens (couleurs via variables sémantiques).
// Logique API préservée (/admin/config/*).
import { useState, useEffect } from 'react'
import { api, ApiError } from '@/lib/api'
import { useEntityLabel, useUpdateEntityLabel } from '@/lib/hooks'
import {
  Button,
  Card,
  CardBody,
  CardHead,
  CardTitle,
  Field,
  FieldError,
  FieldHint,
  FieldLabel,
  InlineMsg,
  Input,
  TitleEyebrow,
} from '@/components/ui'
import { cn } from '@/lib/cn'

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
      setEntityLabelError('Le label ne peut pas être vide')
      return
    }
    try {
      await updateEntityLabel.mutateAsync(entityLabelValue.trim())
      setEntityLabelSuccess('Label mis à jour')
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
      setFreshnessError('Les seuils doivent être supérieurs à 0')
      return
    }
    if (freshness.green_days >= freshness.yellow_days) {
      setFreshnessError('Le seuil vert doit être inférieur au seuil jaune')
      return
    }
    try {
      await api.put('/admin/config/freshness', freshness)
      setFreshnessSuccess('Seuils mis à jour')
    } catch (e) {
      setFreshnessError(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde')
    }
  }

  async function saveTicketUrl() {
    setTicketError('')
    setTicketSuccess('')
    try {
      await api.put('/admin/config/ticket-url', { url: ticketUrl })
      setTicketSuccess('URL mise à jour')
    } catch (e) {
      setTicketError(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde')
    }
  }

  async function saveMaxVersions() {
    setMaxVersionsSaving(true)
    setMaxVersionsSuccess('')
    try {
      await api.put('/admin/config/max-versions', { max_versions: maxVersions })
      setMaxVersionsSuccess('Rétention mise à jour')
    } catch {
      /* ignore */
    }
    setMaxVersionsSaving(false)
  }

  if (loading) return <p className="text-ink-muted">Chargement...</p>

  return (
    <div className="flex flex-col gap-[18px]">
      <section>
        <TitleEyebrow>Administration</TitleEyebrow>
        <h1 className="font-serif font-semibold text-[28px] leading-[1.15] tracking-[-0.02em] text-navy-900">
          Configuration
        </h1>
        <p className="mt-1.5 text-[13.5px] text-ink-soft leading-[1.55] max-w-[620px]">
          Paramètres globaux : label des fiches, seuils de fraîcheur, URL du portail tickets, rétention des versions.
        </p>
      </section>

      {/* Entity label */}
      <Card className="max-w-[640px]">
        <CardHead>
          <CardTitle>Label des fiches</CardTitle>
        </CardHead>
        <CardBody>
          <Field>
            <FieldLabel>Nom affiché (ex : Fiche, Entité, Composant)</FieldLabel>
            <Input
              value={entityLabelValue}
              onChange={(e) => setEntityLabelValue(e.target.value)}
              placeholder="Fiche"
            />
            {entityLabelError && <FieldError>{entityLabelError}</FieldError>}
            {entityLabelSuccess && <InlineMsg variant="success">{entityLabelSuccess}</InlineMsg>}
          </Field>
          <div className="mt-4">
            <Button variant="primary" onClick={saveEntityLabel}>
              Sauvegarder
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Freshness */}
      <Card className="max-w-[640px]">
        <CardHead>
          <CardTitle>Seuils de fraîcheur</CardTitle>
        </CardHead>
        <CardBody>
          <div className="flex flex-col gap-3.5">
            <FreshnessRow
              colorClass="bg-success"
              label="Frais : moins de"
              value={freshness.green_days}
              onChange={(n) => setFreshness({ ...freshness, green_days: n })}
            />
            <FreshnessRow
              colorClass="bg-warn"
              label="À vérifier : jusqu'à"
              value={freshness.yellow_days}
              onChange={(n) => setFreshness({ ...freshness, yellow_days: n })}
            />
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-danger shrink-0" aria-hidden />
              <span className="text-[13px] text-ink-soft w-[160px] shrink-0">Périmé : plus de</span>
              <span className="text-[13px] text-ink font-semibold">{freshness.yellow_days} jours</span>
            </div>

            {freshnessError && <FieldError>{freshnessError}</FieldError>}
            {freshnessSuccess && <InlineMsg variant="success">{freshnessSuccess}</InlineMsg>}
          </div>
          <div className="mt-4">
            <Button variant="primary" onClick={saveFreshness}>
              Sauvegarder
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Ticket URL */}
      <Card className="max-w-[640px]">
        <CardHead>
          <CardTitle>URL du système de tickets</CardTitle>
        </CardHead>
        <CardBody>
          <Field>
            <FieldLabel>URL du portail de tickets (GLPI)</FieldLabel>
            <Input
              value={ticketUrl}
              onChange={(e) => setTicketUrl(e.target.value)}
              placeholder="https://glpi.example.com/front/ticket.form.php"
            />
            {ticketError && <FieldError>{ticketError}</FieldError>}
            {ticketSuccess && <InlineMsg variant="success">{ticketSuccess}</InlineMsg>}
          </Field>
          <div className="mt-4">
            <Button variant="primary" onClick={saveTicketUrl}>
              Sauvegarder
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Max versions */}
      <Card className="max-w-[640px]">
        <CardHead>
          <CardTitle>Rétention des versions</CardTitle>
        </CardHead>
        <CardBody>
          <Field>
            <FieldLabel>Nombre de versions conservées par document</FieldLabel>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                value={maxVersions}
                onChange={(e) => setMaxVersions(Number(e.target.value))}
                className="max-w-[120px]"
                inputClassName="text-center"
              />
              <span className="text-[13px] text-ink-muted">versions max par document</span>
            </div>
            <FieldHint>Les versions les plus anciennes sont purgées automatiquement.</FieldHint>
            {maxVersionsSuccess && <InlineMsg variant="success">{maxVersionsSuccess}</InlineMsg>}
          </Field>
          <div className="mt-4">
            <Button variant="primary" onClick={saveMaxVersions} disabled={maxVersionsSaving}>
              {maxVersionsSaving ? '...' : 'Sauvegarder'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

function FreshnessRow({
  colorClass,
  label,
  value,
  onChange,
}: {
  colorClass: string
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn('w-3 h-3 rounded-full shrink-0', colorClass)} aria-hidden />
      <label className="text-[13px] text-ink-soft w-[160px] shrink-0">{label}</label>
      <Input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="max-w-[100px]"
        inputClassName="text-center !py-[7px]"
      />
      <span className="text-[13px] text-ink-muted">jours</span>
    </div>
  )
}
