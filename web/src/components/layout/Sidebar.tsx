import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '@/lib/api'
import { useStatsHealth } from '@/lib/hooks/useStatsHealth'
import { useSidebar } from '@/lib/sidebar-context'

interface Domain {
  id: string; name: string; slug: string; color: string
  doc_count: number; entity_count: number; features_enabled: string[]
}
interface Stats {
  documents: number; entities: number; searches_month: number
  contributors: number; updates_month: number
}

interface SidebarProps {
  activeService?: string | null
  onServiceClick?: (domainId: string | null) => void
}

export default function Sidebar({ activeService: activeServiceProp, onServiceClick }: SidebarProps) {
  const { isOpen } = useSidebar()
  const navigate = useNavigate()
  const location = useLocation()
  const [domains, setDomains] = useState<Domain[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const { data: health } = useStatsHealth()

  useEffect(() => {
    api.get<Domain[]>('/domains').then(setDomains).catch(() => {})
    api.get<Stats>('/stats').then(setStats).catch(() => {})
  }, [])

  // Derive active service from URL if not provided via prop
  const activeService = activeServiceProp !== undefined
    ? activeServiceProp
    : (() => {
        const match = location.pathname.match(/^\/domains\/([^/]+)/)
        if (match) {
          const d = domains.find(d => d.slug === match[1])
          return d?.id ?? null
        }
        return null
      })()

  const services = domains.map(d => ({
    code: d.id,
    label: d.name,
    slug: d.slug,
    color: d.color,
    count: d.doc_count,
    entityCount: d.entity_count || 0,
    features: d.features_enabled || ['documents'],
  }))

  const handleServiceClick = (svc: typeof services[0]) => {
    if (onServiceClick) {
      onServiceClick(activeService === svc.code ? null : svc.code)
    } else {
      navigate(`/domains/${svc.slug}`)
    }
  }

  const statsData = [
    { label: 'Documents', value: stats?.documents ?? 0, trend: stats ? `+${stats.updates_month}` : undefined },
    { label: 'Fiches', value: stats?.entities ?? 0 },
    { label: 'Recherches / mois', value: stats?.searches_month ?? 0 },
    { label: 'Contributeurs', value: stats?.contributors ?? 0 },
  ]

  return (
    <aside style={{
      width: isOpen ? 240 : 0,
      minWidth: isOpen ? 240 : 0,
      overflow: 'hidden',
      opacity: isOpen ? 1 : 0,
      borderRight: isOpen ? '1px solid rgba(28,28,28,0.1)' : 'none',
      display: 'flex',
      flexDirection: 'column',
      background: '#F7F6F3',
      transition: 'width 0.2s ease, min-width 0.2s ease, opacity 0.2s ease',
      flexShrink: 0,
    }}>
      <div style={{
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 3,
        textTransform: 'uppercase' as const,
        color: 'rgba(28,28,28,0.6)',
        padding: '20px 20px 10px',
      }}>
        Services
      </div>

      {services.map(s => {
        const isActive = activeService === s.code
        return (
          <div
            key={s.code}
            onClick={() => handleServiceClick(s)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '11px 20px',
              cursor: 'pointer',
              borderBottom: '1px solid rgba(28,28,28,0.03)',
              transition: 'all 0.1s',
              userSelect: 'none' as const,
              background: isActive ? '#1C1C1C' : 'transparent',
              color: isActive ? '#FAFAF8' : '#1C1C1C',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(28,28,28,0.025)' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              background: s.color,
              border: `2px solid ${isActive ? 'rgba(250,250,248,0.35)' : '#1C1C1C'}`,
              flexShrink: 0,
            }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 13,
                fontWeight: 600,
              }}>
                {s.label}
              </span>
            </div>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              opacity: 0.5,
            }}>
              {s.count}{s.entityCount ? ` + ${s.entityCount}` : ''}
            </span>
          </div>
        )
      })}

      {health && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(28,28,28,0.08)' }}>
          <div style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: 'uppercase' as const,
            color: 'rgba(28,28,28,0.6)',
            marginBottom: 8,
          }}>
            Sante documentaire
          </div>
          <div style={{
            display: 'flex',
            height: 6,
            borderRadius: 1,
            overflow: 'hidden',
            background: 'rgba(28,28,28,0.06)',
          }}>
            {health.total > 0 && (
              <>
                <div style={{ width: `${(health.green / health.total) * 100}%`, background: '#22C55E' }} />
                <div style={{ width: `${(health.yellow / health.total) * 100}%`, background: '#EAB308' }} />
                <div style={{ width: `${(health.red / health.total) * 100}%`, background: '#C23B22' }} />
              </>
            )}
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 4,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            color: 'rgba(28,28,28,0.5)',
          }}>
            <span>{health.green} vert{health.green !== 1 ? 's' : ''}</span>
            <span>{health.yellow} jaune{health.yellow !== 1 ? 's' : ''}</span>
            <span>{health.red} rouge{health.red !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      <div style={{
        marginTop: 'auto',
        borderTop: '2px solid rgba(28,28,28,0.1)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
      }}>
        {statsData.map((s, i) => (
          <div key={i} style={{
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            borderBottom: '1px solid rgba(28,28,28,0.04)',
            borderRight: i % 2 === 0 ? '1px solid rgba(28,28,28,0.04)' : 'none',
          }}>
            <div style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: 24,
              lineHeight: 1,
            }}>
              {s.value}
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 8,
              textTransform: 'uppercase' as const,
              letterSpacing: 1.5,
              color: 'rgba(28,28,28,0.5)',
            }}>
              {s.label}
            </div>
            {s.trend && (
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 9,
                color: '#2B5797',
              }}>
                {s.trend}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  )
}
