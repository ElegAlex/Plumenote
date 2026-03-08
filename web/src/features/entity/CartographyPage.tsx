import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { useEntityLabel } from '@/lib/hooks'
import CartographyView from './CartographyView'

export default function CartographyPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: entityLabelConfig } = useEntityLabel()
  const entityLabel = entityLabelConfig?.label ?? 'Fiche'

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
        <h1 className="text-lg font-semibold text-ink">Cartographie globale des {entityLabel.toLowerCase()}s</h1>
      </div>
      <CartographyView onNodeClick={(id) => navigate(`/entities/${id}`)} />
    </div>
  )
}
