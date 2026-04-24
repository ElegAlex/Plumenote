import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface TabsProps {
  children: ReactNode
  /** Label ARIA pour la navigation par onglets. */
  'aria-label'?: string
  className?: string
}

/**
 * Tabs — conteneur plat des onglets.
 *
 * Style : `bg-white border border-line rounded-xl p-1 flex gap-0.5`.
 * Gabarit de référence : g10 tabs-bar (page Compte).
 */
export function Tabs({ children, className, ...props }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-0.5',
        'bg-white border border-line rounded-xl p-1',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface TabProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** État actif. */
  active?: boolean
  /** Icône à gauche (14 px). */
  icon?: ReactNode
  /** Pastille numérotée à droite du label (ex. compteur). */
  badge?: ReactNode
  children: ReactNode
}

/**
 * Tab — onglet individuel. Actif : navy-900 bg + white text.
 * Badge : pastille numérotée à droite.
 */
export function Tab({ active, icon, badge, className, children, ...props }: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cn(
        'inline-flex items-center gap-2',
        'px-4 py-[10px] rounded-lg',
        'font-semibold text-[13px] font-sans cursor-pointer',
        'transition-[background-color,color]',
        '[&_svg]:w-[14px] [&_svg]:h-[14px]',
        active
          ? 'bg-navy-900 text-white'
          : 'bg-transparent text-ink-soft hover:bg-cream-light hover:text-navy-800',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {badge != null && (
        <span
          className={cn(
            'inline-flex items-center justify-center',
            'px-[7px] py-px rounded-[5px]',
            'text-[10.5px] font-bold tabular-nums',
            active
              ? 'bg-white/20 text-cream'
              : 'bg-cream text-navy-800',
          )}
        >
          {badge}
        </span>
      )}
    </button>
  )
}
