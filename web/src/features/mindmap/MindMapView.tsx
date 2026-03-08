import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { useMindMap } from '@/lib/hooks'
import FreshnessBadge from '@/features/home/FreshnessBadge'

interface MindMapViewProps {
  domainId?: string
  onNodeClick?: (slug: string) => void
}

interface GraphNode {
  id: string
  title: string
  slug: string
  domain_color: string
  domain_name: string
  type_name: string
  freshness_badge: 'green' | 'yellow' | 'red'
  view_count: number
  is_orphan: boolean
  is_ghost?: boolean
  link_count: number
  val: number
  x?: number
  y?: number
}

interface GraphLink {
  source: string
  target: string
  type: 'internal_link' | 'shared_entity' | 'shared_tags'
  label: string
  weight: number
}

const EDGE_COLORS: Record<string, string> = {
  internal_link: '#2B5797',
  shared_entity: '#D4952A',
  shared_tags: '#9CA3AF',
}

const EDGE_WIDTHS: Record<string, number> = {
  internal_link: 2,
  shared_entity: 1.5,
  shared_tags: 0.8,
}

const EDGE_DASHES: Record<string, number[] | null> = {
  internal_link: null,
  shared_entity: [5, 5],
  shared_tags: [8, 4],
}

const FRESHNESS_COLORS: Record<string, string> = {
  green: '#22C55E',
  yellow: '#EAB308',
  red: '#C23B22',
}

export default function MindMapView({ domainId, onNodeClick }: MindMapViewProps) {
  const { data, isLoading } = useMindMap(domainId)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    internal_link: true,
    shared_entity: true,
    shared_tags: false,
    showOrphans: true,
  })

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

  // Transform to graph data with filters applied
  const graphData = useMemo(() => {
    if (!data) return { nodes: [] as GraphNode[], links: [] as GraphLink[] }

    const filteredNodes = data.nodes.filter((n) => {
      if (!filters.showOrphans && n.is_orphan) return false
      return true
    })

    const nodeIds = new Set(filteredNodes.map((n) => n.id))

    const nodes: GraphNode[] = filteredNodes.map((n) => ({
      id: n.id,
      title: n.title,
      slug: n.slug,
      domain_color: n.domain_color,
      domain_name: n.domain_name,
      type_name: n.type_name,
      freshness_badge: n.freshness_badge,
      view_count: n.view_count,
      is_orphan: n.is_orphan,
      is_ghost: n.is_ghost ?? false,
      link_count: n.link_count,
      val: 1,
    }))

    const links: GraphLink[] = data.edges
      .filter((e) => {
        if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) return false
        if (!filters[e.type as keyof typeof filters]) return false
        return true
      })
      .map((e) => ({
        source: e.source,
        target: e.target,
        type: e.type,
        label: e.label,
        weight: e.weight,
      }))

    return { nodes, links }
  }, [data, filters])

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
    const connections: { id: string; title: string; slug: string; type: string; label: string }[] = []
    for (const edge of data.edges) {
      if (edge.source === selectedNode.id) {
        const target = data.nodes.find((n) => n.id === edge.target)
        if (target) connections.push({ id: target.id, title: target.title, slug: target.slug, type: edge.type, label: edge.label })
      }
      if (edge.target === selectedNode.id) {
        const source = data.nodes.find((n) => n.id === edge.source)
        if (source) connections.push({ id: source.id, title: source.title, slug: source.slug, type: edge.type, label: edge.label })
      }
    }
    return connections
  }, [selectedNode, data])

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node)
  }, [])

  const toggleFilter = useCallback((key: keyof typeof filters) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const nodeCanvasObject = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const size = Math.min(20, Math.max(4, 4 + Math.log2(node.view_count + 1) * 3))
    const x = node.x ?? 0
    const y = node.y ?? 0

    ctx.save()

    // Ghost nodes (from other domains) get reduced opacity
    if (node.is_ghost) ctx.globalAlpha = 0.3
    // Orphan nodes get reduced opacity
    else if (node.is_orphan) ctx.globalAlpha = 0.5

    // Circle
    ctx.beginPath()
    ctx.arc(x, y, size, 0, 2 * Math.PI)
    ctx.fillStyle = node.domain_color || '#999'
    ctx.fill()

    // Orphan: dashed red border
    if (node.is_orphan) {
      ctx.setLineDash([3, 3])
      ctx.strokeStyle = '#C23B22'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.setLineDash([])
    }

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

    // Freshness badge: small circle at top-right
    const badgeColor = FRESHNESS_COLORS[node.freshness_badge]
    if (badgeColor) {
      ctx.beginPath()
      ctx.arc(x + size * 0.7, y - size * 0.7, 3, 0, 2 * Math.PI)
      ctx.fillStyle = badgeColor
      ctx.globalAlpha = node.is_ghost ? 0.3 : 1
      ctx.fill()
    }

    // Restore alpha for label
    ctx.globalAlpha = node.is_ghost ? 0.3 : (node.is_orphan ? 0.5 : 1)

    // Label
    const fontSize = Math.max(10, 12 / globalScale)
    ctx.font = `${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = node.is_ghost ? 'rgba(28,28,28,0.3)' : 'rgba(28,28,28,0.8)'

    const label = node.title.length > 30 ? node.title.slice(0, 30) + '...' : node.title
    if (globalScale > 0.6 || hoveredNode === node.id || selectedNode?.id === node.id) {
      ctx.fillText(label, x, y + size + 2)
    }

    ctx.restore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredNode, selectedNode])

  const linkCanvasObject = useCallback((link: { source: GraphNode; target: GraphNode; type: string; label: string; weight: number }, ctx: CanvasRenderingContext2D, globalScale: number) => {
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

    const edgeType = link.type as string
    const color = EDGE_COLORS[edgeType] || '#999'
    const width = EDGE_WIDTHS[edgeType] || 1
    const dash = EDGE_DASHES[edgeType]

    ctx.save()
    ctx.beginPath()
    if (dash) ctx.setLineDash(dash)
    ctx.moveTo(srcX, srcY)
    ctx.lineTo(tgtX, tgtY)
    ctx.strokeStyle = color
    ctx.globalAlpha = isHighlighted ? 0.8 : 0.3
    ctx.lineWidth = isHighlighted ? width * 1.5 : width
    ctx.stroke()
    ctx.setLineDash([])

    // Label on hover
    if (isHighlighted && globalScale > 0.8) {
      const midX = (srcX + tgtX) / 2
      const midY = (srcY + tgtY) / 2
      const fontSize = Math.max(8, 10 / globalScale)
      ctx.font = `${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = 0.7
      ctx.fillStyle = color
      const typeLabels: Record<string, string> = {
        internal_link: 'Lien interne',
        shared_entity: 'Fiche commune',
        shared_tags: 'Tags communs',
      }
      const displayLabel = `${typeLabels[edgeType] || edgeType}${link.label ? ` : ${link.label}` : ''}`
      ctx.fillText(displayLabel, midX, midY - 3)
    }

    ctx.restore()
  }, [hoveredEdges])

  const nodeCount = graphData.nodes.length
  const edgeCount = graphData.links.length
  const orphansCount = graphData.nodes.filter((n) => n.is_orphan).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-ink-45">Chargement de la mind map...</p>
      </div>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 px-8 text-center">
        <div>
          <p className="text-ink-45 mb-2">Aucun document connecte dans ce domaine.</p>
          <p className="text-xs text-ink-25">
            Les connexions apparaissent automatiquement quand les documents utilisent des liens internes [[...]],
            partagent des tags, ou sont lies aux memes fiches.
          </p>
        </div>
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
          <label className="flex items-center gap-1 text-xs text-ink-70 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.internal_link}
              onChange={() => toggleFilter('internal_link')}
              className="accent-blue"
            />
            Liens internes
          </label>
          <label className="flex items-center gap-1 text-xs text-ink-70 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.shared_entity}
              onChange={() => toggleFilter('shared_entity')}
              className="accent-blue"
            />
            Fiches communes
          </label>
          <label className="flex items-center gap-1 text-xs text-ink-70 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.shared_tags}
              onChange={() => toggleFilter('shared_tags')}
              className="accent-blue"
            />
            Tags communs
          </label>
          <span className="text-ink-10">|</span>
          <label className="flex items-center gap-1 text-xs text-ink-70 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.showOrphans}
              onChange={() => toggleFilter('showOrphans')}
              className="accent-blue"
            />
            Orphelins
          </label>
          <span className="text-xs text-ink-45 ml-auto">
            {nodeCount} documents · {edgeCount} liens · {orphansCount} orphelins
          </span>
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
              {selectedNode.title}
            </h3>
            <button onClick={() => setSelectedNode(null)} className="text-ink-45 hover:text-ink text-sm ml-2">&times;</button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedNode.domain_color }} />
              <span className="text-ink-70">{selectedNode.domain_name}</span>
            </div>

            <div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-ink-05 rounded text-ink-70">
                {selectedNode.type_name}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <FreshnessBadge badge={selectedNode.freshness_badge} />
            </div>

            <div className="text-ink-70">{selectedNode.view_count} vue{selectedNode.view_count !== 1 ? 's' : ''}</div>
            <div className="text-ink-70">{selectedNode.link_count} connexion{selectedNode.link_count !== 1 ? 's' : ''}</div>

            {selectedNode.is_orphan && (
              <span className="text-red-500">Document orphelin</span>
            )}

            {selectedNode.is_ghost && (
              <span className="text-ink-45 italic">Document d'un autre domaine</span>
            )}

            <a
              href={`/documents/${selectedNode.slug}`}
              className="inline-block text-blue hover:text-blue/80 text-xs font-medium"
              onClick={(e) => {
                e.preventDefault()
                onNodeClick?.(selectedNode.slug)
              }}
            >
              Voir le document &rarr;
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
                      <span className="text-ink truncate">{conn.title}</span>
                      <span className="text-ink-25 ml-auto text-[10px] flex-shrink-0">{conn.label}</span>
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
