import type { ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/cn'

type TimelineDotStatus = 'done' | 'current' | 'upcoming' | 'refused' | 'coral' | 'navy'

const dotStyles: Record<TimelineDotStatus, string> = {
  done: 'bg-success-bg border-success text-success',
  current:
    'bg-coral border-coral text-white shadow-[0_0_0_4px_rgba(232,132,92,.2)] animate-[dot-pulse_2.4s_infinite]',
  upcoming: 'bg-white border-line text-ink-muted',
  refused: 'bg-danger-bg border-danger text-danger',
  coral: 'bg-coral-bg border-coral text-coral',
  navy: 'bg-navy-50 border-navy-700 text-navy-700',
}

export interface TimelineProps {
  children: ReactNode
  className?: string
}

/**
 * Timeline — liste verticale d'événements reliés par une ligne grise.
 * Usage : <Timeline><TimelineEvent .../><TimelineEvent .../></Timeline>
 */
export function Timeline({ children, className }: TimelineProps) {
  return (
    <div
      className={cn(
        'relative pl-0',
        // ligne verticale reliant les points : left ajusté au centre des dot (11px + 1px)
        'before:absolute before:content-[""] before:left-[10px] before:top-6 before:bottom-8',
        'before:w-[2px] before:bg-line-soft before:rounded',
        className,
      )}
    >
      <style>{`
        @keyframes dot-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(232,132,92,.2); }
          50% { box-shadow: 0 0 0 6px rgba(232,132,92,.1); }
        }
      `}</style>
      {children}
    </div>
  )
}

export interface TimelineEventProps {
  status?: TimelineDotStatus
  label: ReactNode
  meta?: ReactNode
  icon?: ReactNode
  className?: string
}

/**
 * TimelineEvent — un événement du timeline (dot + label + méta).
 * - status="done" affiche un ✓ (success)
 * - status="current" pulse coral
 * - status="upcoming" dot vide
 * - status="refused" affiche un × (danger)
 */
export function TimelineEvent({ status = 'done', label, meta, icon, className }: TimelineEventProps) {
  const defaultIcon =
    status === 'done' ? <Check size={11} strokeWidth={3} /> :
    status === 'refused' ? <X size={11} strokeWidth={3} /> :
    null

  return (
    <div className={cn('relative grid grid-cols-[22px_1fr] gap-3 pb-4 last:pb-0', className)}>
      <span
        className={cn(
          'w-[22px] h-[22px] rounded-full border-2 grid place-items-center mt-0.5',
          'z-[1] shrink-0 text-[10px] font-bold',
          dotStyles[status],
        )}
      >
        {icon ?? defaultIcon}
      </span>
      <div className="min-w-0 pt-0.5">
        <div
          className={cn(
            'text-[12.5px] font-bold leading-tight',
            status === 'upcoming' ? 'text-ink-muted' : 'text-navy-900',
            status === 'current' && 'text-coral',
          )}
        >
          {label}
        </div>
        {meta && (
          <div className="text-[11.5px] text-ink-soft mt-0.5 tabular-nums leading-snug">{meta}</div>
        )}
      </div>
    </div>
  )
}
