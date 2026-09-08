import { useState, useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

const titles: Record<string, string> = {
  '/dashboard': 'لوحة التحكم',
  '/students': 'الطلاب',
  '/teachers': 'الأساتذة',
  '/courses': 'المواد والأفواج',
  '/attendance': 'تسجيل الحضور',
  '/attendance/history': 'سجل الحضور',
  '/payments': 'المدفوعات والمداخيل',
  '/reports': 'التقارير والإحصائيات',
  '/settings': 'الإعدادات',
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const api = (window as any).schoolApp

  // Auto-lock inactivity listener
  useEffect(() => {
    let autoLockMinutes = 0

    const checkAutoLock = async () => {
      if (!api?.settings?.getAutoLock) return
      try {
        const res = await api.settings.getAutoLock()
        if (res.success && res.data?.minutes) {
          autoLockMinutes = res.data.minutes
          resetTimer()
        }
      } catch (err) {
        console.error('Failed to get auto-lock setting:', err)
      }
    }

    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (autoLockMinutes <= 0) return

      timeoutRef.current = setTimeout(() => {
        navigate('/login')
      }, autoLockMinutes * 60 * 1000)
    }

    checkAutoLock()

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']
    const onUserActivity = () => {
      if (autoLockMinutes > 0) resetTimer()
    }

    events.forEach(evt => window.addEventListener(evt, onUserActivity))

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      events.forEach(evt => window.removeEventListener(evt, onUserActivity))
    }
  }, [api, navigate])

  const getTitle = () => {
    const exact = titles[location.pathname]
    if (exact) return exact
    if (location.pathname.startsWith('/students/')) return 'الملف الشخصي للطالب'
    return 'منصة إدارة المدرسة'
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background" dir="rtl">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title={getTitle()} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
