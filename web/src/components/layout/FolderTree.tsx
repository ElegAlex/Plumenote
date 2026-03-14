import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react'
import { api } from '@/lib/api'

interface FolderNode {
  id: string
  name: string
  slug: string
  position: number
  parent_id: string | null
  children: FolderNode[]
}

interface FolderTreeProps {
  domainId: string
  domainSlug: string
}

const STORAGE_KEY = 'plumenote-folder-expanded'

function getExpandedState(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function setExpandedState(state: Record<string, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export default function FolderTree({ domainId, domainSlug }: FolderTreeProps) {
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>(getExpandedState)

  useEffect(() => {
    api.get<FolderNode[]>(`/domains/${domainId}/folders`).then(setFolders).catch(() => {})
  }, [domainId])

  const toggleExpand = useCallback((folderId: string) => {
    setExpanded((prev) => {
      const next = { ...prev, [folderId]: !prev[folderId] }
      setExpandedState(next)
      return next
    })
  }, [])

  return (
    <div>
      {folders.map((f) => (
        <FolderTreeItem
          key={f.id}
          folder={f}
          depth={1}
          domainSlug={domainSlug}
          expanded={expanded}
          onToggle={toggleExpand}
        />
      ))}
    </div>
  )
}

interface FolderTreeItemProps {
  folder: FolderNode
  depth: number
  domainSlug: string
  expanded: Record<string, boolean>
  onToggle: (id: string) => void
}

function FolderTreeItem({ folder, depth, domainSlug, expanded, onToggle }: FolderTreeItemProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isExpanded = expanded[folder.id] ?? false
  const hasChildren = folder.children.length > 0
  const isActive = location.pathname === `/domains/${domainSlug}/folders/${folder.id}`

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '5px 12px',
          paddingLeft: 12 + depth * 16,
          cursor: 'pointer',
          fontSize: 12,
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontWeight: isActive ? 600 : 400,
          color: isActive ? '#1C1C1C' : 'rgba(28,28,28,0.65)',
          background: isActive ? 'rgba(28,28,28,0.06)' : 'transparent',
          borderRadius: 4,
          transition: 'background 0.1s',
          userSelect: 'none' as const,
        }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(28,28,28,0.03)' }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => { e.stopPropagation(); onToggle(folder.id) }}
            style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            {isExpanded
              ? <ChevronDown size={14} color="rgba(28,28,28,0.4)" />
              : <ChevronRight size={14} color="rgba(28,28,28,0.4)" />
            }
          </span>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}
        <span
          onClick={() => navigate(`/domains/${domainSlug}/folders/${folder.id}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}
        >
          {isExpanded
            ? <FolderOpen size={14} color="rgba(28,28,28,0.45)" />
            : <Folder size={14} color="rgba(28,28,28,0.45)" />
          }
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {folder.name}
          </span>
        </span>
      </div>
      {isExpanded && hasChildren && folder.children.map((child) => (
        <FolderTreeItem
          key={child.id}
          folder={child}
          depth={depth + 1}
          domainSlug={domainSlug}
          expanded={expanded}
          onToggle={onToggle}
        />
      ))}
    </>
  )
}
