import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation, NavLink } from 'react-router-dom'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

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

  const { data: rootDocs } = useQuery({
    queryKey: ['root-documents', domainId],
    queryFn: () => api.get<{ documents: { id: string; title: string; slug: string }[] }>(
      `/domains/${domainId}/root-documents`
    ),
    enabled: !!domainId,
  })

  return (
    <div className="ml-8 mt-1 flex flex-col gap-[2px]">
      {folders.map((f) => (
        <FolderTreeItem
          key={f.id}
          folder={f}
          depth={0}
          domainSlug={domainSlug}
          expanded={expanded}
          onToggle={toggleExpand}
        />
      ))}
      {rootDocs?.documents?.map(doc => (
        <NavLink
          key={doc.id}
          to={`/documents/${doc.slug}`}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 pl-[26px] pr-2.5 py-[5px] rounded-md',
              'text-[12.5px] font-medium transition-colors',
              isActive
                ? 'bg-white/10 text-white'
                : 'text-[#9299BD] hover:bg-white/5 hover:text-white',
            )
          }
        >
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{doc.title}</span>
        </NavLink>
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

  // Indent manuel : 10 px par niveau, collé après le chevron.
  const indent = { paddingLeft: 10 + depth * 14 }

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-1 pr-2.5 py-[5px] rounded-md cursor-pointer select-none',
          'text-[12.5px] font-medium transition-colors',
          isActive
            ? 'bg-white/10 text-white'
            : 'text-[#9299BD] hover:bg-white/5 hover:text-white',
        )}
        style={indent}
      >
        {hasChildren ? (
          <span
            onClick={(e) => { e.stopPropagation(); onToggle(folder.id) }}
            className="flex items-center shrink-0 opacity-70 hover:opacity-100"
          >
            {isExpanded
              ? <ChevronDown size={13} />
              : <ChevronRight size={13} />
            }
          </span>
        ) : (
          <span className="w-[13px] shrink-0" />
        )}
        <span
          onClick={() => navigate(`/domains/${domainSlug}/folders/${folder.id}`)}
          className="flex items-center gap-1.5 flex-1 min-w-0"
        >
          {isExpanded
            ? <FolderOpen size={13} className="opacity-70" />
            : <Folder size={13} className="opacity-70" />
          }
          <span className="truncate">
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
