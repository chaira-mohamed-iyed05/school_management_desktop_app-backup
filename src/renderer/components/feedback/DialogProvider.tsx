import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import { AlertTriangle, AlertCircle, Info, X, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
}

type ConfirmFunction = (options: ConfirmOptions) => Promise<boolean>

interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToastContextType {
  success: (msg: string, duration?: number) => void
  error: (msg: string, duration?: number) => void
  info: (msg: string, duration?: number) => void
}

const ConfirmContext = createContext<ConfirmFunction | null>(null)
const ToastContext = createContext<ToastContextType | null>(null)

export function useConfirm(): ConfirmFunction {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within a DialogProvider')
  }
  return context
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a DialogProvider')
  }
  return context
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'

  // Confirm state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean
    options: ConfirmOptions
  }>({
    isOpen: false,
    options: { message: '' },
  })

  const resolveRef = useRef<((value: boolean) => void) | null>(null)
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null)

  // Toasts state
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info', duration = 3500) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  const toastMethods = useRef<ToastContextType>({
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  })

  // Polyfill window.alert to use toast so native blocking OS alerts never steal Chromium focus
  useEffect(() => {
    const originalAlert = window.alert
    window.alert = (msg?: any) => {
      const text = typeof msg === 'string' ? msg : JSON.stringify(msg)
      if (text) {
        addToast(text, text.toLowerCase().includes('error') || text.toLowerCase().includes('فشل') ? 'error' : 'info', 4500)
      }
    }
    return () => {
      window.alert = originalAlert
    }
  }, [addToast])

  // Global focus guard for Windows:
  // When a user clicks on an input or textarea, force document and target focus
  // so that Windows Chromium never swallows keystrokes in a ghost-focus state.
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable ||
        target.closest('input, textarea, select, [contenteditable="true"]')

      if (isInput) {
        const inputEl = (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
          ? target as HTMLElement
          : target.closest('input, textarea, select') as HTMLElement | null

        if (inputEl && document.activeElement !== inputEl) {
          setTimeout(() => {
            inputEl.focus()
          }, 0)
        }
      }
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [])

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setConfirmState({
        isOpen: true,
        options,
      })
    })
  }, [])

  const handleClose = (result: boolean) => {
    setConfirmState((prev) => ({ ...prev, isOpen: false }))
    if (resolveRef.current) {
      resolveRef.current(result)
      resolveRef.current = null
    }
    // Refocus application
    window.schoolApp?.app?.refocus?.().catch(() => {})
  }

  // Auto focus confirm button when opened
  useEffect(() => {
    if (confirmState.isOpen) {
      const timer = setTimeout(() => {
        confirmButtonRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [confirmState.isOpen])

  // Handle Escape and Enter in confirm modal
  useEffect(() => {
    if (!confirmState.isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose(false)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleClose(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [confirmState.isOpen])

  const { options, isOpen } = confirmState
  const variant = options.variant || 'danger'

  return (
    <ConfirmContext.Provider value={confirm}>
      <ToastContext.Provider value={toastMethods.current}>
        {children}

        {/* ── Custom React Confirm Modal (100% inside DOM, zero native modal blur) ── */}
        {isOpen && (
          <div
            className="fixed inset-0 z-9999 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
            onClick={() => handleClose(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 animate-fade-in"
              onClick={(e) => e.stopPropagation()}
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center shadow-xs ${
                    variant === 'danger'
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : variant === 'warning'
                      ? 'bg-amber-50 text-amber-600 border border-amber-200'
                      : 'bg-blue-50 text-[#2563EB] border border-blue-200'
                  }`}
                >
                  {variant === 'danger' ? (
                    <AlertTriangle size={20} />
                  ) : variant === 'warning' ? (
                    <AlertCircle size={20} />
                  ) : (
                    <Info size={20} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-[#0F172A] text-base leading-snug">
                    {options.title || (variant === 'danger' ? t('common.confirm') : t('common.notice') || 'تأكيد')}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed whitespace-pre-wrap">
                    {options.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleClose(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
                >
                  {options.cancelText || t('common.cancel') || 'إلغاء'}
                </button>
                <button
                  ref={confirmButtonRef}
                  type="button"
                  onClick={() => handleClose(true)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer shadow-xs ${
                    variant === 'danger'
                      ? 'bg-red-600 hover:bg-red-700'
                      : variant === 'warning'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-[#2563EB] hover:bg-[#1D4ED8]'
                  }`}
                >
                  {options.confirmText || t('common.confirm') || 'تأكيد'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Toast Notifications Floating Stack ── */}
        <div className="fixed bottom-5 end-5 z-9999 flex flex-col gap-2 max-w-sm pointer-events-none">
          {toasts.map((item) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl shadow-lg border text-xs font-medium flex items-center gap-2.5 animate-fade-in pointer-events-auto transition-all ${
                item.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : item.type === 'error'
                  ? 'bg-red-50 text-red-900 border-red-200'
                  : 'bg-slate-900 text-white border-slate-800'
              }`}
            >
              {item.type === 'success' ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              ) : item.type === 'error' ? (
                <AlertCircle size={16} className="text-red-600 shrink-0" />
              ) : (
                <Info size={16} className="text-blue-400 shrink-0" />
              )}
              <span className="flex-1 leading-tight">{item.message}</span>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== item.id))}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      </ToastContext.Provider>
    </ConfirmContext.Provider>
  )
}
