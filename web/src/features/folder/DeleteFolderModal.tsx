import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

interface Props {
  folderId: string
  folderName: string
  onDeleted: () => void
  onClose: () => void
}

export default function DeleteFolderModal({ folderId, folderName, onDeleted, onClose }: Props) {
  const [counts, setCounts] = useState<{ folder_count: number; document_count: number } | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    api.get<{ folder_count: number; document_count: number }>(`/folders/${folderId}/cascade-count`)
      .then(setCounts)
      .catch(() => {})
  }, [folderId])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/folders/${folderId}?confirm=true`)
      onDeleted()
    } catch {
      setDeleting(false)
    }
  }

  const canDelete = confirmText === folderName

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-bg border border-ink-10 rounded-xl shadow-xl p-6 w-[28rem]">
        <h2 className="text-lg font-semibold text-red mb-2">Supprimer &quot;{folderName}&quot;</h2>
        {counts && (
          <p className="text-sm text-ink-70 mb-4">
            Cette action supprimera <strong>{counts.folder_count} sous-dossier{counts.folder_count !== 1 ? 's' : ''}</strong> et{' '}
            <strong>{counts.document_count} document{counts.document_count !== 1 ? 's' : ''}</strong>.
            Cette action est irreversible.
          </p>
        )}
        <label className="block text-sm text-ink-45 mb-2">
          Tapez <strong>{folderName}</strong> pour confirmer :
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="w-full border border-ink-10 rounded-md px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md hover:bg-ink-05">
            Annuler
          </button>
          <button
            onClick={handleDelete}
            disabled={!canDelete || deleting}
            className="px-4 py-2 text-sm bg-red text-white rounded-md hover:bg-red/90 disabled:opacity-50"
          >
            {deleting ? '...' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}
