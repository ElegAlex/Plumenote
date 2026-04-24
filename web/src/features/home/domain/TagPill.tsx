import { cn } from '@/lib/cn'

/**
 * TagPill — petit chip `#tag` utilisé dans les doc-cards g7.
 * Fond cream, bordure line-soft, `#` coral en prefix.
 * Gabarit g7 `.card-tag`.
 */
export interface TagPillProps {
  children: React.ReactNode
  className?: string
}

export default function TagPill({ children, className }: TagPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center',
        'text-[10.5px] font-semibold',
        'px-2 py-0.5 rounded-full',
        'bg-cream text-navy-900 border border-line-soft',
        'before:content-["#"] before:text-coral before:font-bold',
        className,
      )}
    >
      {children}
    </span>
  )
}
