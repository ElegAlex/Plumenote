import { Dialog, DialogBody, DialogFoot, DialogHead, Button } from '@/components/ui'

interface DeleteModalProps {
  title: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

/**
 * DeleteModal — confirmation destructive avant suppression d'un document.
 *
 * Portée par la primitive Dialog (focus trap, Escape, backdrop navy blur).
 * Action principale : bouton danger. Action secondaire : bouton ghost.
 */
export default function DeleteModal({ title, onConfirm, onCancel, loading }: DeleteModalProps) {
  return (
    <Dialog open onClose={onCancel} maxWidth={480} aria-label="Confirmer la suppression">
      <DialogHead>
        <h2 className="font-serif font-semibold text-[17px] text-navy-900 tracking-[-0.01em]">
          Supprimer ce document ?
        </h2>
      </DialogHead>
      <DialogBody>
        <p className="text-[13.5px] leading-relaxed text-ink-soft">
          Le document &laquo;&nbsp;<strong className="text-navy-900 font-semibold">{title}</strong>&nbsp;&raquo; sera
          définitivement supprimé. Cette action est irréversible.
        </p>
      </DialogBody>
      <DialogFoot>
        <Button variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={loading}>
          {loading ? 'Suppression…' : 'Supprimer définitivement'}
        </Button>
      </DialogFoot>
    </Dialog>
  )
}
