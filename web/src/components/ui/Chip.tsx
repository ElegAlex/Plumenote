import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/* ==========================================================================
   DomainChip — pastille par domaine DSI (Infrastructure / Support / SCI / etc.)
   ========================================================================== */

type DomainKey = 'infra' | 'support' | 'sci' | 'etudes' | 'data' | 'neutral'

const domainStyles: Record<DomainKey, string> = {
  infra: 'bg-coral-bg text-coral',
  support: 'bg-success-bg text-success',
  sci: 'bg-navy-50 text-navy-700',
  etudes: 'bg-plum-bg text-plum',
  data: 'bg-warn-bg text-warn',
  neutral: 'bg-cream text-navy-800',
}

export interface DomainChipProps {
  domain: DomainKey
  children: ReactNode
  className?: string
}

/**
 * DomainChip — pastille colorée identifiant un domaine documentaire.
 * Couleur dérivée du domaine (infra = coral, support = success, sci = navy, etc.).
 */
export function DomainChip({ domain, children, className }: DomainChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full',
        'font-sans text-[10.5px] font-bold uppercase tracking-[0.08em]',
        domainStyles[domain],
        className,
      )}
    >
      <span className="w-[5px] h-[5px] rounded-full bg-current" />
      {children}
    </span>
  )
}

/* ==========================================================================
   TypeChip — pastille par type de document (Procédure, FAQ, Mode opératoire, etc.)
   ========================================================================== */

type DocTypeKey = 'proc' | 'mo' | 'faq' | 'arch' | 'ref' | 'guide'

const typeStyles: Record<DocTypeKey, string> = {
  proc: 'bg-navy-50 text-navy-700',
  mo: 'bg-coral-bg text-coral',
  faq: 'bg-success-bg text-success',
  arch: 'bg-plum-bg text-plum',
  ref: 'bg-warn-bg text-warn',
  guide: 'bg-cream text-navy-800',
}

export interface TypeChipProps {
  type: DocTypeKey
  children: ReactNode
  className?: string
}

/**
 * TypeChip — pastille par type de document, sobre, placée en tête de card/titre.
 */
export function TypeChip({ type, children, className }: TypeChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full',
        'font-sans text-[10.5px] font-bold uppercase tracking-[0.08em]',
        typeStyles[type],
        className,
      )}
    >
      <span className="w-[5px] h-[5px] rounded-full bg-current" />
      {children}
    </span>
  )
}

/* ==========================================================================
   FilterChip — chip de filtre actif avec bouton × de retrait.
   ========================================================================== */

export interface FilterChipProps {
  label: ReactNode
  value: ReactNode
  onRemove?: () => void
  className?: string
}

/**
 * FilterChip — chip de filtre actif type "Domaine : Infrastructure ×".
 * Fond cream avec bouton rond navy qui devient coral au hover.
 */
export function FilterChip({ label, value, onRemove, className }: FilterChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full',
        'bg-cream text-navy-900 border border-line-soft',
        'font-sans text-xs font-medium',
        className,
      )}
    >
      <span className="text-ink-soft">{label} : </span>
      <strong className="text-navy-900 font-semibold">{value}</strong>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Retirer le filtre"
          className={cn(
            'w-[18px] h-[18px] rounded-full grid place-items-center',
            'bg-navy-900 text-cream text-[11px] transition-colors',
            'hover:bg-coral cursor-pointer',
          )}
        >
          ×
        </button>
      )}
    </span>
  )
}
