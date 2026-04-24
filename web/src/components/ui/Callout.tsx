import type { ReactNode } from 'react'
import { Zap, AlertTriangle, AlertOctagon, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/cn'

type CalloutVariant = 'tip' | 'info' | 'warn' | 'danger' | 'success'

const variantStyles: Record<CalloutVariant, { container: string; iconBg: string; iconColor: string; Default: typeof Zap }> = {
  tip: {
    container: 'bg-coral-bg border-coral',
    iconBg: 'bg-white',
    iconColor: 'text-coral',
    Default: Zap,
  },
  info: {
    container: 'bg-[#E9EAF7] border-navy-700',
    iconBg: 'bg-white',
    iconColor: 'text-navy-700',
    Default: Info,
  },
  warn: {
    container: 'bg-warn-bg border-warn',
    iconBg: 'bg-white',
    iconColor: 'text-warn',
    Default: AlertTriangle,
  },
  danger: {
    container: 'bg-danger-bg border-danger',
    iconBg: 'bg-white',
    iconColor: 'text-danger',
    Default: AlertOctagon,
  },
  success: {
    container: 'bg-success-bg border-success',
    iconBg: 'bg-white',
    iconColor: 'text-success',
    Default: CheckCircle2,
  },
}

export interface CalloutProps {
  variant?: CalloutVariant
  title?: ReactNode
  icon?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Callout — bloc d'attention (Astuce, Info, Attention, Danger, Validé).
 * Border-left coloré + fond tinté + icône dans un carré blanc.
 *
 * Usage :
 *   <Callout variant="tip" title="Astuce">
 *     Texte avec <strong>emphase</strong> et <a>liens</a>.
 *   </Callout>
 */
export function Callout({ variant = 'tip', title, icon, children, className }: CalloutProps) {
  const s = variantStyles[variant]
  const IconComponent = s.Default
  return (
    <div
      className={cn(
        'my-5 p-4 pl-5 rounded-xl border-l-4 flex gap-3',
        s.container,
        className,
      )}
    >
      <div className={cn('w-8 h-8 rounded-lg grid place-items-center shrink-0', s.iconBg, s.iconColor)}>
        {icon ?? <IconComponent size={16} />}
      </div>
      <div className="text-sm leading-relaxed text-ink min-w-0 flex-1">
        {title && <strong className="text-navy-900 font-bold">{title}</strong>}
        {title && ' '}
        {children}
      </div>
    </div>
  )
}
