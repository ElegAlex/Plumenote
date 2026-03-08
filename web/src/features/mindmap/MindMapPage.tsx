import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import MindMapView from './MindMapView'

export default function MindMapPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  if (!user || (user.role !== 'admin' && user.role !== 'dsi')) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-ink-45">Acces reserve aux administrateurs et DSI.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 58px)' }}>
      <div className="flex items-center justify-between px-6 py-3 border-b border-ink-10 bg-bg">
        <h1 className="text-lg font-semibold text-ink">Mind Map documentaire</h1>
      </div>
      <MindMapView onNodeClick={(slug) => navigate(`/documents/${slug}`)} />
    </div>
  )
}
