import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type FreshStatus = 'ok' | 'warn' | 'danger'

const styles: Record<FreshStatus, { chip: string; dot: string; text: string }> = {
  ok: {
    chip: 'bg-success-bg text-success',
    dot: 'bg-success',
    text: 'text-success',
  },
  warn: {
    chip: 'bg-warn-bg text-warn',
    dot: 'bg-warn shadow-[0_0_0_3px_rgba(201,123,26,.15)]',
    text: 'text-warn',
  },
  danger: {
    chip: 'bg-danger-bg text-danger',
    dot: 'bg-danger shadow-[0_0_0_3px_rgba(177,48,74,.15)]',
    text: 'text-danger',
  },
}

export interface FreshBadgeProps {
  status: FreshStatus
  children: ReactNode
  className?: string
  /**
   * Variante compacte sans pilule : un simple dot + texte coloré.
   * Gabarit g7 `.fresh-badge` (top-right d'une doc-card). Par défaut la
   * variante "pill" est rendue (gabarit g5).
   */
  inline?: boolean
}

/**
 * FreshBadge — indicateur de fraîcheur (🟢 à jour, 🟡 vieillissant, 🔴 périmé).
 *
 * Deux variantes :
 * - par défaut (pilule) : chip coloré `bg-*-bg text-*`, usage gabarit g5.
 *   Usage : <FreshBadge status="ok">À jour</FreshBadge>
 * - `inline` : dot + texte coloré, sans fond. Usage gabarit g7 `.fresh-badge`
 *   (top-right d'une doc-card).
 *   Usage : <FreshBadge status="warn" inline>3 mois</FreshBadge>
 */
export function FreshBadge({ status, children, className, inline = false }: FreshBadgeProps) {
  const s = styles[status]
  if (inline) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5',
          'font-sans text-[11px] font-bold tabular-nums whitespace-nowrap',
          s.text,
          className,
        )}
      >
        <span
          className={cn(
            'w-[8px] h-[8px] rounded-full shrink-0',
            status === 'ok'
              ? 'bg-success shadow-[0_0_0_3px_rgba(47,125,91,.15)]'
              : s.dot,
          )}
        />
        {children}
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full',
        'font-sans text-[11px] font-bold tabular-nums whitespace-nowrap',
        s.chip,
        className,
      )}
    >
      <span className={cn('w-[7px] h-[7px] rounded-full shrink-0', s.dot)} />
      {children}
    </span>
  )
}

/**
 * computeFreshStatus — utilitaire pour calculer le statut à partir d'une date de vérification
 * et de seuils (en mois). Par défaut : ok < 6 mois, warn < 12 mois, danger >= 12 mois.
 */
export function computeFreshStatus(
  verifiedAt: Date | string | null | undefined,
  thresholds: { okMonths?: number; warnMonths?: number } = {},
): FreshStatus {
  const { okMonths = 6, warnMonths = 12 } = thresholds
  if (!verifiedAt) return 'danger'
  const d = typeof verifiedAt === 'string' ? new Date(verifiedAt) : verifiedAt
  const months = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
  if (months < okMonths) return 'ok'
  if (months < warnMonths) return 'warn'
  return 'danger'
}
