import type { LabelHTMLAttributes, ReactNode } from 'react'
import { Info, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

/* ========================================================================
   Field — wrapper d'un champ de formulaire (label + control + hint/error).
   Gabarits g1, g6 (meta form), g10 (tous les fields).
   ======================================================================== */

export interface FieldProps {
  children: ReactNode
  className?: string
}

/** Field — conteneur vertical (label → control → hint/error). */
export function Field({ children, className }: FieldProps) {
  return <div className={cn('flex flex-col gap-1.5', className)}>{children}</div>
}

export interface FieldLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Ajoute un astérisque coral indiquant un champ requis. */
  required?: boolean
  /** Texte d'aide positionné à droite du label (ex. "25 / 280"). */
  hintInline?: ReactNode
  children: ReactNode
}

/**
 * FieldLabel — label 12.5 px, weight 600, ink.
 * Supporte un astérisque requis (coral) et un hint-inline à droite.
 */
export function FieldLabel({ required, hintInline, children, className, ...props }: FieldLabelProps) {
  return (
    <label
      className={cn(
        'flex items-center justify-between gap-2',
        'text-[12.5px] font-semibold text-ink',
        className,
      )}
      {...props}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {required && <span className="text-coral font-bold">*</span>}
      </span>
      {hintInline && <span className="text-[11px] font-medium text-ink-muted">{hintInline}</span>}
    </label>
  )
}

export interface FieldHintProps {
  /** Afficher une icône info en tête (par défaut). Passer `false` pour désactiver. */
  icon?: ReactNode | false
  children: ReactNode
  className?: string
}

/** FieldHint — texte d'aide sous le contrôle (11.5 px ink-muted + icône info optionnelle). */
export function FieldHint({ icon, children, className }: FieldHintProps) {
  return (
    <span className={cn('flex items-center gap-1.5 text-[11.5px] text-ink-muted', className)}>
      {icon === false ? null : icon ?? <Info size={12} />}
      {children}
    </span>
  )
}

export interface FieldErrorProps {
  children: ReactNode
  className?: string
}

/** FieldError — message d'erreur 11.5 px danger + icône alerte. */
export function FieldError({ children, className }: FieldErrorProps) {
  return (
    <span className={cn('flex items-center gap-1.5 text-[11.5px] font-medium text-danger', className)}>
      <AlertCircle size={13} />
      {children}
    </span>
  )
}

type InlineMsgVariant = 'success' | 'info' | 'error'

const inlineMsgStyles: Record<InlineMsgVariant, { color: string; Icon: typeof Info }> = {
  success: { color: 'text-success', Icon: CheckCircle2 },
  info: { color: 'text-navy-700', Icon: Info },
  error: { color: 'text-danger', Icon: AlertCircle },
}

export interface InlineMsgProps {
  variant: InlineMsgVariant
  children: ReactNode
  className?: string
}

/**
 * InlineMsg — petit message contextuel (validation live, info latérale).
 * 11.5 px, icône de 13 px, couleur sémantique.
 * Gabarit g10 (inline-msg success / info).
 */
export function InlineMsg({ variant, children, className }: InlineMsgProps) {
  const { color, Icon } = inlineMsgStyles[variant]
  return (
    <span className={cn('flex items-center gap-1.5 text-[11.5px] font-medium', color, className)}>
      <Icon size={13} />
      {children}
    </span>
  )
}
