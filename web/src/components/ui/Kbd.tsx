import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Kbd — affichage d'une touche clavier (ex. Ctrl, K, ↵).
 * Usage : <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>
 */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center',
        'px-1.5 py-0.5 bg-bg border border-line rounded',
        'font-sans text-[10.5px] font-bold text-ink tabular-nums leading-none',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
