import { Link } from 'react-router-dom'
import { Eye } from 'lucide-react'
import { cn } from '@/lib/cn'

export type PopularDocDomainKey = 'coral' | 'success' | 'navy' | 'plum' | 'neutral'

export interface PopularDocCardProps {
  href: string
  domainKey: PopularDocDomainKey
  domainLabel: string
  title: string
  desc: string
  typeLabel: string
  views: number
  dateLabel: string
}

/**
 * Mapping domainKey → classe text-* token pour le chip "type" (override couleur).
 * Le chip hérite toujours du fond cream-light, seule la couleur du texte change.
 */
const DOMAIN_TEXT: Record<PopularDocDomainKey, string> = {
  coral: 'text-coral',
  success: 'text-success',
  navy: 'text-navy-700',
  plum: 'text-plum',
  neutral: 'text-navy-700',
}

/**
 * PopularDocCard — carte d'un document populaire (gabarit g3, section "Les plus consultés").
 *
 * Affiche : chip domaine (couleur par domainKey), compteur de vues avec icône Eye,
 * titre Fraunces 16 px, description 12.5 px, footer avec type + date.
 */
export default function PopularDocCard({
  href,
  domainKey,
  domainLabel,
  title,
  desc,
  typeLabel,
  views,
  dateLabel,
}: PopularDocCardProps) {
  return (
    <Link
      to={href}
      className={cn(
        'bg-white border border-line rounded-[14px] p-4.5 px-5',
        'flex flex-col gap-2.5 no-underline text-inherit',
        'transition-[transform,border-color,box-shadow] duration-150',
        // shadow custom navy alpha : non exprimable en token
        'hover:-translate-y-0.5 hover:border-navy-600 hover:shadow-[0_10px_24px_rgba(20,35,92,0.06)]',
      )}
    >
      <div className="flex items-center justify-between gap-2.5">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5',
            'bg-cream-light rounded-full',
            'text-[10.5px] font-bold tracking-[0.06em] uppercase',
            'before:content-[""] before:w-[5px] before:h-[5px] before:bg-current before:rounded-full',
            DOMAIN_TEXT[domainKey],
          )}
        >
          {domainLabel}
        </span>
        <span className="inline-flex items-center gap-1.5 text-ink-muted text-[11.5px] font-semibold tabular-nums">
          <Eye className="w-3 h-3" aria-hidden="true" />
          {views}
        </span>
      </div>

      <h3 className="font-serif font-semibold text-base text-navy-900 leading-[1.3] tracking-[-0.01em]">
        {title}
      </h3>
      <p className="text-[12.5px] text-ink-soft leading-[1.5]">{desc}</p>

      <div className="mt-auto pt-2.5 border-t border-line-soft flex items-center justify-between text-[11.5px] text-ink-muted">
        <span className="text-navy-700 font-semibold">{typeLabel}</span>
        <span>{dateLabel}</span>
      </div>
    </Link>
  )
}
