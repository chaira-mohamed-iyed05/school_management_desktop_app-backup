import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, User, Settings, LogOut, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface HeaderProps {
  title: string
}

const today = new Date().toLocaleDateString('ar-DZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

export default function Header({ title }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [adminUser, setAdminUser] = useState<{ fullName: string; photoUrl: string | null }>({
    fullName: 'مدير النظام',
    photoUrl: null,
  })

  const searchRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const api = (window as any).schoolApp

  // Load admin profile info
  useEffect(() => {
    const fetchAdmin = async () => {
      if (!api) return
      try {
        const res = await api.settings.getAdmin ? api.settings.getAdmin() : { success: false }
        if (res.success && res.data) {
          let photoUrl = null
          if (res.data.photoPath) {
            const pRes = await api.media.getImageUrl(res.data.photoPath)
            if (pRes.success) photoUrl = pRes.data.url
          }
          setAdminUser({
            fullName: res.data.fullName || 'مدير النظام',
            photoUrl,
          })
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchAdmin()
  }, [api])

  // Live search across SQLite students and courses
  useEffect(() => {
    if (searchQuery.trim().length < 2 || !api) {
      setSearchResults([])
      return
    }

    const searchTimer = setTimeout(async () => {
      try {
        const [sRes, cRes] = await Promise.all([
          api.students.list({ search: searchQuery, pageSize: 4 }),
          api.courses.list()
        ])

        const matchedStudents = (sRes.success && sRes.data?.items ? sRes.data.items : []).map((s: any) => ({
          type: 'طالب',
          label: `${s.lastNameAr || s.lastNameFr || ''} ${s.firstNameAr || s.firstNameFr || ''}`.trim(),
          sub: s.studentNumber,
          to: `/students/${s.id}`
        }))

        const matchedCourses = (cRes.success && cRes.data ? cRes.data : [])
          .filter((c: any) => (c.nameAr || c.nameFr || '').toLowerCase().includes(searchQuery.toLowerCase()))
          .slice(0, 3)
          .map((c: any) => ({
            type: 'مادة',
            label: c.nameAr || c.nameFr,
            sub: c.code || 'مادة تعليمية',
            to: '/courses'
          }))

        setSearchResults([...matchedStudents, ...matchedCourses])
      } catch (err) {
        console.error(err)
      }
    }, 200)

    return () => clearTimeout(searchTimer)
  }, [searchQuery, api])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-6 gap-4 shrink-0 z-20" dir="rtl">
      <h1 className="text-base font-bold text-slate-900 whitespace-nowrap">{title}</h1>
      <div className="flex-1" />

      {/* Search */}
      <div ref={searchRef} className="relative">
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5 w-60">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="بحث عن طالب أو مادة..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowSearch(true) }}
            onFocus={() => setShowSearch(true)}
            className="bg-transparent text-sm outline-none w-full text-slate-700 placeholder-slate-400 text-right"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setShowSearch(false) }}>
              <X size={12} className="text-slate-400" />
            </button>
          )}
        </div>
        {showSearch && searchResults.length > 0 && (
          <div className="absolute top-full mt-1 right-0 bg-white rounded-xl border border-slate-200 shadow-lg w-80 z-50 overflow-hidden">
            {searchResults.map((r, i) => (
              <button
                key={i}
                className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-slate-50 text-right transition-colors border-b border-slate-50 last:border-0"
                onClick={() => { navigate(r.to); setShowSearch(false); setSearchQuery('') }}
              >
                <div>
                  <span className="text-sm text-slate-800 font-medium block">{r.label}</span>
                  <span className="text-[11px] font-mono text-slate-400">{r.sub}</span>
                </div>
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-medium">{r.type}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Date */}
      <span className="text-xs text-slate-500 whitespace-nowrap hidden xl:block">{today}</span>

      {/* Profile Menu */}
      <div className="relative">
        <button
          onClick={() => setShowProfile(!showProfile)}
          className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          {adminUser.photoUrl ? (
            <img src={adminUser.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-slate-200" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {adminUser.fullName.charAt(0)}
            </div>
          )}
          <span className="text-sm font-semibold text-slate-800 hidden sm:block max-w-28 truncate">{adminUser.fullName}</span>
          <ChevronDown size={13} className="text-slate-400" />
        </button>
        {showProfile && (
          <div className="absolute top-full mt-1 left-0 bg-white rounded-xl border border-slate-200 shadow-lg w-48 z-50 overflow-hidden text-right">
            <button onClick={() => { navigate('/settings'); setShowProfile(false) }} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
              <User size={14} /> الملف الشخصي
            </button>
            <button onClick={() => { navigate('/settings'); setShowProfile(false) }} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
              <Settings size={14} /> الإعدادات
            </button>
            <div className="border-t border-slate-100" />
            <button onClick={() => { navigate('/login'); setShowProfile(false) }} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
              <LogOut size={14} /> تسجيل الخروج
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
