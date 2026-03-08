import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { useEntities, useEntityLabel } from '@/lib/hooks'
import FreshnessBadge from './FreshnessBadge'
import TimeAgo from './TimeAgo'
import BookmarkList from '@/features/bookmark/BookmarkList'
import BookmarkForm from '@/features/bookmark/BookmarkForm'
import CartographyView from '@/features/entity/CartographyView'
import MindMapView from '@/features/mindmap/MindMapView'

interface Domain {
  id: string
  name: string
  slug: string
  color: string
  doc_count: number
  entity_count: number
  features_enabled: string[]
}

interface Doc {
  id: string
  title: string
  slug: string
  freshness_badge: 'green' | 'yellow' | 'red'
  author_name: string
  updated_at: string
  verified_at?: string
  view_count: number
}

type Tab = 'documents' | 'entities' | 'cartography' | 'mindmap'

export default function DomainPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [domain, setDomain] = useState<Domain | null>(null)
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('documents')
  const [showBookmarkForm, setShowBookmarkForm] = useState(false)
  const { data: entityLabelConfig } = useEntityLabel()
  const entityLabel = entityLabelConfig?.label ?? 'Fiche'
  const { data: entities } = useEntities({ domainId: domain?.id })

  useEffect(() => {
    if (!slug) return
    Promise.all([
      api.get<Domain[]>('/domains').then((domains) => domains.find((d) => d.slug === slug) || null),
      api.get<Doc[]>(`/documents?domain=${slug}&sort=recent`),
    ])
      .then(([d, docList]) => {
        setDomain(d)
        setDocs(docList)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div style={{ padding: 24, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'rgba(28,28,28,0.5)' }}>
        Chargement...
      </div>
    )
  }

  if (!domain) {
    return (
      <div style={{ padding: 24, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'rgba(28,28,28,0.5)' }}>
        Domaine introuvable.
      </div>
    )
  }

  const hasCartography = domain.features_enabled?.includes('cartography')
  const hasEntities = domain.features_enabled?.includes('entities') || domain.features_enabled?.includes('cartography')
  const hasMindMap = domain.features_enabled?.includes('mindmap')
  const hasMultipleTabs = hasEntities || hasCartography || hasMindMap

  const isFullHeight = activeTab === 'cartography' || activeTab === 'mindmap'
  const entityCount = domain.entity_count || 0

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: isFullHeight ? 'calc(100vh - 58px)' : undefined,
      height: isFullHeight ? 'calc(100vh - 58px)' : undefined,
      fontFamily: "'IBM Plex Mono', monospace",
      color: '#1C1C1C',
    }}>
      <style>{`
        .dp-tab {
          font-family: 'IBM Plex Sans', sans-serif; font-size: 11.5px; font-weight: 600;
          letter-spacing: 1px; text-transform: uppercase;
          padding: 12px 22px; cursor: pointer;
          border-right: 1px solid rgba(28,28,28,0.04);
          transition: all 0.1s; user-select: none;
          position: relative; border: none; background: none;
          color: rgba(28,28,28,0.6);
        }
        .dp-tab:hover { color: #1C1C1C; }
        .dp-tab.on { color: #1C1C1C; background: #FBFBF9; }
        .dp-tab.on::after {
          content: ''; position: absolute; top: 0; left: 0; right: 0;
          height: 2px; background: #2B5797;
        }
        .dp-doc-row {
          display: grid; grid-template-columns: 28px 1fr auto auto auto;
          align-items: center; gap: 8px;
          padding: 12px 24px;
          border-bottom: 1px solid rgba(28,28,28,0.04);
          cursor: pointer; transition: background 0.08s;
          text-decoration: none; color: inherit;
        }
        .dp-doc-row:hover { background: rgba(28,28,28,0.02); }
        .dp-doc-row:hover .dp-doc-title { text-decoration: underline; text-underline-offset: 3px; }
        .dp-doc-title {
          font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; font-weight: 600;
          color: #1C1C1C; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .dp-doc-author {
          font-family: 'IBM Plex Mono', monospace; font-size: 10px;
          color: rgba(28,28,28,0.5); white-space: nowrap;
        }
        .dp-doc-views {
          font-family: 'IBM Plex Mono', monospace; font-size: 10px;
          color: rgba(28,28,28,0.4); white-space: nowrap;
        }
        .dp-doc-row time {
          font-family: 'IBM Plex Sans', sans-serif; font-size: 10px;
          color: rgba(28,28,28,0.45); white-space: nowrap;
        }
        .dp-entity-row {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 24px;
          border-bottom: 1px solid rgba(28,28,28,0.04);
          cursor: pointer; transition: background 0.08s;
          text-decoration: none; color: inherit;
        }
        .dp-entity-row:hover { background: rgba(28,28,28,0.02); }
        .dp-entity-row:hover .dp-entity-name { text-decoration: underline; text-underline-offset: 3px; }
        .dp-entity-name {
          font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; font-weight: 600;
          color: #1C1C1C; flex: 1; min-width: 0;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .dp-entity-type {
          font-family: 'IBM Plex Mono', monospace; font-size: 9px;
          letter-spacing: 0.8px; text-transform: uppercase;
          color: rgba(28,28,28,0.5); background: rgba(28,28,28,0.06);
          padding: 2px 7px;
        }
        .dp-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding: 48px 24px; gap: 12px;
        }
        .dp-empty-icon {
          font-family: 'Archivo Black', sans-serif; font-size: 36px; color: rgba(28,28,28,0.12);
        }
        .dp-empty-text {
          font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: rgba(28,28,28,0.4);
        }
        @media (max-width: 900px) {
          .dp-doc-row { grid-template-columns: 28px 1fr auto; }
          .dp-doc-author, .dp-doc-views { display: none; }
        }
      `}</style>

      {/* Domain header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '20px 24px 16px',
        borderBottom: hasMultipleTabs ? 'none' : '1px solid rgba(28,28,28,0.08)',
        flexShrink: 0,
      }}>
        <div style={{
          width: 18,
          height: 18,
          borderRadius: 3,
          background: domain.color,
          border: '2px solid #1C1C1C',
          flexShrink: 0,
        }} />
        <h1 style={{
          fontFamily: "'Archivo Black', sans-serif",
          fontSize: 22,
          letterSpacing: 1,
          lineHeight: 1,
          margin: 0,
        }}>
          {domain.name}
        </h1>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: 'rgba(28,28,28,0.5)',
        }}>
          {domain.doc_count} doc{domain.doc_count !== 1 ? 's' : ''}
          {entityCount > 0 && ` · ${entityCount} ${entityLabel.toLowerCase()}${entityCount !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Tabs (hidden if only documents) */}
      {hasMultipleTabs && (
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(28,28,28,0.08)',
          background: '#F7F6F3',
          flexShrink: 0,
        }}>
          <button className={`dp-tab ${activeTab === 'documents' ? 'on' : ''}`} onClick={() => setActiveTab('documents')}>
            Documents
          </button>
          {hasEntities && (
            <button className={`dp-tab ${activeTab === 'entities' ? 'on' : ''}`} onClick={() => setActiveTab('entities')}>
              {entityLabel}s
            </button>
          )}
          {hasCartography && (
            <button className={`dp-tab ${activeTab === 'cartography' ? 'on' : ''}`} onClick={() => setActiveTab('cartography')}>
              Cartographie
            </button>
          )}
          {hasMindMap && (
            <button className={`dp-tab ${activeTab === 'mindmap' ? 'on' : ''}`} onClick={() => setActiveTab('mindmap')}>
              Mind Map
            </button>
          )}
        </div>
      )}

      {/* Documents tab */}
      {activeTab === 'documents' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {docs.length === 0 ? (
            <div className="dp-empty">
              <div className="dp-empty-icon">{"\u2205"}</div>
              <div className="dp-empty-text">Aucun document dans ce domaine</div>
              {isAuthenticated && (
                <Link
                  to="/documents/new"
                  style={{
                    fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, fontWeight: 600,
                    letterSpacing: 0.8, textTransform: 'uppercase',
                    padding: '8px 18px', background: '#2B5797', color: '#fff',
                    textDecoration: 'none', marginTop: 8,
                  }}
                >
                  + Nouvelle page
                </Link>
              )}
            </div>
          ) : (
            docs.map((doc) => (
              <div
                key={doc.id}
                className="dp-doc-row"
                onClick={() => navigate(`/documents/${doc.slug}`)}
              >
                <FreshnessBadge badge={doc.freshness_badge} verifiedAt={doc.verified_at} />
                <span className="dp-doc-title">{doc.title}</span>
                <span className="dp-doc-author">{doc.author_name}</span>
                <span className="dp-doc-views">{doc.view_count} vue{doc.view_count !== 1 ? 's' : ''}</span>
                <TimeAgo date={doc.updated_at} />
              </div>
            ))
          )}

          {/* Liens externes */}
          <div style={{
            padding: '24px',
            borderTop: '2px solid rgba(28,28,28,0.06)',
            marginTop: docs.length > 0 ? 8 : 0,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              <div style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: 'uppercase' as const,
                color: 'rgba(28,28,28,0.6)',
              }}>
                Liens externes
              </div>
              {isAuthenticated && (
                <button
                  onClick={() => setShowBookmarkForm(true)}
                  style={{
                    fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10, fontWeight: 600,
                    letterSpacing: 0.8, textTransform: 'uppercase',
                    padding: '5px 12px', background: 'none', color: '#2B5797',
                    border: '1.5px solid #2B5797', cursor: 'pointer',
                  }}
                >
                  + Ajouter un lien
                </button>
              )}
            </div>
            <BookmarkList domainId={domain.id} />
          </div>

          {showBookmarkForm && (
            <BookmarkForm onClose={() => setShowBookmarkForm(false)} />
          )}
        </div>
      )}

      {/* Entities tab */}
      {activeTab === 'entities' && hasEntities && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {(!entities || entities.length === 0) ? (
            <div className="dp-empty">
              <div className="dp-empty-icon">{"\u2205"}</div>
              <div className="dp-empty-text">Aucune {entityLabel.toLowerCase()} dans ce domaine</div>
              {isAuthenticated && (
                <Link
                  to="/entities/new"
                  style={{
                    fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, fontWeight: 600,
                    letterSpacing: 0.8, textTransform: 'uppercase',
                    padding: '8px 18px', background: '#2B5797', color: '#fff',
                    textDecoration: 'none', marginTop: 8,
                  }}
                >
                  + {entityLabel}
                </Link>
              )}
            </div>
          ) : (
            entities.map((entity) => (
              <div
                key={entity.id}
                className="dp-entity-row"
                onClick={() => navigate(`/entities/${entity.id}`)}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{entity.entity_type_icon}</span>
                <span className="dp-entity-name">{entity.name}</span>
                <span className="dp-entity-type">{entity.entity_type_name}</span>
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
                  color: 'rgba(28,28,28,0.45)', flexShrink: 0,
                }}>
                  {entity.author_name}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Cartography tab */}
      {activeTab === 'cartography' && hasCartography && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <CartographyView domainId={domain.id} onNodeClick={(id) => navigate(`/entities/${id}`)} />
        </div>
      )}

      {/* Mind Map tab */}
      {activeTab === 'mindmap' && hasMindMap && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <MindMapView rootType="domain" rootId={domain.id} />
        </div>
      )}
    </div>
  )
}
