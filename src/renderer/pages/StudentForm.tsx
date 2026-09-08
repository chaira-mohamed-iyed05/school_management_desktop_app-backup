import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'

export default function StudentForm() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    firstNameAr: '', lastNameAr: '', firstNameFr: '', lastNameFr: '',
    gender: 'male' as 'male' | 'female',
    dateOfBirth: '', phone: '', guardianName: '', guardianRelationship: '',
    guardianPhone: '', secondaryPhone: '', address: '',
  })

  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    window.schoolApp.students.getById(Number(id)).then((res) => {
      if (res.success && res.data) {
        const s = res.data
        setForm({
          firstNameAr: s.firstNameAr, lastNameAr: s.lastNameAr,
          firstNameFr: s.firstNameFr, lastNameFr: s.lastNameFr,
          gender: s.gender, dateOfBirth: s.dateOfBirth ?? '',
          phone: s.phone ?? '', guardianName: s.guardianName ?? '',
          guardianRelationship: s.guardianRelationship ?? '',
          guardianPhone: s.guardianPhone ?? '', secondaryPhone: s.secondaryPhone ?? '',
          address: s.address ?? '',
        })
      }
    }).finally(() => setLoading(false))
  }, [id, isEdit])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.firstNameAr.trim() || !form.lastNameAr.trim() || !form.firstNameFr.trim() || !form.lastNameFr.trim()) {
      setError(t('students.fillNamesRequired'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        firstNameAr: form.firstNameAr, lastNameAr: form.lastNameAr,
        firstNameFr: form.firstNameFr, lastNameFr: form.lastNameFr,
        gender: form.gender, dateOfBirth: form.dateOfBirth || null,
        phone: form.phone || null, guardianName: form.guardianName || null,
        guardianRelationship: form.guardianRelationship || null,
        guardianPhone: form.guardianPhone || null,
        secondaryPhone: form.secondaryPhone || null,
        address: form.address || null,
      }
      const res = isEdit
        ? await window.schoolApp.students.update(Number(id), payload)
        : await window.schoolApp.students.create(payload)
      if (res.success && res.data) {
        navigate(`/students/${res.data.id}`)
      } else {
        setError(!res.success ? res.error ?? t('common.error') : t('common.error'))
      }
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all bg-white'
  const labelCls = 'block text-sm font-medium text-[#0F172A] mb-1.5'

  if (loading) return <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="max-w-2xl animate-fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm mb-5 transition-colors">
        <ArrowLeft size={15} /> {t('common.back')}
      </button>

      <h2 className="text-xl font-bold text-[#0F172A] mb-6">{isEdit ? t('students.edit') : t('students.add')}</h2>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-border p-6 space-y-5">
        {/* Arabic name */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{t('students.nameArSection')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('students.lastNameAr')} *</label>
              <input className={inputCls} value={form.lastNameAr} onChange={set('lastNameAr')} dir="rtl" required />
            </div>
            <div>
              <label className={labelCls}>{t('students.firstNameAr')} *</label>
              <input className={inputCls} value={form.firstNameAr} onChange={set('firstNameAr')} dir="rtl" required />
            </div>
          </div>
        </div>

        {/* French name */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{t('students.nameFrSection')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('students.lastNameFr')} *</label>
              <input className={inputCls} value={form.lastNameFr} onChange={set('lastNameFr')} required />
            </div>
            <div>
              <label className={labelCls}>{t('students.firstNameFr')} *</label>
              <input className={inputCls} value={form.firstNameFr} onChange={set('firstNameFr')} required />
            </div>
          </div>
        </div>

        {/* Personal info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t('students.dateOfBirth')}</label>
            <input type="date" className={inputCls} value={form.dateOfBirth} onChange={set('dateOfBirth')} dir="ltr" />
          </div>
          <div>
            <label className={labelCls}>{t('students.gender')}</label>
            <select className={inputCls} value={form.gender} onChange={set('gender')}>
              <option value="male">{t('students.male')}</option>
              <option value="female">{t('students.female')}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t('students.phone')}</label>
            <input
              className={inputCls}
              value={form.phone}
              onChange={set('phone')}
              dir="ltr"
              placeholder="0550 123 456"
              onKeyDown={(e) => {
                if (!/[\d\s+\-()Backspace Delete ArrowLeft ArrowRight Tab]/.test(e.key) && e.key.length === 1) {
                  e.preventDefault()
                }
              }}
            />
          </div>
          <div>
            <label className={labelCls}>{t('students.secondaryPhone')}</label>
            <input
              className={inputCls}
              value={form.secondaryPhone}
              onChange={set('secondaryPhone')}
              dir="ltr"
              onKeyDown={(e) => {
                if (!/[\d\s+\-()Backspace Delete ArrowLeft ArrowRight Tab]/.test(e.key) && e.key.length === 1) {
                  e.preventDefault()
                }
              }}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>{t('students.address')}</label>
          <input className={inputCls} value={form.address} onChange={set('address')} />
        </div>

        {/* Guardian */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{t('students.guardianName')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('students.guardianName')}</label>
              <input className={inputCls} value={form.guardianName} onChange={set('guardianName')} />
            </div>
            <div>
              <label className={labelCls}>{t('students.guardianRelationship')}</label>
              <input className={inputCls} value={form.guardianRelationship} onChange={set('guardianRelationship')} />
            </div>
          </div>
          <div className="mt-3">
            <label className={labelCls}>{t('students.guardianPhone')}</label>
            <input
              className={inputCls}
              value={form.guardianPhone}
              onChange={set('guardianPhone')}
              dir="ltr"
              onKeyDown={(e) => {
                if (!/[\d\s+\-()Backspace Delete ArrowLeft ArrowRight Tab]/.test(e.key) && e.key.length === 1) {
                  e.preventDefault()
                }
              }}
            />
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-lg">{error}</div>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate(-1)} className="px-5 py-2.5 border border-border rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            {t('students.cancel')}
          </button>
          <button type="submit" disabled={saving} className="px-5 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] transition-colors disabled:opacity-60 flex items-center gap-2">
            {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {saving ? t('students.saving') : t('students.save')}
          </button>
        </div>
      </form>
    </div>
  )
}
