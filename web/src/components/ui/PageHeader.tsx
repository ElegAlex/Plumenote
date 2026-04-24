import type { ReactNode } from 'react'
import { Breadcrumb, type BreadcrumbItem } from './Breadcrumb'
import { cn } from '@/lib/cn'

export interface PageHeaderProps {
  /** Fil d'ariane (dernier item = page courante en Fraunces navy). */
  breadcrumb?: BreadcrumbItem[]
  /** Contenu du slot droit (boutons d'action, IconButton, etc.). */
  actions?: ReactNode
  /** Permet un z-index supérieur si la page a déjà une Toolbar sticky. */
  className?: string
}

/**
 * PageHeader — bandeau supérieur sticky top de page (breadcrumb + actions).
 *
 * Volontairement épuré vs gabarit g2 (pas de search inline ni user-chip).
 * Ces éléments vivront dans le Shell (Vague 1). Ce header sert les pages
 * internes qui doivent poser un fil d'ariane et un ensemble d'actions au
 * dessus du contenu.
 *
 * Gabarits (motif commun) : g2, g4, g5, g7, g9.
 */
export function PageHeader({ breadcrumb, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-[5]',
        'bg-white border-b border-line',
        'px-8 py-[14px]',
        'flex items-center gap-5 min-h-[68px]',
        className,
      )}
    >
      {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} />}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </header>
  )
}
