import { LayoutGrid, List } from 'lucide-react'
import { Card, Select } from '@/components/ui'
import { cn } from '@/lib/cn'

/**
 * FilterBar — barre de filtres du listing domaine (g7 .filter-bar).
 *
 * Trois groupes :
 * - Type de document : chips all/proc/mo/arch/faq/ref avec count
 * - Fraîcheur : 3 chips bullet coloré + count
 * - Tri + Vue (cards / liste) à droite
 *
 * Volontairement découplée de l'état global : un composant parent
 * gère les états et les change handlers. Les counts sont calculés en amont.
 */

export type DocTypeFilter = 'all' | 'proc' | 'mo' | 'arch' | 'faq' | 'ref'
export type FreshFilter = 'ok' | 'warn' | 'danger'
export type SortKey = 'recent' | 'views' | 'alpha' | 'fresh'
export type ViewMode = 'cards' | 'list'

export interface TypeCounts {
  all: number
  proc: number
  mo: number
  arch: number
  faq: number
  ref: number
}

export interface FreshCounts {
  ok: number
  warn: number
  danger: number
}

export interface FilterBarProps {
  type: DocTypeFilter
  onTypeChange: (t: DocTypeFilter) => void
  typeCounts: TypeCounts
  fresh: FreshFilter[]
  onFreshToggle: (f: FreshFilter) => void
  freshCounts: FreshCounts
  sort: SortKey
  onSortChange: (s: SortKey) => void
  view: ViewMode
  onViewChange: (v: ViewMode) => void
}

// Styles par type. On s'aligne strictement sur les classes g7 .type-chip.<key>.active.
const TYPE_LABELS: Record<DocTypeFilter, string> = {
  all: 'Tous',
  proc: 'Procédure',
  mo: 'Mode opératoire',
  arch: 'Architecture',
  faq: 'FAQ',
  ref: 'Référence',
}

const TYPE_ACTIVE: Record<DocTypeFilter, string> = {
  all: 'bg-navy-900 text-white',
  proc: 'bg-navy-700 text-white',
  mo: 'bg-coral text-white',
  arch: 'bg-plum text-white',
  faq: 'bg-success text-white',
  ref: 'bg-warn text-white',
}

const FRESH_LABELS: Record<FreshFilter, string> = {
  ok: 'À jour',
  warn: 'Vieillissant',
  danger: 'Périmé',
}

const FRESH_BULLET: Record<FreshFilter, string> = {
  ok: 'bg-success',
  warn: 'bg-warn',
  danger: 'bg-danger',
}

export default function FilterBar({
  type,
  onTypeChange,
  typeCounts,
  fresh,
  onFreshToggle,
  freshCounts,
  sort,
  onSortChange,
  view,
  onViewChange,
}: FilterBarProps) {
  const typeKeys: DocTypeFilter[] = ['all', 'proc', 'mo', 'arch', 'faq', 'ref']
  const freshKeys: FreshFilter[] = ['ok', 'warn', 'danger']

  return (
    <Card className="flex items-center gap-4 flex-wrap px-4.5 py-3.5">
      <span id="filter-type-label" className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">
        Type
      </span>

      <div
        role="group"
        aria-label="Type de document"
        aria-labelledby="filter-type-label"
        className="inline-flex items-center gap-4 flex-wrap"
      >
        {typeKeys.map((key) => {
          const active = type === key
          return (
            // Chip filter local (divergent de TypeChip du DS) : variante g7 "active" avec bordure 1.5px coloré, taille filter-bar. Ne pas remplacer par TypeChip.
            <button
              key={key}
              type="button"
              onClick={() => onTypeChange(key)}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center gap-1.5',
                'px-3 py-1.5 rounded-full',
                'text-[12px] font-semibold',
                'border-[1.5px] border-transparent transition-colors cursor-pointer',
                'before:content-[""] before:w-[7px] before:h-[7px] before:bg-current before:rounded-full',
                active
                  ? TYPE_ACTIVE[key]
                  : 'bg-bg text-ink-soft hover:border-line',
              )}
            >
              {TYPE_LABELS[key]}
              <span className="font-bold ml-0.5 tabular-nums">{typeCounts[key]}</span>
            </button>
          )
        })}
      </div>

      <span className="w-px h-6 bg-line" aria-hidden="true" />

      <span id="filter-fresh-label" className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">
        Fraîcheur
      </span>

      <div
        role="group"
        aria-label="Filtre de fraîcheur"
        aria-labelledby="filter-fresh-label"
        className="inline-flex items-center gap-4 flex-wrap"
      >
        {freshKeys.map((key) => {
          const active = fresh.includes(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => onFreshToggle(key)}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center gap-1.5',
                'px-2.5 py-1.5 rounded-lg',
                'border text-[12px] font-semibold text-ink transition-colors cursor-pointer',
                active
                  ? 'border-navy-600 bg-cream-light'
                  : 'border-line bg-bg hover:border-navy-600',
              )}
            >
              <span className={cn('w-2.5 h-2.5 rounded-full', FRESH_BULLET[key])} />
              {FRESH_LABELS[key]}
              <span className="font-serif font-semibold text-navy-900 tabular-nums">
                {freshCounts[key]}
              </span>
            </button>
          )
        })}
      </div>

      <Select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as SortKey)}
        aria-label="Trier les documents"
        className={cn(
          'ml-auto',
          // Select primitive par défaut = padding 10/14 pour formulaires.
          // Ici (filter bar g7) on veut un select compact : on resserre padding + font size.
          '!w-auto !py-[7px] !pl-3 !pr-[30px] !text-[12px] !font-semibold !text-navy-900',
        )}
      >
        <option value="recent">Trier : Dernière modification</option>
        <option value="views">Trier : Plus consulté</option>
        <option value="alpha">Trier : Alphabétique</option>
        <option value="fresh">Trier : Fraîcheur</option>
      </Select>

      <div
        role="group"
        aria-label="Mode d'affichage"
        className="inline-flex gap-1 bg-bg border border-line rounded-lg p-1"
      >
        <ViewButton active={view === 'cards'} onClick={() => onViewChange('cards')}>
          <LayoutGrid aria-hidden="true" />
          Cartes
        </ViewButton>
        <ViewButton active={view === 'list'} onClick={() => onViewChange('list')}>
          <List aria-hidden="true" />
          Liste
        </ViewButton>
      </div>
    </Card>
  )
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md',
        'text-[12px] font-semibold cursor-pointer transition-colors',
        '[&_svg]:w-[13px] [&_svg]:h-[13px]',
        active
          ? 'bg-white text-navy-900 shadow-[0_1px_3px_rgba(20,35,92,0.08)]'
          : 'bg-transparent text-ink-soft hover:text-navy-800',
      )}
    >
      {children}
    </button>
  )
}
