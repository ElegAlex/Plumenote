import { Link } from 'react-router-dom'
import { Eye, Link2, Plus } from 'lucide-react'
import { Avatar, FreshBadge, TypeChip } from '@/components/ui'
import { cn } from '@/lib/cn'
import TagPill from './TagPill'

export type DocTypeKey = 'proc' | 'mo' | 'faq' | 'arch' | 'ref' | 'guide'
export type FreshStatus = 'ok' | 'warn' | 'danger'

/**
 * Mapping slug de document_type → DocTypeKey pour TypeChip.
 * Le slug backend peut être: procedure, mode-operatoire, faq, architecture, reference, guide…
 * Fallback : 'guide' (cream neutre).
 */
export function typeSlugToKey(slug: string | null | undefined): DocTypeKey {
  if (!slug) return 'guide'
  const s = slug.toLowerCase()
  if (s.startsWith('proc')) return 'proc'
  if (s.startsWith('mo') || s.includes('operat')) return 'mo'
  if (s.startsWith('faq')) return 'faq'
  if (s.startsWith('arch')) return 'arch'
  if (s.startsWith('ref')) return 'ref'
  return 'guide'
}

/**
 * Mapping freshness_badge API ('green' | 'yellow' | 'red') → FreshBadge status.
 * Fallback non alarmiste : toute valeur inconnue retombe sur 'warn' (pas 'danger'),
 * pour ne pas présenter à tort un document comme périmé si le backend introduit
 * une nouvelle valeur. Un console.warn en dev signale les valeurs non reconnues.
 */
export function freshnessToStatus(
  badge: 'green' | 'yellow' | 'red' | string | null | undefined,
): FreshStatus {
  if (badge === 'green') return 'ok'
  if (badge === 'yellow') return 'warn'
  if (badge === 'red') return 'danger'
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn('unknown freshness_badge:', badge)
  }
  return 'warn'
}

/**
 * Compose un libellé court ("2 h", "3 sem", "3 mois", "14 mois") depuis
 * un ISO ou un Date. Utilisé dans le coin supérieur droit des doc-cards g7
 * à côté du type-chip.
 */
export function shortAge(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const diffMs = Date.now() - d.getTime()
  if (diffMs < 0) return "à l'instant"
  const h = Math.floor(diffMs / 3_600_000)
  if (h < 1) return "à l'instant"
  if (h < 48) return `${h} h`
  const j = Math.floor(diffMs / 86_400_000)
  if (j < 14) return `${j} j`
  if (j < 60) return `${Math.round(j / 7)} sem`
  const months = Math.floor(diffMs / (86_400_000 * 30.44))
  if (months < 24) return `${months} mois`
  const years = Math.floor(months / 12)
  return `${years} an${years > 1 ? 's' : ''}`
}

export interface DocCardProps {
  href: string
  typeKey: DocTypeKey
  typeLabel: string
  freshStatus: FreshStatus
  freshLabel: string
  title: string
  ref?: string | null
  desc?: string | null
  tags?: string[]
  authorName: string
  authorInitials: string
  views?: number
  links?: number
}

/**
 * DocCard — carte document du gabarit g7 `.doc-card`.
 *
 * Layout vertical : header (TypeChip + FreshBadge inline) / titre Fraunces /
 * ref mono / description clampée 2 lignes / tags / meta footer (auteur + stats).
 *
 * Hover : `translateY(-2)` + border-navy-600 + shadow navy (alpha non tokenisable).
 */
export default function DocCard({
  href,
  typeKey,
  typeLabel,
  freshStatus,
  freshLabel,
  title,
  ref,
  desc,
  tags,
  authorName,
  authorInitials,
  views,
  links,
}: DocCardProps) {
  return (
    <Link
      to={href}
      className={cn(
        'bg-white border border-line rounded-[16px] p-5',
        'flex flex-col gap-3 min-h-[210px]',
        'no-underline text-inherit',
        'transition-[transform,border-color,box-shadow] duration-150',
        // shadow custom navy alpha : non exprimable en token
        'hover:-translate-y-0.5 hover:border-navy-600 hover:shadow-[0_14px_30px_rgba(20,35,92,0.08)]',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <TypeChip type={typeKey}>{typeLabel}</TypeChip>
        <FreshBadge status={freshStatus} inline>
          {freshLabel}
        </FreshBadge>
      </div>

      <h3 className="font-serif font-semibold text-[18px] leading-[1.25] tracking-[-0.01em] text-navy-900">
        {title}
      </h3>

      {ref ? (
        <div className="-mt-1.5 font-mono text-[11px] text-ink-muted">{ref}</div>
      ) : null}

      {desc ? (
        <p
          className="text-[12.5px] text-ink-soft leading-[1.5] overflow-hidden"
          // clamp 2 lignes (webkit-line-clamp non disponible en utilitaire Tailwind 4 sans plugin)
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {desc}
        </p>
      ) : null}

      {tags && tags.length > 0 ? (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {tags.map((t) => (
            <TagPill key={t}>{t}</TagPill>
          ))}
        </div>
      ) : null}

      <div className="mt-auto pt-3 border-t border-line-soft flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-soft">
          <Avatar size="xs" initials={authorInitials} />
          <strong className="font-semibold text-ink">{authorName}</strong>
        </span>
        <span className="inline-flex items-center gap-2.5 text-[11px] text-ink-muted tabular-nums">
          {typeof views === 'number' ? (
            <span className="inline-flex items-center gap-1">
              <Eye className="w-[11px] h-[11px]" aria-hidden="true" />
              {views}
            </span>
          ) : null}
          {typeof links === 'number' && links > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Link2 className="w-[11px] h-[11px]" aria-hidden="true" />
              {links}
            </span>
          ) : null}
        </span>
      </div>
    </Link>
  )
}

export interface NewDocCardProps {
  href: string
  title?: string
  desc?: string
}

/**
 * NewDocCard — placeholder "Nouveau document" du gabarit g7 `.doc-card.new`.
 * Bordure dashed, fond cream-light → coral-bg + border-coral au hover.
 */
export function NewDocCard({
  href,
  title = 'Nouveau document',
  desc = 'Commencer une fiche vierge ou choisir un template dans ce domaine.',
}: NewDocCardProps) {
  return (
    <Link
      to={href}
      className={cn(
        'grid place-items-center gap-2.5 text-center',
        'bg-cream-light border-[1.5px] border-dashed border-line rounded-[16px] p-5',
        'min-h-[210px] no-underline text-inherit',
        'transition-[transform,border-color,background-color] duration-150',
        'hover:-translate-y-0.5 hover:border-coral hover:bg-coral-bg',
      )}
    >
      <div className="w-12 h-12 rounded-xl bg-white border border-line text-coral grid place-items-center">
        <Plus className="w-[22px] h-[22px]" strokeWidth={2.5} aria-hidden="true" />
      </div>
      <div className="font-serif font-semibold text-[17px] text-navy-900">{title}</div>
      <div className="text-[12px] text-ink-soft leading-[1.5] max-w-[200px]">{desc}</div>
    </Link>
  )
}
