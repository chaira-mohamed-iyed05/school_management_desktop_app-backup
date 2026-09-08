import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import { switchLanguage, LANGUAGES, type SupportedLanguage } from '../../i18n/i18n'
import { useAuth } from '../../features/auth/AuthContext'

const routeLabels: Record<string, string> = {
  '/dashboard': 'nav.dashboard',
  '/students': 'nav.students',
  '/teachers': 'nav.teachers',
  '/courses': 'nav.courses',
  '/attendance': 'nav.attendance',
  '/payments': 'nav.payments',
  '/reports': 'nav.reports',
  '/settings': 'nav.settings',
  '/backups': 'nav.backups',
}

export default function Header() {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const { session } = useAuth()
  const [adminPhotoUrl, setAdminPhotoUrl] = useState<string | null>(null)

  const rootPath = '/' + pathname.split('/')[1]
  const pageTitle = routeLabels[rootPath] ? t(routeLabels[rootPath]) : ''

  useEffect(() => {
    if (session) {
      window.schoolApp.settings.getAdmin().then(async (res) => {
        if (res.success && res.data?.photoPath) {
          try {
            const photoRes = await window.schoolApp.media.getImageUrl(res.data.photoPath)
            if (photoRes.success && photoRes.data?.url) setAdminPhotoUrl(photoRes.data.url)
          } catch { /* ignore */ }
        }
      })
    }
  }, [session])

  const handleLang = (lang: SupportedLanguage) => {
    switchLanguage(lang)
  }

  return (
    <header className="bg-white border-b border-border px-5 py-3 flex items-center justify-between h-14 shrink-0">
      <h1 className="text-[15px] font-semibold text-[#0F172A]">{pageTitle}</h1>

      <div className="flex items-center gap-3">
        {/* Language switcher */}
        <div className="flex items-center gap-1 border border-border rounded-lg px-2 py-1.5">
          <Globe size={13} className="text-slate-400" />
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => handleLang(l.code)}
              className={`text-[11px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                i18n.language === l.code
                  ? 'bg-[#2563EB] text-white'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {l.code.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Admin badge with photo */}
        {session && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {adminPhotoUrl ? (
              <img src={adminPhotoUrl} alt={session.fullName} className="w-7 h-7 rounded-full object-cover border border-slate-200" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center text-white font-semibold text-xs">
                {session.fullName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="hidden sm:block font-medium text-[#0F172A]">{session.fullName}</span>
          </div>
        )}
      </div>
    </header>
  )
}
