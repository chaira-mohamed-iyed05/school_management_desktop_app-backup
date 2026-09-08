import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Building2, User, Globe, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { switchLanguage, type SupportedLanguage } from '../i18n/i18n'

const STEPS = ['step1', 'step2', 'step3'] as const

export default function Setup() {
  const { t } = useTranslation()
  const { completeSetup } = useAuth()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [form, setForm] = useState({
    schoolNameAr: '',
    schoolNameFr: '',
    phone: '',
    email: '',
    address: '',
    academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    adminFullName: '',
    adminUsername: '',
    adminPassword: '',
    confirmPassword: '',
    preferredLanguage: 'ar' as SupportedLanguage,
  })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  // Go back without clearing form data
  const prevStep = () => {
    setError('')
    setStep((s) => Math.max(0, s - 1))
  }

  const nextStep = () => {
    setError('')
    if (step === 0) {
      if (!form.schoolNameAr.trim() || !form.schoolNameFr.trim()) {
        setError(t('setup.errorSchoolName'))
        return
      }
    }
    if (step === 1) {
      if (!form.adminFullName.trim() || !form.adminUsername.trim() || !form.adminPassword) {
        setError(t('setup.errorAdminFields'))
        return
      }
      if (form.adminPassword.length < 8) {
        setError(t('setup.errorPasswordLength'))
        return
      }
      if (form.adminPassword !== form.confirmPassword) {
        setError(t('setup.errorPasswordMismatch'))
        return
      }
    }
    setStep((s) => s + 1)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await completeSetup({
        schoolNameAr: form.schoolNameAr,
        schoolNameFr: form.schoolNameFr,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        academicYear: form.academicYear,
        adminFullName: form.adminFullName,
        adminUsername: form.adminUsername,
        adminPassword: form.adminPassword,
        preferredLanguage: form.preferredLanguage,
      })
      if (!result.success) {
        setError(result.error ?? t('setup.errorGeneral'))
      }
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all bg-white'
  const labelCls = 'block text-sm font-medium text-[#0F172A] mb-1.5'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-[#2563EB] flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">E</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A]">{t('setup.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('setup.subtitle')}</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                i < step ? 'bg-success text-white' : i === step ? 'bg-[#2563EB] text-white' : 'bg-border text-slate-500'
              }`}>
                {i < step ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-12 h-0.5 rounded transition-colors ${i < step ? 'bg-success' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-8">
          {/* Step 0: School info */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-5">
                <Building2 size={18} className="text-[#2563EB]" />
                <h2 className="font-semibold text-[#0F172A]">{t('setup.step1')}</h2>
              </div>
              <div>
                <label className={labelCls}>{t('setup.schoolNameAr')} *</label>
                <input className={inputCls} value={form.schoolNameAr} onChange={set('schoolNameAr')} dir="rtl" placeholder="مدرسة الأمل" />
              </div>
              <div>
                <label className={labelCls}>{t('setup.schoolNameFr')} *</label>
                <input className={inputCls} value={form.schoolNameFr} onChange={set('schoolNameFr')} placeholder="École de l'Espoir" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('setup.schoolPhone')}</label>
                  <input className={inputCls} value={form.phone} onChange={set('phone')} placeholder="0550 123 456" dir="ltr"
                    onKeyDown={(e) => { if (!/[\d\s+\-()]/.test(e.key) && e.key.length === 1) e.preventDefault() }} />
                </div>
                <div>
                  <label className={labelCls}>{t('setup.academicYear')}</label>
                  <input className={inputCls} value={form.academicYear} onChange={set('academicYear')} dir="ltr"
                    placeholder="2025-2026"
                    onKeyDown={(e) => { if (!/[\d\-]/.test(e.key) && e.key.length === 1) e.preventDefault() }} />
                </div>
              </div>
              <div>
                <label className={labelCls}>{t('setup.schoolEmail')}</label>
                <input type="email" className={inputCls} value={form.email} onChange={set('email')} dir="ltr" />
              </div>
              <div>
                <label className={labelCls}>{t('setup.schoolAddress')}</label>
                <input className={inputCls} value={form.address} onChange={set('address')} />
              </div>
            </div>
          )}

          {/* Step 1: Admin account */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-5">
                <User size={18} className="text-[#2563EB]" />
                <h2 className="font-semibold text-[#0F172A]">{t('setup.step2')}</h2>
              </div>
              <div>
                <label className={labelCls}>{t('setup.adminName')} *</label>
                <input className={inputCls} value={form.adminFullName} onChange={set('adminFullName')} />
              </div>
              <div>
                <label className={labelCls}>{t('setup.adminUsername')} *</label>
                <input className={inputCls} value={form.adminUsername} onChange={set('adminUsername')} dir="ltr" placeholder="admin" autoComplete="new-password" />
              </div>
              <div>
                <label className={labelCls}>{t('setup.adminPassword')} *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`${inputCls} pr-10`}
                    value={form.adminPassword}
                    onChange={set('adminPassword')}
                    dir="ltr"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">{t('setup.minPasswordLength')}</p>
              </div>
              <div>
                <label className={labelCls}>{t('auth.confirmPassword')} *</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className={`${inputCls} pr-10`}
                    value={form.confirmPassword}
                    onChange={set('confirmPassword')}
                    dir="ltr"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Language preference */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-5">
                <Globe size={18} className="text-[#2563EB]" />
                <h2 className="font-semibold text-[#0F172A]">{t('setup.step3')}</h2>
              </div>
              <div>
                <label className={labelCls}>{t('setup.preferredLanguage')}</label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {(['ar', 'fr', 'en'] as const).map((lang) => {
                    const labels = { ar: 'العربية', fr: 'Français', en: 'English' }
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => {
                          setForm((f) => ({ ...f, preferredLanguage: lang }))
                          switchLanguage(lang)
                        }}
                        className={`py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                          form.preferredLanguage === lang
                            ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                            : 'border-border text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {labels[lang]}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                <p className="font-medium mb-1">✓ {t('common.localDatabase')}</p>
                <p className="text-xs opacity-80">{t('app.offline')}</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-lg">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between mt-8">
            {step > 0 ? (
              <button onClick={prevStep} className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
                ← {t('setup.back')}
              </button>
            ) : <span />}

            {step < STEPS.length - 1 ? (
              <button onClick={nextStep} className="bg-[#2563EB] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] transition-colors">
                {t('setup.next')} →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading} className="bg-success text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#15803D] transition-colors disabled:opacity-60 flex items-center gap-2">
                {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {loading ? t('setup.settingUp') : t('setup.completeSetup')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
