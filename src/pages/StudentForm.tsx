import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, RefreshCw, Save, Printer, AlertTriangle, Camera } from 'lucide-react'
import ConfirmDialog from '../components/ui/ConfirmDialog'

function generateToken() {
  const id = Math.floor(Math.random() * 90000) + 10000
  return `STD-2026-${id.toString().padStart(5, '0')}`
}

function QRPlaceholder({ token }: { token: string }) {
  const cells = Array.from({ length: 121 }, (_, i) => {
    const row = Math.floor(i / 11)
    const col = i % 11
    const isCorner = (row < 3 && col < 3) || (row < 3 && col > 7) || (row > 7 && col < 3)
    const isDark = isCorner || (Math.abs(token.charCodeAt(i % token.length) + row + col) % 3 === 0)
    return isDark
  })
  return (
    <div className="grid grid-cols-11 w-20 h-20 bg-white border border-slate-200 rounded p-1">
      {cells.map((dark, i) => (
        <div key={i} className={`${dark ? 'bg-slate-900' : 'bg-white'}`} />
      ))}
    </div>
  )
}

export default function StudentForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id && id !== 'new')

  const [courses, setCourses] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [token, setToken] = useState(generateToken())
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    firstNameAr: '',
    lastNameAr: '',
    firstNameFr: '',
    lastNameFr: '',
    dateOfBirth: '',
    gender: 'male' as 'male' | 'female',
    phone: '',
    address: '',
    guardianName: '',
    guardianRelationship: 'أب',
    guardianPhone: '',
    guardianPhone2: '',
    courseId: '',
    groupId: '',
    registrationDate: new Date().toISOString().split('T')[0],
    monthlyFee: '2500',
    status: 'active' as 'active' | 'inactive',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const api = (window as any).schoolApp

  // Load courses & groups
  useEffect(() => {
    const init = async () => {
      if (!api) return
      try {
        const [cRes, gRes] = await Promise.all([
          api.courses.list(),
          api.groups.list()
        ])
        if (cRes.success && cRes.data) setCourses(cRes.data)
        if (gRes.success && gRes.data) setGroups(gRes.data)
      } catch (err) {
        console.error(err)
      }
    }
    init()
  }, [api])

  // Load existing student for edit
  useEffect(() => {
    const loadExisting = async () => {
      if (!api || !isEdit || !id) return
      try {
        const sRes = await api.students.getById(Number(id))
        if (sRes.success && sRes.data) {
          const s = sRes.data
          setToken(s.qrToken || generateToken())
          setPhotoPath(s.photoPath)

          if (s.photoPath) {
            const pRes = await api.media.getImageUrl(s.photoPath)
            if (pRes.success) setPhotoUrl(pRes.data.url)
          }

          // Get active enrollment for group
          const eRes = await api.enrollments.byStudent(Number(id))
          const active = eRes.data?.find((e: any) => e.status === 'active') ?? eRes.data?.[0]
          const group = groups.find(g => g.id === active?.groupId)

          setForm({
            firstNameAr: s.firstNameAr || '',
            lastNameAr: s.lastNameAr || '',
            firstNameFr: s.firstNameFr || '',
            lastNameFr: s.lastNameFr || '',
            dateOfBirth: s.dateOfBirth || '',
            gender: s.gender || 'male',
            phone: s.phone || '',
            address: s.address || '',
            guardianName: s.guardianName || '',
            guardianRelationship: s.guardianRelationship || 'أب',
            guardianPhone: s.guardianPhone || '',
            guardianPhone2: s.secondaryPhone || '',
            courseId: group ? String(group.courseId) : '',
            groupId: active ? String(active.groupId) : '',
            registrationDate: s.registrationDate || new Date().toISOString().split('T')[0],
            monthlyFee: active ? String(active.agreedPrice) : '2500',
            status: s.status || 'active',
          })
        }
      } catch (err) {
        console.error('Failed to load student:', err)
      }
    }
    loadExisting()
  }, [api, isEdit, id, groups])

  const update = (field: keyof typeof form, value: string) => {
    setForm(f => ({ ...f, [field]: value }))
    setDirty(true)
    setErrors(e => ({ ...e, [field]: '' }))
  }

  const handleSelectPhoto = async () => {
    if (!api) return
    try {
      const res = await api.media.selectImage('student', id || 'temp')
      if (res.success && res.path) {
        setPhotoPath(res.path)
        const pRes = await api.media.getImageUrl(res.path)
        if (pRes.success) setPhotoUrl(pRes.data.url)
        setDirty(true)
      }
    } catch (err) {
      console.error('Failed to select image:', err)
    }
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.firstNameAr.trim() && !form.firstNameFr.trim()) e.firstNameAr = 'الاسم مطلوب'
    if (!form.lastNameAr.trim() && !form.lastNameFr.trim()) e.lastNameAr = 'اللقب مطلوب'
    if (!isEdit && !form.groupId) e.groupId = 'يرجى اختيار الفوج'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async (printTicket = false) => {
    if (!validate() || !api) return
    setLoading(true)
    try {
      let savedId = id ? Number(id) : null
      const fAr = form.firstNameAr.trim() || form.firstNameFr.trim()
      const lAr = form.lastNameAr.trim() || form.lastNameFr.trim()
      const fFr = form.firstNameFr.trim() || form.firstNameAr.trim()
      const lFr = form.lastNameFr.trim() || form.lastNameAr.trim()

      if (isEdit && savedId) {
        const updateRes = await api.students.update(savedId, {
          firstNameAr: fAr,
          lastNameAr: lAr,
          firstNameFr: fFr,
          lastNameFr: lFr,
          dateOfBirth: form.dateOfBirth || null,
          gender: form.gender,
          phone: form.phone || null,
          guardianName: form.guardianName || null,
          status: form.status,
          photoPath,
        })
        if (!updateRes.success) {
          alert(updateRes.error?.message || 'حدث خطأ أثناء تحديث بيانات الطالب')
          return
        }
      } else {
        const createRes = await api.students.create({
          firstNameAr: fAr,
          lastNameAr: lAr,
          firstNameFr: fFr,
          lastNameFr: lFr,
          gender: form.gender,
          dateOfBirth: form.dateOfBirth || null,
          phone: form.phone || null,
          guardianName: form.guardianName || null,
          guardianRelationship: form.guardianRelationship || null,
          guardianPhone: form.guardianPhone || null,
          secondaryPhone: form.guardianPhone2 || null,
          address: form.address || null,
        })

        if (!createRes.success || !createRes.data) {
          alert(createRes.error?.message || 'حدث خطأ أثناء إنشاء الطالب')
          return
        }

        savedId = createRes.data.id

        // Enroll in selected group
        if (form.groupId) {
          await api.enrollments.create({
            studentId: savedId,
            groupId: Number(form.groupId),
            agreedPrice: Number(form.monthlyFee) || 2500,
            enrollmentDate: form.registrationDate || new Date().toISOString().split('T')[0],
          })
        }
      }

      if (printTicket && savedId) {
        navigate(`/students/${savedId}/card`)
      } else {
        navigate('/students')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    if (dirty) setShowLeaveConfirm(true)
    else navigate('/students')
  }

  const availableGroups = groups.filter(g => !form.courseId || String(g.courseId) === form.courseId)

  const Field = ({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) => (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
    </div>
  )

  return (
    <div dir="rtl" className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={handleBack} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors" title="رجوع">
          <ArrowRight size={18} />
        </button>
        <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}</h2>
        {dirty && (
          <span className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 mr-auto font-medium">
            <AlertTriangle size={12} /> توجد تعديلات غير محفوظة
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Personal info */}
        <div className="col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-4 pb-3 border-b border-slate-100">المعلومات الشخصية</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="الاسم الأول (بالعربية) *" error={errors.firstNameAr}>
                <input
                  type="text"
                  placeholder="مثال: مريم"
                  value={form.firstNameAr}
                  onChange={e => update('firstNameAr', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white text-right"
                  dir="rtl"
                />
              </Field>
              <Field label="اللقب (بالعربية) *" error={errors.lastNameAr}>
                <input
                  type="text"
                  placeholder="مثال: بن حمودة"
                  value={form.lastNameAr}
                  onChange={e => update('lastNameAr', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white text-right"
                  dir="rtl"
                />
              </Field>
              <Field label="الاسم الأول (بالفرنسية / اللاتينية)">
                <input
                  type="text"
                  placeholder="Meriem"
                  value={form.firstNameFr}
                  onChange={e => update('firstNameFr', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white text-left font-sans"
                  dir="ltr"
                />
              </Field>
              <Field label="اللقب (بالفرنسية / اللاتينية)">
                <input
                  type="text"
                  placeholder="Benhamouda"
                  value={form.lastNameFr}
                  onChange={e => update('lastNameFr', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white text-left font-sans"
                  dir="ltr"
                />
              </Field>
              <Field label="تاريخ الميلاد">
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={e => update('dateOfBirth', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
                />
              </Field>
              <Field label="الجنس">
                <select
                  value={form.gender}
                  onChange={e => update('gender', e.target.value as 'male' | 'female')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                >
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </Field>
              <Field label="هاتف الطالب">
                <input
                  type="tel"
                  placeholder="0555 000 000"
                  value={form.phone}
                  onChange={e => update('phone', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
                />
              </Field>
              <Field label="العنوان">
                <input
                  type="text"
                  placeholder="الشارع، المدينة..."
                  value={form.address}
                  onChange={e => update('address', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                />
              </Field>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-4 pb-3 border-b border-slate-100">معلومات ولي الأمر</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="اسم ولي الأمر الكامل">
                <input
                  type="text"
                  placeholder="محمد بن حمودة"
                  value={form.guardianName}
                  onChange={e => update('guardianName', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                />
              </Field>
              <Field label="صلة القرابة">
                <select
                  value={form.guardianRelationship}
                  onChange={e => update('guardianRelationship', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                >
                  <option value="أب">أب</option>
                  <option value="أم">أم</option>
                  <option value="أخ">أخ</option>
                  <option value="أخت">أخت</option>
                  <option value="عم / خال">عم / خال</option>
                  <option value="ولي أمر">ولي أمر</option>
                </select>
              </Field>
              <Field label="الهاتف الرئيسي للولي">
                <input
                  type="tel"
                  placeholder="0661 000 000"
                  value={form.guardianPhone}
                  onChange={e => update('guardianPhone', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
                />
              </Field>
              <Field label="هاتف ثانوي (اختياري)">
                <input
                  type="tel"
                  placeholder="0770 000 000"
                  value={form.guardianPhone2}
                  onChange={e => update('guardianPhone2', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
                />
              </Field>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-4 pb-3 border-b border-slate-100">التسجيل في الفوج والمادة</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="المادة التعليمية">
                <select
                  value={form.courseId}
                  onChange={e => { update('courseId', e.target.value); update('groupId', '') }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">اختر المادة...</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.nameAr || c.nameFr}</option>)}
                </select>
              </Field>
              <Field label="الفوج / المجموعة *" error={errors.groupId}>
                <select
                  value={form.groupId}
                  onChange={e => update('groupId', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">اختر الفوج...</option>
                  {availableGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </Field>
              <Field label="تاريخ التسجيل">
                <input
                  type="date"
                  value={form.registrationDate}
                  onChange={e => update('registrationDate', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
                />
              </Field>
              <Field label="السعر الشهري المتفق عليه (دج)">
                <input
                  type="number"
                  placeholder="2500"
                  value={form.monthlyFee}
                  onChange={e => update('monthlyFee', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
                />
              </Field>
              <Field label="حالة الطالب">
                <select
                  value={form.status}
                  onChange={e => update('status', e.target.value as 'active' | 'inactive')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                >
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                </select>
              </Field>
            </div>
          </div>
        </div>

        {/* Right column: Photo, Token & Save */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-4 pb-3 border-b border-slate-100">صورة الطالب</h3>
            <div className="flex flex-col items-center gap-3">
              <div
                onClick={handleSelectPhoto}
                className="w-28 h-28 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all overflow-hidden relative group"
              >
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 p-2">
                    <Camera size={20} className="text-slate-400" />
                    <span>اختيار صورة</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                  تغيير الصورة
                </div>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">JPG, PNG, WebP · بحد أقصى 5MB</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3 pb-3 border-b border-slate-100">بطاقة الطالب والباركود</h3>
            <div className="flex flex-col items-center gap-3">
              <QRPlaceholder token={token} />
              <p className="text-xs font-mono text-slate-600 text-center font-bold">{token}</p>
              <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                رمز تعريف رقمي فريد يُطبع على البطاقة لتسجيل الحضور السريع عبر الماسح الضوئي.
              </p>
              {!isEdit && (
                <button
                  type="button"
                  onClick={() => { setToken(generateToken()); setDirty(true) }}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors font-medium"
                >
                  <RefreshCw size={12} /> توليد رمز جديد
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-2.5">
            <button
              onClick={() => handleSave(false)}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-colors text-sm shadow-sm"
            >
              <Save size={15} /> حفظ بيانات الطالب
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-colors text-sm shadow-sm"
            >
              <Printer size={15} /> حفظ وطباعة البطاقة
            </button>
            <button
              onClick={handleBack}
              className="w-full text-slate-500 hover:text-slate-700 py-2 text-sm transition-colors text-center font-medium"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={() => navigate('/students')}
        title="تغييرات غير محفوظة"
        message="لديك تغييرات غير محفوظة في النموذج. هل أنت متأكد من المغادرة دون حفظ؟"
        confirmLabel="مغادرة بدون حفظ"
        danger
      />
    </div>
  )
}

