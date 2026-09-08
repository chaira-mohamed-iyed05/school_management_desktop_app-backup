import Modal from './Modal'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmer', danger = false }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-slate-600 mb-6">{message}</p>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Annuler</button>
        <button
          onClick={() => { onConfirm(); onClose() }}
          className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
