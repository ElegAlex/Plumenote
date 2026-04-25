import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/* ========================================================================
   Toolbar — barre d'outils éditeur TipTap (gabarit g6).
   ======================================================================== */

export interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  /** Offset sticky top (par défaut 68 px = header Shell). Vague 1+ peut l'ajuster. */
  stickyTop?: number
  children: ReactNode
}

/**
 * Toolbar — conteneur sticky de la toolbar éditeur.
 *
 * Style : `bg-cream-light border-b border-line-soft p-[10px_14px] flex gap-1 flex-wrap sticky`.
 * `stickyTop` pilotable pour s'adapter à la hauteur du header Shell.
 *
 * Gabarit de référence : g6 .toolbar.
 */
export function Toolbar({ stickyTop = 68, className, children, style, ...props }: ToolbarProps) {
  return (
    <div
      className={cn(
        'sticky z-[4]',
        'bg-cream-light border-b border-line-soft',
        'px-[14px] py-[10px]',
        'flex items-center gap-1 flex-wrap',
        className,
      )}
      style={{ top: stickyTop, ...style }}
      {...props}
    >
      {children}
    </div>
  )
}

export interface ToolbarGroupProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

/** ToolbarGroup — groupe logique de boutons (gap 2 px). */
export function ToolbarGroup({ className, children, ...props }: ToolbarGroupProps) {
  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      {...props}
    >
      {children}
    </div>
  )
}

/** ToolbarSeparator — séparateur vertical 1 px × 22 px, couleur line. */
export function ToolbarSeparator({ className }: { className?: string }) {
  return <span className={cn('inline-block w-px h-[22px] bg-line mx-1', className)} aria-hidden />
}

export interface ToolbarButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** Bouton actif (fond navy-900 + white). */
  active?: boolean
  children: ReactNode
}

/**
 * ToolbarButton — bouton 32 px de la toolbar (icône 14 px).
 * Hover : fond white + navy-800. Active : fond navy-900 + white.
 */
export function ToolbarButton({ active, className, children, ...props }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex items-center justify-center gap-1.5',
        'min-w-[32px] h-8 px-2 rounded-[7px]',
        'text-[12.5px] font-semibold font-sans cursor-pointer',
        'transition-[background-color,color]',
        '[&_svg]:w-[14px] [&_svg]:h-[14px]',
        active
          ? 'bg-navy-900 text-white'
          : 'bg-transparent text-ink-soft hover:bg-white hover:text-navy-800',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export interface ToolbarSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  children: ReactNode
}

// Chevron inline repris verbatim du gabarit g6 (ligne 116).
const CHEVRON_BG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%235A6380' stroke-width='1.5' fill='none'/></svg>\") no-repeat right 8px center"

/**
 * ToolbarSelect — select natif stylé de la toolbar (ex. choix du heading).
 * Plus compact qu'un Select standard (7 px radius, 12.5 px).
 */
export function ToolbarSelect({ className, style, children, ...props }: ToolbarSelectProps) {
  return (
    <select
      style={{ background: `white ${CHEVRON_BG}`, ...style }}
      className={cn(
        'appearance-none cursor-pointer outline-none',
        'pl-[10px] pr-[26px] py-[6px]',
        'border border-line rounded-[7px]',
        'text-[12.5px] font-semibold text-ink font-sans',
        'focus:border-navy-600',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
