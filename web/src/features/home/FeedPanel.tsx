import { useNavigate } from 'react-router-dom'
import { useFeed } from '@/lib/hooks'
import type { FeedItem } from '@/lib/types'

interface FeedPanelProps {
  domainId?: string
}

const FRESHNESS_COLORS: Record<string, string> = {
  green: '#22C55E',
  yellow: '#EAB308',
  red: '#C23B22',
}

const FRESHNESS_LABELS: Record<string, string> = {
  green: 'OK',
  yellow: 'Ancien',
  red: 'Obsolète',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR')
}

export default function FeedPanel({ domainId }: FeedPanelProps) {
  const navigate = useNavigate()
  const { data: items, isLoading, isError } = useFeed({ domainId, limit: 10 })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 300, overflow: 'hidden' }}>
      <div style={{
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 2,
        textTransform: 'uppercase' as const,
        color: 'rgba(28,28,28,0.6)',
        marginBottom: 12,
      }}>
        ACTIVIT&Eacute; R&Eacute;CENTE
      </div>

      {isLoading && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'rgba(28,28,28,0.5)', padding: '16px 0' }}>
          Chargement...
        </div>
      )}

      {isError && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#C23B22', padding: '16px 0' }}>
          Erreur de chargement
        </div>
      )}

      {!isLoading && !isError && (!items || items.length === 0) && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'rgba(28,28,28,0.4)', padding: '16px 0' }}>
          Aucune activit&eacute; r&eacute;cente
        </div>
      )}

      {!isLoading && !isError && items && items.length > 0 && (
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {items.map((item: FeedItem) => (
            <div
              key={item.id}
              onClick={() => navigate(`/documents/${item.slug}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 0',
                borderBottom: '1px solid rgba(28,28,28,0.04)',
                cursor: 'pointer',
                transition: 'background 0.08s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(28,28,28,0.02)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              {/* Domain color dot */}
              <div style={{
                width: 7,
                height: 7,
                borderRadius: 1,
                background: item.domain_color || '#1C1C1C',
                border: '1.5px solid #1C1C1C',
                flexShrink: 0,
              }} />

              {/* Title + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#1C1C1C',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap' as const,
                }}>
                  {item.title}
                </div>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 9,
                  color: 'rgba(28,28,28,0.5)',
                  marginTop: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap' as const,
                }}>
                  {item.domain_name} · {item.author_name} · {formatDate(item.updated_at)}
                </div>
              </div>

              {/* Freshness badge */}
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 8,
                letterSpacing: 1,
                textTransform: 'uppercase' as const,
                color: FRESHNESS_COLORS[item.freshness_badge] || '#22C55E',
                border: `1.5px solid ${FRESHNESS_COLORS[item.freshness_badge] || '#22C55E'}`,
                padding: '1px 6px',
                borderRadius: 1,
                flexShrink: 0,
              }}>
                {FRESHNESS_LABELS[item.freshness_badge] || 'OK'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
