import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { X } from 'lucide-react'

interface Version {
  id: string
  version_number: number
  title: string
  author_name: string
  created_at: string
}

interface Props {
  documentId: string
  documentSlug: string
  open: boolean
  onClose: () => void
  onSelectVersion: (versionNumber: number) => void
}

export default function VersionHistory({ documentId, documentSlug, open, onClose, onSelectVersion }: Props) {
  const navigate = useNavigate()
  const [versions, setVersions] = useState<Version[]>([])
  const [selected, setSelected] = useState<number[]>([])

  useEffect(() => {
    if (!open || !documentId) return
    api.get<Version[]>(`/documents/${documentId}/versions`).then(setVersions).catch(() => {})
  }, [open, documentId])

  const toggleSelect = (vn: number) => {
    setSelected((prev) => {
      if (prev.includes(vn)) return prev.filter((v) => v !== vn)
      if (prev.length >= 2) return [prev[1], vn]
      return [...prev, vn]
    })
  }

  const canCompare = selected.length === 2

  const handleCompare = () => {
    if (!canCompare) return
    const [v1, v2] = selected.sort((a, b) => a - b)
    navigate(`/documents/${documentSlug}/diff/${v1}/${v2}`)
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (!open) return null

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-bg border-l border-ink-10 shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-ink-10">
        <h2 className="text-sm font-semibold text-ink-70">Historique des versions</h2>
        <button onClick={onClose} className="p-1 hover:bg-ink-05 rounded">
          <X size={16} />
        </button>
      </div>

      {canCompare && (
        <div className="p-3 border-b border-ink-10">
          <button
            onClick={handleCompare}
            className="w-full px-3 py-2 bg-blue text-white text-sm rounded-lg hover:bg-blue/90"
          >
            Comparer v{Math.min(...selected)} → v{Math.max(...selected)}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 ? (
          <p className="p-4 text-sm text-ink-45">Aucune version enregistree.</p>
        ) : (
          versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-2 px-4 py-3 border-b border-ink-05 hover:bg-ink-05 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(v.version_number)}
                onChange={() => toggleSelect(v.version_number)}
                className="shrink-0"
              />
              <div className="flex-1 min-w-0" onClick={() => onSelectVersion(v.version_number)}>
                <div className="text-sm font-medium text-ink">v{v.version_number}</div>
                <div className="text-xs text-ink-45 truncate">
                  {formatDate(v.created_at)} — {v.author_name}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
