import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { Card } from '@/components/ui'
import DomainHero from './domain/DomainHero'
import FilterBar, {
  type DocTypeFilter,
  type FreshFilter,
  type SortKey,
  type ViewMode,
} from './domain/FilterBar'
import DocCard, {
  NewDocCard,
  freshnessToStatus,
  shortAge,
  typeSlugToKey,
  type DocTypeKey,
  type FreshStatus,
} from './domain/DocCard'
import { cn } from '@/lib/cn'

/**
 * DomainPage — listing des documents par domaine `/domains/:slug`.
 *
 * Gabarit de référence : `gabarits-visuels/g7-domaine.html`.
 *
 * Structure rendue :
 * 1. Hero gradient navy/coral avec 4 stats de fraîcheur
 * 2. FilterBar (type + fraîcheur + sort + view toggle)
 * 3. Section "Récemment modifiés" (≤ 12 items, 7 derniers jours)
 * 4. Section "Tous les documents" (reste de la liste + NewDocCard)
 * 5. Pagination (client-side)
 *
 * Simplifications de Vague 2 (ex-DomainPage legacy) :
 * - onglets Entities / Cartography / MindMap retirés (les entités sont accessibles
 *   via leurs routes dédiées `/entities/:id`, `/cartography`, `/mindmap`).
 * - section BookmarkList / BookmarkForm retirée (hors périmètre g7, à réintroduire
 *   si besoin dans une future vague).
 * - section "Documents hors dossier" fusionnée dans le grid principal.
 *
 * API préservée :
 * - GET /api/domains  → résolution du domaine par slug
 * - GET /api/documents?domain=:slug&limit=100  → docs du domaine
 *
 * Filtre / tri / pagination : 100 % client-side sur la liste chargée
 * (limite 100 du backend considérée suffisante pour un domaine DSI Vague 2).
 */

// --- Shapes API ---

interface Domain {
  id: string
  name: string
  slug: string
  color: string
  doc_count: number
  entity_count: number
  features_enabled?: string[]
}

interface ApiDoc {
  id: string
  title: string
  slug: string
  freshness_badge: 'green' | 'yellow' | 'red' | string
  author_name: string
  view_count: number
  updated_at: string
  created_at: string
  last_verified_at?: string | null
  type_name?: string | null
  type_slug?: string | null
  domain_id?: string | null
}

// --- Helpers ---

const PAGE_SIZE = 12
const RECENT_DAYS = 7

/** Initiales courtes pour Avatar xs — "Mohamed Zemouche" → "MZ". */
function initialsOf(name: string): string {
  if (!name) return '—'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Description courte du domaine. Le backend ne renvoie pas de description pour
 *  l'instant : on affiche une phrase générique basée sur le nom du domaine. */
function domainDescription(name: string): string {
  return `Documentation technique et opérationnelle du périmètre ${name} : procédures, modes opératoires, architectures, FAQ et références rédigées et maintenues par les équipes DSI.`
}

export default function DomainPage() {
  const { slug } = useParams<{ slug: string }>()
  const [domain, setDomain] = useState<Domain | null>(null)
  const [docs, setDocs] = useState<ApiDoc[]>([])
  const [loading, setLoading] = useState(true)

  // Etats de filtre / tri / vue (in-memory, non persistés en URL : l'existant
  // ne le faisait pas, on reste sur une UX cohérente).
  const [type, setType] = useState<DocTypeFilter>('all')
  const [fresh, setFresh] = useState<FreshFilter[]>([])
  const [sort, setSort] = useState<SortKey>('recent')
  const [view, setView] = useState<ViewMode>('cards')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    Promise.all([
      api.get<Domain[]>('/domains').then((list) => list.find((d) => d.slug === slug) || null),
      api.get<ApiDoc[]>(`/documents?domain=${slug}&sort=recent&limit=100`),
    ])
      .then(([d, docList]) => {
        setDomain(d)
        setDocs(Array.isArray(docList) ? docList : [])
      })
      .catch(() => {
        setDomain(null)
        setDocs([])
      })
      .finally(() => setLoading(false))
  }, [slug])

  // Reset pagination quand filtres changent
  useEffect(() => {
    setPage(1)
  }, [type, fresh, sort, slug])

  // --- Enrichissement : statut de fraîcheur, typeKey, libellé âge ---
  const enrichedDocs = useMemo(() => {
    return docs.map((d) => {
      const status: FreshStatus = freshnessToStatus(d.freshness_badge)
      const typeKey: DocTypeKey = typeSlugToKey(d.type_slug)
      return {
        raw: d,
        status,
        typeKey,
        freshLabel: shortAge(d.updated_at),
      }
    })
  }, [docs])

  // --- Compteurs pour FilterBar (sur la liste totale, avant filtre) ---
  const typeCounts = useMemo(() => {
    const c = { all: enrichedDocs.length, proc: 0, mo: 0, arch: 0, faq: 0, ref: 0 }
    for (const e of enrichedDocs) {
      if (e.typeKey === 'proc') c.proc++
      else if (e.typeKey === 'mo') c.mo++
      else if (e.typeKey === 'arch') c.arch++
      else if (e.typeKey === 'faq') c.faq++
      else if (e.typeKey === 'ref') c.ref++
    }
    return c
  }, [enrichedDocs])

  const freshCounts = useMemo(() => {
    const c = { ok: 0, warn: 0, danger: 0 }
    for (const e of enrichedDocs) c[e.status]++
    return c
  }, [enrichedDocs])

  // --- Filtre + tri ---
  const filteredSorted = useMemo(() => {
    let list = enrichedDocs
    if (type !== 'all') list = list.filter((e) => e.typeKey === type)
    if (fresh.length > 0) list = list.filter((e) => fresh.includes(e.status))

    const sorted = [...list]
    if (sort === 'views') {
      sorted.sort((a, b) => b.raw.view_count - a.raw.view_count)
    } else if (sort === 'alpha') {
      sorted.sort((a, b) => a.raw.title.localeCompare(b.raw.title, 'fr'))
    } else if (sort === 'fresh') {
      // ok < warn < danger : à jour d'abord
      const rank: Record<FreshStatus, number> = { ok: 0, warn: 1, danger: 2 }
      sorted.sort((a, b) => rank[a.status] - rank[b.status])
    } else {
      // recent
      sorted.sort(
        (a, b) =>
          new Date(b.raw.updated_at).getTime() - new Date(a.raw.updated_at).getTime(),
      )
    }
    return sorted
  }, [enrichedDocs, type, fresh, sort])

  // --- Récemment modifiés : 7 derniers jours, max 12, triés par updated_at DESC.
  //     Les filtres type/fresh sont appliqués sur place pour rester cohérent avec
  //     la seconde section (décision spec review : les 2 sections du gabarit g7
  //     restent visibles quand un filtre est actif, mais sur la même liste filtrée). ---
  const recentDocs = useMemo(() => {
    const cutoff = Date.now() - RECENT_DAYS * 86_400_000
    let list = enrichedDocs.filter((e) => new Date(e.raw.updated_at).getTime() >= cutoff)
    if (type !== 'all') list = list.filter((e) => e.typeKey === type)
    if (fresh.length > 0) list = list.filter((e) => fresh.includes(e.status))
    return list
      .sort(
        (a, b) =>
          new Date(b.raw.updated_at).getTime() - new Date(a.raw.updated_at).getTime(),
      )
      .slice(0, 12)
  }, [enrichedDocs, type, fresh])

  // --- Pagination client-side sur la liste filtrée ---
  const totalFiltered = filteredSorted.length
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pageEnd = Math.min(pageStart + PAGE_SIZE, totalFiltered)
  const pageDocs = filteredSorted.slice(pageStart, pageEnd)

  // Guard : si la liste change hors du trio {type,fresh,sort,slug} (ex. refresh
  // des docs) et que `page` dépasse le nouveau totalPages, on aligne le state.
  // Math.min au render corrige l'affichage mais laisse `page` désynchronisé.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [totalPages, page])

  function toggleFresh(f: FreshFilter) {
    setFresh((curr) => (curr.includes(f) ? curr.filter((x) => x !== f) : [...curr, f]))
  }

  // Helper partagé entre "Récemment modifiés" et "Tous les documents" : les 2
  // sections rendent la même DocCard avec les mêmes props. Un seul point TODO
  // ref/desc/tags à maintenir, pas 2.
  function renderDocCard(e: (typeof enrichedDocs)[number]) {
    return (
      <DocCard
        key={e.raw.id}
        href={`/documents/${e.raw.slug}`}
        typeKey={e.typeKey}
        typeLabel={e.raw.type_name ?? 'Document'}
        freshStatus={e.status}
        freshLabel={e.freshLabel}
        title={e.raw.title}
        // TODO: brancher ref/desc/tags dès que le backend expose
        // reference_code / excerpt / tags sur /api/documents.
        ref={undefined}
        desc={undefined}
        tags={undefined}
        authorName={e.raw.author_name}
        authorInitials={initialsOf(e.raw.author_name)}
        views={e.raw.view_count}
      />
    )
  }

  // --- Rendus partiels communs ---

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto px-8 py-8 text-ink-soft font-mono text-xs">
        Chargement…
      </div>
    )
  }

  if (!domain) {
    return (
      <div className="max-w-[1440px] mx-auto px-8 py-8 text-ink-soft font-mono text-xs">
        Domaine introuvable.
      </div>
    )
  }

  return (
    <div className="max-w-[1440px] mx-auto px-8 py-8 flex flex-col gap-5.5">
      <DomainHero
        name={domain.name}
        description={domainDescription(domain.name)}
        total={enrichedDocs.length}
        okCount={freshCounts.ok}
        warnCount={freshCounts.warn}
        dangerCount={freshCounts.danger}
      />

      <FilterBar
        type={type}
        onTypeChange={setType}
        typeCounts={typeCounts}
        fresh={fresh}
        onFreshToggle={toggleFresh}
        freshCounts={freshCounts}
        sort={sort}
        onSortChange={setSort}
        view={view}
        onViewChange={setView}
      />

      {/* === Section : Récemment modifiés ===
          Affichée systématiquement quand non vide, filtres appliqués en amont
          (cf. recentDocs useMemo). Cohérent avec le gabarit g7 qui montre les
          2 sections en permanence. */}
      {recentDocs.length > 0 ? (
        <>
          <SectionHead
            title="Récemment modifiés"
            count={recentDocs.length}
            hint="7 derniers jours"
          />
          <div className={cn(gridClass(view))}>{recentDocs.map(renderDocCard)}</div>
        </>
      ) : null}

      {/* === Section : Tous les documents (page courante) === */}
      <SectionHead
        title="Tous les documents"
        count={totalFiltered}
        hint={sortHint(sort)}
      />

      {totalFiltered === 0 ? (
        <Card className="p-10 text-center text-ink-soft text-sm">
          Aucun document ne correspond à ces filtres.
        </Card>
      ) : (
        <div className={cn(gridClass(view))}>
          {pageDocs.map(renderDocCard)}
          {/* "Nouveau document" en dernière case de la dernière page quand aucun filtre type. */}
          {currentPage === totalPages && type === 'all' ? (
            <NewDocCard href={`/documents/new?domain=${domain.slug}`} />
          ) : null}
        </div>
      )}

      {/* === Pagination === */}
      {totalFiltered > PAGE_SIZE ? (
        <Card className="flex items-center justify-between gap-3 flex-wrap px-5 py-3.5 text-[12.5px] text-ink-soft">
          <span>
            Affichage{' '}
            <strong className="text-navy-900 tabular-nums">
              {pageStart + 1} – {pageEnd}
            </strong>{' '}
            sur <strong className="text-navy-900 tabular-nums">{totalFiltered}</strong> documents
          </span>
          <Pagination
            current={currentPage}
            total={totalPages}
            onChange={(p) => setPage(p)}
          />
        </Card>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers de rendu
// ---------------------------------------------------------------------------

function gridClass(view: ViewMode): string {
  if (view === 'list') {
    // Mode liste : 1 colonne pleine largeur. On conserve la même DocCard pour garder
    // le rendu g7 (pas de table dense). Les cards s'étendent sur 1 col, donc
    // chaque card occupe toute la largeur : c'est le rendu "liste" demandé.
    return 'grid grid-cols-1 gap-4.5'
  }
  return 'grid grid-cols-1 gap-4.5 min-[700px]:grid-cols-2 min-[1200px]:grid-cols-3'
}

function sortHint(sort: SortKey): string {
  switch (sort) {
    case 'views':
      return 'Triés par nombre de vues'
    case 'alpha':
      return 'Triés par ordre alphabétique'
    case 'fresh':
      return 'Triés par fraîcheur'
    case 'recent':
    default:
      return 'Triés par dernière modification'
  }
}

function SectionHead({
  title,
  count,
  hint,
}: {
  title: string
  count: number
  hint: string
}) {
  return (
    <div className="flex justify-between items-baseline mt-2.5">
      <h2 className="flex items-center gap-2.5 font-serif font-semibold text-[20px] text-navy-900 tracking-[-0.01em]">
        {title}
        <span className="inline-flex items-center bg-cream text-navy-800 text-[12px] font-bold px-2 py-0.5 rounded-md tabular-nums">
          {count}
        </span>
      </h2>
      <span className="text-[12.5px] text-ink-soft">{hint}</span>
    </div>
  )
}

function Pagination({
  current,
  total,
  onChange,
}: {
  current: number
  total: number
  onChange: (p: number) => void
}) {
  // On affiche au plus 5 boutons de page + ellipsis, façon g7.
  const pages = computePages(current, total)
  return (
    <div className="flex gap-1">
      <PageBtn
        disabled={current === 1}
        onClick={() => onChange(Math.max(1, current - 1))}
        aria-label="Page précédente"
      >
        ‹
      </PageBtn>
      {pages.map((p, i) =>
        p === '…' ? (
          <span
            key={`e-${i}`}
            aria-hidden="true"
            className="min-w-[32px] h-8 grid place-items-center text-ink-muted text-xs font-semibold"
          >
            …
          </span>
        ) : (
          <PageBtn
            key={p}
            current={p === current}
            onClick={() => onChange(p)}
            aria-label={`Page ${p}`}
            aria-current={p === current ? 'page' : undefined}
          >
            {p}
          </PageBtn>
        ),
      )}
      <PageBtn
        disabled={current === total}
        onClick={() => onChange(Math.min(total, current + 1))}
        aria-label="Page suivante"
      >
        ›
      </PageBtn>
    </div>
  )
}

function PageBtn({
  current,
  disabled,
  children,
  onClick,
  ...props
}: {
  current?: boolean
  disabled?: boolean
  children: React.ReactNode
  onClick?: () => void
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'min-w-[32px] h-8 px-2.5 rounded-lg',
        'text-[12px] font-semibold tabular-nums cursor-pointer transition-colors',
        'border',
        current
          ? 'bg-navy-900 text-white border-navy-900'
          : 'bg-white text-ink-soft border-line hover:border-navy-600 hover:text-navy-800',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-line',
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/** Génère la séquence de pages affichées avec ellipsis, aligné sur g7. */
function computePages(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  if (current > 3) pages.push('…')
  const from = Math.max(2, current - 1)
  const to = Math.min(total - 1, current + 1)
  for (let p = from; p <= to; p++) pages.push(p)
  if (current < total - 2) pages.push('…')
  pages.push(total)
  return pages
}
