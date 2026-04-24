import { useEffect } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

export interface DialogProps {
  /** Ouvre / ferme la modale. */
  open: boolean
  /** Callback appelé au click backdrop ou touche Escape. */
  onClose: () => void
  /** Largeur max (par défaut 640 px). */
  maxWidth?: number
  /** Offset top pour centrer en haut plutôt qu'au centre vertical (par défaut 80 px). */
  topOffset?: number
  /** Label ARIA pour la modale (par défaut "Dialogue"). */
  'aria-label'?: string
  children: ReactNode
  className?: string
}

/**
 * Dialog — modale simple portée dans document.body.
 *
 * Comportement :
 * - Click backdrop → `onClose()`.
 * - Escape → `onClose()`.
 * - Scroll body verrouillé le temps de l'ouverture.
 *
 * Style : backdrop navy-900 alpha 0.5 + blur 6 px, modal blanc bordé rounded-2xl.
 * Gabarit de référence : g4 ck-overlay / ck-modal (Ctrl+K).
 *
 * Composition :
 *   <Dialog open={…} onClose={…}>
 *     <DialogHead>…</DialogHead>
 *     <DialogBody>…</DialogBody>
 *     <DialogFoot>…</DialogFoot>
 *   </Dialog>
 */
export function Dialog({
  open,
  onClose,
  maxWidth = 640,
  topOffset = 80,
  children,
  className,
  ...props
}: DialogProps) {
  // Fermeture Escape + lock du scroll body.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      // Backdrop
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex justify-center bg-[rgba(20,35,92,0.5)] backdrop-blur-[6px] animate-[fadeIn_.15s_ease-out]"
      style={{ paddingTop: topOffset }}
    >
      <div
        // Modal
        role="dialog"
        aria-modal="true"
        aria-label={props['aria-label'] ?? 'Dialogue'}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full h-fit bg-white border border-line rounded-[18px] overflow-hidden',
          'shadow-[0_40px_80px_rgba(20,35,92,0.35)]',
          'flex flex-col animate-[slideUp_.2s_ease-out]',
          className,
        )}
        style={{ maxWidth }}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

export interface DialogHeadProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

/** DialogHead — en-tête de modale (padding 18 22 + border-bottom line-soft). */
export function DialogHead({ className, children, ...props }: DialogHeadProps) {
  return (
    <div
      className={cn(
        'px-[22px] py-[18px] border-b border-line-soft',
        'flex items-center justify-between gap-3',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface DialogBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

/** DialogBody — corps de modale (padding 22 + scroll interne possible). */
export function DialogBody({ className, children, ...props }: DialogBodyProps) {
  return (
    <div
      className={cn('px-[22px] py-[18px] overflow-y-auto', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export interface DialogFootProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

/**
 * DialogFoot — pied de modale (border-top line-soft + fond cream-light,
 * boutons alignés à droite).
 */
export function DialogFoot({ className, children, ...props }: DialogFootProps) {
  return (
    <div
      className={cn(
        'px-[22px] py-[14px]',
        'border-t border-line-soft bg-cream-light',
        'flex items-center justify-end gap-2',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
