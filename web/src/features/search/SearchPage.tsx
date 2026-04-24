import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Boxes,
  Code2,
  Eye,
  FileText,
  HelpCircle,
  Layers,
  LifeBuoy,
  Plus,
  Search as SearchIcon,
  Users,
} from 'lucide-react'
import {
  Button,
  Card,
  DomainChip,
  FilterChip,
  FreshBadge,
  Input,
  Select,
  TitleEyebrow,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { api } from '@/lib/api'
import {
  DOMAIN_ICON_BG,
  DOMAIN_LABEL,
  DOMAIN_SHORT,
  TYPE_LABEL,
  freshLabel,
  freshStatus,
  normalizeDomain,
  normalizeType,
  sanitizeHighlight,
  type DocType,
  type Domain,
  type DomainKey,
  type DocTypeKey,
  type SearchResponse,
  type SearchResult,
} from './shared'

const PAGE_SIZE = 20

/**
 * SearchPage — page résultats `/search` (gabarit g4).
 *
 * Lit le paramètre `q` de l'URL (PublicHomePage / Topbar / Sidebar y arrivent
 * avec `?q=...`). Les paramètres legacy `?filter=mine`, `?sort=recent`,
 * `?status=stale` sont préservés sans crasher : un filtre de fraîcheur est
 * déduit de `?status=stale`.
 *
 * Filtres visuels (domaine, type, fraîcheur) reliés à la recherche API.
 * Highlighting `<mark>` warn-bg sur titre + snippet.
 * Empty state avec CTA "Créer « {query} »" navigue vers `/documents/new?title=`.
 */
export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const q = searchParams.get('q') ?? ''
  const statusParam = searchParams.get('status') ?? ''

  const [domainFilter, setDomainFilter] = useState<DomainKey | ''>('')
  const [typeFilter, setTypeFilter] = useState<DocTypeKey | ''>('')
  const [freshFilter, setFreshFilter] = useState<'all' | 'fresh' | 'stale'>(
    statusParam === 'stale' ? 'stale' : 'all',
  )
  const [page, setPage] = useState(1)

  const [domains, setDomains] = useState<Domain[]>([])
  const [docTypes, setDocTypes] = useState<DocType[]>([])
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [processingTime, setProcessingTime] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Typo-correction (stub — l'API ne renvoie pas encore ce champ).
  const [typoFrom] = useState<string | null>(null)

  useEffect(() => {
    api.get<Domain[]>('/domains').then(setDomains).catch(() => {})
    api.get<DocType[]>('/document-types').then(setDocTypes).catch(() => {})
  }, [])

  // Reset page lorsque la requête / les filtres changent.
  useEffect(() => {
    setPage(1)
  }, [q, domainFilter, typeFilter, freshFilter])

  // Lookup id → clé normalisée.
  const domainIdToKey = useMemo(() => {
    const m = new Map<string, DomainKey>()
    for (const d of domains) m.set(d.id, normalizeDomain(d.name || d.slug))
    return m
  }, [domains])

  const typeIdToKey = useMemo(() => {
    const m = new Map<string, DocTypeKey>()
    for (const t of docTypes) m.set(t.id, normalizeType(t.name))
    return m
  }, [docTypes])

  // Recherche (debounce 150 ms).
  useEffect(() => {
    if (!q) {
      setResults([])
      setTotal(0)
      setProcessingTime(null)
      return
    }
    setIsLoading(true)
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        q,
        limit: String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
      })
      const domainId = domains.find((d) => normalizeDomain(d.name || d.slug) === domainFilter)?.id
      const typeId = docTypes.find((t) => normalizeType(t.name) === typeFilter)?.id
      if (domainId) params.set('domain', domainId)
      if (typeId) params.set('type', typeId)

      api
        .get<SearchResponse>(`/search?${params}`)
        .then((data) => {
          let list = data.results
          if (freshFilter === 'fresh') list = list.filter((r) => r.freshness_badge === 'green')
          if (freshFilter === 'stale') list = list.filter((r) => r.freshness_badge !== 'green')
          setResults(list)
          setTotal(freshFilter === 'all' ? data.total : list.length)
          setProcessingTime(data.processing_time_ms)
        })
        .catch(() => {
          setResults([])
          setTotal(0)
        })
        .finally(() => setIsLoading(false))
    }, 150)
    return () => clearTimeout(timer)
  }, [q, domainFilter, typeFilter, freshFilter, page, domains, docTypes])

  const updateQuery = useCallback(
    (next: string) => {
      const p = new URLSearchParams(searchParams)
      if (next) p.set('q', next)
      else p.delete('q')
      setSearchParams(p, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const handleCreate = useCallback(() => {
    navigate(`/documents/new?title=${encodeURIComponent(q)}`)
  }, [navigate, q])

  const hasQuery = q.length > 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const firstShown = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const lastShown = Math.min(page * PAGE_SIZE, total)

  const activeFilterCount =
    (domainFilter ? 1 : 0) + (typeFilter ? 1 : 0) + (freshFilter !== 'all' ? 1 : 0)
  const clearAll = () => {
    setDomainFilter('')
    setTypeFilter('')
    setFreshFilter('all')
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-8 py-7 flex flex-col gap-[22px]">
      {/* ============ Title block ============ */}
      <div>
        <TitleEyebrow>Recherche · Meilisearch</TitleEyebrow>
        {hasQuery ? (
          <h1 className="font-serif font-semibold text-[32px] leading-[1.1] tracking-[-0.02em] text-navy-900">
            Résultats pour{' '}
            <em className="not-italic inline-block bg-coral-bg text-coral font-semibold px-2.5 rounded-lg align-baseline">
              {q}
            </em>
          </h1>
        ) : (
          <h1 className="font-serif font-semibold text-[32px] leading-[1.1] tracking-[-0.02em] text-navy-900">
            Rechercher dans la base
          </h1>
        )}
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {hasQuery ? (
            <>
              <strong className="text-navy-900">{total} document{total !== 1 ? 's' : ''}</strong>{' '}
              correspondent à cette requête. Typo-tolérance activée, tri par pertinence.
            </>
          ) : (
            <>Saisissez une requête pour lancer la recherche full-text. Typo-tolérance activée.</>
          )}
        </p>
      </div>

      {/* ============ Search input (sur la page elle-même) ============ */}
      <Input
        leftIcon={<SearchIcon />}
        type="search"
        value={q}
        onChange={(e) => updateQuery(e.target.value)}
        placeholder="Rechercher une procédure, une FAQ, un mode opératoire…"
        autoFocus={!hasQuery}
        aria-label="Requête de recherche"
      />

      {/* ============ Filter bar ============ */}
      <Card className="px-5 py-[14px] flex items-center gap-[18px] flex-wrap">
        <FilterGroup label="Domaine">
          {(['infra', 'support', 'sci', 'etudes'] as DomainKey[]).map((d) => (
            <DomainFilterChip
              key={d}
              domain={d}
              active={domainFilter === d}
              onClick={() => setDomainFilter(domainFilter === d ? '' : d)}
            >
              {DOMAIN_LABEL[d]}
            </DomainFilterChip>
          ))}
        </FilterGroup>

        <FilterSeparator />

        <FilterGroup label="Type">
          {(['proc', 'mo', 'faq', 'arch'] as DocTypeKey[]).map((t) => (
            <TypeFilterChip
              key={t}
              type={t}
              active={typeFilter === t}
              onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
            >
              {TYPE_LABEL[t]}
            </TypeFilterChip>
          ))}
        </FilterGroup>

        <FilterSeparator />

        <FilterGroup label="Fraîcheur">
          <Select
            value={freshFilter}
            onChange={(e) => setFreshFilter(e.target.value as typeof freshFilter)}
            className="py-[7px] text-[12.5px] font-semibold w-auto"
            aria-label="Filtre de fraîcheur"
          >
            <option value="all">Toutes</option>
            <option value="fresh">À jour uniquement</option>
            <option value="stale">Périmés uniquement</option>
          </Select>
        </FilterGroup>

        <span className="ml-auto text-[12.5px] font-semibold text-ink-soft">
          <strong className="font-serif text-sm text-navy-900 tabular-nums">{total}</strong>{' '}
          résultats
          {processingTime !== null && (
            <>
              {' · '}
              <strong className="font-serif text-sm text-navy-900 tabular-nums">
                {processingTime} ms
              </strong>
            </>
          )}
        </span>
      </Card>

      {/* ============ Active filters ============ */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
            Filtres actifs :
          </span>
          {domainFilter && (
            <FilterChip
              label="Domaine"
              value={DOMAIN_LABEL[domainFilter]}
              onRemove={() => setDomainFilter('')}
            />
          )}
          {typeFilter && (
            <FilterChip
              label="Type"
              value={TYPE_LABEL[typeFilter]}
              onRemove={() => setTypeFilter('')}
            />
          )}
          {freshFilter !== 'all' && (
            <FilterChip
              label="Fraîcheur"
              value={freshFilter === 'fresh' ? 'À jour' : 'Périmés'}
              onRemove={() => setFreshFilter('all')}
            />
          )}
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Tout retirer
          </Button>
        </div>
      )}

      {/* ============ Typo-tolérance banner (réservé) ============ */}
      {typoFrom && (
        <div className="flex items-center gap-2 rounded-lg bg-warn-bg px-[14px] py-2 text-[12px] font-semibold text-warn">
          <AlertTriangle className="w-[13px] h-[13px]" />
          Faute de frappe corrigée : recherche étendue sur{' '}
          <strong className="text-warn">« {q} »</strong> (saisi : « {typoFrom} »)
        </div>
      )}

      {/* ============ Results list ============ */}
      {hasQuery && results.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {results.map((r) => (
            <ResultCard
              key={r.id}
              result={r}
              domainKey={
                domainIdToKey.get(r.domain_id) ?? normalizeDomain(r.domain_name || undefined)
              }
              typeKey={typeIdToKey.get(r.type_id) ?? 'guide'}
            />
          ))}
        </div>
      )}

      {/* ============ Empty state ============ */}
      {hasQuery && !isLoading && results.length === 0 && (
        <EmptyState query={q} onCreate={handleCreate} />
      )}

      {/* ============ Pagination ============ */}
      {hasQuery && total > PAGE_SIZE && (
        <Card className="flex items-center justify-between px-[22px] py-[14px] text-[12.5px] text-ink-soft">
          <span>
            Affichage{' '}
            <strong className="text-navy-900 tabular-nums font-semibold">
              {firstShown} – {lastShown}
            </strong>{' '}
            sur{' '}
            <strong className="text-navy-900 tabular-nums font-semibold">{total}</strong> résultats
          </span>
          <Pagination current={page} total={totalPages} onChange={setPage} />
        </Card>
      )}
    </main>
  )
}

/* ==========================================================================
   Sub-components
   ========================================================================== */

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </span>
      {children}
    </div>
  )
}

function FilterSeparator() {
  return <span aria-hidden className="w-px h-6 bg-line" />
}

/**
 * DomainFilterChip — chip filtrable par domaine. Style coloré par domaine actif.
 * Différent de DomainChip (pastille d'identification), ici il sert de bouton.
 */
function DomainFilterChip({
  domain,
  active,
  onClick,
  children,
}: {
  domain: DomainKey
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const activeColors: Record<DomainKey, string> = {
    infra: 'bg-coral text-white',
    support: 'bg-success text-white',
    sci: 'bg-navy-700 text-white',
    etudes: 'bg-plum text-white',
    data: 'bg-warn text-white',
    neutral: 'bg-navy-800 text-white',
  }
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-[11px] py-[5px] rounded-full',
        'text-[12px] font-semibold cursor-pointer',
        'border-[1.5px] transition-all duration-150',
        'before:content-[""] before:w-[7px] before:h-[7px] before:rounded-full before:bg-current',
        active
          ? `${activeColors[domain]} border-transparent`
          : 'bg-bg text-ink-soft border-transparent hover:border-line',
      )}
    >
      {children}
    </button>
  )
}

function TypeFilterChip({
  active,
  onClick,
  children,
}: {
  type: DocTypeKey
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-[11px] py-[5px] rounded-full',
        'text-[12px] font-semibold cursor-pointer',
        'border-[1.5px] transition-all duration-150',
        'before:content-[""] before:w-[7px] before:h-[7px] before:rounded-full before:bg-current',
        active
          ? 'bg-navy-800 text-white border-transparent'
          : 'bg-bg text-ink-soft border-transparent hover:border-line',
      )}
    >
      {children}
    </button>
  )
}

/* ==========================================================================
   ResultCard — item de résultat cliquable (g4 .result)
   ========================================================================== */

function ResultCard({
  result,
  domainKey,
  typeKey,
}: {
  result: SearchResult
  domainKey: DomainKey
  typeKey: DocTypeKey
}) {
  const isBookmark = result.object_type === 'bookmark'
  const isEntity = result.object_type === 'entity'
  const target = isBookmark && result.url
    ? result.url
    : isEntity
      ? `/entities/${result.id}`
      : result.slug
        ? `/documents/${result.slug}`
        : `/documents/${result.id}`

  const Wrapper = (props: { children: React.ReactNode }) =>
    isBookmark && result.url ? (
      <a
        href={target}
        target="_blank"
        rel="noopener noreferrer"
        className="block no-underline text-inherit"
      >
        {props.children}
      </a>
    ) : (
      <Link to={target} className="block no-underline text-inherit">
        {props.children}
      </Link>
    )

  const updatedLabel = formatRelative(result.created_at)

  return (
    <Wrapper>
      <article
        className={cn(
          'grid grid-cols-[48px_1fr_auto] gap-4 items-start',
          'bg-white border border-line rounded-[14px] px-[22px] py-[18px]',
          'transition-all duration-150',
          'hover:border-navy-600 hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(20,35,92,0.06)]',
        )}
      >
        <div
          className={cn(
            'w-12 h-12 rounded-[12px] grid place-items-center',
            '[&_svg]:w-5 [&_svg]:h-5',
            DOMAIN_ICON_BG[domainKey],
          )}
          aria-hidden
        >
          {domainIcon(domainKey)}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-muted mb-1">
            <strong className="font-bold text-navy-800">{DOMAIN_LABEL[domainKey]}</strong>
            <span aria-hidden>›</span>
            <span>{TYPE_LABEL[typeKey]}</span>
          </div>

          <h3
            className={cn(
              'font-serif font-semibold text-[18px] leading-[1.25] tracking-[-0.01em] text-navy-900',
              // <mark> dans un titre Fraunces → force Manrope + fond warn
              '[&_mark]:bg-warn-bg [&_mark]:text-warn [&_mark]:rounded-[3px] [&_mark]:px-0.5',
              '[&_mark]:font-sans [&_mark]:font-bold [&_mark]:text-[17px]',
            )}
            dangerouslySetInnerHTML={{ __html: sanitizeHighlight(result.title) }}
          />

          {result.body_text_highlight && (
            <p
              className={cn(
                'mt-1.5 text-[13px] leading-[1.55] text-ink-soft',
                '[&_mark]:bg-warn-bg [&_mark]:text-warn [&_mark]:rounded-[3px] [&_mark]:px-0.5',
                '[&_mark]:font-semibold',
              )}
              dangerouslySetInnerHTML={{
                __html: sanitizeHighlight(result.body_text_highlight),
              }}
            />
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11.5px] text-ink-muted">
            <DomainChip domain={domainKey}>{DOMAIN_SHORT[domainKey]}</DomainChip>
            {result.author_name && (
              <span className="text-ink font-semibold">{result.author_name}</span>
            )}
            {updatedLabel && (
              <>
                <span aria-hidden className="text-ink-muted">
                  ·
                </span>
                <span>mis à jour {updatedLabel}</span>
              </>
            )}
            {result.tags && result.tags.length > 0 && (
              <>
                <span aria-hidden className="text-ink-muted">
                  ·
                </span>
                <span>Tags : {result.tags.slice(0, 4).join(', ')}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {!isBookmark && (
            <FreshBadge status={freshStatus(result.freshness_badge)}>
              {freshLabel(result.freshness_badge)}
            </FreshBadge>
          )}
          {!isBookmark && result.view_count > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted tabular-nums">
              <Eye className="w-[11px] h-[11px]" />
              {result.view_count} vues
            </span>
          )}
        </div>
      </article>
    </Wrapper>
  )
}

/* ==========================================================================
   EmptyState — 0 résultat : proposition de créer une fiche
   ========================================================================== */

function EmptyState({ query, onCreate }: { query: string; onCreate: () => void }) {
  return (
    <div
      className={cn(
        'bg-white border-[1.5px] border-dashed border-line rounded-2xl',
        'px-7 py-7 grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-5 items-center',
      )}
    >
      <div
        className="w-14 h-14 rounded-[14px] bg-cream text-navy-800 grid place-items-center [&_svg]:w-[26px] [&_svg]:h-[26px]"
        aria-hidden
      >
        <HelpCircle />
      </div>
      <div>
        <h4 className="font-serif font-semibold text-[17px] text-navy-900 mb-1">
          Aucune fiche ne couvre précisément ce sujet ?
        </h4>
        <p className="text-[13px] leading-[1.5] text-ink-soft">
          Si vous êtes sûr qu'un document devrait exister mais que vous ne le trouvez pas, vous
          pouvez le créer ou signaler le manque à l'administrateur DSI.
        </p>
      </div>
      <Button
        variant="cta"
        leftIcon={<Plus />}
        onClick={onCreate}
        disabled={!query}
        className="whitespace-nowrap"
      >
        Créer « {query} »
      </Button>
    </div>
  )
}

/* ==========================================================================
   Pagination
   ========================================================================== */

function Pagination({
  current,
  total,
  onChange,
}: {
  current: number
  total: number
  onChange: (n: number) => void
}) {
  const pages = pageNumbers(current, total)
  return (
    <nav className="flex gap-1" aria-label="Pagination">
      <PageButton
        disabled={current === 1}
        onClick={() => onChange(current - 1)}
        aria-label="Page précédente"
      >
        ‹
      </PageButton>
      {pages.map((p, i) =>
        p === '…' ? (
          <span
            key={`dots-${i}`}
            className="min-w-[32px] h-8 grid place-items-center text-[12px] text-ink-muted"
            aria-hidden
          >
            …
          </span>
        ) : (
          <PageButton key={p} active={p === current} onClick={() => onChange(p)}>
            {p}
          </PageButton>
        ),
      )}
      <PageButton
        disabled={current === total}
        onClick={() => onChange(current + 1)}
        aria-label="Page suivante"
      >
        ›
      </PageButton>
    </nav>
  )
}

function PageButton({
  active,
  disabled,
  onClick,
  children,
  ...rest
}: {
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
  'aria-label'?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'min-w-[32px] h-8 px-[10px] rounded-lg border cursor-pointer',
        'text-[12px] font-semibold tabular-nums transition-all duration-150',
        active
          ? 'bg-navy-900 text-white border-navy-900'
          : 'bg-white text-ink-soft border-line hover:border-navy-600 hover:text-navy-800',
        disabled && 'opacity-40 cursor-not-allowed hover:border-line hover:text-ink-soft',
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  if (current > 3) pages.push('…')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
  if (current < total - 2) pages.push('…')
  pages.push(total)
  return pages
}

/* ==========================================================================
   Helpers d'affichage
   ========================================================================== */

export function domainIcon(key: DomainKey) {
  switch (key) {
    case 'infra':
      return <Boxes />
    case 'support':
      return <LifeBuoy />
    case 'sci':
      return <Users />
    case 'etudes':
      return <Code2 />
    case 'data':
      return <Layers />
    default:
      return <FileText />
  }
}

function formatRelative(iso: string): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = (Date.now() - t) / 1000
  if (diff < 3600) return `il y a ${Math.max(1, Math.round(diff / 60))} min`
  if (diff < 86400) return `il y a ${Math.round(diff / 3600)} h`
  if (diff < 2592000) return `il y a ${Math.round(diff / 86400)} j`
  if (diff < 31536000) return `il y a ${Math.round(diff / 2592000)} mois`
  return `il y a ${Math.round(diff / 31536000)} an(s)`
}

