import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SwitchProps {
  /** État actuel du toggle. API controlled only. */
  on: boolean
  /** Callback invoqué au click avec la nouvelle valeur. */
  onChange: (next: boolean) => void
  /** Désactive le toggle. */
  disabled?: boolean
  /** Label ARIA (obligatoire si pas de `<label>` externe associé). */
  'aria-label'?: string
  /** Permet d'associer ce bouton à un label externe via id. */
  id?: string
  className?: string
  /** Slot libre à gauche (ex. icône Moon / Sun). Ignore la sémantique. */
  children?: ReactNode
}

/**
 * Switch — toggle 38×22 contrôlé.
 *
 * API strictement controlled : passer `on` et `onChange`. Pas de defaultChecked.
 * Off : fond line. On : fond success. Pastille blanche 16×16 + shadow,
 * translate 16 px quand on.
 *
 * Gabarit de référence : g10 pref-row .switch / .switch.on.
 */
export function Switch({
  on,
  onChange,
  disabled,
  id,
  className,
  children,
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={on}
      aria-label={props['aria-label']}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        'relative inline-block shrink-0 cursor-pointer',
        'w-[38px] h-[22px] rounded-full',
        'transition-colors duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        on ? 'bg-success' : 'bg-line',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute top-[3px] left-[3px]',
          'w-4 h-4 rounded-full bg-white',
          'shadow-[0_1px_3px_rgba(20,35,92,0.2)]',
          'transition-transform duration-200',
          on && 'translate-x-4',
        )}
      />
      {children}
    </button>
  )
}
