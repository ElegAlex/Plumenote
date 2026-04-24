import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui'

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

/**
 * VersionHistory — panneau latéral droit listant les versions d'un document.
 *
 * Sélection multi-check (max 2) pour ouvrir la DiffPage.
 * Click sur une ligne → preview inline via onSelectVersion.
 */
export default function VersionHistory({
  documentId,
  documentSlug,
  open,
  onClose,
  onSelectVersion,
}: Props) {
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
    const [v1, v2] = [...selected].sort((a, b) => a - b)
    navigate(`/documents/${documentSlug}/diff/${v1}/${v2}`)
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  if (!open) return null

  return (
    <aside
      className="fixed inset-y-0 right-0 w-80 bg-white border-l border-line shadow-[0_0_40px_rgba(20,35,92,0.15)] z-50 flex flex-col"
      aria-label="Historique des versions"
    >
      <header className="flex items-center justify-between p-4 border-b border-line-soft">
        <h2 className="font-serif font-semibold text-[15px] text-navy-900 tracking-[-0.01em]">
          Historique des versions
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="p-1 rounded-md text-ink-soft hover:bg-cream-light hover:text-navy-800 transition-colors"
        >
          <X size={16} />
        </button>
      </header>

      {canCompare && (
        <div className="p-3 border-b border-line-soft">
          <Button variant="primary" onClick={handleCompare} className="w-full">
            Comparer v{Math.min(...selected)} → v{Math.max(...selected)}
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 ? (
          <p className="p-4 text-sm text-ink-muted">Aucune version enregistrée.</p>
        ) : (
          versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-2 px-4 py-3 border-b border-line-soft hover:bg-cream-light transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.includes(v.version_number)}
                onChange={() => toggleSelect(v.version_number)}
                aria-label={`Sélectionner la version ${v.version_number}`}
                className="shrink-0 accent-navy-800"
              />
              <button
                type="button"
                className="flex-1 min-w-0 text-left cursor-pointer"
                onClick={() => onSelectVersion(v.version_number)}
              >
                <div className="text-sm font-semibold text-ink">v{v.version_number}</div>
                <div className="text-xs text-ink-muted truncate">
                  {formatDate(v.created_at)} — {v.author_name}
                </div>
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
