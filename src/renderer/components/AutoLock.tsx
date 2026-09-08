import { useEffect, useState, useRef, useCallback } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../features/auth/AuthContext'

export default function AutoLock() {
  const { t } = useTranslation()
  const { session, login } = useAuth()
  const [isLocked, setIsLocked] = useState(false)
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [unlocking, setUnlocking] = useState(false)

  const lockMinutesRef = useRef(0)
  const lastActivityRef = useRef(Date.now())

  // Fetch configured auto-lock minutes
  useEffect(() => {
    window.schoolApp.settings.getAutoLock().then((res) => {
      if (res.success && res.data) {
        lockMinutesRef.current = res.data.minutes ?? 0
      }
    })
  }, [])

  // Event listener to reset activity timestamp
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', resetActivity)
    window.addEventListener('keydown', resetActivity)
    window.addEventListener('click', resetActivity)

    const interval = setInterval(() => {
      const lockMs = lockMinutesRef.current * 60 * 1000
      if (lockMs > 0 && !isLocked && session) {
        if (Date.now() - lastActivityRef.current >= lockMs) {
          setIsLocked(true)
        }
      }
    }, 10000)

    return () => {
      window.removeEventListener('mousemove', resetActivity)
      window.removeEventListener('keydown', resetActivity)
      window.removeEventListener('click', resetActivity)
      clearInterval(interval)
    }
  }, [isLocked, session, resetActivity])

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    setUnlocking(true)
    setError('')

    try {
      const res = await login(session?.username ?? 'admin', password)
      if (res.success) {
        setIsLocked(false)
        setPassword('')
        lastActivityRef.current = Date.now()
      } else {
        setError(t('auth.wrongPassword'))
      }
    } catch {
      setError(t('auth.wrongPassword'))
    } finally {
      setUnlocking(false)
    }
  }

  if (!isLocked) return null

  return (
    <div className="fixed inset-0 z-999 bg-[#0F172A] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-sm p-8 shadow-2xl text-center space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="w-16 h-16 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center mx-auto border-2 border-[#2563EB]">
          <Lock size={28} />
        </div>

        <div>
          <h2 className="text-lg font-bold text-[#0F172A]">{t('auth.sessionLocked')}</h2>
          <p className="text-xs text-slate-400 mt-1">{t('auth.unlockPrompt')}</p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.password')}
              className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 bg-white"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={unlocking || !password}
            className="w-full py-3 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {unlocking && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {t('auth.unlock')}
          </button>
        </form>
      </div>
    </div>
  )
}
