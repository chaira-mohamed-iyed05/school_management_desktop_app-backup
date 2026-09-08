import { useState, useEffect, useCallback } from 'react'
import {
  Search, Plus, Printer, TrendingUp, AlertCircle,
  DollarSign, Users, X, XCircle, CreditCard, CheckCircle2
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import StatCard from '../components/ui/StatCard'
import StudentCombobox from '../components/ui/StudentCombobox'
import type { PaymentMethod } from '../types'

function Receipt({ payment, student, group, course, schoolSettings, onClose }: {
  payment: any
  student: any
  group: any
  course: any
  schoolSettings: any
  onClose: () => void
}) {
  const handlePrint = async () => {
    const api = (window as any).schoolApp
    if (api) await api.app.print()
  }

  const methodLabel: Record<string, string> = {
    cash: 'نقداً',
    transfer: 'تحويل بنكي / CCP',
    check: 'شيك بنكي',
  }

  return (
    <div dir="rtl">
      <div className="border border-dashed border-slate-300 rounded-xl p-6 bg-white font-sans text-sm shadow-sm" style={{ width: 320, margin: '0 auto' }}>
        <div className="text-center mb-4">
          <p className="font-bold text-base text-slate-900 tracking-wider">✦ {schoolSettings?.schoolNameAr || 'إيدوبيلوت الجزائر'} ✦</p>
          {schoolSettings?.schoolNameFr && (
            <p className="text-xs text-slate-500 font-medium font-sans" dir="ltr">{schoolSettings.schoolNameFr}</p>
          )}
          <p className="text-xs text-slate-600 font-bold mt-1.5 font-mono" dir="ltr">وصل تسديد N° {payment.receiptNumber}</p>
        </div>
        <div className="border-t border-dashed border-slate-300 my-3" />
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">الطالب:</span>
            <span className="font-bold text-slate-800">
              {student ? (student.firstNameAr ? `${student.lastNameAr} ${student.firstNameAr}` : `${student.firstNameFr} ${student.lastNameFr}`) : `رقم #${payment.studentId}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">رقم القيد:</span>
            <span className="font-mono text-slate-700" dir="ltr">{student?.studentNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">المادة / الدورة:</span>
            <span className="font-medium text-slate-800">{course?.nameAr || course?.nameFr || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">الفوج:</span>
            <span className="font-medium text-slate-800">{group?.name || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">الفترة / الشهر:</span>
            <span className="font-bold font-mono text-slate-800" dir="ltr">{payment.billingPeriod}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">طريقة الدفع:</span>
            <span className="font-medium text-slate-800">{methodLabel[payment.paymentMethod || payment.method] || payment.paymentMethod || 'نقداً'}</span>
          </div>
          {payment.reference && (
            <div className="flex justify-between">
              <span className="text-slate-500">رقم المرجع / الشيك:</span>
              <span className="font-mono text-slate-700" dir="ltr">{payment.reference}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">تاريخ الدفع:</span>
            <span className="font-mono" dir="ltr">{new Date(payment.paymentDate || payment.date).toLocaleDateString('ar-DZ')}</span>
          </div>
        </div>
        <div className="border-t border-dashed border-slate-300 my-3" />
        <div className="flex justify-between font-bold text-base text-slate-900">
          <span>المبلغ الإجمالي:</span>
          <span className="font-mono text-emerald-700" dir="ltr">{Number(payment.amount).toLocaleString('ar-DZ')} دج</span>
        </div>
        <div className="border-t border-dashed border-slate-300 my-3" />
        <p className="text-[11px] text-slate-500 text-center font-medium">شكراً لثقتكم بنا!</p>
      </div>

      <div className="flex justify-end gap-2.5 mt-5">
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <Printer size={15} /> طباعة الوصل
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          إغلاق
        </button>
      </div>
    </div>
  )
}

export default function Payments() {
  const [activeTab, setActiveTab] = useState<'receipts' | 'debts'>('receipts')
  const [payments, setPayments] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [debtReport, setDebtReport] = useState<any[]>([])
  const [schoolSettings, setSchoolSettings] = useState<any | null>(null)

  const [summary, setSummary] = useState({ monthRevenue: 0, todayCollected: 0, outstanding: 0, overdue: 0 })
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [debtFilter, setDebtFilter] = useState<'all' | 'overdue' | 'up_to_date'>('all')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [receiptModal, setReceiptModal] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    studentId: '',
    enrollmentId: '',
    billingPeriod: new Date().toISOString().substring(0, 7),
    amount: '2500',
    method: 'cash' as PaymentMethod,
    reference: '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
  })

  const api = (window as any).schoolApp

  const loadData = useCallback(async () => {
    if (!api) return
    setLoading(true)
    try {
      const [pRes, sRes, gRes, cRes, sumRes, setRes, debtRes] = await Promise.all([
        api.payments.list({ pageSize: 500 }),
        api.students.list({ pageSize: 1000 }),
        api.groups.list(),
        api.courses.list(),
        api.payments.summary ? api.payments.summary() : Promise.resolve({ success: false }),
        api.settings.get(),
        api.payments.debtReport ? api.payments.debtReport() : Promise.resolve({ success: false, data: [] }),
      ])

      if (pRes.success && pRes.data) setPayments(pRes.data.items || [])
      if (sRes.success && sRes.data) setStudents(sRes.data.items || [])
      if (gRes.success && gRes.data) setGroups(gRes.data || [])
      if (cRes.success && cRes.data) setCourses(cRes.data || [])
      if (sumRes.success && sumRes.data) setSummary(sumRes.data)
      if (setRes.success && setRes.data) setSchoolSettings(setRes.data)
      if (debtRes.success && debtRes.data) setDebtReport(debtRes.data)
    } catch (err) {
      console.error('Failed to load payments:', err)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Mapping for debt badges by student ID
  const debtMap: Record<number, { debt: number; monthsOverdue: number; status: string }> = {}
  debtReport.forEach(item => {
    debtMap[item.studentId] = {
      debt: item.totalDebt,
      monthsOverdue: item.monthsOverdue,
      status: item.status,
    }
  })

  // When student selected in add modal, load their active enrollments
  const handleStudentSelect = async (studentId: string) => {
    setForm(f => ({ ...f, studentId, enrollmentId: '' }))
    if (!studentId || !api) return
    try {
      const enRes = await api.enrollments.byStudent(Number(studentId))
      if (enRes.success && enRes.data && enRes.data.length > 0) {
        setEnrollments(enRes.data)
        const active = enRes.data.find((e: any) => e.status === 'active') ?? enRes.data[0]
        setForm(f => ({
          ...f,
          enrollmentId: String(active.id),
          amount: String(active.agreedPrice || 2500)
        }))
      } else {
        setEnrollments([])
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Quick action: Open pay modal directly for a specific student from debt list
  const handleQuickPayForStudent = async (studentId: number) => {
    setAddModalOpen(true)
    await handleStudentSelect(String(studentId))
  }

  const handleAddPayment = async () => {
    if (!api || !form.studentId || !form.enrollmentId || !form.amount) {
      alert('يرجى تحديد الطالب مع الفوج المسجل به وإدخال المبلغ المدفوع')
      return
    }

    try {
      const res = await api.payments.create({
        studentId: Number(form.studentId),
        enrollmentId: Number(form.enrollmentId),
        billingPeriod: form.billingPeriod,
        amount: Number(form.amount),
        paymentMethod: form.method,
        paymentDate: form.date,
        reference: form.reference || null,
        notes: form.notes || null,
      })

      if (res.success && res.data) {
        setAddModalOpen(false)
        setReceiptModal(res.data)
        loadData()
      } else {
        alert(res.error?.message || 'خطأ أثناء تسجيل الدفعة')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCancelPayment = async (id: number) => {
    const reason = prompt('سبب إلغاء هذا الوصل :')
    if (reason === null || !api) return
    try {
      const res = await api.payments.cancel(id, reason)
      if (res.success) {
        loadData()
      } else {
        alert(res.error?.message || 'خطأ أثناء الإلغاء')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Filtered payments list for Receipts tab
  const filteredPayments = payments.filter(p => {
    const student = students.find(s => s.id === p.studentId)
    const q = search.toLowerCase().trim()
    const nameFr = `${student?.firstNameFr || ''} ${student?.lastNameFr || ''}`.toLowerCase()
    const nameAr = `${student?.firstNameAr || ''} ${student?.lastNameAr || ''}`.toLowerCase()
    const studentNumber = (student?.studentNumber || p.studentNumber || '').toLowerCase()
    const receiptNumber = (p.receiptNumber || '').toLowerCase()
    const groupName = (p.groupName || '').toLowerCase()
    const courseName = (p.courseName || p.courseNameFr || '').toLowerCase()

    const matchSearch = !q ||
      nameFr.includes(q) ||
      nameAr.includes(q) ||
      studentNumber.includes(q) ||
      receiptNumber.includes(q) ||
      groupName.includes(q) ||
      courseName.includes(q)

    const matchStatus = !filterStatus || p.status === filterStatus
    return matchSearch && matchStatus
  })

  // Filtered debt report for Debt Tracker tab
  const filteredDebtReport = debtReport.filter(item => {
    const q = search.toLowerCase().trim()
    const nameFr = `${item.firstNameFr || ''} ${item.lastNameFr || ''}`.toLowerCase()
    const nameAr = `${item.firstNameAr || ''} ${item.lastNameAr || ''}`.toLowerCase()
    const studentNumber = (item.studentNumber || '').toLowerCase()

    const matchSearch = !q ||
      nameFr.includes(q) ||
      nameAr.includes(q) ||
      studentNumber.includes(q)

    const matchFilter = debtFilter === 'all' ||
      (debtFilter === 'overdue' && item.totalDebt > 0) ||
      (debtFilter === 'up_to_date' && item.totalDebt === 0)

    return matchSearch && matchFilter
  })

  const methodLabels: Record<PaymentMethod, string> = { cash: 'نقداً', transfer: 'تحويل بنكي/CCP', check: 'شيك' }

  return (
    <div className="space-y-5" dir="rtl">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="مداخيل هذا الشهر"
          value={`${summary.monthRevenue.toLocaleString('ar-DZ')} دج`}
          change="الفوترة الشهرية"
          changePositive
          icon={TrendingUp}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="المحصل اليوم"
          value={`${summary.todayCollected.toLocaleString('ar-DZ')} دج`}
          icon={DollarSign}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="إجمالي الديون المعلقة"
          value={`${summary.outstanding.toLocaleString('ar-DZ')} دج`}
          change="مستحقات على الطلاب"
          icon={AlertCircle}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatCard
          title="الطلاب المتأخرون عن الدفع"
          value={summary.overdue}
          change="بحاجة إلى تذكير"
          icon={Users}
          iconColor="text-rose-500"
          iconBg="bg-rose-50"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('receipts')}
            className={`pb-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'receipts'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Printer size={16} /> الوصولات والمدفوعات ({payments.length})
          </button>
          <button
            onClick={() => setActiveTab('debts')}
            className={`pb-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'debts'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertCircle size={16} /> تقرير الديون والمستحقات ({debtReport.filter(d => d.totalDebt > 0).length} متأخر)
          </button>
        </div>

        <button
          onClick={() => {
            setForm({
              studentId: '',
              enrollmentId: '',
              billingPeriod: new Date().toISOString().substring(0, 7),
              amount: '2500',
              method: 'cash',
              reference: '',
              notes: '',
              date: new Date().toISOString().split('T')[0],
            })
            setAddModalOpen(true)
          }}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm mb-2 cursor-pointer"
        >
          <Plus size={16} /> تسجيل دفعة جديدة
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 flex-1">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            placeholder={
              activeTab === 'receipts'
                ? 'البحث عن طالب (بالعربية/الفرنسية)، رقم القيد، رقم الوصل، الفوج، المادة...'
                : 'البحث عن طالب بالاسم أو رقم القيد...'
            }
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full placeholder-slate-400 text-slate-800"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X size={15} />
            </button>
          )}
        </div>

        {activeTab === 'receipts' ? (
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white text-slate-700 font-medium"
          >
            <option value="">جميع الحالات</option>
            <option value="paid">مدفوع</option>
            <option value="cancelled">ملغى</option>
          </select>
        ) : (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setDebtFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                debtFilter === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({debtReport.length})
            </button>
            <button
              onClick={() => setDebtFilter('overdue')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                debtFilter === 'overdue' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-600 hover:bg-rose-50'
              }`}
            >
              عليهم ديون ({debtReport.filter(d => d.totalDebt > 0).length})
            </button>
            <button
              onClick={() => setDebtFilter('up_to_date')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                debtFilter === 'up_to_date' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              مستوفون ({debtReport.filter(d => d.totalDebt === 0).length})
            </button>
          </div>
        )}

        <button
          onClick={() => (window as any).schoolApp?.app.print()}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <Printer size={15} /> طباعة
        </button>
      </div>

      {/* Main Content View */}
      {activeTab === 'receipts' ? (
        /* Receipts Table */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['رقم الوصل', 'الطالب', 'المادة والفوج', 'الفترة', 'المبلغ', 'طريقة الدفع', 'التاريخ', 'الحالة', 'الإجراءات'].map(h => (
                    <th key={h} className="px-4 py-3 text-right text-xs font-bold text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400 text-sm">
                      لا توجد أي مدفوعات مسجلة
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map(p => {
                    const student = students.find(s => s.id === p.studentId)
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-blue-700 font-bold text-left" dir="ltr">{p.receiptNumber}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-800">
                            {student ? (student.firstNameAr ? `${student.lastNameAr} ${student.firstNameAr}` : `${student.firstNameFr} ${student.lastNameFr}`) : (p.studentName || `طالب #${p.studentId}`)}
                          </span>
                          <p className="text-[11px] font-mono text-slate-400 text-left" dir="ltr">{student?.studentNumber || p.studentNumber}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <p className="font-bold text-slate-700">{p.groupName || '—'}</p>
                          <p className="text-slate-400">{p.courseNameAr || p.courseNameFr || ''}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-xs text-left" dir="ltr">{p.billingPeriod || '—'}</td>
                        <td className="px-4 py-3 font-bold text-emerald-700 font-mono text-left" dir="ltr">{Number(p.amount).toLocaleString('ar-DZ')} دج</td>
                        <td className="px-4 py-3 text-slate-700 font-medium">{methodLabels[p.paymentMethod as PaymentMethod] || p.paymentMethod || 'نقداً'}</td>
                        <td className="px-4 py-3 text-slate-600 text-xs font-mono text-left" dir="ltr">{new Date(p.paymentDate).toLocaleDateString('ar-DZ')}</td>
                        <td className="px-4 py-3">
                          <Badge variant={p.status === 'paid' ? 'success' : 'error'}>
                            {p.status === 'paid' ? 'مدفوع' : 'ملغى'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setReceiptModal(p)}
                              className="text-xs text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Printer size={13} /> الوصل
                            </button>
                            {p.status === 'paid' && (
                              <button
                                onClick={() => handleCancelPayment(p.id)}
                                className="text-xs text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                                title="إلغاء هذا الوصل"
                              >
                                <XCircle size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Debts & Tuition Tracker Table */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['الطالب', 'الأفواج والمواد', 'السعر الشهري', 'الأشهر المحتسبة', 'إجمالي المدفوع', 'الدين / المتبقي', 'آخر دفعة', 'الوضعية', 'الإجراء'].map(h => (
                    <th key={h} className="px-4 py-3 text-right text-xs font-bold text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDebtReport.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400 text-sm">
                      لا توجد أي بيانات مطابقة
                    </td>
                  </tr>
                ) : (
                  filteredDebtReport.map(item => (
                    <tr key={item.studentId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900">
                          {item.firstNameAr ? `${item.lastNameAr} ${item.firstNameAr}` : `${item.firstNameFr} ${item.lastNameFr}`}
                        </span>
                        {item.firstNameFr && item.firstNameAr && (
                          <span className="text-xs text-slate-400 block font-sans" dir="ltr">
                            {item.firstNameFr} {item.lastNameFr}
                          </span>
                        )}
                        <span className="font-mono text-[11px] text-slate-400 block text-left" dir="ltr">{item.studentNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        {item.enrollments.map((en: any) => (
                          <div key={en.enrollmentId} className="text-xs">
                            <span className="font-bold text-slate-700">{en.groupName}</span>
                            <span className="text-slate-400"> ({en.courseName})</span>
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-700 font-mono text-left" dir="ltr">
                        {item.enrollments.map((en: any) => (
                          <div key={en.enrollmentId}>
                            {Number(en.agreedPrice).toLocaleString('ar-DZ')} دج
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {item.enrollments.map((en: any) => (
                          <div key={en.enrollmentId}>
                            {en.monthsBilled} شهر ({Number(en.totalDue).toLocaleString('ar-DZ')} دج)
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-emerald-700 font-mono text-left" dir="ltr">
                        {Number(item.totalPaid).toLocaleString('ar-DZ')} دج
                      </td>
                      <td className="px-4 py-3">
                        {item.totalDebt > 0 ? (
                          <div>
                            <span className="font-bold text-rose-600 text-sm font-mono text-left block" dir="ltr">
                              {Number(item.totalDebt).toLocaleString('ar-DZ')} دج
                            </span>
                            <span className="text-[11px] text-rose-500 block">
                              ({item.monthsOverdue} شهر تأخير)
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 size={14} /> 0 دج
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {item.lastPaymentDate ? (
                          <div>
                            <span className="font-mono" dir="ltr">{new Date(item.lastPaymentDate).toLocaleDateString('ar-DZ')}</span>
                            <span className="text-slate-400 block font-mono text-[10px] text-left" dir="ltr">
                              {Number(item.lastPaymentAmount).toLocaleString('ar-DZ')} دج
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">لا يوجد</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={item.totalDebt > 0 ? 'error' : 'success'}>
                          {item.totalDebt > 0 ? 'متأخر' : 'مستوفٍ'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleQuickPayForStudent(item.studentId)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm cursor-pointer"
                        >
                          <CreditCard size={13} /> تسديد
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add payment modal */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="تسجيل دفعة مالية جديدة" size="md">
        <div className="space-y-4" dir="rtl">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">الطالب *</label>
              <StudentCombobox
                students={students.filter(s => s.status === 'active')}
                value={form.studentId}
                onChange={handleStudentSelect}
                debtMap={debtMap}
                placeholder="ابحث عن طالب بالاسم، اللقب، أو رقم القيد..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">التسجيل / الفوج *</label>
              <select
                value={form.enrollmentId}
                onChange={e => {
                  const enId = e.target.value
                  const selectedEn = enrollments.find(en => String(en.id) === enId)
                  setForm(f => ({
                    ...f,
                    enrollmentId: enId,
                    amount: selectedEn ? String(selectedEn.agreedPrice) : f.amount
                  }))
                }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
              >
                <option value="">-- اختر الفوج الدراسي --</option>
                {enrollments.map(en => {
                  const g = groups.find(grp => grp.id === en.groupId)
                  return (
                    <option key={en.id} value={en.id}>{g?.name || `فوج #${en.groupId}`} — {en.agreedPrice} دج/شهر</option>
                  )
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">شهر الفوترة</label>
              <input
                type="month"
                value={form.billingPeriod}
                onChange={e => setForm(f => ({ ...f, billingPeriod: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">المبلغ المقبوض (دج) *</label>
              <input
                type="number"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="2500"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-bold text-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">طريقة الدفع</label>
              <select
                value={form.method}
                onChange={e => setForm(f => ({ ...f, method: e.target.value as PaymentMethod }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
              >
                <option value="cash">نقداً (Espèces)</option>
                <option value="transfer">تحويل بنكي / CCP</option>
                <option value="check">شيك بنكي (Chèque)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">تاريخ الدفع</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">رقم المرجع / الشيك (اختياري)</label>
              <input
                type="text"
                placeholder="مثال: CHQ-882109"
                value={form.reference}
                onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono text-left"
                dir="ltr"
              />
            </div>
          </div>

          {/* Student current debt notice if applicable */}
          {form.studentId && debtMap[Number(form.studentId)] && debtMap[Number(form.studentId)].debt > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-2.5">
              <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <p className="font-bold">
                  مستحقات سابقة على هذا الطالب: {debtMap[Number(form.studentId)].debt.toLocaleString('ar-DZ')} دج ({debtMap[Number(form.studentId)].monthsOverdue} شهر تأخير)
                </p>
                <p className="mt-1 text-amber-800">
                  سيتم خصم مبلغ هذه الدفعة البالغ {Number(form.amount || 0).toLocaleString('ar-DZ')} دج من إجمالي ديون الطالب.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button onClick={() => setAddModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer">
              إلغاء
            </button>
            <button onClick={handleAddPayment} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm cursor-pointer">
              تسجيل الدفعة واستخراج الوصل
            </button>
          </div>
        </div>
      </Modal>

      {/* Receipt Modal */}
      <Modal open={receiptModal !== null} onClose={() => setReceiptModal(null)} title="وصل تسديد رسوم" size="sm">
        {receiptModal && (
          <Receipt
            payment={receiptModal}
            student={students.find(s => s.id === receiptModal.studentId)}
            group={groups.find(g => g.id === receiptModal.groupId)}
            course={courses.find(c => c.id === receiptModal.courseId)}
            schoolSettings={schoolSettings}
            onClose={() => setReceiptModal(null)}
          />
        )}
      </Modal>
    </div>
  )
}
