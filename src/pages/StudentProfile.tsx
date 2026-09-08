import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowRight, Pencil, Archive, Plus, Trash2,
  RefreshCw, UserX, XCircle, ArrowLeftRight, Filter, Calendar
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'

const TABS = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'attendance', label: 'سجل الحضور والغياب' },
  { id: 'payments', label: 'المدفوعات' },
  { id: 'enrollments', label: 'التسجيلات' },
  { id: 'notes', label: 'الملاحظات' },
]

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  credit: 'شحن رصيد',
  deduction: 'خصم حصة',
  refund: 'استرداد / رد مبلغ',
  transfer_in: 'تحويل وارد',
  transfer_out: 'تحويل صادر',
}

const ATTENDANCE_LABELS: Record<string, { label: string; color: string }> = {
  present: { label: 'حاضر', color: 'text-green-700 bg-green-50' },
  absent:  { label: 'غائب', color: 'text-red-700 bg-red-50' },
  late:    { label: 'حاضر', color: 'text-green-700 bg-green-50' },
  inactive:{ label: 'غير نشط', color: 'text-slate-600 bg-slate-100' },
  unmarked:{ label: 'غائب', color: 'text-red-700 bg-red-50' },
}

export default function StudentProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')

  const [student, setStudent] = useState<any | null>(null)
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([])
  const [notes, setNotes] = useState<string[]>([])
  const [newNote, setNewNote] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Attendance Filters
  const [filterGroup, setFilterGroup] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const [enrollModal, setEnrollModal] = useState(false)
  const [groups, setGroups] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [enrollForm, setEnrollForm] = useState({
    groupId: '',
    agreedPrice: '',
    enrollmentDate: new Date().toISOString().split('T')[0],
  })

  const [transferModal, setTransferModal] = useState(false)
  const [transferFrom, setTransferFrom] = useState<any | null>(null)
  const [transferToGroupId, setTransferToGroupId] = useState('')

  const [cancelEnrollModal, setCancelEnrollModal] = useState(false)
  const [cancelEnrollTarget, setCancelEnrollTarget] = useState<any | null>(null)

  const [topUpModal, setTopUpModal] = useState(false)
  const [topUpTarget, setTopUpTarget] = useState<any | null>(null)
  const [topUpForm, setTopUpForm] = useState({ amount: '', method: 'cash', date: new Date().toISOString().split('T')[0], notes: '' })

  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const api = (window as any).schoolApp

  const notesKey = `student_notes_${id}`
  const notesLoaded = useRef(false)

  useEffect(() => {
    if (notesLoaded.current) return
    notesLoaded.current = true
    try {
      const raw = localStorage.getItem(notesKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setNotes(parsed.map(n => String(n ?? '')))
        }
      }
    } catch (err) {
      console.warn('Failed to parse notes from storage:', err)
      setNotes([])
    }
  }, [notesKey])

  const saveNotes = (updated: string[]) => {
    try {
      const safe = (updated || []).map(n => String(n ?? ''))
      setNotes(safe)
      localStorage.setItem(notesKey, JSON.stringify(safe))
    } catch (err) {
      console.warn('Failed to save notes:', err)
    }
  }

  const loadProfile = useCallback(async () => {
    if (!api || !id) return
    setLoading(true)
    setError(null)
    try {
      const sId = Number(id)
      const [sRes, eRes, pRes, aRes, gRes, cRes, tRes] = await Promise.all([
        api.students.getById(sId),
        api.enrollments.byStudent(sId),
        api.payments.byStudent(sId),
        api.students.getAttendanceHistory(sId),
        api.groups.list(),
        api.courses.list(),
        api.teachers.list(),
      ])

      if (sRes.success && sRes.data) {
        setStudent(sRes.data)
        try {
          if (sRes.data.photoPath) {
            const pImg = await api.media.getImageUrl(sRes.data.photoPath)
            if (pImg.success) setPhotoUrl(pImg.data?.url ?? null)
          }
        } catch { /* photo non-critical */ }
      }

      const allGroups = gRes.success ? (gRes.data ?? []) : []
      const allCourses = cRes.success ? (cRes.data ?? []) : []
      const allTeachers = tRes.success ? (tRes.data ?? []) : []
      setGroups(allGroups)
      setCourses(allCourses)
      setTeachers(allTeachers)

      if (eRes.success && eRes.data) {
        const enriched = await Promise.all(
          eRes.data.map(async (en: any) => {
            const group = allGroups.find((g: any) => g.id === en.groupId)
            const course = allCourses.find((c: any) => c.id === group?.courseId)
            const teacher = allTeachers.find((t: any) => t.id === group?.teacherId)
            let balance = null
            try {
              const bRes = await api.payments.balance(en.id)
              if (bRes.success) balance = bRes.data?.balance ?? null
            } catch { /* ignore */ }
            return {
              ...en,
              groupName: group?.name ?? en.groupName ?? '—',
              courseName: course?.nameAr || course?.nameFr || en.courseName || '—',
              teacherName: en.teacherName || (teacher
                ? `${teacher.lastNameAr || teacher.lastNameFr || ''} ${teacher.firstNameAr || teacher.firstNameFr || ''}`.trim()
                : '—'),
              room: group?.room ?? '—',
              monthlyPrice: group?.monthlyPrice ?? 0,
              balance,
            }
          })
        )
        setEnrollments(enriched)
      }

      if (pRes.success && pRes.data) setPayments(pRes.data)
      if (aRes.success && aRes.data) setAttendanceHistory(aRes.data)

    } catch (err: any) {
      console.error('Failed to load profile:', err)
      setError('حدث خطأ أثناء تحميل الملف الشخصي')
    } finally {
      setLoading(false)
    }
  }, [api, id])

  useEffect(() => { loadProfile() }, [loadProfile])

  const handleArchive = async () => {
    if (!api || !id || !window.confirm('هل تريد أرشفة هذا الطالب؟')) return
    try {
      const res = await api.students.archive(Number(id))
      if (res.success) navigate('/students')
    } catch (err) { console.error(err) }
  }

  const handleMarkInactive = async () => {
    if (!api || !id || !window.confirm('هل تريد تعيين الطالب كغير نشط؟')) return
    try {
      await api.students.update(Number(id), { status: 'inactive' })
      loadProfile()
    } catch (err) { console.error(err) }
  }

  const openEdit = () => {
    if (!student) return
    setEditForm({
      firstNameAr: student.firstNameAr ?? '',
      lastNameAr: student.lastNameAr ?? '',
      firstNameFr: student.firstNameFr ?? '',
      lastNameFr: student.lastNameFr ?? '',
      phone: student.phone ?? '',
      guardianPhone: student.guardianPhone ?? '',
      address: student.address ?? '',
    })
    setEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!api || !id) return
    setSaving(true)
    try {
      await api.students.update(Number(id), {
        firstNameAr: String(editForm.firstNameAr || ''),
        lastNameAr: String(editForm.lastNameAr || ''),
        firstNameFr: String(editForm.firstNameFr || ''),
        lastNameFr: String(editForm.lastNameFr || ''),
        phone: editForm.phone ? String(editForm.phone) : null,
        guardianPhone: editForm.guardianPhone ? String(editForm.guardianPhone) : null,
        address: editForm.address ? String(editForm.address) : null,
      })
      setEditModal(false)
      loadProfile()
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  const handleEnroll = async () => {
    if (!api || !id || !enrollForm.groupId) return
    setSaving(true)
    try {
      const selectedGroup = groups.find((g: any) => g.id === Number(enrollForm.groupId))
      await api.enrollments.create({
        studentId: Number(id),
        groupId: Number(enrollForm.groupId),
        agreedPrice: Number(enrollForm.agreedPrice) || selectedGroup?.monthlyPrice || 0,
        enrollmentDate: enrollForm.enrollmentDate,
      })
      setEnrollModal(false)
      setEnrollForm({
        groupId: '',
        agreedPrice: '',
        enrollmentDate: new Date().toISOString().split('T')[0],
      })
      loadProfile()
    } catch (err: any) {
      alert(err?.message || 'حدث خطأ أثناء التسجيل')
    }
    finally { setSaving(false) }
  }

  const handleCancelEnrollment = async () => {
    if (!api || !cancelEnrollTarget) return
    setSaving(true)
    try {
      await api.enrollments.cancel(cancelEnrollTarget.id, Number(id), 'إلغاء التسجيل واسترداد الرصيد')
      setCancelEnrollModal(false)
      setCancelEnrollTarget(null)
      loadProfile()
    } catch (err: any) {
      alert(err?.message || 'فشل إلغاء التسجيل')
    }
    finally { setSaving(false) }
  }

  const handleTransfer = async () => {
    if (!api || !transferFrom || !transferToGroupId) return
    const toEnrollment = enrollments.find((e: any) => e.groupId === Number(transferToGroupId))
    if (!toEnrollment) return
    setSaving(true)
    try {
      await api.payments.transfer({
        fromEnrollmentId: transferFrom.id,
        toEnrollmentId: toEnrollment.id,
        studentId: Number(id),
      })
      setTransferModal(false)
      setTransferFrom(null)
      setTransferToGroupId('')
      loadProfile()
    } catch (err: any) {
      alert(err?.message ?? 'فشل التحويل')
    } finally { setSaving(false) }
  }

  const handleTopUp = async () => {
    if (!api || !topUpTarget || !topUpForm.amount) return
    setSaving(true)
    try {
      await api.payments.topUp({
        studentId: Number(id),
        enrollmentId: topUpTarget.id,
        amount: Number(topUpForm.amount),
        paymentMethod: topUpForm.method as any,
        paymentDate: topUpForm.date,
        notes: topUpForm.notes ? String(topUpForm.notes) : null,
      })
      setTopUpModal(false)
      setTopUpTarget(null)
      setTopUpForm({ amount: '', method: 'cash', date: new Date().toISOString().split('T')[0], notes: '' })
      loadProfile()
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400" dir="rtl">
        <RefreshCw size={20} className="animate-spin ml-2" />
        <span className="text-sm">جارٍ تحميل الملف الشخصي...</span>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400" dir="rtl">
        <p className="text-lg font-semibold">الطالب غير موجود</p>
        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
        <button onClick={() => navigate('/students')} className="mt-3 text-sm text-blue-600 hover:text-blue-800">
          ← العودة إلى القائمة
        </button>
      </div>
    )
  }

  const fullNameAr = `${student.lastNameAr ?? ''} ${student.firstNameAr ?? ''}`.trim()
  const statusColor = student.status === 'active' ? 'active' : 'inactive'

  // Filtered attendance records
  const filteredAttendance = attendanceHistory.filter(r => {
    const matchGroup = !filterGroup || String(r.groupId) === filterGroup
    const matchFrom = !filterDateFrom || r.sessionDate >= filterDateFrom
    const matchTo = !filterDateTo || r.sessionDate <= filterDateTo
    return matchGroup && matchFrom && matchTo
  })

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/students')}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="رجوع للقائمة"
        >
          <ArrowRight size={18} />
        </button>

        <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden shrink-0">
          {photoUrl
            ? <img src={photoUrl} alt="" className="w-full h-full object-cover" />
            : <span className="text-xl font-bold text-blue-700">{student.firstNameAr?.charAt(0) ?? '؟'}</span>
          }
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900 truncate">{fullNameAr}</h1>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs font-mono text-slate-500">{student.studentNumber}</span>
            <Badge variant={statusColor}>{student.status === 'active' ? 'نشط' : 'غير نشط'}</Badge>
            {student.phone && <span className="text-xs text-slate-500 font-mono">{student.phone}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={openEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
            <Pencil size={13} /> تعديل
          </button>
          {student.status === 'active' && (
            <button onClick={handleMarkInactive}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors">
              <UserX size={13} /> غير نشط
            </button>
          )}
          <button onClick={handleArchive}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
            <Archive size={13} /> أرشفة
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'border-b-2 border-blue-600 text-blue-700 bg-blue-50/50 font-bold'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* نظرة عامة */}
          {tab === 'overview' && (
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">المعلومات الشخصية</h3>
                {[
                  ['الاسم (عربي)', fullNameAr],
                  ['الاسم (لاتيني)', `${student.firstNameFr ?? ''} ${student.lastNameFr ?? ''}`.trim() || '—'],
                  ['الجنس', student.gender === 'male' ? 'ذكر' : 'أنثى'],
                  ['تاريخ الميلاد', student.dateOfBirth ?? '—'],
                  ['الهاتف', student.phone ?? '—'],
                  ['ولي الأمر', student.guardianName ?? '—'],
                  ['هاتف الولي', student.guardianPhone ?? '—'],
                  ['العنوان', student.address ?? '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm py-1 border-b border-slate-50 last:border-0">
                    <span className="text-slate-500 text-xs">{label}</span>
                    <span className="text-xs font-medium text-slate-800 text-left max-w-45 truncate">{value}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">الأفواج والمجموعات المسجل بها</h3>
                {enrollments.filter((e: any) => e.status === 'active').length === 0
                  ? <p className="text-xs text-slate-400">لا توجد تسجيلات نشطة حالياً</p>
                  : enrollments.filter((e: any) => e.status === 'active').map((en: any) => (
                    <div key={en.id} className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs space-y-1.5">
                      <div className="flex justify-between items-center">
                        <p className="font-bold text-blue-900">{en.groupName}</p>
                        <span className="text-[11px] text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded font-medium">{en.courseName}</span>
                      </div>
                      <p className="text-slate-600">الأستاذ: <span className="font-semibold text-slate-800">{en.teacherName}</span></p>
                      {en.balance !== null && (
                        <p className={`font-bold text-xs ${en.balance < 0 ? 'text-red-600' : 'text-green-700'}`}>
                          الرصيد المالي: {en.balance.toLocaleString('ar-DZ')} دج
                        </p>
                      )}
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* سجل الحضور والغياب مع الفلاتر */}
          {tab === 'attendance' && (
            <div className="space-y-4">
              {/* Attendance filters */}
              <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-slate-500" />
                  <span className="text-xs font-semibold text-slate-600">تصفية السجل:</span>
                </div>
                <select
                  value={filterGroup}
                  onChange={e => setFilterGroup(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500"
                >
                  <option value="">جميع الأفواج</option>
                  {enrollments.map((en: any) => (
                    <option key={en.groupId} value={en.groupId}>{en.groupName}</option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">من:</span>
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={e => setFilterDateFrom(e.target.value)}
                    className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">إلى:</span>
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={e => setFilterDateTo(e.target.value)}
                    className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500"
                  />
                </div>

                {(filterGroup || filterDateFrom || filterDateTo) && (
                  <button
                    onClick={() => { setFilterGroup(''); setFilterDateFrom(''); setFilterDateTo('') }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium mr-auto"
                  >
                    إعادة ضبط الفلاتر
                  </button>
                )}
              </div>

              {filteredAttendance.length === 0
                ? <p className="text-sm text-slate-400 text-center py-8">لا يوجد سجل حضور مطابق للفلاتر المحددة</p>
                : (
                  <div className="overflow-auto max-h-125 border border-slate-100 rounded-xl">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                        <tr className="text-xs text-slate-600 font-semibold">
                          <th className="py-2.5 px-3 text-right">التاريخ</th>
                          <th className="py-2.5 px-3 text-right">المجموعة / الفوج</th>
                          <th className="py-2.5 px-3 text-right">المادة</th>
                          <th className="py-2.5 px-3 text-right">الحالة</th>
                          <th className="py-2.5 px-3 text-right">الوقت / المسح</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredAttendance.map((r: any) => {
                          const att = ATTENDANCE_LABELS[r.attendanceStatus] ?? ATTENDANCE_LABELS.unmarked
                          return (
                            <tr key={r.recordId || `${r.sessionId}-${r.sessionDate}`} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-3 font-mono text-xs text-slate-700">{r.sessionDate}</td>
                              <td className="py-2.5 px-3 text-xs font-medium text-slate-800">{r.groupName}</td>
                              <td className="py-2.5 px-3 text-xs text-slate-600">{r.courseNameAr ?? r.courseNameFr ?? '—'}</td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${att.color}`}>
                                  {att.label}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-xs text-slate-400 font-mono">
                                {r.scannedAt
                                  ? new Date(r.scannedAt).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })
                                  : r.plannedStartTime ?? '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </div>
          )}

          {/* المدفوعات */}
          {tab === 'payments' && (
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                {enrollments.filter((e: any) => e.status === 'active').map((en: any) => (
                  <button
                    key={en.id}
                    onClick={() => { setTopUpTarget(en); setTopUpModal(true) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    <Plus size={12} /> شحن رصيد — {en.groupName}
                  </button>
                ))}
              </div>

              {payments.length === 0
                ? <p className="text-sm text-slate-400 text-center py-8">لا توجد معاملات مالية مسجلة</p>
                : (
                  <div className="overflow-auto max-h-112.5 border border-slate-100 rounded-xl">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                        <tr className="text-xs text-slate-600 font-semibold">
                          <th className="py-2.5 px-3 text-right">رقم الوصل</th>
                          <th className="py-2.5 px-3 text-right">نوع المعاملة</th>
                          <th className="py-2.5 px-3 text-right">المجموعة</th>
                          <th className="py-2.5 px-3 text-right">المبلغ</th>
                          <th className="py-2.5 px-3 text-right">التاريخ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {payments.map((p: any) => {
                          const isCredit = ['credit', 'transfer_in'].includes(p.paymentType)
                          const isRefund = p.paymentType === 'refund'
                          return (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-mono text-xs text-blue-700 font-semibold">{p.receiptNumber}</td>
                              <td className="py-2.5 px-3 text-xs">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${isCredit ? 'bg-green-50 text-green-700' : isRefund ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                                  {PAYMENT_TYPE_LABELS[p.paymentType] ?? p.paymentType}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-xs text-slate-700 font-medium">{p.groupName ?? '—'}</td>
                              <td className={`py-2.5 px-3 text-xs font-bold ${isCredit ? 'text-green-700' : isRefund ? 'text-amber-700' : 'text-red-600'}`}>
                                {isCredit ? '+' : '-'}{p.amount?.toLocaleString('ar-DZ')} دج
                              </td>
                              <td className="py-2.5 px-3 text-xs text-slate-500 font-mono">{p.paymentDate}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </div>
          )}

          {/* التسجيلات */}
          {tab === 'enrollments' && (
            <div className="space-y-3">
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setEnrollModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                >
                  <Plus size={14} /> تسجيل في فوج جديد
                </button>
              </div>

              {enrollments.length === 0
                ? <p className="text-sm text-slate-400 text-center py-8">لا توجد تسجيلات</p>
                : enrollments.map((en: any) => (
                  <div key={en.id} className="p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 text-sm">{en.groupName}</p>
                          <span className="text-xs text-slate-500 font-medium">({en.courseName})</span>
                        </div>
                        <p className="text-xs text-slate-600">الأستاذ: <span className="font-semibold text-slate-800">{en.teacherName}</span></p>
                        <p className="text-xs text-slate-600">القاعة: {en.room}</p>
                        <p className="text-xs text-slate-600">السعر الشهري: <span className="font-bold text-slate-800">{en.agreedPrice?.toLocaleString('ar-DZ')} دج</span></p>
                        {en.balance !== null && (
                          <p className={`text-xs font-bold ${en.balance < 0 ? 'text-red-600' : 'text-green-700'}`}>
                            الرصيد المتبقي: {en.balance?.toLocaleString('ar-DZ')} دج
                          </p>
                        )}
                        <p className="text-xs text-slate-400">تاريخ التسجيل: {en.enrollmentDate}</p>
                      </div>
                      <div className="flex flex-col gap-2 items-end shrink-0">
                        <Badge variant={en.status === 'active' ? 'active' : 'inactive'}>
                          {en.status === 'active' ? 'نشط' : en.status === 'completed' ? 'منتهٍ' : 'غير نشط'}
                        </Badge>
                        {en.status === 'active' && (
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              onClick={() => { setTransferFrom(en); setTransferToGroupId(''); setTransferModal(true) }}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors font-medium border border-blue-200"
                            >
                              <ArrowLeftRight size={12} /> تحويل 100% من الرصيد
                            </button>
                            <button
                              onClick={() => { setCancelEnrollTarget(en); setCancelEnrollModal(true) }}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors font-medium border border-red-200"
                            >
                              <XCircle size={12} /> إلغاء التسجيل
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* الملاحظات - محمي ضد الانهيار */}
          {tab === 'notes' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="اكتب ملاحظة جديدة حول الطالب..."
                  rows={3}
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white resize-none"
                  dir="rtl"
                />
                <button
                  onClick={() => {
                    const text = (newNote || '').trim()
                    if (!text) return
                    saveNotes([text, ...notes])
                    setNewNote('')
                  }}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors self-end shadow-sm"
                >
                  <Plus size={16} /> إضافة
                </button>
              </div>
              {notes.length === 0
                ? <p className="text-sm text-slate-400 text-center py-6">لا توجد ملاحظات مسجلة</p>
                : notes.map((note: string, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-slate-800 flex-1 whitespace-pre-wrap leading-relaxed">{note}</p>
                    <button onClick={() => saveNotes(notes.filter((_: any, j: number) => j !== i))}
                      className="p-1 rounded text-slate-400 hover:text-red-500 transition-colors shrink-0"
                      title="حذف الملاحظة">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>

      {/* Edit Student Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="تعديل معلومات الطالب" size="md">
        <div className="space-y-3" dir="rtl">
          <div className="grid grid-cols-2 gap-3">
            {[
              ['الاسم الأول (عربي)', 'firstNameAr'],
              ['اللقب (عربي)', 'lastNameAr'],
              ['الاسم الأول (لاتيني)', 'firstNameFr'],
              ['اللقب (لاتيني)', 'lastNameFr'],
              ['الهاتف', 'phone'],
              ['هاتف الولي', 'guardianPhone'],
            ].map(([label, field]) => (
              <div key={field}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                <input
                  value={editForm[field] ?? ''}
                  onChange={e => setEditForm((f: any) => ({ ...f, [field]: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">العنوان</label>
            <input
              value={editForm.address ?? ''}
              onChange={e => setEditForm((f: any) => ({ ...f, address: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={() => setEditModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">إلغاء</button>
            <button onClick={handleSaveEdit} disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60">
              {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Simplified Enroll Modal */}
      <Modal open={enrollModal} onClose={() => setEnrollModal(false)} title="تسجيل في فوج" size="sm">
        <div className="space-y-4" dir="rtl">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">الفوج / المجموعة *</label>
            <select
              value={enrollForm.groupId}
              onChange={e => {
                const g = groups.find((g: any) => g.id === Number(e.target.value))
                setEnrollForm(f => ({ ...f, groupId: e.target.value, agreedPrice: String(g?.monthlyPrice ?? '') }))
              }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
            >
              <option value="">اختر الفوج...</option>
              {groups.filter((g: any) => g.status === 'active').map((g: any) => {
                const course = courses.find((c: any) => c.id === g.courseId)
                const teacher = teachers.find((t: any) => t.id === g.teacherId)
                const tName = teacher ? `${teacher.lastNameAr || teacher.lastNameFr || ''} ${teacher.firstNameAr || teacher.firstNameFr || ''}`.trim() : ''
                return (
                  <option key={g.id} value={g.id}>
                    {g.name} — {course?.nameAr ?? course?.nameFr ?? ''} {tName ? `(${tName})` : ''}
                  </option>
                )
              })}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">السعر الشهري المتفق عليه (دج) *</label>
            <input
              type="number"
              value={enrollForm.agreedPrice}
              onChange={e => setEnrollForm(f => ({ ...f, agreedPrice: e.target.value }))}
              placeholder="2500"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">تاريخ بدء التسجيل *</label>
            <input
              type="date"
              value={enrollForm.enrollmentDate}
              onChange={e => setEnrollForm(f => ({ ...f, enrollmentDate: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button onClick={() => setEnrollModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">إلغاء</button>
            <button onClick={handleEnroll} disabled={saving || !enrollForm.groupId}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60 shadow-sm">
              {saving ? 'جارٍ التسجيل...' : 'تأكيد التسجيل'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Cancel Enrollment Modal */}
      <Modal open={cancelEnrollModal} onClose={() => { setCancelEnrollModal(false); setCancelEnrollTarget(null) }} title="إلغاء التسجيل واسترداد الرصيد" size="sm">
        <div className="space-y-4" dir="rtl">
          <p className="text-sm text-slate-700 leading-relaxed">
            هل أنت متأكد من إلغاء تسجيل الطالب في <strong>{cancelEnrollTarget?.groupName}</strong>؟
          </p>
          {cancelEnrollTarget?.balance > 0 ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-xs font-semibold">
              سيتم استرداد وإرجاع كامل الرصيد المتبقي: <strong>{cancelEnrollTarget.balance?.toLocaleString('ar-DZ')} دج</strong>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-xs">
              لا يوجد رصيد متبقٍ للاسترداد.
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={() => { setCancelEnrollModal(false); setCancelEnrollTarget(null) }}
              className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">إلغاء</button>
            <button onClick={handleCancelEnrollment} disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-60 shadow-sm">
              {saving ? 'جارٍ الإلغاء...' : 'تأكيد إلغاء التسجيل'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 1-Click 100% Transfer Modal */}
      <Modal open={transferModal} onClose={() => { setTransferModal(false); setTransferFrom(null) }} title="تحويل 100% من الرصيد المتبقي" size="sm">
        <div className="space-y-4" dir="rtl">
          <p className="text-sm text-slate-700 leading-relaxed">
            سيتم تحويل كامل الرصيد المتبقي (<strong>{transferFrom?.balance?.toLocaleString('ar-DZ')} دج</strong>) من <strong>{transferFrom?.groupName}</strong> وإنهاء هذا التسجيل، ونقل الرصيد إلى:
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">الفوج المستهدف *</label>
            <select
              value={transferToGroupId}
              onChange={e => setTransferToGroupId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
            >
              <option value="">اختر الفوج المستهدف...</option>
              {enrollments
                .filter((e: any) => e.id !== transferFrom?.id && e.status === 'active')
                .map((e: any) => <option key={e.id} value={e.groupId}>{e.groupName}</option>)
              }
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={() => { setTransferModal(false); setTransferFrom(null) }}
              className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">إلغاء</button>
            <button onClick={handleTransfer} disabled={saving || !transferToGroupId}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60 shadow-sm">
              {saving ? 'جارٍ التحويل...' : 'تأكيد تحويل الرصيد'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Top-up Modal */}
      <Modal open={topUpModal} onClose={() => { setTopUpModal(false); setTopUpTarget(null) }} title="شحن الرصيد المالي" size="sm">
        <div className="space-y-4" dir="rtl">
          <p className="text-xs text-slate-600">شحن رصيد لفوج: <strong className="text-blue-900">{topUpTarget?.groupName}</strong></p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">المبلغ (دج) *</label>
              <input type="number" value={topUpForm.amount}
                onChange={e => setTopUpForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="2500"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">طريقة الدفع</label>
              <select value={topUpForm.method} onChange={e => setTopUpForm(f => ({ ...f, method: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white">
                <option value="cash">نقداً</option>
                <option value="transfer">تحويل بنكي / CCP</option>
                <option value="check">صك بريدي / شيك</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">تاريخ الدفع</label>
            <input type="date" value={topUpForm.date} onChange={e => setTopUpForm(f => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={() => { setTopUpModal(false); setTopUpTarget(null) }}
              className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">إلغاء</button>
            <button onClick={handleTopUp} disabled={saving || !topUpForm.amount}
              className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-60 shadow-sm">
              {saving ? 'جارٍ الشحن...' : 'تأكيد شحن الرصيد'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

