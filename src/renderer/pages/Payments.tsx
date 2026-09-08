import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import {
  Plus, Search, Printer, X, TrendingUp, AlertTriangle, CheckCircle2, Clock,
  BookOpen, AlertCircle, CreditCard, ChevronDown, Filter
} from 'lucide-react'
import type { Payment, Student, Enrollment, Group, Course } from '@shared/types/index'

interface PaymentSummary {
  monthRevenue: number
  todayCollected: number
  outstanding: number
  overdue: number
}

// Convert Eastern Arabic numerals (٠-٩) and Persian numerals (۰-۹) to standard ASCII (0-9)
function normalizeNumberInput(val: string): string {
  const ascii = val
    .replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
    .replace(/[۰-۹]/g, (d) => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
  return ascii.replace(/[^0-9.]/g, '')
}

// ── Searchable Student Combobox ─────────────────────────────────────────────
function getStudentLabel(s: Student): string {
  const ar = `${s?.lastNameAr || ''} ${s?.firstNameAr || ''}`.trim()
  const fr = `${s?.lastNameFr || ''} ${s?.firstNameFr || ''}`.trim()
  const name = ar || fr || ''
  const num = s?.studentNumber || ''
  if (name && num) return `${name} — #${num}`
  if (name) return name
  if (num) return `#${num}`
  return `ID:${s?.id ?? '?'}`
}

function getStudentInitial(s: Student): string {
  const label = getStudentLabel(s)
  return label.charAt(0).toUpperCase() || '?'
}

function StudentCombobox({
  students,
  value,
  onChange,
  placeholder,
}: {
  students: Student[]
  value: string
  onChange: (id: string) => void
  inputCls: string
  placeholder: string
}) {
  const safeStudents = Array.isArray(students) ? students : []
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedStudent = safeStudents.find((s) => s?.id != null && String(s.id) === value)
  const displayLabel = selectedStudent ? getStudentLabel(selectedStudent) : ''

  // Sync input text when selection changes and user is not actively typing
  useEffect(() => {
    if (!isTyping) {
      setQuery(displayLabel)
    }
  }, [value, displayLabel, isTyping])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      try {
        if (ref.current && !ref.current.contains(e.target as Node) && document.body.contains(e.target as Node)) {
          setOpen(false)
          setIsTyping(false)
          setQuery(displayLabel)
        }
      } catch {
        // ignore
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [displayLabel])

  const q = isTyping ? (query || '').toLowerCase().trim() : ''
  const filtered = q
    ? safeStudents.filter((s) => {
        if (!s) return false
        const ar = `${s.lastNameAr || ''} ${s.firstNameAr || ''}`.toLowerCase()
        const fr = `${s.lastNameFr || ''} ${s.firstNameFr || ''}`.toLowerCase()
        const num = (s.studentNumber || '').toLowerCase()
        const ph = (s.phone || '').toLowerCase()
        return ar.includes(q) || fr.includes(q) || num.includes(q) || ph.includes(q)
      })
    : safeStudents

  const visibleStudents = filtered.slice(0, 30)

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setQuery('')
    setIsTyping(true)
    setOpen(true)
    inputRef.current?.focus()
  }

  return (
    <div ref={ref} className="relative">
      <div
        className="flex items-center gap-2 relative bg-white border border-border rounded-xl px-3 py-2 shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all cursor-text"
        onClick={() => {
          if (!open) setOpen(true)
          inputRef.current?.focus()
        }}
      >
        <Search size={15} className="shrink-0 text-slate-400 ms-0.5" />
        <input
          ref={inputRef}
          type="text"
          className="flex-1 outline-none bg-transparent text-xs text-[#0F172A] placeholder:text-slate-400"
          value={query}
          onFocus={() => {
            setOpen(true)
            setIsTyping(true)
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsTyping(true)
            if (!open) setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              setIsTyping(false)
              setQuery(displayLabel)
            }
          }}
          placeholder={placeholder}
        />
        {value || query ? (
          <button
            type="button"
            onClick={handleClear}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors shrink-0"
            title="إلغاء الاختيار"
          >
            <X size={14} />
          </button>
        ) : (
          <ChevronDown
            size={14}
            className="shrink-0 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              setOpen((v) => !v)
            }}
          />
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-white border border-border rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 animate-fade-in">
          {visibleStudents.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400 text-center">
              لم يتم العثور على أي طالب
            </div>
          ) : (
            visibleStudents.map((s) => {
              if (!s || s.id == null) return null
              const label = getStudentLabel(s)
              const initial = getStudentInitial(s)
              const isSelected = String(s.id) === value

              return (
                <div
                  key={s.id}
                  className={`px-3.5 py-2.5 text-xs cursor-pointer hover:bg-indigo-50/70 transition-colors flex items-center justify-between gap-3 ${
                    isSelected ? 'bg-indigo-50/90 font-bold text-indigo-700' : 'text-[#0F172A]'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onChange(String(s.id))
                    setIsTyping(false)
                    setOpen(false)
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={`w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{label}</p>
                      {s.phone && <p className="text-[10px] text-slate-400 font-mono dir-ltr">{s.phone}</p>}
                    </div>
                  </div>
                  {s.studentNumber && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                      #{s.studentNumber}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export default function Payments() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as 'ar' | 'fr' | 'en'
  const location = useLocation()

  const [payments, setPayments] = useState<any[]>([])
  const [summary, setSummary] = useState<PaymentSummary>({ monthRevenue: 0, todayCollected: 0, outstanding: 0, overdue: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [enrollmentBalance, setEnrollmentBalance] = useState<{ balance: number; sessionsUsed: number } | null>(null)

  // Reference lists
  const [students, setStudents] = useState<Student[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [receiptModal, setReceiptModal] = useState<any | null>(null)

  // Transfer/Refund modals
  const [showTransfer, setShowTransfer] = useState<{ enrollmentId: number; studentId: number; balance: number } | null>(null)
  const [showRefund, setShowRefund] = useState<{ enrollmentId: number; studentId: number; balance: number } | null>(null)
  const [toEnrollmentId, setToEnrollmentId] = useState('')

  // Form State
  const [form, setForm] = useState({
    studentId: '',
    enrollmentId: '',
    newGroupId: '',
    amount: '',
    paymentMethod: 'cash',
    paymentDate: new Date().toISOString().slice(0, 10),
    reference: '',
    notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, summaryRes, grpRes, crsRes] = await Promise.all([
        window.schoolApp.payments.list({ pageSize: 100 }),
        window.schoolApp.payments.summary(),
        window.schoolApp.groups.list(),
        window.schoolApp.courses.list(),
      ])
      if (listRes.success && listRes.data) setPayments(listRes.data.items)
      if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data)
      if (grpRes.success && grpRes.data) setGroups(grpRes.data)
      if (crsRes.success && crsRes.data) setCourses(crsRes.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Auto-open form with pre-selected student when navigating from StudentProfile ──
  // Store the preselected ID from URL so we can open the form after load() finishes
  const preselectedStudentId = new URLSearchParams(location.search).get('studentId')
  const openedForStudentRef = useRef<string | null>(null)

  useEffect(() => {
    if (preselectedStudentId && !loading && openedForStudentRef.current !== preselectedStudentId) {
      openedForStudentRef.current = preselectedStudentId
      openForm(preselectedStudentId)
    }
  }, [preselectedStudentId, loading])

  const loadBalance = async (enrollmentId: number) => {
    try {
      const res = await window.schoolApp.payments.balance(enrollmentId)
      if (res.success && res.data) setEnrollmentBalance(res.data)
    } catch { setEnrollmentBalance(null) }
  }

  const handleStudentChange = async (sid: string) => {
    setError('')
    setEnrollmentBalance(null)
    setForm((f) => ({ ...f, studentId: sid, enrollmentId: '', newGroupId: '', amount: '' }))
    if (!sid) { setEnrollments([]); return }
    const res = await window.schoolApp.enrollments.byStudent(Number(sid))
    if (res.success && res.data && res.data.length > 0) {
      setEnrollments(res.data)
      const first = res.data[0]
      setForm((f) => ({ ...f, studentId: sid, enrollmentId: String(first.id), newGroupId: '', amount: String(first.agreedPrice || '') }))
      loadBalance(first.id)
    } else {
      setEnrollments([])
      if (groups.length > 0) setForm((f) => ({ ...f, studentId: sid, enrollmentId: '', newGroupId: String(groups[0].id), amount: String(groups[0].monthlyPrice || '') }))
    }
  }

  const handleEnrollmentChange = (enrollId: string) => {
    const found = enrollments.find((e) => e.id === Number(enrollId))
    setForm((f) => ({ ...f, enrollmentId: enrollId, newGroupId: '', amount: found ? String(found.agreedPrice || '') : f.amount }))
    if (enrollId) loadBalance(Number(enrollId))
    else setEnrollmentBalance(null)
  }

  const handleNewGroupChange = (grpId: string) => {
    const found = groups.find((g) => g.id === Number(grpId))
    setForm((f) => ({ ...f, newGroupId: grpId, enrollmentId: '', amount: found ? String(found.monthlyPrice || '') : f.amount }))
    setEnrollmentBalance(null)
  }

  const openForm = async (preselectedStudentId?: string) => {
    const sr = await window.schoolApp.students.list({ status: 'active', pageSize: 1000 })
    const studentList = sr.success && sr.data ? sr.data.items : []
    setStudents(studentList)

    const defaultForm = {
      studentId: preselectedStudentId ?? '',
      enrollmentId: '',
      newGroupId: '',
      billingPeriod: new Date().toISOString().slice(0, 7),
      amount: '',
      paymentMethod: 'cash',
      paymentDate: new Date().toISOString().slice(0, 10),
      reference: '',
      notes: '',
    }
    setForm(defaultForm)
    setEnrollments([])
    setError('')
    setShowForm(true)

    // If a student is pre-selected, auto-load their enrollments
    if (preselectedStudentId) {
      const res = await window.schoolApp.enrollments.byStudent(Number(preselectedStudentId))
      if (res.success && res.data && res.data.length > 0) {
        setEnrollments(res.data)
        const first = res.data[0]
        setForm((f) => ({
          ...f,
          enrollmentId: String(first.id),
          amount: String(first.agreedPrice || ''),
        }))
      }
    }
  }

  const handleSave = async () => {
    if (!form.studentId) { setError(t('payments.student') + ' requis'); return }
    if (!form.enrollmentId && !form.newGroupId) { setError(t('payments.groupOrCourseRequired')); return }
    if (!form.amount || Number(form.amount) <= 0) { setError(t('payments.amount') + ' requis'); return }
    setSaving(true); setError('')
    try {
      let finalEnrollmentId = Number(form.enrollmentId)
      if (!finalEnrollmentId && form.newGroupId) {
        const er = await window.schoolApp.enrollments.create({ studentId: Number(form.studentId), groupId: Number(form.newGroupId), agreedPrice: Number(form.amount), enrollmentDate: form.paymentDate })
        if (!er.success) { setError(er.error ?? t('common.error')); return }
        finalEnrollmentId = er.data.id
      }
      // Use topUp (credit model)
      const res = await window.schoolApp.payments.topUp({
        studentId: Number(form.studentId),
        enrollmentId: finalEnrollmentId,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod as 'cash' | 'transfer' | 'check',
        paymentDate: form.paymentDate,
        reference: form.reference.trim() || null,
        notes: form.notes.trim() || null,
      })
      if (!res.success) { setError(res.error ?? t('common.error')) }
      else { setShowForm(false); setReceiptModal(res.data); await load() }
    } catch (err: any) { setError(err?.message ?? t('common.error')) }
    finally { setSaving(false) }
  }

  const handleTransfer = async () => {
    if (!showTransfer || !toEnrollmentId) return
    setSaving(true)
    try {
      const res = await window.schoolApp.payments.transfer({ fromEnrollmentId: showTransfer.enrollmentId, toEnrollmentId: Number(toEnrollmentId), studentId: showTransfer.studentId })
      if (res.success) { setShowTransfer(null); setToEnrollmentId(''); await load() }
      else setError(res.error ?? t('common.error'))
    } finally { setSaving(false) }
  }

  const handleRefund = async () => {
    if (!showRefund) return
    setSaving(true)
    try {
      const res = await window.schoolApp.payments.refund({ enrollmentId: showRefund.enrollmentId, studentId: showRefund.studentId })
      if (res.success) { setShowRefund(null); await load() }
      else setError(res.error ?? t('common.error'))
    } finally { setSaving(false) }
  }

  const handleCancel = async (id: number) => {
    if (!window.confirm(t('payments.cancelConfirm'))) return
    await window.schoolApp.payments.cancel(id)
    await load()
  }

  const handlePrintReceipt = async () => {
    await window.schoolApp.app.print()
  }

  const getCourseGroupName = (courseId: number, groupName: string) => {
    const course = courses.find((c) => c.id === courseId)
    if (!course) return groupName
    const cName = lang === 'ar' ? course.nameAr : course.nameFr
    return `${cName} — ${groupName}`
  }

  const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 bg-white'
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1'

  // ── Filter by search text ──
  const filtered = payments.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (p.receiptNumber?.toLowerCase().includes(q)) ||
      (p.studentName && p.studentName.toLowerCase().includes(q)) ||
      (p.studentNumber && p.studentNumber.toLowerCase().includes(q)) ||
      (p.groupName && p.groupName.toLowerCase().includes(q))
    )
  })

  return (
    <div className="animate-fade-in space-y-6">
      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-border shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-emerald-500" />
            <p className="text-xs text-slate-400 font-medium">{t('dashboard.monthRevenue')}</p>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{summary.monthRevenue.toLocaleString()} DA</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-border shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={14} className="text-[#2563EB]" />
            <p className="text-xs text-slate-400 font-medium">{t('payments.todayCollected')}</p>
          </div>
          <p className="text-2xl font-bold text-[#2563EB]">{summary.todayCollected.toLocaleString()} DA</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-border shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className="text-amber-500" />
            <p className="text-xs text-slate-400 font-medium">{t('payments.outstanding')}</p>
          </div>
          <p className="text-2xl font-bold text-amber-600">{summary.outstanding.toLocaleString()} DA</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-border shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-red-500" />
            <p className="text-xs text-slate-400 font-medium">{lang === 'ar' ? 'ديون متراكمة' : lang === 'en' ? 'Outstanding Debt' : 'Dettes en cours'}</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{summary.outstanding.toLocaleString()} DA</p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-50">
          <Search size={14} className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full ps-9 pe-3 py-2 border border-border rounded-lg text-sm bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
          />
        </div>
        {/* no overdue filter button needed anymore */}
        <button
          onClick={() => openForm()}
          className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] transition-colors"
        >
          <Plus size={15} /> {lang === 'ar' ? 'شحن رصيد' : lang === 'en' ? 'Add Credit' : 'Recharger'}
        </button>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden shadow-xs">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <CreditCard size={36} className="mx-auto mb-2 opacity-30" />
            <p className="font-medium">{t('payments.noPayments')}</p>
          </div>
        ) : (
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-border">
              <tr>
                <th className="px-4 py-3 text-start">{t('payments.receiptNumber')}</th>
                <th className="px-4 py-3 text-start">{t('payments.student')}</th>
                <th className="px-4 py-3 text-start">{t('payments.courseAndGroup')}</th>
                <th className="px-4 py-3 text-start">{lang === 'ar' ? 'النوع' : 'Type'}</th>
                <th className="px-4 py-3 text-start">{t('payments.amount')}</th>
                <th className="px-4 py-3 text-start">{t('payments.date')}</th>
                <th className="px-4 py-3 text-start">{t('payments.status')}</th>
                <th className="px-4 py-3 text-end">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 font-mono text-[10px] text-slate-600">{p.receiptNumber}</td>
                  <td className="px-4 py-3 font-medium text-[#0F172A]">
                    <div>{p.studentName ?? `#${p.studentId}`}</div>
                    {p.studentNumber && <div className="text-[10px] text-slate-400 font-mono">{p.studentNumber}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-[11px]">
                    {p.groupName ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      p.paymentType === 'credit' ? 'bg-emerald-100 text-emerald-700' :
                      p.paymentType === 'deduction' ? 'bg-blue-100 text-blue-700' :
                      p.paymentType === 'transfer_in' ? 'bg-teal-100 text-teal-700' :
                      p.paymentType === 'transfer_out' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {p.paymentType === 'credit' ? (lang === 'ar' ? 'شحن' : lang === 'en' ? 'Credit' : 'Crédit') :
                       p.paymentType === 'deduction' ? (lang === 'ar' ? 'حصة' : lang === 'en' ? 'Session' : 'Séance') :
                       p.paymentType === 'transfer_in' ? (lang === 'ar' ? 'تحويل+' : 'Transfer+') :
                       p.paymentType === 'transfer_out' ? (lang === 'ar' ? 'تحويل-' : 'Transfer-') :
                       (lang === 'ar' ? 'استرداد' : lang === 'en' ? 'Refund' : 'Remboursement')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-[#2563EB]">{p.amount?.toLocaleString()} DA</td>
                  <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">{p.paymentDate}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      p.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {p.status === 'paid' ? t('payments.paid') : t('payments.cancelled')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end flex gap-2 justify-end">
                    <button onClick={() => setReceiptModal(p)} className="text-xs text-[#2563EB] hover:underline flex items-center gap-1">
                      <Printer size={12} />
                    </button>
                    {p.status === 'paid' && p.paymentType === 'credit' && (
                      <button onClick={() => handleCancel(p.id)} className="text-xs text-red-500 hover:underline">{t('payments.cancel')}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Payment Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-[#0F172A]">{lang === 'ar' ? 'شحن رصيد' : lang === 'en' ? 'Add Credit' : 'Recharger le crédit'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="space-y-3.5">
              {/* Student Selector — searchable combobox */}
              <div>
                <label className={labelCls}>{t('payments.student')} *</label>
                <StudentCombobox
                  students={students}
                  value={form.studentId}
                  onChange={handleStudentChange}
                  inputCls={inputCls}
                  placeholder={`— ${t('payments.student')} —`}
                />
              </div>

              {/* Course & Group Selector (Enrollment) */}
              {form.studentId && (
                <div>
                  <label className={labelCls}>{t('payments.courseAndGroup')} *</label>
                  {enrollments.length > 0 ? (
                    <select className={inputCls} value={form.enrollmentId} onChange={(e) => handleEnrollmentChange(e.target.value)}>
                      <option value="">{t('payments.selectCourseGroup')}</option>
                      {enrollments.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.courseName ? `${e.courseName} — ` : ''}{e.groupName ?? `${t('courses.groups')} #${e.groupId}`} ({e.agreedPrice.toLocaleString()} DA)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs">
                      <div className="flex items-center gap-1.5 text-amber-800 font-medium">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>{t('payments.notEnrolledYet')}</span>
                      </div>
                      <select className={inputCls} value={form.newGroupId} onChange={(e) => handleNewGroupChange(e.target.value)}>
                        <option value="">{t('payments.selectCourseGroup')}</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {getCourseGroupName(g.courseId, g.name)} ({g.monthlyPrice.toLocaleString()} DA)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Balance info with Transfer & Refund actions */}
              {enrollmentBalance && form.enrollmentId && (
                <div className={`p-3 rounded-xl border text-xs flex flex-col gap-2 ${
                  enrollmentBalance.balance < 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}>
                  <div className="flex items-center justify-between">
                    <span>{lang === 'ar' ? 'الرصيد الحالي لهذا المادة' : lang === 'en' ? 'Current balance for this course' : 'Solde pour cette matière'}:</span>
                    <span className="font-bold text-base">{enrollmentBalance.balance.toLocaleString()} DA</span>
                  </div>
                  {enrollmentBalance.balance > 0 && (
                    <div className="flex gap-2 pt-1 border-t border-emerald-200/60 justify-end">
                      <button
                        type="button"
                        onClick={() => setShowTransfer({ enrollmentId: Number(form.enrollmentId), studentId: Number(form.studentId), balance: enrollmentBalance.balance })}
                        className="px-2.5 py-1 bg-teal-600 text-white rounded text-[11px] font-semibold hover:bg-teal-700 transition-colors"
                      >
                        {lang === 'ar' ? 'تحويل الرصيد' : lang === 'en' ? 'Transfer' : 'Transférer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRefund({ enrollmentId: Number(form.enrollmentId), studentId: Number(form.studentId), balance: enrollmentBalance.balance })}
                        className="px-2.5 py-1 bg-red-600 text-white rounded text-[11px] font-semibold hover:bg-red-700 transition-colors"
                      >
                        {lang === 'ar' ? 'إلغاء واسترداد' : lang === 'en' ? 'Cancel & Refund' : 'Annuler & Rembourser'}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {/* Amount */}
              <div>
                <label className={labelCls}>{lang === 'ar' ? 'مبلغ الشحن (DA)' : lang === 'en' ? 'Credit Amount (DA)' : 'Montant à créditer (DA)'} *</label>
                <input
                  type="text" inputMode="decimal" className={inputCls}
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: normalizeNumberInput(e.target.value) }))}
                  placeholder="0" dir="ltr"
                />
              </div>

              {/* Payment Method & Date */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>{t('payments.method')}</label>
                  <select className={inputCls} value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}>
                    <option value="cash">{t('payments.cash')}</option>
                    <option value="transfer">{t('payments.transfer')}</option>
                    <option value="check">{t('payments.check')}</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t('payments.date')}</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.paymentDate}
                    onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Reference / Note */}
              <div>
                <label className={labelCls}>{t('payments.reference')} / {t('common.notes')}</label>
                <input
                  className={inputCls}
                  value={form.reference}
                  onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                  placeholder={t('payments.referencePlaceholder')}
                />
              </div>
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs mt-3 flex items-center gap-1.5">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-border rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] disabled:opacity-60 flex items-center gap-2 shadow-xs"
              >
                {saving && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Ticket Modal */}
      {receiptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setReceiptModal(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-[#0F172A]">{t('payments.receipt')}</h3>
              <button onClick={() => setReceiptModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            {/* Printable Ticket Receipt */}
            <div className="space-y-3 text-xs text-slate-700 font-mono bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner">
              <div className="text-center">
                <p className="font-extrabold text-base text-[#0F172A] tracking-wider">EDUPILOT DZ</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{t('payments.receiptNumber')}: {receiptModal.receiptNumber}</p>
              </div>

              <div className="border-b border-dashed border-slate-300 my-2" />

              {receiptModal.studentName && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('payments.student')}:</span>
                  <span className="font-bold text-[#0F172A] text-end">{receiptModal.studentName}</span>
                </div>
              )}
              {receiptModal.studentNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('students.studentNumber')}:</span>
                  <span className="font-bold text-slate-600">{receiptModal.studentNumber}</span>
                </div>
              )}

              {(receiptModal.courseName || receiptModal.groupName) && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('payments.courseAndGroup')}:</span>
                  <span className="font-bold text-[#0F172A] text-end">
                    {receiptModal.courseName ? `${receiptModal.courseName} ` : ''}
                    {receiptModal.groupName ? `(${receiptModal.groupName})` : ''}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-slate-500">{t('payments.billingPeriod')}:</span>
                <span className="font-bold text-[#0F172A]">{receiptModal.billingPeriod}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">{t('payments.method')}:</span>
                <span>{t(`payments.${receiptModal.paymentMethod}`)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">{t('payments.date')}:</span>
                <span>{receiptModal.paymentDate}</span>
              </div>

              {receiptModal.reference && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('payments.reference')}:</span>
                  <span className="font-semibold">{receiptModal.reference}</span>
                </div>
              )}

              <div className="border-b border-dashed border-slate-300 my-2" />

              <div className="flex justify-between items-center pt-1">
                <span className="font-bold text-sm text-[#0F172A]">{t('payments.amount')}:</span>
                <span className="font-extrabold text-base text-[#2563EB]">{receiptModal.amount.toLocaleString()} DA</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={handlePrintReceipt}
                className="w-full py-2.5 bg-[#2563EB] text-white rounded-lg text-xs font-bold hover:bg-[#1D4ED8] flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <Printer size={15} /> {t('payments.printReceipt')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Credit Modal */}
      {showTransfer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowTransfer(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-[#0F172A]">{lang === 'ar' ? 'تحويل الرصيد المتبقي' : lang === 'en' ? 'Transfer Remaining Balance' : 'Transférer le solde'}</h3>
              <button onClick={() => setShowTransfer(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-800">
                <span className="block font-semibold mb-0.5">{lang === 'ar' ? 'الرصيد المتاح للتحويل' : lang === 'en' ? 'Available balance' : 'Solde disponible'}</span>
                <span className="text-lg font-bold text-teal-700">{showTransfer.balance.toLocaleString()} DA</span>
              </div>

              <div>
                <label className={labelCls}>{lang === 'ar' ? 'التحويل إلى الفوج/المادة' : lang === 'en' ? 'Transfer to group/course' : 'Transférer vers le groupe/matière'}</label>
                <select className={inputCls} value={toEnrollmentId} onChange={(e) => setToEnrollmentId(e.target.value)}>
                  <option value="">{lang === 'ar' ? '— اختر الفوج المستهدف —' : lang === 'en' ? '— Choose target group —' : '— Choisir le groupe cible —'}</option>
                  {enrollments.filter(e => e.id !== showTransfer.enrollmentId).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.courseName ? `${e.courseName} — ` : ''}{e.groupName ?? `Groupe #${e.groupId}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowTransfer(null)} className="px-4 py-2 border border-border rounded-lg text-xs text-slate-600">
                {t('common.cancel')}
              </button>
              <button onClick={handleTransfer} disabled={saving || !toEnrollmentId} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 disabled:opacity-50">
                {saving ? (lang === 'ar' ? 'جاري التحويل...' : lang === 'en' ? 'Transferring...' : 'Transfert...') : (lang === 'ar' ? 'تأكيد التحويل' : lang === 'en' ? 'Confirm Transfer' : 'Confirmer le transfert')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Balance Modal */}
      {showRefund && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowRefund(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-[#0F172A]">{lang === 'ar' ? 'إلغاء واسترداد الرصيد' : lang === 'en' ? 'Cancel & Refund Balance' : 'Annuler & Rembourser le solde'}</h3>
              <button onClick={() => setShowRefund(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800">
                <p className="font-bold mb-1">{lang === 'ar' ? 'سيتم إرجاع المبلغ المتبقي للطالب:' : lang === 'en' ? 'Amount to be refunded to the student:' : 'Montant à rembourser à l\'étudiant :'}</p>
                <p className="text-2xl font-black text-red-600">{showRefund.balance.toLocaleString()} DA</p>
                <p className="text-[11px] text-slate-500 mt-1">{lang === 'ar' ? 'وسيتم تغيير حالة الاشتراك إلى ملغى.' : lang === 'en' ? 'And the enrollment status will be set to cancelled.' : 'Le statut d\'inscription sera défini sur annulé.'}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowRefund(null)} className="px-4 py-2 border border-border rounded-lg text-xs text-slate-600">
                {t('common.cancel')}
              </button>
              <button onClick={handleRefund} disabled={saving} className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50">
                {saving ? (lang === 'ar' ? 'جاري الاسترداد...' : lang === 'en' ? 'Refunding...' : 'Remboursement...') : (lang === 'ar' ? 'تأكيد الاسترداد' : lang === 'en' ? 'Confirm Refund' : 'Confirmer le remboursement')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

