import { useState, useEffect, useCallback } from 'react'
import {
  School, Settings as SettingsIcon, HardDrive, Shield, Save,
  FolderOpen, Plus, Eye, EyeOff, User, History, Check, AlertTriangle, RefreshCw
} from 'lucide-react'
import Modal from '../components/ui/Modal'

const TABS = [
  { id: 'school', label: 'الملف المدرسي', icon: School },
  { id: 'app', label: 'إعدادات التطبيق', icon: SettingsIcon },
  { id: 'admin', label: 'الملف الشخصي', icon: User },
  { id: 'backup', label: 'النسخ الاحتياطي', icon: HardDrive },
  { id: 'security', label: 'الأمان وسجل العمليات', icon: Shield },
]

export default function Settings() {
  const [tab, setTab] = useState('school')
  const [loading, setLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // School settings
  const [school, setSchool] = useState({
    schoolNameFr: 'Edupilot DZ',
    schoolNameAr: 'إيدوبيلوت الجزائر',
    schoolNameEn: 'Edupilot DZ',
    phone: '+213 555 000 000',
    email: 'contact@edupilot.dz',
    address: 'الجزائر العاصمة',
    academicYear: '2025–2026',
    currency: 'DZD',
    defaultLanguage: 'ar' as 'ar' | 'fr' | 'en',
    backupDirectory: '',
    automaticBackupEnabled: true,
    backupsToRetain: 7,
  })

  // Admin profile
  const [adminProfile, setAdminProfile] = useState({
    id: 1,
    username: 'admin',
    fullName: 'المدير العام',
    preferredLanguage: 'ar' as 'ar' | 'fr' | 'en',
    photoPath: null as string | null,
    photoUrl: null as string | null,
  })

  // Security / Password
  const [showOldPw, setShowOldPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [pwForm, setPwForm] = useState({ old: '', new: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Auto-lock
  const [autoLockMinutes, setAutoLockMinutes] = useState(0)

  // Backups
  const [backupsList, setBackupsList] = useState<any[]>([])
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [restoreModal, setRestoreModal] = useState(false)
  const [restorePath, setRestorePath] = useState('')
  const [restorePassword, setRestorePassword] = useState('')
  const [restoring, setRestoring] = useState(false)

  // Audit logs
  const [auditLogsModal, setAuditLogsModal] = useState(false)
  const [auditLogs, setAuditLogs] = useState<any[]>([])

  const api = (window as any).schoolApp

  // Load all settings
  const loadSettings = useCallback(async () => {
    if (!api) return
    setLoading(true)
    try {
      const [sRes, aRes, bRes, lkRes] = await Promise.all([
        api.settings.get(),
        api.settings.getAdmin ? api.settings.getAdmin() : Promise.resolve({ success: false }),
        api.backups.list(),
        api.settings.getAutoLock ? api.settings.getAutoLock() : Promise.resolve({ success: false }),
      ])

      if (sRes.success && sRes.data) {
        setSchool(prev => ({ ...prev, ...sRes.data }))
      }

      if (aRes.success && aRes.data) {
        let photoUrl = null
        if (aRes.data.photoPath) {
          const pRes = await api.media.getImageUrl(aRes.data.photoPath)
          if (pRes.success) photoUrl = pRes.data.url
        }
        setAdminProfile({ ...aRes.data, photoUrl })
      }

      if (bRes.success && bRes.data) {
        setBackupsList(bRes.data)
      }

      if (lkRes.success && lkRes.data) {
        setAutoLockMinutes(lkRes.data.minutes || 0)
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Save school settings
  const handleSaveSchool = async () => {
    if (!api) return
    try {
      const res = await api.settings.update(school)
      if (res.success) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2500)
      } else {
        alert(res.error?.message || 'خطأ أثناء الحفظ')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Save admin profile
  const handleSaveAdmin = async () => {
    if (!api) return
    try {
      const res = await api.settings.updateAdmin({
        fullName: adminProfile.fullName,
        preferredLanguage: adminProfile.preferredLanguage,
        photoPath: adminProfile.photoPath,
      })
      if (res.success) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2500)
      } else {
        alert(res.error?.message || 'خطأ أثناء تحديث بيانات المدير')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Choose admin photo
  const handleSelectAdminPhoto = async () => {
    if (!api) return
    try {
      const res = await api.media.selectImage('admin', adminProfile.id)
      if (res.success && res.path) {
        setAdminProfile(p => ({ ...p, photoPath: res.path }))
        const pRes = await api.media.getImageUrl(res.path)
        if (pRes.success) setAdminProfile(p => ({ ...p, photoUrl: pRes.data.url }))
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Change password
  const handleChangePassword = async () => {
    if (!api) return
    if (!pwForm.old || !pwForm.new || !pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'يرجى ملء جميع حقول كلمة المرور.' })
      return
    }
    if (pwForm.new !== pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'كلمات المرور الجديدة غير متطابقة.' })
      return
    }
    try {
      const res = await api.auth.changePassword({
        currentPassword: pwForm.old,
        newPassword: pwForm.new,
        confirmPassword: pwForm.confirm,
      })
      if (res.success) {
        setPwMsg({ type: 'success', text: 'تم تحديث كلمة المرور بنجاح!' })
        setPwForm({ old: '', new: '', confirm: '' })
      } else {
        setPwMsg({ type: 'error', text: res.error?.message || 'كلمة المرور الحالية غير صحيحة.' })
      }
    } catch (err) {
      setPwMsg({ type: 'error', text: 'حدث خطأ أثناء تغيير كلمة المرور.' })
    }
  }

  // Auto-lock change
  const handleAutoLockChange = async (minutes: number) => {
    setAutoLockMinutes(minutes)
    if (!api) return
    try {
      await api.settings.setAutoLock(minutes)
    } catch (err) {
      console.error(err)
    }
  }

  // Create backup
  const handleCreateBackup = async () => {
    if (!api) return
    setCreatingBackup(true)
    try {
      const res = await api.backups.create()
      if (res.success) {
        alert('تم إنشاء النسخة الاحتياطية بنجاح!')
        loadSettings()
      } else {
        alert(res.error?.message || 'حدث خطأ أثناء إنشاء النسخة الاحتياطية')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCreatingBackup(false)
    }
  }

  // Choose backup destination directory
  const handleChooseBackupDir = async () => {
    if (!api) return
    try {
      const res = await api.app.showSaveDialog()
      if (res.success && res.path) {
        setSchool(s => ({ ...s, backupDirectory: res.path }))
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Restore backup
  const handleRestoreBackup = async () => {
    if (!api || !restorePath || !restorePassword) {
      alert('يرجى تحديد ملف النسخة الاحتياطية وإدخال كلمة المرور للمدير.')
      return
    }
    setRestoring(true)
    try {
      const res = await api.backups.restore({
        backupPath: restorePath,
        confirmPassword: restorePassword,
      })
      if (res.success) {
        alert('تمت استعادة قاعدة البيانات بنجاح! سيتم إعادة تشغيل التطبيق.')
        window.location.reload()
      } else {
        alert(res.error?.message || 'كلمة المرور غير صحيحة أو ملف النسخة الاحتياطية غير صالح')
      }
    } catch (err) {
      alert('حدث خطأ أثناء الاستعادة')
    } finally {
      setRestoring(false)
    }
  }

  // Load audit logs
  const handleOpenAuditLogs = async () => {
    setAuditLogsModal(true)
    if (!api) return
    try {
      const res = await api.settings.listAuditLogs({ limit: 100 })
      if (res.success && res.data) {
        setAuditLogs(res.data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const InputRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0 gap-4">
      <label className="text-sm font-medium text-slate-700 w-64 shrink-0">{label}</label>
      <div className="flex-1 max-w-md">{children}</div>
    </div>
  )

  return (
    <div className="flex gap-6" dir="rtl">
      {/* Sidebar navigation */}
      <div className="w-56 shrink-0">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-1.5 space-y-1">
          {TABS.map(t => {
            const Icon = t.icon
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors text-right ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border border-blue-100'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1">
        {/* Tab 1: School Profile */}
        {tab === 'school' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">الملف التعريفي للمؤسسة</h2>
                <p className="text-xs text-slate-500 mt-0.5">تعديل معلومات وبيانات المدرسة التي تظهر في التقارير والوصولات</p>
              </div>
              {saveSuccess && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <Check size={14} /> تم الحفظ بنجاح!
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              <InputRow label="اسم المؤسسة (بالعربية)">
                <input
                  type="text"
                  value={school.schoolNameAr}
                  onChange={e => setSchool(s => ({ ...s, schoolNameAr: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                  placeholder="مثال: أكاديمية النجاح التعليمية"
                />
              </InputRow>
              <InputRow label="اسم المؤسسة (بالفرنسية / اللاتينية)">
                <input
                  type="text"
                  value={school.schoolNameFr}
                  onChange={e => setSchool(s => ({ ...s, schoolNameFr: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-left font-sans"
                  dir="ltr"
                  placeholder="ex: Académie Ennajah"
                />
              </InputRow>
              <InputRow label="رقم الهاتف">
                <input
                  type="tel"
                  value={school.phone || ''}
                  onChange={e => setSchool(s => ({ ...s, phone: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white font-mono text-left"
                  dir="ltr"
                  placeholder="0555 00 00 00"
                />
              </InputRow>
              <InputRow label="البريد الإلكتروني">
                <input
                  type="email"
                  value={school.email || ''}
                  onChange={e => setSchool(s => ({ ...s, email: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-left font-sans"
                  dir="ltr"
                  placeholder="contact@school.dz"
                />
              </InputRow>
              <InputRow label="العنوان الجغرافي">
                <input
                  type="text"
                  value={school.address || ''}
                  onChange={e => setSchool(s => ({ ...s, address: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                  placeholder="الجزائر العاصمة، الجزائر"
                />
              </InputRow>
              <InputRow label="الموسم الدراسي">
                <input
                  type="text"
                  value={school.academicYear}
                  onChange={e => setSchool(s => ({ ...s, academicYear: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white font-mono text-left"
                  dir="ltr"
                  placeholder="2025–2026"
                />
              </InputRow>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={handleSaveSchool}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <Save size={16} /> حفظ التغييرات
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: App Settings */}
        {tab === 'app' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">إعدادات التطبيق والنظام</h2>
                <p className="text-xs text-slate-500 mt-0.5">تخصيص الخيارات العامة وسلوك البرنامج</p>
              </div>
              {saveSuccess && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <Check size={14} /> تم الحفظ بنجاح!
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              <InputRow label="اللغة الافتراضية للواجهة">
                <select
                  value={school.defaultLanguage}
                  onChange={e => setSchool(s => ({ ...s, defaultLanguage: e.target.value as any }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="ar">العربية (Algeria)</option>
                  <option value="fr">الفرنسية (Français)</option>
                  <option value="en">الإنجليزية (English)</option>
                </select>
              </InputRow>
              <InputRow label="العملة الرسمية المعتمدة">
                <div className="text-sm text-slate-800 py-1 font-bold flex items-center gap-2">
                  <span>الدينار الجزائري (دج / DZD)</span>
                  <span className="text-xs text-slate-400 font-normal">عملة الفوترة المعتمدة</span>
                </div>
              </InputRow>
              <InputRow label="النسخ الاحتياطي التلقائي">
                <label className="flex items-center gap-3 cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={school.automaticBackupEnabled}
                    onChange={e => setSchool(s => ({ ...s, automaticBackupEnabled: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                  />
                  <span className="text-sm text-slate-700 font-medium">تفعيل النسخ الاحتياطي اليومي التلقائي عند فتح التطبيق</span>
                </label>
              </InputRow>
              <InputRow label="عدد النسخ الاحتياطية المحتفظ بها">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={school.backupsToRetain}
                    onChange={e => setSchool(s => ({ ...s, backupsToRetain: Number(e.target.value) || 7 }))}
                    className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white font-mono text-center"
                  />
                  <span className="text-xs text-slate-500">نسخ سابقة (يتم حذف الأقدم تلقائياً)</span>
                </div>
              </InputRow>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={handleSaveSchool}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <Save size={16} /> حفظ الإعدادات
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Admin Profile */}
        {tab === 'admin' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">الملف الشخصي للمسؤول</h2>
                <p className="text-xs text-slate-500 mt-0.5">تعديل بيانات الحساب الإداري وصورة الملف</p>
              </div>
              {saveSuccess && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <Check size={14} /> تم التحديث بنجاح!
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              <InputRow label="صورة الحساب">
                <div className="flex items-center gap-4">
                  {adminProfile.photoUrl ? (
                    <img src={adminProfile.photoUrl} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-slate-200 shadow-sm" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold shadow-sm">
                      {adminProfile.fullName.charAt(0)}
                    </div>
                  )}
                  <button
                    onClick={handleSelectAdminPhoto}
                    className="px-3.5 py-1.5 text-xs text-blue-700 font-bold bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                  >
                    تغيير الصورة
                  </button>
                </div>
              </InputRow>
              <InputRow label="الاسم الكامل">
                <input
                  type="text"
                  value={adminProfile.fullName}
                  onChange={e => setAdminProfile(p => ({ ...p, fullName: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </InputRow>
              <InputRow label="اسم المستخدم (تسجيل الدخول)">
                <div className="font-mono text-sm text-slate-700 py-1.5 bg-slate-50 px-3 rounded-lg border border-slate-200 max-w-xs text-left" dir="ltr">
                  {adminProfile.username}
                </div>
              </InputRow>
              <InputRow label="اللغة المفضلة">
                <select
                  value={adminProfile.preferredLanguage}
                  onChange={e => setAdminProfile(p => ({ ...p, preferredLanguage: e.target.value as any }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="ar">العربية</option>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </InputRow>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={handleSaveAdmin}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <Save size={16} /> حفظ بيانات الحساب
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Backup & Restore */}
        {tab === 'backup' && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">النسخ الاحتياطي واستعادة البيانات</h2>
                  <p className="text-xs text-slate-500 mt-0.5">حفظ نسخة كاملة من قاعدة البيانات والصور واستعادتها عند الحاجة</p>
                </div>
                <button
                  onClick={handleCreateBackup}
                  disabled={creatingBackup}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors shadow-sm cursor-pointer"
                >
                  {creatingBackup ? <RefreshCw size={15} className="animate-spin" /> : <Plus size={15} />}
                  <span>إنشاء نسخة احتياطية الآن</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                <InputRow label="مجلد حفظ النسخ الاحتياطية">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={school.backupDirectory || 'المجلد الافتراضي (AppData/backups)'}
                      readOnly
                      className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 font-mono text-slate-600 text-left"
                      dir="ltr"
                    />
                    <button
                      onClick={handleChooseBackupDir}
                      className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                      title="تغيير المجلد"
                    >
                      <FolderOpen size={16} />
                    </button>
                  </div>
                </InputRow>
              </div>
            </div>

            {/* Backups List */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">
                  قائمة النسخ الاحتياطية المتوفرة ({backupsList.length})
                </h3>
                <button
                  onClick={loadSettings}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={12} /> تحديث القائمة
                </button>
              </div>
              {backupsList.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">
                  لا توجد أي نسخ احتياطية مسجلة حالياً
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500">
                      <th className="px-6 py-3 text-right">اسم الملف / المسار</th>
                      <th className="px-6 py-3 text-right">الحجم</th>
                      <th className="px-6 py-3 text-center">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {backupsList.map((b, i) => {
                      const sizeMb = (b.sizeBytes / (1024 * 1024)).toFixed(2)
                      const sizeKb = (b.sizeBytes / 1024).toFixed(0)
                      const sizeLabel = b.sizeBytes > 1024 * 1024 ? `${sizeMb} ميغابايت` : `${sizeKb} كيلوبايت`
                      return (
                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-3.5 font-mono text-xs text-slate-700 text-left" dir="ltr">
                            {b.filename || b.path}
                          </td>
                          <td className="px-6 py-3.5 text-xs text-slate-600 font-medium">
                            {sizeLabel}
                          </td>
                          <td className="px-6 py-3.5 text-center">
                            <button
                              onClick={() => {
                                setRestorePath(b.path)
                                setRestoreModal(true)
                              }}
                              className="inline-flex items-center gap-1 text-xs text-amber-700 font-bold bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                            >
                              استعادة
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Security, Auto-lock & Audit Logs */}
        {tab === 'security' && (
          <div className="space-y-5">
            {/* Password Change */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-base font-bold text-slate-900 mb-1">تغيير كلمة مرور المدير</h2>
              <p className="text-xs text-slate-500 mb-4 pb-3 border-b border-slate-100">يُنصح بتعيين كلمة مرور قوية لحماية بيانات المؤسسة</p>
              
              {pwMsg && (
                <div className={`p-3 mb-4 rounded-lg text-xs font-bold ${pwMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {pwMsg.text}
                </div>
              )}
              <div className="space-y-3.5 max-w-sm">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">كلمة المرور الحالية</label>
                  <div className="relative">
                    <input
                      type={showOldPw ? 'text' : 'password'}
                      value={pwForm.old}
                      onChange={e => setPwForm(p => ({ ...p, old: e.target.value }))}
                      className="w-full px-3 py-2 pl-10 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPw(v => !v)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showOldPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">كلمة المرور الجديدة</label>
                  <div className="relative">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      value={pwForm.new}
                      onChange={e => setPwForm(p => ({ ...p, new: e.target.value }))}
                      className="w-full px-3 py-2 pl-10 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(v => !v)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">تأكيد كلمة المرور الجديدة</label>
                  <input
                    type="password"
                    value={pwForm.confirm}
                    onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
                    dir="ltr"
                  />
                </div>
                <button
                  onClick={handleChangePassword}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm cursor-pointer mt-2"
                >
                  <Save size={15} /> تحديث كلمة المرور
                </button>
              </div>
            </div>

            {/* Auto-lock & Audit */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-base font-bold text-slate-900 mb-1">الأمان التلقائي وسجل الأنشطة</h2>
              <p className="text-xs text-slate-500 mb-4 pb-3 border-b border-slate-100">التحكم في قفل الشاشة عند الخمول ومراجعة العمليات</p>
              
              <div className="divide-y divide-slate-100">
                <InputRow label="القفل التلقائي عند عدم النشاط">
                  <select
                    value={autoLockMinutes}
                    onChange={e => handleAutoLockChange(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option value={0}>معطل (لا يتم القفل تلقائياً)</option>
                    <option value={5}>بعد 5 دقائق من الخمول</option>
                    <option value={10}>بعد 10 دقائق من الخمول</option>
                    <option value={15}>بعد 15 دقيقة من الخمول</option>
                    <option value={30}>بعد 30 دقيقة من الخمول</option>
                    <option value={60}>بعد ساعة واحدة من الخمول</option>
                  </select>
                </InputRow>
                <InputRow label="سجل العمليات والأنشطة (Audit Log)">
                  <button
                    onClick={handleOpenAuditLogs}
                    className="text-sm text-blue-700 hover:text-blue-900 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg px-4 py-2 transition-colors font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <History size={16} /> عرض سجل العمليات والأنشطة
                  </button>
                </InputRow>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Restore confirmation modal */}
      <Modal open={restoreModal} onClose={() => setRestoreModal(false)} title="استعادة قاعدة البيانات" size="sm">
        <div className="space-y-4" dir="rtl">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              <strong>تنبيه هام:</strong> ستؤدي عملية الاستعادة إلى استبدال كافة البيانات الحالية بالبيانات الموجودة في ملف النسخة الاحتياطية المحدد.
            </span>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">كلمة مرور المدير للتأكيد</label>
            <input
              type="password"
              placeholder="أدخل كلمة المرور الحالية..."
              value={restorePassword}
              onChange={e => setRestorePassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
              dir="ltr"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              onClick={() => setRestoreModal(false)}
              disabled={restoring}
              className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              إلغاء
            </button>
            <button
              onClick={handleRestoreBackup}
              disabled={restoring}
              className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg cursor-pointer flex items-center gap-1.5"
            >
              {restoring && <RefreshCw size={14} className="animate-spin" />}
              <span>تأكيد الاستعادة</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Audit logs viewer modal */}
      <Modal open={auditLogsModal} onClose={() => setAuditLogsModal(false)} title="سجل العمليات والأنشطة الإدارية" size="lg">
        <div className="space-y-3 max-h-96 overflow-y-auto" dir="rtl">
          {auditLogs.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">لا توجد أي أنشطة مسجلة في السجل</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 text-slate-600 font-bold">
                  <th className="p-2.5 text-right">التاريخ والوقت</th>
                  <th className="p-2.5 text-right">العملية</th>
                  <th className="p-2.5 text-right">العنصر</th>
                  <th className="p-2.5 text-right">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {auditLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2.5 text-slate-500 whitespace-nowrap font-mono text-left" dir="ltr">
                      {new Date(log.createdAt).toLocaleString('ar-DZ')}
                    </td>
                    <td className="p-2.5 font-bold text-slate-800">{log.action}</td>
                    <td className="p-2.5 text-slate-600">{log.entityType ? `${log.entityType} #${log.entityId}` : '—'}</td>
                    <td className="p-2.5 text-slate-500 truncate max-w-xs font-mono text-left" dir="ltr">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>
    </div>
  )
}
