import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui'
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

/**
 * VersionPreview — bandeau d'aperçu d'une version antérieure +
 * rendu DocumentContent readonly de ladite version.
 */
export default function VersionPreview({ documentId, versionNumber, onClose, onRestore }: Props) {
  const [version, setVersion] = useState<VersionData | null>(null)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    api.get<VersionData>(`/documents/${documentId}/versions/${versionNumber}`)
      .then(setVersion)
      .catch(() => {})
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
      <div className="flex items-center justify-between gap-3 flex-wrap bg-warn-bg border border-warn/30 rounded-xl p-3 mb-4">
        <span className="text-[13px] text-warn font-medium">
          Version <strong className="font-bold">{version.version_number}</strong> du {date} par {version.author_name}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="primary" onClick={handleRestore} disabled={restoring}>
            {restoring ? 'Restauration…' : 'Restaurer cette version'}
          </Button>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
      <DocumentContent content={version.body} />
    </div>
  )
}
