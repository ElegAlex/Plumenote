// web/src/features/admin/VersionBanner.tsx
// Bandeau "version / ops" affiché en tête de la Console DSI (gabarit g9).
// Les valeurs sont statiques (visuel uniquement, pas de probes réelles en V1).
import { Code2, Database, Search, Clock } from 'lucide-react'
import { cn } from '@/lib/cn'

export default function VersionBanner() {
  return (
    <div
      className={cn(
        'flex items-center gap-4 flex-wrap',
        'px-[18px] py-3',
        'bg-gradient-to-br from-cream to-cream-light',
        'border border-line rounded-xl',
      )}
    >
      <Pill ok>PlumeNote opérationnel</Pill>
      <Pill>
        <Code2 size={12} aria-hidden />
        Version <strong>v0.1.0-mvp</strong>
      </Pill>
      <Pill>
        <Database size={12} aria-hidden />
        PostgreSQL <strong>18.2</strong>
      </Pill>
      <Pill>
        <Search size={12} aria-hidden />
        Meilisearch <strong>v1.37</strong>
      </Pill>
      <Pill className="ml-auto">
        <Clock size={12} aria-hidden />
        Uptime <strong>11 j 04 h</strong>
      </Pill>
    </div>
  )
}

function Pill({
  children,
  ok,
  className,
}: {
  children: React.ReactNode
  ok?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5',
        'px-[11px] py-[5px] rounded-full',
        'font-sans text-[11.5px] font-semibold',
        ok
          ? cn(
              'bg-success-bg text-success border border-transparent',
              "before:content-[''] before:w-[7px] before:h-[7px] before:rounded-full before:bg-success",
              'before:shadow-[0_0_0_3px_rgba(47,125,91,0.15)]',
            )
          : 'bg-white text-ink-soft border border-line',
        '[&_strong]:text-navy-900 [&_strong]:font-mono [&_strong]:text-[11px] [&_strong]:font-semibold',
        className,
      )}
    >
      {children}
    </span>
  )
}
