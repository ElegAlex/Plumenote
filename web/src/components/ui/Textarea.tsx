import { forwardRef } from 'react'
import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** État d'erreur : border danger + fond rosé. */
  invalid?: boolean
}

/**
 * Textarea — zone de texte multiligne, même styling qu'Input.
 *
 * Différences : `min-height: 96px`, `resize: vertical`, line-height 1.55.
 * Gabarit de référence : g10 (bio field compte).
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full bg-white text-ink text-[13.5px] leading-[1.55]',
        'px-[14px] py-[10px] min-h-[96px] resize-y',
        'border rounded-lg outline-none transition-[border-color,box-shadow]',
        'placeholder:text-ink-muted',
        invalid
          ? 'border-danger bg-[#FDF5F7] focus:border-danger focus:shadow-[0_0_0_3px_rgba(177,48,74,0.12)]'
          : 'border-line focus:border-navy-600 focus:shadow-[0_0_0_3px_rgba(46,66,160,0.12)]',
        className,
      )}
      {...props}
    />
  )
})
