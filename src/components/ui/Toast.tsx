import { useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react'

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

interface ToastProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

const icons = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: CheckCircle }
const colors = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
}
const iconColors = { success: 'text-green-600', error: 'text-red-600', warning: 'text-amber-600', info: 'text-blue-600' }

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const Icon = icons[toast.type]
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(t)
  }, [toast.id, onDismiss])
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg min-w-64 max-w-sm ${colors[toast.type]}`}>
      <Icon size={18} className={iconColors[toast.type]} />
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      <button onClick={() => onDismiss(toast.id)} className="opacity-60 hover:opacity-100 transition-opacity"><X size={14} /></button>
    </div>
  )
}

export default function Toast({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
      {toasts.map(t => <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  )
}
