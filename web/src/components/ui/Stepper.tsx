import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

type StepStatus = 'done' | 'current' | 'todo'

export interface StepperProps {
  children: ReactNode
  columns?: number
  className?: string
}

/**
 * Stepper — workflow horizontal numéroté, carte blanche avec points connectés.
 * Par défaut 4 colonnes (cas d'usage import dossier). Adapter via `columns`.
 *
 * Usage :
 *   <Stepper columns={4}>
 *     <Step status="done" label="Étape 1" title="Source" />
 *     <Step status="current" label="Étape 2" title="Aperçu" />
 *     ...
 *   </Stepper>
 */
export function Stepper({ children, columns = 4, className }: StepperProps) {
  return (
    <nav
      aria-label="Progression"
      className={cn(
        'bg-white border border-line rounded-2xl p-4 px-5',
        'grid gap-2',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      <style>{`
        @keyframes step-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(232,132,92,.2); }
          50% { box-shadow: 0 0 0 8px rgba(232,132,92,.1); }
        }
      `}</style>
      {children}
    </nav>
  )
}

export interface StepProps {
  status: StepStatus
  label: ReactNode
  title: ReactNode
  index?: number
  className?: string
}

const bulletStyles: Record<StepStatus, string> = {
  done: 'bg-success border-success text-white',
  current: 'bg-coral border-coral text-white animate-[step-pulse_2.4s_infinite]',
  todo: 'bg-white border-line text-ink-muted',
}

const labelColors: Record<StepStatus, string> = {
  done: 'text-success',
  current: 'text-coral',
  todo: 'text-ink-muted',
}

/**
 * Step — étape individuelle du Stepper.
 * Afficher un ✓ si `done`, le numéro (prop `index` ou "1" par défaut) sinon.
 */
export function Step({ status, label, title, index, className }: StepProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-2 px-2.5 rounded-lg relative',
        status === 'current' && 'bg-gradient-to-br from-coral-bg to-cream-light',
        className,
      )}
    >
      <span
        className={cn(
          'w-8 h-8 rounded-full border-[1.5px] grid place-items-center shrink-0',
          'font-serif font-semibold text-[13px]',
          bulletStyles[status],
        )}
      >
        {status === 'done' ? <Check size={13} strokeWidth={3} /> : index ?? '1'}
      </span>
      <div className="min-w-0">
        <span className={cn('block text-[10.5px] font-bold uppercase tracking-[0.08em]', labelColors[status])}>
          {label}
        </span>
        <span className="block text-[13.5px] font-bold text-ink mt-0.5">{title}</span>
      </div>
    </div>
  )
}
