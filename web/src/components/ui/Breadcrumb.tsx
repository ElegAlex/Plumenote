import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

export interface BreadcrumbItem {
  label: ReactNode
  /** Cible interne (react-router). Absent = item courant (rendu en strong Fraunces). */
  href?: string
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[]
  /** Label ARIA (par défaut "Fil d'ariane"). */
  'aria-label'?: string
  className?: string
}

/**
 * Breadcrumb — fil d'ariane `<nav class="crumb">`.
 *
 * - Items avec `href` : `<Link>` react-router, couleur ink-soft.
 * - Dernier item sans `href` : `<strong>` navy-800 Fraunces (item courant).
 * - Séparateur › ink-muted.
 *
 * Gabarit de référence : structure commune g2, g4, g5, g7, g9.
 */
export function Breadcrumb({ items, className, ...props }: BreadcrumbProps) {
  return (
    <nav
      aria-label={props['aria-label'] ?? "Fil d'ariane"}
      className={cn(
        'flex items-center gap-2 text-[13px] text-ink-soft',
        className,
      )}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <Fragment key={i}>
            {i > 0 && <span className="text-ink-muted" aria-hidden>›</span>}
            {isLast || !item.href ? (
              <strong className="font-serif font-semibold text-navy-900">{item.label}</strong>
            ) : (
              <Link
                to={item.href}
                className="text-ink-soft no-underline hover:text-navy-800 transition-colors"
              >
                {item.label}
              </Link>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
