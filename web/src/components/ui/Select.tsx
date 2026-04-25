import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** État d'erreur : border danger + fond rosé. */
  invalid?: boolean
}

// Chevron SVG inline repris verbatim du gabarit g6 (ligne 116) pour un rendu identique.
const CHEVRON_BG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%235A6380' stroke-width='1.5' fill='none'/></svg>\") no-repeat right 12px center"

const INVALID_BG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23B1304A' stroke-width='1.5' fill='none'/></svg>\") no-repeat right 12px center, #FDF5F7"

/**
 * Select — élément `<select>` natif stylé (appearance none).
 *
 * Même style qu'Input côté contrôles de formulaire. Le chevron est un SVG inline
 * en background-image (stroke ink-soft). Utilisable partout où un tri / choix court
 * est demandé (gabarits g4, g6 tb-select, g7, g9).
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, children, style, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      style={{ background: invalid ? INVALID_BG : `white ${CHEVRON_BG}`, ...style }}
      className={cn(
        'w-full appearance-none text-ink text-[13.5px] leading-[1.4]',
        'pl-[14px] pr-[34px] py-[10px]',
        'border rounded-lg outline-none cursor-pointer transition-[border-color,box-shadow]',
        invalid
          ? 'border-danger focus:border-danger focus:shadow-[0_0_0_3px_rgba(177,48,74,0.12)]'
          : 'border-line focus:border-navy-600 focus:shadow-[0_0_0_3px_rgba(46,66,160,0.12)]',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
})
