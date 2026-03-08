import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { useCartography } from '@/lib/hooks'

interface CartographyViewProps {
  domainId?: string
  onNodeClick?: (nodeId: string) => void
}

interface GraphNode {
  id: string
  name: string
  type_name: string
  type_icon: string
  type_slug: string
  domain_color: string
  is_ghost: boolean
  val: number
  connections: number
  x?: number
  y?: number
}

interface GraphLink {
  source: string
  target: string
  relation_name: string
}

export default function CartographyView({ domainId, onNodeClick }: CartographyViewProps) {
  const { data, isLoading } = useCartography(domainId)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set())
  const [showGhosts, setShowGhosts] = useState(true)

  // Responsive sizing
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width, height: Math.max(height, 400) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Compute connection counts
  const connectionCounts = useMemo(() => {
    if (!data) return new Map<string, number>()
    const counts = new Map<string, number>()
    for (const edge of data.edges) {
      counts.set(edge.source, (counts.get(edge.source) || 0) + 1)
      counts.set(edge.target, (counts.get(edge.target) || 0) + 1)
    }
    return counts
  }, [data])

  // Unique type slugs for filter
  const uniqueTypes = useMemo(() => {
    if (!data) return []
    const seen = new Map<string, { slug: string; name: string; icon: string }>()
    for (const n of data.nodes) {
      if (!seen.has(n.type_slug)) {
        seen.set(n.type_slug, { slug: n.type_slug, name: n.type_name, icon: n.type_icon })
      }
    }
    return Array.from(seen.values())
  }, [data])

  // Transform to graph data with filters applied
  const graphData = useMemo(() => {
    if (!data) return { nodes: [] as GraphNode[], links: [] as GraphLink[] }

    const filteredNodes = data.nodes.filter((n) => {
      if (!showGhosts && n.is_ghost) return false
      if (typeFilters.size > 0 && !typeFilters.has(n.type_slug)) return false
      return true
    })

    const nodeIds = new Set(filteredNodes.map((n) => n.id))

    const nodes: GraphNode[] = filteredNodes.map((n) => ({
      id: n.id,
      name: n.name,
      type_name: n.type_name,
      type_icon: n.type_icon,
      type_slug: n.type_slug,
      domain_color: n.domain_color,
      is_ghost: n.is_ghost,
      val: 1,
      connections: connectionCounts.get(n.id) || 0,
    }))

    const links: GraphLink[] = data.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        relation_name: e.relation_name,
      }))

    return { nodes, links }
  }, [data, typeFilters, showGhosts, connectionCounts])

  // Connected edges for hover highlight
  const hoveredEdges = useMemo(() => {
    if (!hoveredNode) return new Set<string>()
    const set = new Set<string>()
    for (const link of graphData.links) {
      const src = typeof link.source === 'object' ? (link.source as GraphNode).id : link.source
      const tgt = typeof link.target === 'object' ? (link.target as GraphNode).id : link.target
      if (src === hoveredNode || tgt === hoveredNode) {
        set.add(`${src}-${tgt}`)
      }
    }
    return set
  }, [hoveredNode, graphData.links])

  // Connected nodes for selected node panel
  const selectedNodeConnections = useMemo(() => {
    if (!selectedNode || !data) return []
    const connections: { id: string; name: string; type_icon: string; relation: string }[] = []
    for (const edge of data.edges) {
      if (edge.source === selectedNode.id) {
        const target = data.nodes.find((n) => n.id === edge.target)
        if (target) connections.push({ id: target.id, name: target.name, type_icon: target.type_icon, relation: edge.relation_name })
      }
      if (edge.target === selectedNode.id) {
        const source = data.nodes.find((n) => n.id === edge.source)
        if (source) connections.push({ id: source.id, name: source.name, type_icon: source.type_icon, relation: edge.relation_name })
      }
    }
    return connections
  }, [selectedNode, data])

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node)
    onNodeClick?.(node.id)
  }, [onNodeClick])

  const toggleTypeFilter = useCallback((slug: string) => {
    setTypeFilters((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }, [])

  const nodeCanvasObject = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const size = Math.min(12, Math.max(4, 4 + (node.connections || 0)))
    const x = node.x ?? 0
    const y = node.y ?? 0

    ctx.save()
    if (node.is_ghost) ctx.globalAlpha = 0.3

    // Circle
    ctx.beginPath()
    ctx.arc(x, y, size, 0, 2 * Math.PI)
    ctx.fillStyle = node.domain_color || '#999'
    ctx.fill()

    // Hover ring
    if (hoveredNode === node.id) {
      ctx.strokeStyle = node.domain_color || '#999'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // Selected ring
    if (selectedNode?.id === node.id) {
      ctx.strokeStyle = '#2B5797'
      ctx.lineWidth = 2.5
      ctx.stroke()
    }

    // Label
    const fontSize = Math.max(10, 12 / globalScale)
    ctx.font = `${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = node.is_ghost ? 'rgba(28,28,28,0.3)' : 'rgba(28,28,28,0.8)'

    const label = node.type_icon + ' ' + (node.name.length > 20 ? node.name.slice(0, 20) + '...' : node.name)
    if (globalScale > 0.6 || hoveredNode === node.id || selectedNode?.id === node.id) {
      ctx.fillText(label, x, y + size + 2)
    }

    ctx.restore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredNode, selectedNode])

  const linkCanvasObject = useCallback((link: { source: GraphNode; target: GraphNode; relation_name: string }, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const src = link.source
    const tgt = link.target
    if (!src || !tgt) return
    const srcX = src.x ?? 0
    const srcY = src.y ?? 0
    const tgtX = tgt.x ?? 0
    const tgtY = tgt.y ?? 0

    const srcId = src.id
    const tgtId = tgt.id
    const isHighlighted = hoveredEdges.has(`${srcId}-${tgtId}`) || hoveredEdges.has(`${tgtId}-${srcId}`)

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(srcX, srcY)
    ctx.lineTo(tgtX, tgtY)
    ctx.strokeStyle = isHighlighted ? '#2B5797' : '#999'
    ctx.globalAlpha = isHighlighted ? 0.8 : 0.3
    ctx.lineWidth = isHighlighted ? 1.5 : 0.5
    ctx.stroke()

    // Arrow
    const dx = tgtX - srcX
    const dy = tgtY - srcY
    const angle = Math.atan2(dy, dx)
    const arrowLen = 4
    const midX = (srcX + tgtX) / 2
    const midY = (srcY + tgtY) / 2
    ctx.beginPath()
    ctx.moveTo(midX, midY)
    ctx.lineTo(midX - arrowLen * Math.cos(angle - Math.PI / 6), midY - arrowLen * Math.sin(angle - Math.PI / 6))
    ctx.moveTo(midX, midY)
    ctx.lineTo(midX - arrowLen * Math.cos(angle + Math.PI / 6), midY - arrowLen * Math.sin(angle + Math.PI / 6))
    ctx.stroke()

    // Label on hover
    if (isHighlighted && globalScale > 0.8) {
      const fontSize = Math.max(8, 10 / globalScale)
      ctx.font = `${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = 0.7
      ctx.fillStyle = '#2B5797'
      ctx.fillText(link.relation_name, midX, midY - 3)
    }

    ctx.restore()
  }, [hoveredEdges])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-ink-45">Chargement de la cartographie...</p>
      </div>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-ink-45">Aucune entite a afficher.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0">
      {/* Main graph area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Filters */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-ink-10 bg-bg text-sm flex-wrap">
          <span className="text-xs font-medium text-ink-45 uppercase tracking-wide">Filtres :</span>
          {uniqueTypes.map((t) => (
            <label key={t.slug} className="flex items-center gap-1 text-xs text-ink-70 cursor-pointer">
              <input
                type="checkbox"
                checked={typeFilters.size === 0 || typeFilters.has(t.slug)}
                onChange={() => toggleTypeFilter(t.slug)}
                className="accent-blue"
              />
              {t.icon} {t.name}
            </label>
          ))}
          <span className="text-ink-10">|</span>
          <label className="flex items-center gap-1 text-xs text-ink-70 cursor-pointer">
            <input
              type="checkbox"
              checked={showGhosts}
              onChange={() => setShowGhosts(!showGhosts)}
              className="accent-blue"
            />
            Fantomes
          </label>
          <span className="text-xs text-ink-45 ml-auto">{graphData.nodes.length} noeuds · {graphData.links.length} liens</span>
        </div>

        {/* Graph */}
        <div ref={containerRef} className="flex-1 min-h-[400px]">
          <ForceGraph2D
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData as any}
            nodeCanvasObject={nodeCanvasObject as any}
            linkCanvasObject={linkCanvasObject as any}
            onNodeClick={handleNodeClick as any}
            onNodeHover={(node: any) => setHoveredNode(node?.id || null)}
            nodeLabel={() => ''}
            cooldownTicks={100}
            enableZoomInteraction={true}
            enablePanInteraction={true}
          />
        </div>
      </div>

      {/* Side panel */}
      {selectedNode && (
        <div className="w-72 border-l border-ink-10 bg-bg p-4 overflow-y-auto flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink truncate flex-1">
              {selectedNode.type_icon} {selectedNode.name}
            </h3>
            <button onClick={() => setSelectedNode(null)} className="text-ink-45 hover:text-ink text-sm ml-2">&times;</button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-ink-05 rounded text-ink-70">
                {selectedNode.type_icon} {selectedNode.type_name}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedNode.domain_color }} />
              <span className="text-ink-70">Domaine</span>
            </div>

            {selectedNode.is_ghost && (
              <span className="text-ink-45 italic">Entite fantome</span>
            )}

            <a
              href={`/entities/${selectedNode.id}`}
              className="inline-block text-blue hover:text-blue/80 text-xs font-medium"
              onClick={(e) => {
                e.preventDefault()
                onNodeClick?.(selectedNode.id)
              }}
            >
              Voir la fiche &rarr;
            </a>

            {selectedNodeConnections.length > 0 && (
              <div className="pt-2 border-t border-ink-10">
                <h4 className="text-xs font-medium text-ink-45 mb-2 uppercase tracking-wide">Connexions ({selectedNodeConnections.length})</h4>
                <div className="space-y-1">
                  {selectedNodeConnections.map((conn, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 p-1.5 rounded hover:bg-ink-05 cursor-pointer"
                      onClick={() => {
                        const node = graphData.nodes.find((n) => n.id === conn.id)
                        if (node) setSelectedNode(node)
                      }}
                    >
                      <span>{conn.type_icon}</span>
                      <span className="text-ink truncate">{conn.name}</span>
                      <span className="text-ink-25 ml-auto text-[10px] flex-shrink-0">{conn.relation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
