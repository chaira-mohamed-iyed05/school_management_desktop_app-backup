import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Lock, User, WifiOff } from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { LANGUAGES, switchLanguage, type SupportedLanguage } from '../i18n/i18n'

export default function Login() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dbStatus, setDbStatus] = useState<'checking' | 'healthy' | 'error'>('checking')

  useEffect(() => {
    async function checkHealth() {
      if (!window.schoolApp?.health) {
        setDbStatus('error')
        return
      }
      try {
        const res = await window.schoolApp.health.check()
        if (res.success && res.data?.sqliteOpen) {
          setDbStatus('healthy')
        } else {
          setDbStatus('error')
        }
      } catch {
        setDbStatus('error')
      }
    }
    checkHealth()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError(t('auth.fillAllFields'))
      return
    }
    setError('')
    setLoading(true)
    try {
      const result = await login(username.trim(), password)
      if (result.success) {
        navigate('/dashboard', { replace: true })
      } else {
        const code = result.error
        setError(
          code && t(`errors.${code}`, '') !== ''
            ? t(`errors.${code}`)
            : result.error ?? t('auth.invalidCredentials')
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel — branding */}
      <div className="hidden lg:flex w-1/2 bg-[#0F172A] flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-[#2563EB] opacity-20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-accent opacity-15 rounded-full blur-3xl" />

        <div className="relative text-center">
          <div className="w-20 h-20 rounded-2xl bg-[#2563EB] flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <span className="text-white font-bold text-3xl">E</span>
          </div>
          <h1 className="text-white text-4xl font-bold mb-2">Edupilot <span className="text-accent">DZ</span></h1>
          <p className="text-slate-400 text-base mt-3">{t('app.tagline')}</p>

          <div className="mt-12 flex items-center gap-2 text-slate-400 text-sm">
            <WifiOff size={15} />
            <span>{t('app.offline')}</span>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Language switcher */}
        <div className="absolute top-5 inset-e-5 flex gap-1 border border-border rounded-lg p-1">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => switchLanguage(l.code as SupportedLanguage)}
              className="text-xs px-2 py-1 rounded font-medium text-slate-500 hover:bg-slate-100 transition-colors"
            >
              {l.code.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center">
              <span className="text-white font-bold text-lg">E</span>
            </div>
            <span className="text-[#0F172A] font-bold text-xl">Edupilot <span className="text-accent">DZ</span></span>
          </div>

          <h2 className="text-2xl font-bold text-[#0F172A] mb-1">{t('auth.login')}</h2>
          <p className="text-slate-500 text-sm mb-8">{t('auth.schoolAdmin')}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
                {t('auth.username')}
              </label>
              <div className="relative">
                <User size={15} className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full ps-9 pe-3 py-2.5 border border-border rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all bg-white"
                  autoComplete="username"
                  disabled={loading}
                  dir="ltr"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
                {t('auth.password')}
              </label>
              <div className="relative">
                <Lock size={15} className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full ps-9 pe-9 py-2.5 border border-border rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all bg-white"
                  autoComplete="current-password"
                  disabled={loading}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-e-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2563EB] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#1D4ED8] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {t('auth.loggingIn')}
                </>
              ) : t('auth.loginButton')}
            </button>
          </form>

          <p className="text-center text-xs mt-8 flex items-center justify-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                dbStatus === 'healthy' ? 'bg-green-500' : dbStatus === 'checking' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span className={dbStatus === 'healthy' ? 'text-slate-500' : dbStatus === 'checking' ? 'text-amber-600' : 'text-red-600 font-medium'}>
              {dbStatus === 'healthy'
                ? t('common.localDatabase')
                : dbStatus === 'checking'
                ? t('common.checkingDatabase')
                : t('common.databaseUnavailable')}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
