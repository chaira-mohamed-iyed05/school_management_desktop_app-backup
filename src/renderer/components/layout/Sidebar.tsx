import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ScanLine,
  CreditCard, BarChart3, Settings, ChevronLeft, ChevronRight,
  LogOut
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../features/auth/AuthContext'
import Logo from '../Logo'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { t, i18n } = useTranslation()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const isRTL = i18n.language === 'ar'

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/students', icon: Users, label: t('nav.students') },
    { to: '/teachers', icon: GraduationCap, label: t('nav.teachers') },
    { to: '/courses', icon: BookOpen, label: t('nav.courses') },
    { to: '/attendance', icon: ScanLine, label: t('nav.attendance') },
    { to: '/payments', icon: CreditCard, label: t('nav.payments') },
    { to: '/reports', icon: BarChart3, label: t('nav.reports') },
    { to: '/settings', icon: Settings, label: t('nav.settings') },
  ]

  // Chevron flips for RTL
  const CollapseIcon = isRTL
    ? collapsed ? ChevronLeft : ChevronRight
    : collapsed ? ChevronRight : ChevronLeft

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside
      className={`flex flex-col h-screen bg-[#0F172A] transition-all duration-200 shrink-0 ${
        collapsed ? 'w-15' : 'w-55'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center border-b border-white/10 py-3.5 ${collapsed ? 'flex-col justify-center gap-2 px-1' : 'justify-between px-3'}`}>
        {!collapsed && (
          <div className="overflow-hidden w-full">
            <Logo collapsed={false} size={28} />
          </div>
        )}
        {collapsed && (
          <div className="flex items-center justify-center">
            <Logo collapsed={true} size={28} />
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          title={collapsed ? t('nav.dashboard') : undefined}
        >
          <CollapseIcon size={14} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                isActive
                  ? 'bg-[#2563EB] text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`
            }
          >
            <Icon size={17} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-3">
        <div className={`flex items-center gap-2 mb-3 px-1 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-xs font-bold shrink-0">
            A
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">{t('common.administrator')}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                <span className="text-[10px] text-slate-400 truncate">{t('common.localDatabase')}</span>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          title={t('auth.logout')}
          className={`flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut size={15} />
          {!collapsed && <span>{t('auth.logout')}</span>}
        </button>
      </div>
    </aside>
  )
}
