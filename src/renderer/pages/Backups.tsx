import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Archive, HardDrive, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import type { BackupInfo } from '@shared/types/index'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export default function Backups() {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const load = async () => {
    const res = await window.schoolApp.backups.list()
    if (res.success && res.data) setBackups(res.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    setCreating(true)
    setMessage(null)
    const res = await window.schoolApp.backups.create()
    setCreating(false)
    if (res.success) {
      setMessage({ type: 'success', text: t('backups.backupCreated') })
      await load()
    } else {
      setMessage({ type: 'error', text: res.error ?? t('errors.BACKUP_FAILED') })
    }
  }

  const handleSelectRestore = async () => {
    const res = await window.schoolApp.app.openBackupDialog()
    if (res.success && res.data && !res.data.canceled && res.data.path) {
      const backup: BackupInfo = { filename: res.data.path.split('\\').pop() ?? '', path: res.data.path, createdAt: '', sizeBytes: 0, verified: false }
      setSelectedBackup(backup)
    }
  }

  const handleRestore = async () => {
    if (!selectedBackup || !confirmPassword) return
    setRestoring(true)
    setMessage(null)
    const res = await window.schoolApp.backups.restore(selectedBackup.path, confirmPassword)
    setRestoring(false)
    if (res.success) {
      // Clear current session and redirect cleanly to /login
      await logout()
      navigate('/login', { replace: true })
    } else {
      setMessage({ type: 'error', text: res.error ?? t('errors.RESTORE_FAILED') })
    }
  }

  return (
    <div className="max-w-2xl animate-fade-in space-y-5">
      {/* Create backup */}
      <div className="bg-white rounded-xl border border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-[#0F172A] text-sm">{t('backups.create')}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{t('backups.backupIncludes')}</p>
          </div>
          <button onClick={handleCreate} disabled={creating} className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors">
            {creating ? <RefreshCw size={14} className="animate-spin" /> : <HardDrive size={14} />}
            {creating ? t('backups.creating') : t('backups.create')}
          </button>
        </div>
      </div>

      {/* Feedback */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium animate-fade-in ${
          message.type === 'success' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {message.text}
        </div>
      )}

      {/* Backup list */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-[#F1F5F9] bg-slate-50">
          <h3 className="font-semibold text-[#0F172A] text-sm">{t('backups.list')}</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
        ) : backups.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Archive size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t('backups.noBackups')}</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {backups.map((b) => (
              <div key={b.path} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                  <HardDrive size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0F172A] truncate">{b.filename}</p>
                  <p className="text-xs text-slate-400">{formatBytes(b.sizeBytes)} · {b.createdAt ? new Date(b.createdAt).toLocaleString() : ''}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {b.verified ? (
                    <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircle2 size={12} /> {t('backups.verified')}</span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-400 text-xs"><XCircle size={12} /> {t('backups.notVerified')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Restore */}
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h3 className="font-semibold text-red-600 text-sm mb-1">{t('backups.restore')}</h3>
        <p className="text-xs text-slate-400 mb-4">{t('backups.confirmRestoreMsg')}</p>
        <div className="space-y-3">
          <button onClick={handleSelectRestore} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            <Archive size={14} /> {t('backups.selectBackup')}
          </button>
          {selectedBackup && (
            <>
              <p className="text-xs font-mono text-slate-500 truncate">{selectedBackup.filename}</p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('backups.passwordConfirm')}</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-red-400 focus:ring-2 focus:ring-red-400/20 bg-white" dir="ltr" />
              </div>
              <button onClick={handleRestore} disabled={restoring || !confirmPassword} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors">
                {restoring && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {restoring ? t('backups.restoring') : t('backups.restore')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
