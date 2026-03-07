import { useState } from 'react'
import { Link } from 'react-router-dom'

interface AppDoc {
  id: string
  title: string
  slug: string
  domain_name: string
  freshness_badge: string
  view_count: number
}

interface Props {
  apps: AppDoc[]
}

const BADGE_LABELS: Record<string, string> = {
  green: 'Production',
  yellow: 'En cours',
  red: 'A verifier',
}

export default function ApplicationsView({ apps }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)

  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-2.5 py-16">
        <div className="font-display text-5xl text-ink-10">&empty;</div>
        <div className="font-mono text-xs text-ink-45">Aucune fiche applicative</div>
      </div>
    )
  }

  return (
    <div className="flex-1 grid grid-cols-3 max-md:grid-cols-2">
      {apps.map((app, idx) => {
        const isHovered = hovered === app.id
        return (
          <Link
            key={app.id}
            to={`/documents/${app.slug}`}
            className="border-r border-b border-ink-05 p-6 flex flex-col gap-2.5 cursor-pointer transition-all duration-100 no-underline"
            style={{
              animation: `fadeIn 0.25s ease-out ${0.05 * idx}s both`,
              background: isHovered ? '#1C1C1C' : 'transparent',
              color: isHovered ? '#FAFAF8' : '#1C1C1C',
            }}
            onMouseEnter={() => setHovered(app.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="font-display text-[26px] tracking-wider leading-tight">
              {app.title}
            </div>
            <div
              className="font-mono text-[9px] tracking-[1.5px] uppercase px-2 py-0.5 self-start transition-all duration-100"
              style={{
                border: `1.5px solid ${isHovered ? 'rgba(250,250,248,0.25)' : 'rgba(28,28,28,0.25)'}`,
                color: isHovered ? 'rgba(250,250,248,0.6)' : undefined,
              }}
            >
              {BADGE_LABELS[app.freshness_badge] || 'Production'}
            </div>
            <div
              className="font-mono text-[10px] mt-auto transition-colors duration-100"
              style={{ color: isHovered ? 'rgba(250,250,248,0.3)' : 'rgba(28,28,28,0.5)' }}
            >
              {app.domain_name} &middot; {app.view_count} vue{app.view_count !== 1 ? 's' : ''}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
