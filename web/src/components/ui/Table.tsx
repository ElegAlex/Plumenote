import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/* ========================================================================
   Table — table stylée (gabarit g9 admin users).
   Structure fine, variants Tr `selected` / `overdue`, Th `sortable` / `sorted`.
   ======================================================================== */

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  children: ReactNode
}

/** Table — `<table>` 100 % largeur, border-collapse. */
export function Table({ className, children, ...props }: TableProps) {
  return (
    <table className={cn('w-full border-collapse', className)} {...props}>
      {children}
    </table>
  )
}

export interface THeadProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode
}

/** THead — wrapper du groupe d'en-tête. */
export function THead({ className, children, ...props }: THeadProps) {
  return (
    <thead className={className} {...props}>
      {children}
    </thead>
  )
}

export interface TBodyProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode
}

/** TBody — wrapper du corps de table. */
export function TBody({ className, children, ...props }: TBodyProps) {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  )
}

export interface TrProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Ligne sélectionnée (fond cream-light + gauche coral). */
  selected?: boolean
  /** Ligne en retard (fond danger-bg teinté). */
  overdue?: boolean
  children: ReactNode
}

/**
 * Tr — ligne de table.
 *
 * Variantes :
 * - `selected` : fond cream-light + liseré gauche coral. Utilisable pour sélection multi.
 * - `overdue` : fond danger-bg à 40 % (teinte douce). Lignes en retard dans un backlog.
 *
 * Par défaut : border-bottom line-soft + hover cream-light (gabarit g9).
 */
export function Tr({ selected, overdue, className, children, ...props }: TrProps) {
  return (
    <tr
      className={cn(
        'border-b border-line-soft transition-colors',
        'hover:bg-cream-light',
        '[&:last-child]:border-b-0',
        selected && 'bg-cream-light shadow-[inset_3px_0_0_var(--color-coral)]',
        overdue && 'bg-danger-bg/40',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  )
}

export interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** Colonne triable (curseur pointer). */
  sortable?: boolean
  /** Colonne en cours de tri (couleur navy-900 + flèche coral). */
  sorted?: boolean
  children: ReactNode
}

/**
 * Th — en-tête de colonne. Cream-light bg, 11 px uppercase ink-soft.
 * Variantes `sortable` + `sorted` (gabarit g9 thead th.sorted).
 */
export function Th({ sortable, sorted, className, children, ...props }: ThProps) {
  return (
    <th
      scope="col"
      className={cn(
        'text-left whitespace-nowrap',
        'px-4 py-[11px]',
        'bg-cream-light border-b border-line',
        'text-[11px] font-bold uppercase tracking-[0.08em]',
        sorted ? 'text-navy-900' : 'text-ink-soft',
        sortable && 'cursor-pointer select-none',
        className,
      )}
      {...props}
    >
      {children}
      {sorted && <span className="ml-1 text-coral" aria-hidden>↑</span>}
    </th>
  )
}

export interface TdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  children: ReactNode
}

/** Td — cellule de table. Padding 13 16, 13 px. */
export function Td({ className, children, ...props }: TdProps) {
  return (
    <td
      className={cn('px-4 py-[13px] align-middle text-[13px]', className)}
      {...props}
    >
      {children}
    </td>
  )
}
