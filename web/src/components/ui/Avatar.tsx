import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type AvatarSize = 'xs' | 'sm' | 'md' | 'xl'
type AvatarVariant = 'a' | 'b' | 'c' | 'd' | 'e' | 'f'

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-[9px]',
  sm: 'w-8 h-8 text-[11px]',
  md: 'w-11 h-11 text-[13px]',
  xl: 'w-[72px] h-[72px] text-[26px] font-serif border-[3px] border-white/25 shadow-[0_8px_20px_rgba(20,35,92,.3)]',
}

const gradientClasses: Record<AvatarVariant, string> = {
  a: 'bg-gradient-to-br from-navy-700 to-coral',
  b: 'bg-gradient-to-br from-navy-900 to-success',
  c: 'bg-gradient-to-br from-coral to-coral-soft',
  d: 'bg-gradient-to-br from-plum to-coral',
  e: 'bg-gradient-to-br from-success to-navy-600',
  f: 'bg-gradient-to-br from-navy-700 to-warn',
}

export interface AvatarProps {
  initials: string
  size?: AvatarSize
  variant?: AvatarVariant
  className?: string
  title?: string
}

/**
 * Avatar — rond gradienté avec initiales.
 * 4 tailles, 6 variantes de gradient.
 */
export function Avatar({ initials, size = 'md', variant = 'a', className, title }: AvatarProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-grid place-items-center rounded-full shrink-0',
        'text-white font-bold',
        sizeClasses[size],
        gradientClasses[variant],
        className,
      )}
    >
      {initials.slice(0, 2).toUpperCase()}
    </span>
  )
}

/**
 * AvatarStack — empile des avatars avec chevauchement et bordure blanche.
 * Affiche un badge "+N" si plus d'avatars que `max`.
 */
export function AvatarStack({
  children,
  more,
  className,
}: {
  children: ReactNode
  more?: number
  className?: string
}) {
  return (
    <div className={cn('flex items-center [&>*+*]:-ml-2 [&>*]:border-2 [&>*]:border-white', className)}>
      {children}
      {more && more > 0 ? (
        <span className="inline-grid place-items-center w-6 h-6 rounded-full bg-cream text-navy-800 text-[10px] font-bold border-2 border-white">
          +{more}
        </span>
      ) : null}
    </div>
  )
}
