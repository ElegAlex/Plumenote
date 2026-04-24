import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SidePanelProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  /** Offset sticky top (par défaut 78 px). */
  stickyTop?: number
}

/**
 * SidePanel — colonne latérale droite sticky présente sur les pages de
 * lecture / édition (meta-panel en g5, meta-side en g6).
 *
 * Flex-col gap 4, sticky top 78 px (adaptable via `stickyTop`),
 * max-height `calc(100vh - 100px)`, overflow-y auto.
 *
 * Le contenu interne reste libre : Card, Timeline, blocs de stats, etc.
 */
export function SidePanel({ children, stickyTop = 78, className, style, ...props }: SidePanelProps) {
  return (
    <aside
      className={cn(
        'flex flex-col gap-4 self-start sticky',
        'overflow-y-auto',
        className,
      )}
      style={{
        top: stickyTop,
        maxHeight: `calc(100vh - ${stickyTop + 22}px)`,
        ...style,
      }}
      {...props}
    >
      {children}
    </aside>
  )
}
