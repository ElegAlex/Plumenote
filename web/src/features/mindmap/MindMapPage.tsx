import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import MindMapView from './MindMapView'

interface DomainOption {
  id: string
  name: string
  color: string
}

export default function MindMapPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [domains, setDomains] = useState<DomainOption[]>([])
  const [selectedDomainId, setSelectedDomainId] = useState<string>('')

  // URL params for direct entity/document mind map
  const rootType = searchParams.get('root_type')
  const rootId = searchParams.get('root_id')
  const rootLabel = searchParams.get('label')
  const hasDirectRoot = !!rootType && !!rootId

  useEffect(() => {
    if (hasDirectRoot) return // Skip domain loading when direct root is used
    api.get<DomainOption[]>('/domains').then((d) => {
      setDomains(d)
      if (d.length > 0) setSelectedDomainId(d[0].id)
    }).catch(() => {})
  }, [hasDirectRoot])

  // Direct root (entity/document) is accessible to any authenticated user
  // Global domain browser is restricted to admin/dsi
  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-ink-45">Connexion requise.</p>
      </div>
    )
  }

  if (!hasDirectRoot && user.role !== 'admin' && user.role !== 'dsi') {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-ink-45">Acces reserve aux administrateurs et DSI.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 58px)' }}>
      <div className="flex items-center justify-between px-6 py-3 border-b border-ink-10 bg-bg">
        <div className="flex items-center gap-3">
          {hasDirectRoot && (
            <button
              onClick={() => navigate(-1)}
              className="text-ink-45 hover:text-ink text-sm"
              title="Retour"
            >
              &larr;
            </button>
          )}
          <h1 className="text-lg font-semibold text-ink">
            {hasDirectRoot && rootLabel
              ? `Mind Map — ${rootLabel}`
              : 'Mind Map documentaire'}
          </h1>
        </div>
        {!hasDirectRoot && domains.length > 1 && (
          <select
            value={selectedDomainId}
            onChange={(e) => setSelectedDomainId(e.target.value)}
            className="text-sm border border-ink-10 rounded-md px-3 py-1.5 bg-bg text-ink"
          >
            {domains.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {hasDirectRoot ? (
          <MindMapView rootType={rootType} rootId={rootId} />
        ) : selectedDomainId ? (
          <MindMapView rootType="domain" rootId={selectedDomainId} />
        ) : null}
      </div>
    </div>
  )
}
