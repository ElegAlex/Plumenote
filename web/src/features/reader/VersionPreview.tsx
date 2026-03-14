import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import DocumentContent from './DocumentContent'

interface VersionData {
  version_number: number
  title: string
  body: Record<string, unknown>
  author_name: string
  created_at: string
}

interface Props {
  documentId: string
  versionNumber: number
  onClose: () => void
  onRestore: () => void
}

export default function VersionPreview({ documentId, versionNumber, onClose, onRestore }: Props) {
  const [version, setVersion] = useState<VersionData | null>(null)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    api.get<VersionData>(`/documents/${documentId}/versions/${versionNumber}`).then(setVersion).catch(() => {})
  }, [documentId, versionNumber])

  const handleRestore = async () => {
    setRestoring(true)
    try {
      await api.post(`/documents/${documentId}/versions/${versionNumber}/restore`, {})
      onRestore()
    } catch {
      alert('Erreur lors de la restauration')
    } finally {
      setRestoring(false)
    }
  }

  if (!version) return null

  const date = new Date(version.created_at).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center justify-between">
        <span className="text-sm text-amber-800">
          Version {version.version_number} du {date} par {version.author_name}
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleRestore}
            disabled={restoring}
            className="px-3 py-1 text-xs bg-blue text-white rounded hover:bg-blue/90 disabled:opacity-50"
          >
            {restoring ? 'Restauration...' : 'Restaurer'}
          </button>
          <button onClick={onClose} className="px-3 py-1 text-xs border rounded hover:bg-ink-05">
            Fermer
          </button>
        </div>
      </div>
      <DocumentContent content={version.body} />
    </div>
  )
}
