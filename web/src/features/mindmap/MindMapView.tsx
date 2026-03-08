import { useState } from 'react'
import { useMindMapTree, useExpandNode } from '@/lib/hooks'
import MindMapTree from './MindMapTree'

interface MindMapViewProps {
  rootType: string
  rootId: string
}

export default function MindMapView({ rootType, rootId }: MindMapViewProps) {
  const { data, isLoading, error } = useMindMapTree(rootType, rootId)
  const expandMutation = useExpandNode(rootType, rootId)
  const [expandingId, setExpandingId] = useState<string | null>(null)

  const handleExpand = (nodeType: string, nodeId: string, excludeIds: string[]) => {
    setExpandingId(nodeId)
    expandMutation.mutate(
      { nodeType, nodeId, excludeIds },
      { onSettled: () => setExpandingId(null) },
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-ink-45">Chargement de la mind map...</p>
      </div>
    )
  }

  if (error || !data?.root) {
    return (
      <div className="flex items-center justify-center py-20 px-8 text-center">
        <div>
          <p className="text-ink-45 mb-2">Impossible de charger la mind map.</p>
          <p className="text-xs text-ink-25">
            Verifiez que des relations existent pour cet element.
          </p>
        </div>
      </div>
    )
  }

  return (
    <MindMapTree
      root={data.root}
      onExpand={handleExpand}
      expanding={expandingId}
    />
  )
}
