// web/src/features/import/PreviewTree.tsx
// Phase Aperçu — arbre de fichiers style g8 (bg-cream-light, JetBrains Mono 12,
// emojis 📁 / 📄 / 📕 / 📝 selon type, skip list en italique ink-muted).
//
// L'interactivité checkbox (sélection partielle, toggle, indeterminate) est
// préservée à l'identique — seule la présentation change.
import { useState, useCallback, useMemo } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
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
      {/* Summary grid */}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[12.5px] mb-4">
        {mode === 'root' && (
          <>
            <dt className="text-ink-soft font-semibold">Domaines détectés</dt>
            <dd className="text-navy-900 font-semibold tabular-nums">
              {stats.domains}
            </dd>
          </>
        )}
        <dt className="text-ink-soft font-semibold">Dossiers</dt>
        <dd className="text-navy-900 font-semibold tabular-nums">{stats.folders}</dd>
        <dt className="text-ink-soft font-semibold">Fichiers sélectionnés</dt>
        <dd className="text-navy-900 font-semibold tabular-nums">
          {stats.files} · {formatSize(stats.totalSize)}
        </dd>
      </dl>

      {/* Tree */}
      <div className="bg-cream-light border border-line-soft rounded-[10px] py-3.5 px-4 max-h-[280px] overflow-y-auto font-mono text-[12px] leading-[1.8] text-ink-soft">
        {tree.length === 0 ? (
          <div className="italic text-ink-muted">Aucun fichier compatible détecté.</div>
        ) : (
          tree.map(node => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              mode={mode}
              selected={selected}
              onToggle={toggleNode}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface TreeItemProps {
  node: TreeNode
  depth: number
  mode: 'root' | 'domain'
  selected: Set<string>
  onToggle: (node: TreeNode) => void
}

function TreeItem({ node, depth, mode, selected, onToggle }: TreeItemProps) {
  const [expanded, setExpanded] = useState(true)
  const allFiles = useMemo(() => getFilePaths(node), [node])
  const checkedCount = allFiles.filter(f => selected.has(f)).length
  const isChecked = checkedCount === allFiles.length && allFiles.length > 0
  const isIndeterminate = checkedCount > 0 && checkedCount < allFiles.length
  const isFile = node.type === 'file'
  const isDomain = mode === 'root' && depth === 0 && !isFile

  const fileEmoji = isFile ? emojiForFile(node.name) : ''

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-[1px] hover:bg-white/60 rounded px-1"
        style={{ paddingLeft: `${depth * 20 + 4}px` }}
      >
        {!isFile && node.children && node.children.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 text-ink-muted hover:text-navy-800"
            aria-label={expanded ? 'Réduire' : 'Déplier'}
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span className="w-[17px]" aria-hidden />
        )}

        <input
          type="checkbox"
          checked={isChecked}
          ref={el => { if (el) el.indeterminate = isIndeterminate }}
          onChange={() => onToggle(node)}
          className="h-[13px] w-[13px] accent-coral cursor-pointer"
          aria-label={`Sélectionner ${node.name}`}
        />

        {isFile ? (
          <span className="select-none" aria-hidden>{fileEmoji}</span>
        ) : (
          <span className="select-none" aria-hidden>📁</span>
        )}

        <span
          className={
            isFile
              ? 'truncate text-ink-soft'
              : depth === 0
                ? 'truncate font-semibold text-navy-800'
                : 'truncate font-semibold text-navy-800'
          }
        >
          {node.name}
          {!isFile && '/'}
        </span>

        {isDomain && (
          <span className="ml-1 text-[10px] font-bold uppercase tracking-[0.08em] text-coral">
            · Domaine
          </span>
        )}
      </div>
      {!isFile && expanded && node.children?.map(child => (
        <TreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          mode={mode}
          selected={selected}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}

function getFilePaths(node: TreeNode): string[] {
  if (node.type === 'file') return [node.path]
  if (!node.children) return []
  return node.children.flatMap(getFilePaths)
}

function emojiForFile(name: string): string {
  const ext = name.substring(name.lastIndexOf('.')).toLowerCase()
  if (ext === '.pdf') return '📕'
  if (ext === '.md') return '📝'
  if (ext === '.docx' || ext === '.doc') return '📄'
  if (ext === '.pptx' || ext === '.ppt') return '📊'
  if (ext === '.txt') return '📃'
  return '📄'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`
}
