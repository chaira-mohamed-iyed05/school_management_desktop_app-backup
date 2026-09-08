import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import {
  Save, School, Wrench, Database, Shield,
  Eye, EyeOff, CheckCircle2, AlertCircle, FolderOpen,
  RotateCcw, Plus, Clock, User, KeyRound
} from 'lucide-react'
import type { SchoolSettings } from '@shared/types/index'

type SettingsSection = 'school' | 'application' | 'backup' | 'security'

interface AuditLog {
  id: number
  adminName: string
  action: string
  entityType?: string
  entityId?: number
  createdAt: string
}

export default function Settings() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [section, setSection] = useState<SettingsSection>('school')
  const [settings, setSettings] = useState<Partial<SchoolSettings>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')

  // Admin profile
  const [admin, setAdmin] = useState<{ fullName: string; username: string; preferredLanguage: string; photoPath: string | null } | null>(null)
  const [adminPhotoUrl, setAdminPhotoUrl] = useState<string | null>(null)

  // Password change
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [pwStatus, setPwStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [pwError, setPwError] = useState('')

  // Auto-lock
  const [autoLockMinutes, setAutoLockMinutes] = useState(0)

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  // Backups
  const [backups, setBackups] = useState<any[]>([])
  const [backupStatus, setBackupStatus] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, adminRes, lockRes] = await Promise.all([
        window.schoolApp.settings.get(),
        window.schoolApp.settings.getAdmin(),
        window.schoolApp.settings.getAutoLock(),
      ])
      if (settingsRes.success && settingsRes.data) setSettings(settingsRes.data)
      if (adminRes.success && adminRes.data) {
        setAdmin(adminRes.data)
        if (adminRes.data.photoPath) {
          try {
            const photoRes = await window.schoolApp.media.getImageUrl(adminRes.data.photoPath)
            if (photoRes.success && photoRes.data?.url) setAdminPhotoUrl(photoRes.data.url)
          } catch { /* ignore */ }
        }
      }
      if (lockRes.success && lockRes.data) setAutoLockMinutes(lockRes.data.minutes ?? 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const loadBackups = useCallback(async () => {
    const res = await window.schoolApp.backups.list()
    if (res.success && res.data) setBackups(res.data)
  }, [])

  useEffect(() => {
    if (section === 'backup') loadBackups()
    if (section === 'security') loadAuditLogs()
  }, [section])

  const loadAuditLogs = async () => {
    setLogsLoading(true)
    try {
      const res = await window.schoolApp.settings.listAuditLogs({ limit: 50 })
      if (res.success && res.data) setAuditLogs(res.data)
    } finally {
      setLogsLoading(false)
    }
  }

  const set = (k: keyof SchoolSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setSettings((s) => ({ ...s, [k]: e.target.value }))

  const setChecked = (k: keyof SchoolSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSettings((s) => ({ ...s, [k]: e.target.checked }))

  const handleSave = async () => {
    setSaving(true)
    setSaveStatus('idle')
    try {
      const res = await window.schoolApp.settings.update({
        schoolNameAr: settings.schoolNameAr,
        schoolNameFr: settings.schoolNameFr,
        schoolNameEn: settings.schoolNameEn,
        phone: settings.phone ?? null,
        email: settings.email ?? null,
        address: settings.address ?? null,
        academicYear: settings.academicYear,
        currency: settings.currency,
        defaultLanguage: settings.defaultLanguage as 'ar' | 'fr' | 'en',
        backupDirectory: settings.backupDirectory ?? null,
        automaticBackupEnabled: settings.automaticBackupEnabled,
        backupsToRetain: settings.backupsToRetain,
      })
      if (res.success && res.data) {
        setSettings(res.data)
        setSaveStatus('success')
        setTimeout(() => setSaveStatus('idle'), 3000)
      } else {
        setSaveStatus('error')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!pwForm.current || !pwForm.next) { setPwError(t('auth.fillAllFields')); return }
    if (pwForm.next !== pwForm.confirm) { setPwError(t('setup.errorPasswordMismatch')); return }
    if (pwForm.next.length < 6) { setPwError(t('setup.errorPasswordLength')); return }
    setPwError('')
    try {
      const res = await window.schoolApp.auth.changePassword(pwForm.current, pwForm.next)
      if (res.success) {
        setPwStatus('success')
        setPwForm({ current: '', next: '', confirm: '' })
        setTimeout(() => setPwStatus('idle'), 3000)
      } else {
        setPwError(res.error ?? t('common.error'))
        setPwStatus('error')
      }
    } catch (e: any) {
      setPwError(e.message ?? t('common.error'))
      setPwStatus('error')
    }
  }

  const handleChooseBackupDir = async () => {
    const res = await window.schoolApp.app.openSaveDialog()
    if (res.success && res.data && !res.data.canceled && res.data.path) {
      setSettings((s) => ({ ...s, backupDirectory: res.data!.path! }))
    }
  }

  const handleCreateBackup = async () => {
    setCreating(true)
    setBackupStatus(null)
    try {
      const res = await window.schoolApp.backups.create(settings.backupDirectory ?? undefined)
      if (res.success) {
        setBackupStatus(t('backups.backupCreated'))
        await loadBackups()
      } else {
        setBackupStatus(`${t('common.error')}: ${res.error}`)
      }
    } finally {
      setCreating(false)
    }
  }

  const handleRestoreBackup = async () => {
    const res = await window.schoolApp.app.openBackupDialog()
    if (!res.success || !res.data || res.data.canceled || !res.data.path) return
    const confirmPw = window.prompt(t('backups.passwordConfirm'))
    if (!confirmPw) return
    setRestoring(true)
    try {
      const restoreRes = await window.schoolApp.backups.restore(res.data.path, confirmPw)
      if (restoreRes.success) {
        alert(t('backups.restoreComplete'))
        await logout()
        navigate('/login', { replace: true })
      } else {
        alert(`${t('common.error')}: ${restoreRes.error}`)
      }
    } finally {
      setRestoring(false)
    }
  }

  const handleSaveAutoLock = async () => {
    const res = await window.schoolApp.settings.setAutoLock(autoLockMinutes)
    if (res.success) {
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }
  }

  const handleAdminPhoto = async () => {
    const res = await window.schoolApp.media.selectImage('admin', String(admin?.username ?? 'admin'))
    if (res.success && res.data?.path) {
      const updateRes = await window.schoolApp.settings.updateAdmin({ photoPath: res.data.path })
      if (updateRes.success) {
        const photoRes = await window.schoolApp.media.getImageUrl(res.data.path)
        if (photoRes.success && photoRes.data?.url) setAdminPhotoUrl(photoRes.data.url)
      }
    }
  }

  const inputCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all bg-white'
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1.5'

  const navItems: { key: SettingsSection; label: string; icon: any }[] = [
    { key: 'school', label: t('settings.school'), icon: School },
    { key: 'application', label: t('settings.appearance'), icon: Wrench },
    { key: 'backup', label: t('settings.backup'), icon: Database },
    { key: 'security', label: t('settings.security'), icon: Shield },
  ]

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">
      {/* Left nav */}
      <div className="bg-white rounded-xl border border-border p-3 h-fit">
        {navItems.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1 text-start ${
              section === key
                ? 'bg-[#EFF6FF] text-[#2563EB]'
                : 'text-slate-600 hover:bg-slate-50 hover:text-[#0F172A]'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-5">
        {/* Save status banner */}
        {saveStatus !== 'idle' && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm animate-fade-in ${
            saveStatus === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {saveStatus === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {saveStatus === 'success' ? t('settings.saved') : t('common.error')}
          </div>
        )}

        {/* ── School Profile ── */}
        {section === 'school' && (
          <div className="bg-white rounded-xl border border-border p-6 space-y-4">
            <h3 className="font-semibold text-[#0F172A] text-sm pb-2 border-b border-[#F1F5F9]">
              {t('settings.school')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('settings.schoolNameAr')}</label>
                <input className={inputCls} value={settings.schoolNameAr ?? ''} onChange={set('schoolNameAr')} dir="rtl" />
              </div>
              <div>
                <label className={labelCls}>{t('settings.schoolNameFr')}</label>
                <input className={inputCls} value={settings.schoolNameFr ?? ''} onChange={set('schoolNameFr')} />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t('settings.schoolNameEn')}</label>
              <input className={inputCls} value={settings.schoolNameEn ?? ''} onChange={set('schoolNameEn')} dir="ltr" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('settings.phone')}</label>
                <input className={inputCls} value={settings.phone ?? ''} onChange={set('phone')} dir="ltr" />
              </div>
              <div>
                <label className={labelCls}>{t('settings.email')}</label>
                <input type="email" className={inputCls} value={settings.email ?? ''} onChange={set('email')} dir="ltr" />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t('settings.address')}</label>
              <input className={inputCls} value={settings.address ?? ''} onChange={set('address')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('settings.academicYear')}</label>
                <input className={inputCls} value={settings.academicYear ?? ''} onChange={set('academicYear')} placeholder="2025-2026" dir="ltr" />
              </div>
              <div>
                <label className={labelCls}>{t('settings.currency')}</label>
                <input className={inputCls} value={settings.currency ?? ''} onChange={set('currency')} placeholder="DZD" dir="ltr" />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors"
              >
                {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        )}

        {/* ── Application ── */}
        {section === 'application' && (
          <div className="bg-white rounded-xl border border-border p-6 space-y-4">
            <h3 className="font-semibold text-[#0F172A] text-sm pb-2 border-b border-[#F1F5F9]">
              {t('settings.appearance')}
            </h3>
            <div>
              <label className={labelCls}>{t('settings.language')}</label>
              <select className={inputCls} value={settings.defaultLanguage ?? 'ar'} onChange={set('defaultLanguage')}>
                <option value="ar">العربية</option>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('settings.studentPrefix')}</label>
                <input className={inputCls} value={(settings as any).studentNumberPrefix ?? 'ETU'} placeholder="ETU" dir="ltr"
                  onChange={(e) => setSettings(s => ({ ...s, studentNumberPrefix: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>{t('settings.receiptPrefix')}</label>
                <input className={inputCls} value={(settings as any).receiptPrefix ?? 'REC'} placeholder="REC" dir="ltr"
                  onChange={(e) => setSettings(s => ({ ...s, receiptPrefix: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors"
              >
                {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        )}

        {/* ── Backup ── */}
        {section === 'backup' && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-border p-6 space-y-4">
              <h3 className="font-semibold text-[#0F172A] text-sm pb-2 border-b border-[#F1F5F9]">
                {t('settings.backup')}
              </h3>
              <div>
                <label className={labelCls}>{t('settings.backupDir')}</label>
                <div className="flex gap-2">
                  <input className={`${inputCls} flex-1`} value={settings.backupDirectory ?? ''} readOnly dir="ltr"
                    placeholder={t('backups.chooseDir')} />
                  <button onClick={handleChooseBackupDir} className="px-3 py-2 border border-border rounded-lg text-sm text-slate-600 hover:bg-slate-50 shrink-0 flex items-center gap-1.5">
                    <FolderOpen size={14} /> {t('backups.chooseDir')}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="autoBackup" checked={settings.automaticBackupEnabled ?? false}
                  onChange={setChecked('automaticBackupEnabled')} className="w-4 h-4 text-[#2563EB] rounded" />
                <label htmlFor="autoBackup" className="text-sm font-medium text-[#0F172A]">
                  {t('settings.autoBackup')}
                </label>
              </div>
              {settings.automaticBackupEnabled && (
                <div>
                  <label className={labelCls}>{t('settings.backupsToRetain')}</label>
                  <input type="number" className={inputCls} value={settings.backupsToRetain ?? 30} min={1} max={365} dir="ltr"
                    onChange={(e) => setSettings(s => ({ ...s, backupsToRetain: Number(e.target.value) }))} />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors">
                  {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                  {saving ? t('common.saving') : t('common.save')}
                </button>
                <button onClick={handleCreateBackup} disabled={creating}
                  className="flex items-center gap-2 px-4 py-2.5 border border-border text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-60 transition-colors">
                  {creating ? <span className="w-4 h-4 border-2 border-[#2563EB]/30 border-t-[#2563EB] rounded-full animate-spin" /> : <Plus size={14} />}
                  {creating ? t('backups.creating') : t('backups.create')}
                </button>
                <button onClick={handleRestoreBackup} disabled={restoring}
                  className="flex items-center gap-2 px-4 py-2.5 border border-amber-300 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-50 disabled:opacity-60 transition-colors">
                  <RotateCcw size={14} /> {restoring ? t('backups.restoring') : t('backups.restore')}
                </button>
              </div>
              {backupStatus && (
                <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">{backupStatus}</p>
              )}
            </div>

            {/* Backup list */}
            {backups.length > 0 && (
              <div className="bg-white rounded-xl border border-border p-6">
                <h3 className="font-semibold text-[#0F172A] text-sm pb-2 border-b border-[#F1F5F9] mb-4">
                  {t('backups.list')}
                </h3>
                <div className="space-y-2">
                  {backups.map((b, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-[#F1F5F9] last:border-0">
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">{b.filename ?? b.path?.split(/[/\\]/).pop()}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{b.createdAt ?? b.created_at}</p>
                      </div>
                      <span className="text-xs text-slate-400">
                        {b.sizeBytes ? `${(b.sizeBytes / 1024 / 1024).toFixed(1)} MB` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Security ── */}
        {section === 'security' && (
          <div className="space-y-5">
            {/* Admin profile */}
            {admin && (
              <div className="bg-white rounded-xl border border-border p-6">
                <h3 className="font-semibold text-[#0F172A] text-sm pb-2 border-b border-[#F1F5F9] mb-4 flex items-center gap-2">
                  <User size={14} /> {t('common.administrator')}
                </h3>
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative group cursor-pointer" onClick={handleAdminPhoto}>
                    {adminPhotoUrl ? (
                      <img src={adminPhotoUrl} alt={admin.fullName} className="w-14 h-14 rounded-full object-cover border-2 border-border" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-[#2563EB] flex items-center justify-center text-white font-bold text-xl">
                        {admin.fullName.charAt(0)}
                      </div>
                    )}
                    <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Plus size={14} className="text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-[#0F172A]">{admin.fullName}</p>
                    <p className="text-sm text-slate-400">{admin.username}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Change Password */}
            <div className="bg-white rounded-xl border border-border p-6">
              <h3 className="font-semibold text-[#0F172A] text-sm pb-2 border-b border-[#F1F5F9] mb-4 flex items-center gap-2">
                <KeyRound size={14} /> {t('auth.changePassword')}
              </h3>
              {pwStatus === 'success' && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded-lg text-sm mb-3">
                  <CheckCircle2 size={15} /> {t('auth.passwordChanged')}
                </div>
              )}
              {pwError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg text-sm mb-3">
                  <AlertCircle size={15} /> {pwError}
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>{t('auth.currentPassword')}</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      className={inputCls}
                      value={pwForm.current}
                      onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                      dir="ltr"
                    />
                    <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>{t('auth.newPassword')}</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    className={inputCls}
                    value={pwForm.next}
                    onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('auth.confirmPassword')}</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    className={inputCls}
                    value={pwForm.confirm}
                    onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                    dir="ltr"
                  />
                </div>
                <button
                  onClick={handleChangePassword}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#0F172A] text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
                >
                  <KeyRound size={14} /> {t('auth.changePassword')}
                </button>
              </div>
            </div>

            {/* Auto-lock */}
            <div className="bg-white rounded-xl border border-border p-6">
              <h3 className="font-semibold text-[#0F172A] text-sm pb-2 border-b border-[#F1F5F9] mb-4 flex items-center gap-2">
                <Clock size={14} /> {t('settings.autoLock')}
              </h3>
              <p className="text-xs text-slate-400 mb-3">
                {t('settings.autoLockDesc')}
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  className={`${inputCls} w-28`}
                  value={autoLockMinutes}
                  min={0}
                  max={120}
                  dir="ltr"
                  onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                />
                <span className="text-sm text-slate-600">minutes</span>
                <button onClick={handleSaveAutoLock} className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-medium hover:bg-[#1D4ED8] transition-colors">
                  <Save size={14} /> {t('common.save')}
                </button>
              </div>
            </div>

            {/* Audit Logs */}
            <div className="bg-white rounded-xl border border-border p-6">
              <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9] mb-4">
                <h3 className="font-semibold text-[#0F172A] text-sm flex items-center gap-2">
                  <Clock size={14} /> {t('settings.auditLog')}
                </h3>
                <button onClick={loadAuditLogs} className="text-xs text-[#2563EB] hover:underline">{t('common.refresh')}</button>
              </div>
              {logsLoading ? (
                <div className="flex justify-center py-6">
                  <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">{t('settings.noAuditLogs')}</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 py-2 border-b border-[#F1F5F9] last:border-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB] mt-2 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#0F172A]">
                          <span className="font-medium">{log.adminName}</span>{' '}
                          <span className="text-slate-500">{log.action}</span>
                          {log.entityType && <span className="text-slate-400 text-xs"> · {log.entityType} #{log.entityId}</span>}
                        </p>
                        <p className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
