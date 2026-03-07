import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface Domain {
  id: string
  name: string
  slug: string
  color: string
  doc_count: number
}

interface Stats {
  documents: number
  searches_month: number
  contributors: number
  updates_month: number
}

interface Props {
  activeService: string | null
  onServiceChange: (service: string | null) => void
}

export default function SidebarNew({ activeService, onServiceChange }: Props) {
  const [domains, setDomains] = useState<Domain[]>([])
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    api.get<Domain[]>('/domains').then(setDomains).catch(() => {})
    api.get<Stats>('/stats').then(setStats).catch(() => {})
  }, [])

  return (
    <aside className="border-r border-ink-10 flex flex-col bg-bg max-md:hidden">
      <div className="font-sans text-[9px] font-bold tracking-[3px] uppercase text-ink-45 px-5 pt-5 pb-2.5">
        Services
      </div>

      {domains.map((d) => {
        const isOn = activeService === d.id
        return (
          <div
            key={d.id}
            onClick={() => onServiceChange(isOn ? null : d.id)}
            className={`flex items-center gap-2.5 px-5 py-2.5 cursor-pointer border-b border-ink-05 transition-all duration-100 select-none ${
              isOn ? 'bg-ink text-ink-hover' : 'hover:bg-ink-05'
            }`}
          >
            <div
              className="w-3 h-3 rounded-sm shrink-0"
              style={{
                backgroundColor: d.color,
                border: `2px solid ${isOn ? 'rgba(250,250,248,0.35)' : '#1C1C1C'}`,
              }}
            />
            <span className="font-sans text-[13px] font-semibold flex-1">{d.name}</span>
            <span className="font-mono text-[10px] opacity-50">{d.doc_count}</span>
          </div>
        )
      })}

      {/* Stats grid */}
      <div className="mt-auto border-t-2 border-ink-10 grid grid-cols-2">
        {[
          { label: 'Documents', value: stats?.documents ?? 0 },
          { label: 'Recherches / mois', value: stats?.searches_month ?? 0 },
          { label: 'Contributeurs', value: stats?.contributors ?? 0 },
          { label: 'Mises a jour', value: stats?.updates_month ?? 0 },
        ].map((s, i) => (
          <div
            key={s.label}
            className={`px-4 py-3.5 flex flex-col gap-px border-b border-ink-05 ${
              i % 2 === 0 ? 'border-r border-r-ink-05' : ''
            }`}
          >
            <div className="font-display text-2xl leading-none">{s.value}</div>
            <div className="font-mono text-[8px] uppercase tracking-[1.5px] text-ink-45">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
