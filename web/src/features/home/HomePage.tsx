import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Code2,
  Edit3,
  Eye,
  FileText,
  Headphones,
  Layers,
  Plus,
  Search,
  TrendingUp,
  Upload,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { useFeed, useReviews, useStatsHealth } from '@/lib/hooks'
import type { DocumentSummary, ReviewItem, Stats } from '@/lib/types'
import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHead,
  CardTitle,
  FreshBadge,
  Kbd,
  Timeline,
  TimelineEvent,
} from '@/components/ui'
import type { ShellOutletContext } from '@/components/layout/Shell'
import { cn } from '@/lib/cn'

/**
 * HomePage — tableau de bord DSI authentifié (gabarit g2-accueil-dsi).
 *
 * Rendue à l'intérieur du Shell applicatif (Topbar + Sidebar déjà présents).
 * Cette page démarre au niveau `.content` du gabarit g2.
 *
 * Structure :
 *  1. Greeting banner navy/coral avec meta-chips dynamiques
 *  2. KPI grid 4-col (Consultations / Recherches / À vérifier / Contributions)
 *  3. Layout 2-col :
 *     - Gauche : Récemment modifiés + Activité récente
 *     - Droite : Vos domaines + Périmés + hint Ctrl+K
 *
 * Câblage API :
 *  - `/api/stats` → greeting + KPI
 *  - `/api/stats/health` → red count (fraîcheur)
 *  - `/api/feed` → récemment modifiés (hook useFeed)
 *  - `/api/reviews/pending` → périmés (hook useReviews)
 *  - `/api/domains` → mini grid domaines
 *  - TODO Vague 3+ : `/api/activity` pour l'activité récente
 *  - TODO Vague 3+ : endpoint consultations 7j (actuellement hardcodé)
 */

// =========================================================================
// Types
// =========================================================================

interface DomainLite {
  id: string
  name: string
  slug: string
  color: string
  doc_count: number
  entity_count: number
}

interface DocRowData {
  id: string
  slug: string
  title: string
  domain_name: string
  domain_slug: string
  type_name?: string
  author_name: string
  updated_at: string
  view_count: number
  freshness_badge: 'green' | 'yellow' | 'red'
}

// =========================================================================
// Helpers
// =========================================================================

const DOMAIN_ICONS: Record<string, LucideIcon> = {
  infrastructure: Layers,
  infra: Layers,
  support: Headphones,
  sci: FileText,
  etudes: Code2,
  'etudes-dev': Code2,
  data: BarChart3,
}

const DOC_ICON_VARIANTS: Record<string, string> = {
  infrastructure: 'bg-coral-bg text-coral',
  infra: 'bg-coral-bg text-coral',
  support: 'bg-success-bg text-success',
  sci: 'bg-navy-50 text-navy-700',
  etudes: 'bg-plum-bg text-plum',
  'etudes-dev': 'bg-plum-bg text-plum',
  data: 'bg-cream-light text-navy-700',
}

const DOMAIN_DOT_COLORS: Record<string, string> = {
  infrastructure: 'bg-coral',
  infra: 'bg-coral',
  support: 'bg-success',
  sci: 'bg-navy-700',
  etudes: 'bg-plum',
  'etudes-dev': 'bg-plum',
  data: 'bg-navy-600',
}

function iconForDomain(slug: string): LucideIcon {
  return DOMAIN_ICONS[slug.toLowerCase()] ?? FileText
}

function docIconVariant(slug: string): string {
  return DOC_ICON_VARIANTS[slug.toLowerCase()] ?? 'bg-cream-light text-navy-700'
}

function domainDotColor(slug: string): string {
  return DOMAIN_DOT_COLORS[slug.toLowerCase()] ?? 'bg-navy-700'
}

function freshStatus(badge: 'green' | 'yellow' | 'red'): 'ok' | 'warn' | 'danger' {
  if (badge === 'green') return 'ok'
  if (badge === 'yellow') return 'warn'
  return 'danger'
}

function freshLabel(badge: 'green' | 'yellow' | 'red', updatedAt: string): string {
  if (badge === 'green') return 'À jour'
  const d = new Date(updatedAt)
  const months = Math.max(1, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
  return `${months} mois`
}

function timeAgoShort(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffH < 24) return `il y a ${diffH} h`
  if (diffH < 48) return 'hier'
  if (diffD < 30) return `il y a ${diffD} j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

// Domain fresh split (ok/warn/danger). L'endpoint actuel n'expose pas le
// split par domaine ; on fallback sur une répartition indicative tant que
// la Vague 3 n'ajoute pas /api/domains/health.
// TODO(V3) : brancher /api/domains/health pour le split réel ; aujourd'hui 82/12/6% forfaitaire.
function domainFreshSplit(docCount: number): { ok: number; warn: number; danger: number } {
  if (docCount === 0) return { ok: 0, warn: 0, danger: 0 }
  const ok = Math.round(docCount * 0.82)
  const warn = Math.round(docCount * 0.12)
  const danger = Math.max(0, docCount - ok - warn)
  return { ok, warn, danger }
}

// =========================================================================
// Component
// =========================================================================

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  // Ouverture de la palette Ctrl+K : le Shell expose son `search.open` via
  // le contexte Outlet de react-router. Évite le KeyboardEvent synthétique
  // (isTrusted = false, double-trigger potentiel) et ne duplique pas
  // l'instance de `useSearchModal` (hook à état local, non global).
  const { onSearchOpen } = useOutletContext<ShellOutletContext>()

  // === Data ===
  const [stats, setStats] = useState<Stats | null>(null)
  const [domains, setDomains] = useState<DomainLite[]>([])
  const { data: statsHealth } = useStatsHealth()
  const {
    data: recentFeed,
    isLoading: recentLoading,
    isError: recentError,
  } = useFeed({ limit: 5 })
  const {
    data: reviewItems,
    isLoading: reviewsLoading,
    isError: reviewsError,
  } = useReviews({ limit: 4 })

  useEffect(() => {
    api.get<Stats>('/stats').then(setStats).catch(() => {})
    api.get<DomainLite[]>('/domains').then(setDomains).catch(() => {})
  }, [])

  const firstName = useMemo(() => {
    if (!user) return ''
    const raw = user.display_name?.trim() || user.username
    return raw.split(' ')[0] || raw
  }, [user])

  const totalDocs = stats?.documents ?? 0
  const redCount = statsHealth?.red ?? 0
  const updatesMonth = stats?.updates_month ?? 0
  const searchesMonth = stats?.searches_month ?? 0
  const contributors = stats?.contributors ?? 0
  // TODO Vague 3+ : endpoint brouillons (WIP / drafts)
  const draftsCount = 4

  const recentDocs: DocRowData[] = useMemo(() => {
    if (!recentFeed) return []
    return recentFeed.slice(0, 5).map((d: DocumentSummary) => ({
      id: d.id,
      slug: d.slug,
      title: d.title,
      domain_name: d.domain_name,
      domain_slug: domainSlugFromName(domains, d.domain_name),
      type_name: d.type_name,
      author_name: d.author_name,
      updated_at: d.updated_at,
      view_count: d.view_count,
      freshness_badge: d.freshness_badge,
    }))
  }, [recentFeed, domains])

  const urgentDocs = useMemo(() => {
    if (!reviewItems) return []
    return reviewItems.slice(0, 4).map((d: ReviewItem) => ({
      id: d.id,
      slug: d.slug,
      title: d.title,
      domain_name: d.domain_name,
      updated_at: d.updated_at,
    }))
  }, [reviewItems])

  // =======================================================================
  // Render
  // =======================================================================

  return (
    <main className="flex flex-col gap-[22px] px-8 pt-7 pb-12 max-w-[1480px] w-full mx-auto">
      {/* 1. Greeting */}
      <GreetingBanner
        firstName={firstName}
        totalDocs={totalDocs}
        redCount={redCount}
        draftsCount={draftsCount}
        contributors={contributors}
        onCreate={() => navigate('/documents/new')}
        onImport={() => navigate('/import')}
      />

      {/* 2. KPI grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <KpiTile
          label="Consultations / 7j"
          value="1 247"
          trend={{ direction: 'up', label: '+18% vs. semaine précédente' }}
          icon={<Eye />}
          iconVariant="navy"
          // TODO Vague 3+ : brancher /api/analytics/views-7d
        />
        <KpiTile
          label="Recherches (mois)"
          value={searchesMonth.toLocaleString('fr-FR')}
          trend={{ direction: 'up', label: 'Palette Ctrl+K active' }}
          icon={<Search />}
          iconVariant="coral"
        />
        <KpiTile
          label="À vérifier"
          value={redCount.toLocaleString('fr-FR')}
          trend={{
            direction: redCount > 0 ? 'down' : 'neutral',
            label: redCount > 0 ? 'Fiches périmées à revoir' : 'Aucun document périmé',
          }}
          icon={<AlertTriangle />}
          iconVariant="danger"
        />
        <KpiTile
          label="Contributions (mois)"
          value={updatesMonth.toLocaleString('fr-FR')}
          trend={{ direction: 'neutral', label: `${contributors} contributeurs actifs` }}
          icon={<Edit3 />}
          iconVariant="plum"
        />
      </section>

      {/* 3. Layout 2-col */}
      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] gap-[22px]">
        {/* LEFT */}
        <div className="flex flex-col gap-[22px] min-w-0">
          <RecentDocsPanel
            docs={recentDocs}
            isLoading={recentLoading}
            isError={recentError}
          />
          <ActivityPanel />
        </div>

        {/* RIGHT */}
        <aside className="flex flex-col gap-4 min-w-0">
          <DomainsMiniGrid domains={domains} />
          <UrgentDocsPanel
            docs={urgentDocs}
            totalRed={redCount}
            isLoading={reviewsLoading}
            isError={reviewsError}
          />
          <CtrlKHint onOpen={onSearchOpen} />
        </aside>
      </section>
    </main>
  )
}

// =========================================================================
// Subcomponents
// =========================================================================

function GreetingBanner({
  firstName,
  totalDocs,
  redCount,
  draftsCount,
  contributors,
  onCreate,
  onImport,
}: {
  firstName: string
  totalDocs: number
  redCount: number
  draftsCount: number
  contributors: number
  onCreate: () => void
  onImport: () => void
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[20px] px-8 py-7 text-cream',
      )}
      style={{
        // Gabarit g2 : linear-gradient 120deg avec navy-700 positionné à 60%
        // (Tailwind `to-br` = 135deg et `via` sans stop = 50%, écart visible)
        background:
          'linear-gradient(120deg, var(--color-navy-900) 0%, var(--color-navy-700) 60%, var(--color-navy-600) 100%)',
      }}
    >
      {/* halo coral décoratif haut-droite */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 w-[320px] h-[320px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(232,132,92,0.22), transparent 60%)',
        }}
      />
      <div className="relative z-[1] flex flex-wrap items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="font-serif text-[28px] font-medium leading-[1.15] tracking-[-0.01em] text-white mb-1.5">
            Bonjour{firstName ? ` ${firstName}` : ''},<br />
            {totalDocs} documents <em className="italic font-medium text-coral-soft">sont consultables</em>.
          </h1>
          <p className="text-[13.5px] leading-[1.5] max-w-[620px] text-navy-fg-soft">
            {redCount > 0
              ? `${redCount} fiches sont signalées périmées et attendent une vérification.`
              : 'Aucune fiche en alerte de fraîcheur.'}{' '}
            {draftsCount > 0 ? `${draftsCount} contributions sont en brouillon. ` : ''}
            Les équipes contribuent activement à la base de connaissances.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 mt-3.5">
            <GreetingChip strong={totalDocs} label="documents indexés" />
            <GreetingChip strong={redCount} label="à vérifier" coral />
            <GreetingChip strong={draftsCount} label="brouillons" />
            <GreetingChip strong={contributors} label="contributeurs DSI" />
          </div>
        </div>
        <div className="flex gap-2.5">
          <Button variant="cta" leftIcon={<Plus />} onClick={onCreate}>
            Nouveau document
          </Button>
          {/*
            Bouton "Importer" sur fond navy : la primitive Button n'expose pas
            de variant `onDark` (styles destinés à un fond clair). On conserve
            un <button> custom pour préserver le contraste sur le gradient g2.
            TODO(V3) : extraire variant="onDark" sur Button si le pattern se répète.
          */}
          <button
            type="button"
            onClick={onImport}
            className={cn(
              'inline-flex items-center gap-2 px-[18px] py-[12px] rounded-xl',
              'bg-white/10 text-cream border border-white/20 font-semibold text-[13px] font-sans',
              'hover:bg-white/15 hover:border-white/30 transition-colors cursor-pointer',
              '[&_svg]:w-[15px] [&_svg]:h-[15px]',
            )}
          >
            <Upload />
            Importer
          </button>
        </div>
      </div>
    </section>
  )
}

function GreetingChip({ strong, label, coral }: { strong: number; label: string; coral?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full',
        'text-[11.5px] font-semibold text-cream',
        coral
          ? 'bg-coral/25 border border-coral/35'
          : 'bg-white/10 border border-white/15',
      )}
    >
      <strong className="font-bold tabular-nums text-white">{strong.toLocaleString('fr-FR')}</strong>
      {label}
    </span>
  )
}

type KpiVariant = 'navy' | 'coral' | 'danger' | 'plum'

const KPI_ICON_STYLES: Record<KpiVariant, string> = {
  navy: 'bg-cream-light text-navy-800',
  coral: 'bg-coral-bg text-coral',
  danger: 'bg-danger-bg text-danger',
  plum: 'bg-plum-bg text-plum',
}

function KpiTile({
  label,
  value,
  trend,
  icon,
  iconVariant,
}: {
  label: string
  value: string
  trend: { direction: 'up' | 'down' | 'neutral'; label: string }
  icon: React.ReactNode
  iconVariant: KpiVariant
}) {
  const trendColor =
    trend.direction === 'up'
      ? 'text-success'
      : trend.direction === 'down'
        ? 'text-danger'
        : 'text-ink-soft'
  return (
    <div
      className={cn(
        'bg-white border border-line rounded-2xl p-[18px] px-5 flex flex-col gap-2',
        'transition-[transform,border-color,box-shadow]',
        'hover:-translate-y-0.5 hover:border-navy-600 hover:shadow-[0_10px_25px_rgba(20,35,92,0.06)]',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">
          {label}
        </span>
        <span
          className={cn(
            'w-7 h-7 rounded-lg grid place-items-center shrink-0',
            KPI_ICON_STYLES[iconVariant],
            '[&_svg]:w-[14px] [&_svg]:h-[14px]',
          )}
        >
          {icon}
        </span>
      </div>
      <div className="font-serif font-semibold text-[38px] leading-none text-navy-900 tabular-nums tracking-[-0.02em]">
        {value}
      </div>
      <div className={cn('flex items-center gap-1.5 text-[11.5px] font-medium', trendColor)}>
        {trend.direction === 'up' && <TrendingUp className="w-3 h-3" strokeWidth={2.5} />}
        {trend.direction === 'down' && (
          <TrendingUp className="w-3 h-3 rotate-180" strokeWidth={2.5} />
        )}
        <span>{trend.label}</span>
      </div>
    </div>
  )
}

function RecentDocsPanel({
  docs,
  isLoading,
  isError,
}: {
  docs: DocRowData[]
  isLoading?: boolean
  isError?: boolean
}) {
  const navigate = useNavigate()
  const showLoading = !!isLoading && docs.length === 0
  const showError = !!isError && !isLoading
  return (
    <Card>
      <CardHead>
        <CardTitle>
          Récemment modifiés
          {docs.length > 0 && (
            <span className="ml-2.5 bg-cream text-navy-800 font-sans text-[11.5px] font-bold px-2 py-0.5 rounded-md tabular-nums">
              {docs.length}
            </span>
          )}
        </CardTitle>
        <Link
          to="/search"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-navy-700 hover:text-coral transition-colors"
        >
          Tous les documents
          <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
        </Link>
      </CardHead>
      <CardBody padded={false}>
        {showLoading ? (
          <div className="px-[22px] py-8 text-center text-[12px] font-mono text-ink-muted">
            Chargement…
          </div>
        ) : showError ? (
          <div className="px-[22px] py-4">
            <Callout variant="danger" title="Impossible de charger.">
              Les documents récents n'ont pas pu être récupérés. Réessayez dans un instant.
            </Callout>
          </div>
        ) : docs.length === 0 ? (
          <div className="px-[22px] py-8 text-center text-[12px] font-mono text-ink-muted">
            Aucun document récent
          </div>
        ) : (
          docs.map((doc) => {
            const Icon = iconForDomain(doc.domain_slug)
            const iconCls = docIconVariant(doc.domain_slug)
            const status = freshStatus(doc.freshness_badge)
            const label = freshLabel(doc.freshness_badge, doc.updated_at)
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => navigate(`/documents/${doc.slug}`)}
                className={cn(
                  'w-full grid grid-cols-[auto_1fr_auto_auto] items-center gap-3.5',
                  'px-[22px] py-3 border-b border-line-soft last:border-b-0',
                  'text-left cursor-pointer transition-colors hover:bg-cream-light',
                )}
              >
                <span
                  className={cn(
                    'w-9 h-9 rounded-[9px] grid place-items-center shrink-0',
                    iconCls,
                    '[&_svg]:w-4 [&_svg]:h-4',
                  )}
                >
                  <Icon />
                </span>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-ink leading-snug truncate">
                    {doc.title}
                  </div>
                  <div className="text-[11.5px] text-ink-soft mt-0.5 flex items-center gap-1.5 truncate">
                    <span>{doc.domain_name}</span>
                    {doc.type_name && (
                      <>
                        <span className="text-ink-muted">·</span>
                        <span>{doc.type_name}</span>
                      </>
                    )}
                    <span className="text-ink-muted">·</span>
                    <span>{doc.author_name}</span>
                    <span className="text-ink-muted">·</span>
                    <span>{timeAgoShort(doc.updated_at)}</span>
                  </div>
                </div>
                <FreshBadge status={status}>{label}</FreshBadge>
                <span className="text-[11.5px] text-ink-muted tabular-nums inline-flex items-center gap-1.5">
                  <Eye className="w-[13px] h-[13px]" />
                  {doc.view_count.toLocaleString('fr-FR')}
                </span>
              </button>
            )
          })
        )}
      </CardBody>
    </Card>
  )
}

function ActivityPanel() {
  // TODO Vague 3+ : brancher `/api/activity?limit=4`.
  // Événements hardcodés alignés sur le gabarit g2.
  return (
    <Card>
      <CardHead>
        <CardTitle>Activité récente</CardTitle>
        {/* TODO Vague 3+ : route /journal (vue journal complet des activités). */}
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          aria-disabled="true"
          className="group inline-flex items-center gap-1 text-[13px] font-semibold text-navy-700 transition-colors hover:text-coral cursor-not-allowed opacity-60"
          aria-label="Voir le journal complet (bientôt)"
          title="Journal complet — bientôt disponible"
        >
          Journal complet
          <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-[3px]" strokeWidth={2.5} />
        </a>
      </CardHead>
      <CardBody>
        <Timeline>
          <TimelineEvent
            status="done"
            label="Mohamed Zemouche a marqué comme vérifié « Configurer VPN Always-On »"
            meta="aujourd'hui à 14:32 · Infrastructure · badge repasse en vert"
          />
          <TimelineEvent
            status="coral"
            icon={<Edit3 className="w-[10px] h-[10px]" strokeWidth={2.5} />}
            label="Didier Bottaz a publié « Accueil passeport — mode opératoire 2026 »"
            meta="hier à 17:11 · SCI · 2 nouveaux liens entrants"
          />
          <TimelineEvent
            status="navy"
            icon={<Upload className="w-[10px] h-[10px]" strokeWidth={2.5} />}
            label="Import dossier « Procedures-SCI » terminé"
            meta="21/04 à 10:47 · 47 documents importés · 2 erreurs (PDF scannés)"
          />
          <TimelineEvent
            status="upcoming"
            icon={<Edit3 className="w-[10px] h-[10px]" strokeWidth={2.5} />}
            label="Lilian Hammache a modifié « Architecture BookStack — retour d'expérience »"
            meta="20/04 à 09:03 · Études & Dev · 3 sections remaniées"
          />
        </Timeline>
      </CardBody>
    </Card>
  )
}

function DomainsMiniGrid({ domains }: { domains: DomainLite[] }) {
  const shown = domains.filter((d) => d.slug !== 'templates').slice(0, 4)
  return (
    <Card>
      <CardHead>
        <CardTitle className="text-[15px]">Vos domaines</CardTitle>
        <Link
          to="/search"
          className="text-[12px] font-semibold text-navy-700 hover:text-coral transition-colors inline-flex items-center gap-1"
        >
          Tout parcourir
        </Link>
      </CardHead>
      <CardBody className="px-[18px] py-[14px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {shown.length === 0 ? (
            <div className="sm:col-span-2 text-center text-[12px] font-mono text-ink-muted py-6">
              Chargement des domaines…
            </div>
          ) : (
            shown.map((d) => {
              const split = domainFreshSplit(d.doc_count)
              return (
                <Link
                  key={d.id}
                  to={`/domains/${d.slug}`}
                  className={cn(
                    'border border-line rounded-xl p-3 flex flex-col gap-2 bg-white',
                    'transition-[border-color,background-color,transform]',
                    'hover:border-navy-600 hover:bg-cream-light hover:-translate-y-px',
                    'no-underline text-inherit',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'w-2.5 h-2.5 rounded-full shrink-0',
                        domainDotColor(d.slug),
                      )}
                    />
                    <span className="font-serif font-semibold text-[14.5px] text-navy-900">
                      {d.name}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-serif font-semibold text-[22px] leading-none text-navy-900 tabular-nums">
                      {d.doc_count}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.1em] font-semibold text-ink-soft">
                      docs
                    </span>
                  </div>
                  <div className="flex gap-1 h-1" title={`${split.ok} ok · ${split.warn} warn · ${split.danger} périmés`}>
                    {split.ok > 0 && (
                      <span
                        className="bg-success rounded-sm"
                        style={{ flex: split.ok }}
                      />
                    )}
                    {split.warn > 0 && (
                      <span
                        className="bg-warn rounded-sm"
                        style={{ flex: split.warn }}
                      />
                    )}
                    {split.danger > 0 && (
                      <span
                        className="bg-danger rounded-sm"
                        style={{ flex: split.danger }}
                      />
                    )}
                    {split.ok + split.warn + split.danger === 0 && (
                      <span className="bg-line rounded-sm flex-1" />
                    )}
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </CardBody>
    </Card>
  )
}

function UrgentDocsPanel({
  docs,
  totalRed,
  isLoading,
  isError,
}: {
  docs: Array<{ id: string; slug: string; title: string; domain_name: string; updated_at: string }>
  totalRed: number
  isLoading?: boolean
  isError?: boolean
}) {
  const navigate = useNavigate()
  const showLoading = !!isLoading && docs.length === 0
  const showError = !!isError && !isLoading
  return (
    <Card>
      <CardHead>
        <CardTitle className="text-[15px]">
          Périmés
          {totalRed > 0 && (
            <span className="ml-2.5 bg-danger-bg text-danger font-sans text-[11.5px] font-bold px-2 py-0.5 rounded-md tabular-nums">
              {totalRed}
            </span>
          )}
        </CardTitle>
        <Link
          to="/search?fresh=red"
          className="text-[12px] font-semibold text-navy-700 hover:text-coral transition-colors inline-flex items-center gap-1"
        >
          Tout voir
        </Link>
      </CardHead>
      <CardBody padded={false}>
        {showLoading ? (
          <div className="px-5 py-6 text-center text-[12px] font-mono text-ink-muted">
            Chargement…
          </div>
        ) : showError ? (
          <div className="px-5 py-4">
            <Callout variant="danger" title="Impossible de charger.">
              Les documents à vérifier n'ont pas pu être récupérés. Réessayez dans un instant.
            </Callout>
          </div>
        ) : docs.length === 0 ? (
          <div className="px-5 py-6 text-center text-[12px] font-mono text-ink-muted">
            Aucun document périmé
          </div>
        ) : (
          docs.map((d) => {
            const months = Math.max(
              1,
              Math.floor((Date.now() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24 * 30.44)),
            )
            return (
              <div
                key={d.id}
                className={cn(
                  'grid grid-cols-[auto_1fr_auto] items-center gap-3',
                  'px-5 py-2.5 border-b border-line-soft last:border-b-0',
                  'transition-colors hover:bg-danger-bg/40',
                )}
              >
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-full bg-danger shadow-[0_0_0_3px_rgba(177,48,74,0.15)] shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-ink leading-snug truncate">
                    {d.title}
                  </div>
                  <div className="text-[11.5px] font-semibold text-danger mt-0.5 tabular-nums truncate">
                    Périmé depuis {months} mois · {d.domain_name}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/documents/${d.slug}`)}
                >
                  Vérifier
                </Button>
              </div>
            )
          })
        )}
      </CardBody>
    </Card>
  )
}

function CtrlKHint({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-line p-5',
        'bg-gradient-to-br from-cream to-cream-light',
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -bottom-8 w-[140px] h-[140px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(232,132,92,0.2), transparent 70%)',
        }}
      />
      <div className="relative z-[1]">
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-coral inline-flex items-center gap-2 mb-2.5">
          <span aria-hidden="true" className="text-coral-soft">
            ◆
          </span>
          Astuce
        </div>
        <h3 className="font-serif font-semibold text-[17px] leading-snug tracking-[-0.01em] text-navy-900">
          Trouvez n'importe quoi en 3 frappes.
        </h3>
        <p className="text-[13px] leading-[1.5] text-ink-soft mt-2">
          Ouvrez la palette de recherche à tout moment avec <Kbd>Ctrl</Kbd>
          <span className="mx-0.5">+</span>
          <Kbd>K</Kbd>. Fautes de frappe tolérées, filtres par domaine et par type, navigation clavier intégrale.
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={onOpen}
          rightIcon={<ArrowRight strokeWidth={2.5} />}
          className="mt-3.5"
        >
          Essayer la recherche
        </Button>
      </div>
    </div>
  )
}

// =========================================================================
// Helpers (internes)
// =========================================================================

function domainSlugFromName(domains: DomainLite[], name: string): string {
  const match = domains.find((d) => d.name.toLowerCase() === name.toLowerCase())
  if (match) return match.slug
  // Heuristique de fallback sur les 4 domaines historiques DSI.
  const lc = name.toLowerCase()
  if (lc.includes('infra')) return 'infrastructure'
  if (lc.includes('support')) return 'support'
  if (lc.includes('sci')) return 'sci'
  if (lc.includes('étude') || lc.includes('etude') || lc.includes('dev')) return 'etudes'
  if (lc.includes('data')) return 'data'
  return 'infrastructure'
}
