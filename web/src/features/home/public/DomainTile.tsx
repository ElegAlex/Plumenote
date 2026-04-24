import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/cn'

export type DomainTileAccent = 'coral' | 'success' | 'navy' | 'plum'

export interface DomainTileProps {
  href: string
  icon: ReactNode
  accent: DomainTileAccent
  name: string
  desc: string
  count: number
}

/**
 * Mapping des accents vers les classes Tailwind (token design system) pour :
 * - l'icône (couleur + fond tinted),
 * - le halo radial décoratif bas-droite.
 *
 * On utilise une couleur pleine puis un wrapper opacité via la classe `text-*`
 * pour la couleur CSS du currentColor (propagation dans le radial via var).
 */
const ACCENT_STYLES: Record<
  DomainTileAccent,
  {
    iconColor: string
    iconBg: string
    haloRgba: string // alpha tinted, rgba() commenté (tokens alpha non exprimables)
  }
> = {
  coral: {
    iconColor: 'text-coral',
    iconBg: 'bg-coral-bg',
    // rgba(232,132,92,0.14) — coral 14 %
    haloRgba: 'rgba(232,132,92,0.14)',
  },
  success: {
    iconColor: 'text-success',
    iconBg: 'bg-success-bg',
    // rgba(47,125,91,0.1) — success 10 %
    haloRgba: 'rgba(47,125,91,0.1)',
  },
  navy: {
    iconColor: 'text-navy-700',
    // bg navy-50 (token navy très pâle, ex #E9EAF7)
    iconBg: 'bg-navy-50',
    // rgba(38,54,136,0.1) — navy-700 10 %
    haloRgba: 'rgba(38,54,136,0.1)',
  },
  plum: {
    iconColor: 'text-plum',
    iconBg: 'bg-plum-bg',
    // rgba(122,62,140,0.1) — plum 10 %
    haloRgba: 'rgba(122,62,140,0.1)',
  },
}

/**
 * DomainTile — tuile "Parcourir par domaine" (gabarit g3).
 *
 * Carte cliquable vers `/domains/:slug`, 4 accents par domaine DSI :
 * coral (Infra), success (Support), navy (SCI), plum (Études & Dev).
 *
 * Hover : translate -3px, border-navy-600, shadow. ArrowRight translateX 3px + coral.
 */
export default function DomainTile({ href, icon, accent, name, desc, count }: DomainTileProps) {
  const styles = ACCENT_STYLES[accent]
  return (
    <Link
      to={href}
      className={cn(
        'group relative overflow-hidden',
        'bg-white border border-line rounded-[18px] p-6 px-5.5',
        'flex flex-col gap-3 no-underline text-inherit',
        'transition-[transform,border-color,box-shadow] duration-150',
        // shadow custom avec alpha navy : token non exprimable
        'hover:-translate-y-[3px] hover:border-navy-600 hover:shadow-[0_14px_30px_rgba(20,35,92,0.08)]',
      )}
    >
      {/* Halo radial décoratif bas-droite, variable selon accent */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -bottom-10 w-40 h-40"
        style={{
          background: `radial-gradient(circle, ${styles.haloRgba}, transparent 65%)`,
        }}
      />

      <div className={cn('relative w-12 h-12 rounded-xl grid place-items-center [&_svg]:w-[22px] [&_svg]:h-[22px]', styles.iconBg, styles.iconColor)}>
        {icon}
      </div>

      <div className="relative font-serif font-semibold text-[18px] text-navy-900">{name}</div>
      <p className="relative text-[13px] text-ink-soft leading-[1.55]">{desc}</p>

      <div className="relative mt-auto pt-3.5 border-t border-dashed border-line flex justify-between items-center text-[12px] text-ink-muted">
        <span>
          <strong className="text-navy-800 font-bold tabular-nums">{count}</strong> fiches publiques
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1',
            'text-[12.5px] font-semibold text-navy-700',
            'transition-colors',
            'group-hover:text-coral',
          )}
        >
          Parcourir
          <ArrowRight
            className="w-3 h-3 transition-transform group-hover:translate-x-[3px]"
            aria-hidden="true"
          />
        </span>
      </div>
    </Link>
  )
}
