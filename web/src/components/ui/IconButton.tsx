import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'aria-label'> {
  /** Icône à rendre au centre (ex. `<Bell size={16} />`). */
  icon: ReactNode
  /** Obligatoire pour l'accessibilité : description courte de l'action. */
  'aria-label': string
  /** Badge overlay (généralement un point coral de notification). */
  badge?: ReactNode
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type']
}

/**
 * IconButton — bouton carré 38×38, icône 16 px centrée.
 *
 * Hover : fond cream-light + border navy-800 + couleur navy-800.
 * Badge optionnel (point coral en haut/droite). aria-label obligatoire.
 * Gabarit de référence : g2 header icon-btn (notif dot).
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, badge, className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'relative inline-grid place-items-center shrink-0',
        'w-[38px] h-[38px] rounded-lg',
        'bg-white border border-line text-ink-soft',
        'transition-[background-color,border-color,color] cursor-pointer',
        'hover:bg-cream-light hover:border-navy-800 hover:text-navy-800',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-line disabled:hover:text-ink-soft',
        '[&_svg]:w-4 [&_svg]:h-4',
        className,
      )}
      {...props}
    >
      {icon}
      {badge && (
        <span className="absolute top-[7px] right-[8px] pointer-events-none">
          {badge}
        </span>
      )}
    </button>
  )
})

/**
 * IconButtonDot — helper : point coral 8×8 bordé blanc (2 px) à utiliser comme `badge`.
 */
export function IconButtonDot() {
  return <span className="block w-2 h-2 rounded-full bg-coral border-2 border-white" />
}
