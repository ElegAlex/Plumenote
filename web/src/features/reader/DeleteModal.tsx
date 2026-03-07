import { useCallback } from 'react'

interface DeleteModalProps {
  title: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export default function DeleteModal({ title, onConfirm, onCancel, loading }: DeleteModalProps) {
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onCancel()
    },
    [onCancel]
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50"
      onClick={handleOverlayClick}
    >
      <div className="bg-bg rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-lg font-semibold text-ink mb-2">Supprimer ce document ?</h2>
        <p className="text-ink-70 mb-6">
          Le document &laquo;&nbsp;{title}&nbsp;&raquo; sera definitivement supprime.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            autoFocus
            className="px-4 py-2 text-sm rounded-md bg-ink-05 text-ink-70 hover:bg-ink-10 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-md bg-red text-white hover:bg-red/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Suppression...' : 'Supprimer definitivement'}
          </button>
        </div>
      </div>
    </div>
  )
}
