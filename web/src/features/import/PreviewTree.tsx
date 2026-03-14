import { useState, useCallback, useMemo } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from 'lucide-react'
import type { TreeNode } from '@/lib/hooks/useFolderImport'

interface PreviewTreeProps {
  tree: TreeNode[]
  mode: 'root' | 'domain'
  selected: Set<string>
  onSelectionChange: (selected: Set<string>) => void
}

export default function PreviewTree({ tree, mode, selected, onSelectionChange }: PreviewTreeProps) {
  // Stats computation
  const stats = useMemo(() => {
    let domains = 0, folders = 0, files = 0, totalSize = 0
    function count(nodes: TreeNode[], depth: number) {
      for (const n of nodes) {
        if (n.type === 'dir') {
          if (mode === 'root' && depth === 0) domains++
          else folders++
          if (n.children) count(n.children, depth + 1)
        } else if (selected.has(n.path)) {
          files++
          totalSize += n.size || 0
        }
      }
    }
    count(tree, 0)
    return { domains, folders, files, totalSize }
  }, [tree, mode, selected])

  const toggleNode = useCallback((node: TreeNode) => {
    const newSelected = new Set(selected)
    const allFiles = getFilePaths(node)
    const allSelected = allFiles.every(f => newSelected.has(f))
    if (allSelected) {
      allFiles.forEach(f => newSelected.delete(f))
    } else {
      allFiles.forEach(f => newSelected.add(f))
    }
    onSelectionChange(newSelected)
  }, [selected, onSelectionChange])

  return (
    <div>
      <p className="text-sm text-ink-45 mb-3">
        {mode === 'root' && <>{stats.domains} domaine{stats.domains > 1 ? 's' : ''} · </>}
        {stats.folders} dossier{stats.folders > 1 ? 's' : ''} · {stats.files} fichier{stats.files > 1 ? 's' : ''} · {formatSize(stats.totalSize)}
      </p>
      <div className="border border-ink-10 rounded p-2 max-h-96 overflow-y-auto">
        {tree.map(node => (
          <TreeItem key={node.path} node={node} depth={0} mode={mode} selected={selected} onToggle={toggleNode} />
        ))}
      </div>
    </div>
  )
}

function TreeItem({ node, depth, mode, selected, onToggle }: {
  node: TreeNode; depth: number; mode: 'root' | 'domain'
  selected: Set<string>; onToggle: (node: TreeNode) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const allFiles = useMemo(() => getFilePaths(node), [node])
  const checkedCount = allFiles.filter(f => selected.has(f)).length
  const isChecked = checkedCount === allFiles.length && allFiles.length > 0
  const isIndeterminate = checkedCount > 0 && checkedCount < allFiles.length
  const isFile = node.type === 'file'
  const isDomain = mode === 'root' && depth === 0 && !isFile

  return (
    <div>
      <div className="flex items-center gap-1 py-0.5 hover:bg-ink-05 rounded px-1"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}>
        {!isFile && node.children && node.children.length > 0 ? (
          <button onClick={() => setExpanded(!expanded)} className="p-0.5">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : <span className="w-5" />}
        <input
          type="checkbox"
          checked={isChecked}
          ref={el => { if (el) el.indeterminate = isIndeterminate }}
          onChange={() => onToggle(node)}
          className="h-4 w-4 rounded border-ink-10"
        />
        {isFile ? <FileText className="h-4 w-4 text-ink-45 shrink-0" />
          : expanded ? <FolderOpen className="h-4 w-4 text-ink-45 shrink-0" />
          : <Folder className="h-4 w-4 text-ink-45 shrink-0" />}
        <span className="text-sm truncate">{node.name}</span>
        {isDomain && <span className="text-xs text-ink-45 ml-1">(Domaine)</span>}
      </div>
      {!isFile && expanded && node.children?.map(child => (
        <TreeItem key={child.path} node={child} depth={depth + 1} mode={mode} selected={selected} onToggle={onToggle} />
      ))}
    </div>
  )
}

function getFilePaths(node: TreeNode): string[] {
  if (node.type === 'file') return [node.path]
  if (!node.children) return []
  return node.children.flatMap(getFilePaths)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`
}
