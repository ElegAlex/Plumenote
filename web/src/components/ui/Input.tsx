import { forwardRef } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Icône affichée à gauche (position absolue, couleur ink-muted). */
  leftIcon?: ReactNode
  /** Slot libre à droite (toggle œil, Kbd raccourci, compteur, etc.). */
  rightSlot?: ReactNode
  /** Affiche l'état d'erreur : border danger + fond rosé. */
  invalid?: boolean
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
  { leftIcon, rightSlot, invalid, className, inputClassName, ...props },
  ref,
) {
  const hasLeft = Boolean(leftIcon)
  const hasRight = Boolean(rightSlot)
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
          'w-full bg-white text-ink text-[13.5px] leading-[1.4]',
          'border rounded-lg outline-none transition-[border-color,box-shadow]',
          'placeholder:text-ink-muted',
          hasLeft ? 'pl-[42px] pr-[14px]' : 'px-[14px]',
          hasRight ? 'pr-[46px]' : '',
          'py-[10px]',
          invalid
            ? 'border-danger bg-[#FDF5F7] focus:border-danger focus:shadow-[0_0_0_3px_rgba(177,48,74,0.12)]'
            : 'border-line focus:border-navy-600 focus:shadow-[0_0_0_3px_rgba(46,66,160,0.12)]',
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
