import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tree as d3tree, hierarchy, type HierarchyPointNode } from 'd3-hierarchy'
import { select } from 'd3-selection'
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { linkHorizontal } from 'd3-shape'
import { icons, type LucideIcon } from 'lucide-react'
import type { MindMapNode } from '@/lib/types'

/** Convert kebab-case icon name ("list-checks") to PascalCase ("ListChecks") */
function toPascalCase(s: string): string {
  return s.replace(/(^|-)([a-z])/g, (_, _sep, c) => c.toUpperCase())
}

/** Aliases for Lucide icons renamed between versions */
const ICON_ALIASES: Record<string, string> = {
  layout: 'LayoutDashboard',
  'help-circle': 'CircleQuestionMark',
}

/** Resolve a Lucide icon name to a component; returns null if not found */
function resolveLucideIcon(name: string | undefined): LucideIcon | null {
  if (!name) return null
  const alias = ICON_ALIASES[name]
  const key = (alias ?? toPascalCase(name)) as keyof typeof icons
  return icons[key] ?? null
}

interface TreeDatum {
  id: string
  kind: 'node' | 'relation'
  node?: MindMapNode
  relation?: string
  relationGroup?: string
  collapsed?: boolean
  childrenCount?: number
}

interface Props {
  root: MindMapNode
  onExpand: (nodeType: string, nodeId: string, excludeIds: string[]) => void
  expanding?: string | null
}

const NODE_HEIGHT = 56
const NODE_WIDTH = 260
const LEVEL_GAP = 280

const FRESHNESS_COLORS: Record<string, string> = {
  green: '#22C55E',
  yellow: '#EAB308',
  red: '#C23B22',
}

function toTreeDatum(node: MindMapNode, manuallyCollapsed: Set<string>): TreeDatum & { children?: TreeDatum[] } {
  const isCollapsed = node.has_children && (!node.children || manuallyCollapsed.has(node.id))
  const datum: TreeDatum & { children?: TreeDatum[] } = {
    id: node.id,
    kind: 'node',
    node,
    collapsed: isCollapsed,
    childrenCount: node.children_count,
  }

  if (node.children && node.children.length > 0 && !manuallyCollapsed.has(node.id)) {
    datum.children = []
    for (const branch of node.children) {
      const relationDatum: TreeDatum & { children?: TreeDatum[] } = {
        id: `rel-${node.id}-${branch.relation_group}-${branch.relation}`,
        kind: 'relation',
        relation: branch.relation,
        relationGroup: branch.relation_group,
        children: branch.items.map(item => toTreeDatum(item, manuallyCollapsed)),
      }
      datum.children.push(relationDatum)
    }
  }

  return datum
}

function collectNodeIds(node: MindMapNode): string[] {
  const ids = [node.id]
  if (node.children) {
    for (const branch of node.children) {
      for (const item of branch.items) {
        ids.push(...collectNodeIds(item))
      }
    }
  }
  return ids
}

export default function MindMapTree({ root, onExpand, expanding }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const navigate = useNavigate()
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: MindMapNode } | null>(null)
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set())
  const prevNodeCountRef = useRef(0)

  const rootDatum = useMemo(() => toTreeDatum(root, collapsedNodes), [root, collapsedNodes])

  const { nodes, links } = useMemo(() => {
    const h = hierarchy(rootDatum)

    const layout = d3tree<TreeDatum>()
      .nodeSize([NODE_HEIGHT + 8, LEVEL_GAP])
      .separation((a, b) => {
        if (a.data.kind === 'relation' || b.data.kind === 'relation') return 0.6
        return 1
      })

    const treeData = layout(h)
    return {
      nodes: treeData.descendants(),
      links: treeData.links(),
    }
  }, [rootDatum])

  // Setup zoom/pan
  useEffect(() => {
    const svg = svgRef.current
    const g = gRef.current
    if (!svg || !g) return

    const zoomBehavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 3])
      .filter((event) => {
        // Let click events through to node handlers
        if (event.type === 'click' || event.type === 'dblclick') return false
        // Block drag from starting on interactive nodes
        if (event.type === 'mousedown' && (event.target as Element).closest?.('.mm-node')) return false
        return true
      })
      .on('zoom', (event) => {
        select(g).attr('transform', event.transform.toString())
      })

    select(svg).call(zoomBehavior)

    const rect = svg.getBoundingClientRect()
    const initialTransform = zoomIdentity
      .translate(80, rect.height / 2)
      .scale(0.85)
    select(svg).call(zoomBehavior.transform, initialTransform)

    zoomRef.current = zoomBehavior
  }, [])

  // Animate new nodes appearing
  const nodeCount = nodes.length
  useEffect(() => {
    if (prevNodeCountRef.current > 0 && nodeCount > prevNodeCountRef.current) {
      // New nodes appeared — they'll animate via CSS
    }
    prevNodeCountRef.current = nodeCount
  }, [nodeCount])

  const handleNodeClick = useCallback(
    (datum: TreeDatum, event: React.MouseEvent) => {
      if (!datum.node) return

      if (event.detail === 2) {
        const url = datum.node.url
        if (url.startsWith('http://') || url.startsWith('https://')) {
          window.open(url, '_blank')
        } else {
          navigate(url)
        }
        return
      }

      const node = datum.node
      // Node has children loaded but is not in collapsed set → collapse it
      if (node.children && node.children.length > 0 && !collapsedNodes.has(node.id)) {
        setCollapsedNodes(prev => {
          const next = new Set(prev)
          next.add(node.id)
          return next
        })
        return
      }

      // Node is manually collapsed → un-collapse it
      if (collapsedNodes.has(node.id)) {
        setCollapsedNodes(prev => {
          const next = new Set(prev)
          next.delete(node.id)
          return next
        })
        return
      }

      // Node has no children loaded → expand via API
      if (datum.collapsed) {
        const excludeIds = collectNodeIds(root)
        onExpand(node.type, node.id, excludeIds)
      }
    },
    [navigate, onExpand, root, collapsedNodes],
  )

  const linkGenerator = linkHorizontal<any, any>()
    .x((d: any) => d.y)
    .y((d: any) => d.x)

  return (
    <div className="relative w-full h-full overflow-hidden bg-bg">
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ cursor: 'grab' }}
      >
        <defs>
          <style>{`
            .mm-node { transition: transform 0.3s ease-out, opacity 0.3s ease-out; }
            .mm-link { transition: d 0.3s ease-out, opacity 0.3s ease-out; }
            .mm-node-enter { animation: mm-fade-in 0.3s ease-out; }
            @keyframes mm-fade-in {
              from { opacity: 0; transform: translateX(-20px); }
              to { opacity: 1; transform: translateX(0); }
            }
          `}</style>
        </defs>
        <g ref={gRef}>
          {/* Links */}
          {links.map((link, i) => {
            const source = link.source as HierarchyPointNode<TreeDatum>
            const target = link.target as HierarchyPointNode<TreeDatum>

            if (target.data.kind === 'relation') return null

            let realSource = source
            if (source.data.kind === 'relation' && source.parent) {
              realSource = source.parent as HierarchyPointNode<TreeDatum>
            }

            const pathData = linkGenerator({
              source: { x: realSource.x, y: realSource.y + NODE_WIDTH / 2 },
              target: { x: target.x, y: target.y - 10 },
            })

            return (
              <path
                key={`link-${i}`}
                className="mm-link"
                d={pathData || ''}
                fill="none"
                stroke="var(--color-ink-15, #ddd)"
                strokeWidth={1.5}
                opacity={0.6}
              />
            )
          })}

          {/* Relation labels — positioned at midpoint of parent→children centroid */}
          {(() => {
            const usedPositions: { x: number; y: number }[] = []
            return nodes.filter(n => n.data.kind === 'relation').map((n) => {
              const d = n as HierarchyPointNode<TreeDatum>
              const parent = d.parent as HierarchyPointNode<TreeDatum> | null
              const children = d.children ?? []

              if (!parent || children.length === 0) return null

              // Source: right edge of parent card
              const srcX = parent.y + NODE_WIDTH / 2
              const srcY = parent.x

              // Target: centroid of children
              const tgtX = children.reduce((s, c) => s + c.y - 10, 0) / children.length
              const tgtY = children.reduce((s, c) => s + c.x, 0) / children.length

              // Midpoint
              let mx = (srcX + tgtX) / 2
              let my = (srcY + tgtY) / 2

              // Nudge to avoid overlap with other labels
              const OVERLAP_THRESHOLD = 14
              for (const p of usedPositions) {
                if (Math.abs(mx - p.x) < 60 && Math.abs(my - p.y) < OVERLAP_THRESHOLD) {
                  my += OVERLAP_THRESHOLD
                }
              }
              usedPositions.push({ x: mx, y: my })

              const labelWidth = d.data.relation!.length * 6 + 12

              return (
                <g key={d.data.id} className="mm-node" transform={`translate(${mx}, ${my})`}>
                  <rect
                    x={-labelWidth / 2}
                    y={-9}
                    width={labelWidth}
                    height={18}
                    rx={4}
                    fill="rgba(255,255,255,0.8)"
                  />
                  <text
                    className="select-none"
                    fill="var(--color-ink-45, #888)"
                    fontSize={10}
                    fontFamily="IBM Plex Mono, monospace"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {d.data.relation}
                  </text>
                </g>
              )
            })
          })()}

          {/* Nodes */}
          {nodes.filter(n => n.data.kind === 'node').map((n) => {
            const d = n as HierarchyPointNode<TreeDatum>
            const node = d.data.node!
            const isExpanding = expanding === node.id
            const hasLoadedChildren = !!(node.children && node.children.length > 0 && !collapsedNodes.has(node.id))

            return (
              <g
                key={node.id}
                className="mm-node mm-node-enter cursor-pointer"
                transform={`translate(${d.y - NODE_WIDTH / 2}, ${d.x - NODE_HEIGHT / 2})`}
                onClick={(e) => handleNodeClick(d.data, e)}
                onMouseEnter={(e) => {
                  const rect = svgRef.current?.getBoundingClientRect()
                  if (rect) {
                    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, node })
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {/* Card */}
                <rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={8}
                  fill="var(--color-bg, white)"
                  stroke={node.domain_color || '#ddd'}
                  strokeWidth={1.5}
                />

                {/* Domain color bar */}
                <rect x={0} y={0} width={4} height={NODE_HEIGHT} rx={2} fill={node.domain_color || '#999'} />

                {/* Node content — foreignObject for proper icon/label separation */}
                <switch>
                  <foreignObject x={10} y={4} width={NODE_WIDTH - 50} height={NODE_HEIGHT - 8} requiredExtensions="http://www.w3.org/1999/xhtml">
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontSize: 16, marginRight: 8, flexShrink: 0, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>
                          {(() => { const I = resolveLucideIcon(node.icon); return I ? <I size={16} /> : (node.icon || '📄') })()}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-ink, #1c1c1c)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {node.label.length > 30 ? node.label.slice(0, 30) + '…' : node.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--color-ink-45, #888)', marginTop: 2, paddingLeft: 28 }}>
                        {node.domain_name}
                      </div>
                    </div>
                  </foreignObject>
                  {/* Fallback for browsers that don't support foreignObject */}
                  <g>
                    <text x={14} y={NODE_HEIGHT / 2 - 6} fontSize={16} dominantBaseline="central">{resolveLucideIcon(node.icon) ? '📄' : (node.icon || '📄')}</text>
                    <text x={36} y={NODE_HEIGHT / 2 - 6} fontSize={12} fontFamily="IBM Plex Sans, sans-serif" fontWeight={600} fill="var(--color-ink, #1c1c1c)" dominantBaseline="central">
                      {node.label.length > 30 ? node.label.slice(0, 30) + '…' : node.label}
                    </text>
                    <text x={36} y={NODE_HEIGHT / 2 + 12} fontSize={10} fontFamily="IBM Plex Mono, monospace" fill="var(--color-ink-45, #888)" dominantBaseline="central">{node.domain_name}</text>
                  </g>
                </switch>

                {/* Freshness badge */}
                {node.freshness_badge && FRESHNESS_COLORS[node.freshness_badge] && (
                  <circle
                    cx={NODE_WIDTH - 16}
                    cy={16}
                    r={5}
                    fill={FRESHNESS_COLORS[node.freshness_badge]}
                  />
                )}

                {/* Collapse indicator (chevron) for expanded nodes */}
                {hasLoadedChildren && (
                  <g transform={`translate(${NODE_WIDTH - 4}, ${NODE_HEIGHT / 2})`}>
                    <rect x={-2} y={-10} width={24} height={20} rx={10} fill="var(--color-ink-10, #eee)" />
                    <text x={10} y={1} textAnchor="middle" dominantBaseline="central" fill="var(--color-ink-45, #888)" fontSize={10}>
                      &minus;
                    </text>
                  </g>
                )}

                {/* Expand badge: "+N" or spinner */}
                {d.data.collapsed && node.children_count > 0 && (
                  <g transform={`translate(${NODE_WIDTH - 4}, ${NODE_HEIGHT / 2})`}>
                    <rect
                      x={-2}
                      y={-10}
                      width={28}
                      height={20}
                      rx={10}
                      fill={isExpanding ? '#D4952A' : '#2B5797'}
                      opacity={0.9}
                    />
                    <text
                      x={12}
                      y={1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="white"
                      fontSize={10}
                      fontWeight={isExpanding ? 400 : 600}
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      {isExpanding ? '...' : `+${node.children_count}`}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-50 bg-ink text-bg text-xs px-3 py-2 rounded-lg shadow-lg max-w-xs"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8, transform: 'translateY(-100%)' }}
        >
          <div className="font-semibold">{tooltip.node.label}</div>
          {tooltip.node.meta && (
            <div className="text-bg/70 mt-0.5">{tooltip.node.meta}</div>
          )}
          <div className="text-bg/50 mt-0.5 text-[10px]">
            Clic: deplier/replier · Double-clic: naviguer
          </div>
        </div>
      )}
    </div>
  )
}
