import { forwardRef } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type InputTone = 'default' | 'muted'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Icône affichée à gauche (position absolue, couleur ink-muted). */
  leftIcon?: ReactNode
  /** Slot libre à droite (toggle œil, Kbd raccourci, compteur, etc.). */
  rightSlot?: ReactNode
  /** Affiche l'état d'erreur : border danger + fond rosé. */
  invalid?: boolean
  /**
   * Tonalité du fond en état repos.
   * - `default` (valeur par défaut) : `bg-white`, utilisé sur formulaires (gabarit g1, g10).
   * - `muted` : `bg-bg` (cream clair) au repos puis `bg-white` au focus. Utilisé dans les
   *   barres de recherche sur fond blanc (gabarit g2 header search).
   */
  tone?: InputTone
  /** Classes additionnelles sur l'élément `<input>` lui-même. */
  inputClassName?: string
}

/**
 * Input — contrôle de formulaire principal.
 *
 * API : extension d'un `<input>` HTML natif. Largeur 100 %, 13.5 px.
 * - `leftIcon` : icône 16 px en position absolue 14 px (gabarit g1).
 * - `rightSlot` : élément arbitraire à droite (gabarit g2 kbd, g1 pwd toggle).
 * - `invalid` : border danger + fond rosé, utilisable sans gestion aria-invalid stricte.
 *
 * Gabarits de référence : g1 (login), g2 (recherche), g9 (search-inline), g10 (form).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { leftIcon, rightSlot, invalid, tone = 'default', className, inputClassName, ...props },
  ref,
) {
  const hasLeft = Boolean(leftIcon)
  const hasRight = Boolean(rightSlot)
  const toneBg =
    tone === 'muted'
      ? 'bg-bg focus:bg-white'
      : 'bg-white'
  return (
    <div className={cn('relative w-full', className)}>
      {hasLeft && (
        <span className="pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 text-ink-muted [&_svg]:w-4 [&_svg]:h-4">
          {leftIcon}
        </span>
      )}
      <input
        ref={ref}
        className={cn(
          'w-full text-ink text-[14px] leading-[1.4]',
          'border rounded-[10px] outline-none transition-[border-color,box-shadow,background-color]',
          'placeholder:text-ink-muted',
          hasLeft ? 'pl-[42px] pr-[14px]' : 'px-[14px]',
          hasRight ? 'pr-[46px]' : '',
          'py-[12px]',
          invalid
            ? 'border-danger bg-[#FDF5F7] focus:border-danger focus:shadow-[0_0_0_3px_rgba(177,48,74,0.12)]'
            : cn(toneBg, 'border-line focus:border-navy-600 focus:shadow-[0_0_0_3px_rgba(46,66,160,0.12)]'),
          inputClassName,
        )}
        {...props}
      />
      {hasRight && (
        <span className="absolute right-[10px] top-1/2 -translate-y-1/2 flex items-center gap-1">
          {rightSlot}
        </span>
      )}
    </div>
  )
})
