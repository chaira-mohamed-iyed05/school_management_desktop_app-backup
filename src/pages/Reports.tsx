import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { FileText, Printer, Eye, Calendar, RefreshCw } from 'lucide-react'
import Modal from '../components/ui/Modal'

const reports = [
  { id: 'students', title: 'تقرير الطلاب المسجلين', description: 'قائمة شاملة للطلاب المسجلين مصنفة حسب المادة والفوج مع الحالة.' },
  { id: 'attendance', title: 'تقرير الحضور والغياب', description: 'إحصائيات الحضور والغياب ونسب الانضباط لكل فوج.' },
  { id: 'revenue', title: 'تقرير المعاملات والمدفوعات', description: 'سجل كامل لجميع العمليات المالية (شحن، خصم، تحويل واسترداد).' },
  { id: 'outstanding', title: 'تقرير الديون والمستحقات', description: 'قائمة الطلاب الذين عليهم مستحقات مالية متأخرة.' },
  { id: 'groups', title: 'تقرير الأفواج والقاعات', description: 'نسب استيعاب الأفواج، عدد الطلاب والقاعات المخصصة.' },
]

const PAYMENT_TYPE_LABELS: Record<string, { label: string; isCredit: boolean }> = {
  credit: { label: 'دفعة واردة (شحن)', isCredit: true },
  deduction: { label: 'خصم حصة', isCredit: false },
  transfer_in: { label: 'تحويل وارد', isCredit: true },
  transfer_out: { label: 'تحويل صادر', isCredit: false },
  refund: { label: 'استرداد / إلغاء', isCredit: false },
}

export default function Reports() {
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [students, setStudents] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [debtReport, setDebtReport] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const api = (window as any).schoolApp

  const loadData = useCallback(async () => {
    if (!api) return
    setLoading(true)
    try {
      const [sRes, cRes, gRes, pRes, sessRes, dRes] = await Promise.all([
        api.students.list({ pageSize: 1000 }),
        api.courses.list(),
        api.groups.list(),
        api.payments.listAll ? api.payments.listAll({ pageSize: 2000 }) : api.payments.list({ pageSize: 2000 }),
        api.sessions.list({ limit: 500 }),
        api.payments.debtReport ? api.payments.debtReport() : Promise.resolve({ success: false }),
      ])

      if (sRes.success && sRes.data) setStudents(sRes.data.items || [])
      if (cRes.success && cRes.data) setCourses(cRes.data || [])
      if (gRes.success && gRes.data) setGroups(gRes.data || [])
      if (pRes.success && pRes.data) setPayments(pRes.data.items || [])
      if (sessRes.success && sessRes.data) setSessions(sessRes.data || [])
      if (dRes.success && dRes.data) setDebtReport(dRes.data || [])
    } catch (err) {
      console.error('Failed to load report data:', err)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Revenue chart grouped by billing period / month
  const revenueByMonth = payments
    .filter(p => p.status === 'paid' && p.paymentType === 'credit')
    .reduce((acc: Record<string, number>, p) => {
      const m = p.billingPeriod || p.paymentDate?.substring(0, 7) || '2026-08'
      acc[m] = (acc[m] || 0) + p.amount
      return acc
    }, {})

  const chartData = Object.entries(revenueByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({ month, revenue }))

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Revenue Graph Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">مداخيل الاشتراكات حسب الأشهر</h3>
            <p className="text-xs text-slate-400 mt-0.5">تطور المداخيل المحصلة (دج)</p>
          </div>
          <button
            onClick={loadData}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <Tooltip
                formatter={(val: any) => [`${Number(val).toLocaleString('ar-DZ')} دج`, 'المداخيل']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }}
              />
              <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-2 gap-4">
        {reports.map(r => (
          <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <FileText size={18} />
                </div>
                <h4 className="text-sm font-bold text-slate-900">{r.title}</h4>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed pr-8">{r.description}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t border-slate-100">
              <button
                onClick={() => setPreviewId(r.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <Eye size={13} /> معاينة وطباعة
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Report Preview Modal */}
      <Modal
        open={previewId !== null}
        onClose={() => setPreviewId(null)}
        title={reports.find(r => r.id === previewId)?.title || 'معاينة التقرير'}
        size="lg"
      >
        <div className="space-y-4 max-h-[70vh] flex flex-col" dir="rtl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs text-slate-500">
              تاريخ استخراج التقرير: {new Date().toLocaleDateString('ar-DZ')}
            </span>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
            >
              <Printer size={13} /> طباعة
            </button>
          </div>

          <div className="overflow-auto flex-1 text-xs">
            {previewId === 'students' && (
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-2 font-bold">الرقم</th>
                    <th className="p-2 font-bold">الاسم واللقب</th>
                    <th className="p-2 font-bold">الهاتف</th>
                    <th className="p-2 font-bold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map(s => (
                    <tr key={s.id}>
                      <td className="p-2 font-mono">{s.studentNumber}</td>
                      <td className="p-2 font-semibold">{s.lastNameAr || s.lastNameFr} {s.firstNameAr || s.firstNameFr}</td>
                      <td className="p-2 font-mono">{s.phone || '—'}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                          {s.status === 'active' ? 'نشط' : 'غير نشط'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {previewId === 'revenue' && (
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-2 font-bold">رقم الوصل</th>
                    <th className="p-2 font-bold">النوع</th>
                    <th className="p-2 font-bold">المبلغ</th>
                    <th className="p-2 font-bold">طريقة الدفع</th>
                    <th className="p-2 font-bold">التاريخ</th>
                    <th className="p-2 font-bold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map(p => {
                    const typeInfo = PAYMENT_TYPE_LABELS[p.paymentType] || { label: p.paymentType, isCredit: true }
                    const isCancelled = p.status === 'cancelled'

                    return (
                      <tr key={p.id} className={isCancelled ? 'opacity-50 line-through' : ''}>
                        <td className="p-2 font-mono text-blue-700">{p.receiptNumber}</td>
                        <td className="p-2 font-medium">{typeInfo.label}</td>
                        <td className={`p-2 font-bold ${typeInfo.isCredit ? 'text-green-700' : 'text-red-600'}`}>
                          {typeInfo.isCredit ? '+' : '-'}{p.amount?.toLocaleString('ar-DZ')} دج
                        </td>
                        <td className="p-2">{p.paymentMethod === 'cash' ? 'نقداً' : p.paymentMethod === 'transfer' ? 'تحويل' : 'شيك'}</td>
                        <td className="p-2 font-mono">{p.paymentDate}</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${isCancelled ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            {isCancelled ? 'ملغى' : 'مؤكد'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {previewId === 'outstanding' && (
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-2 font-bold">الطالب</th>
                    <th className="p-2 font-bold">الهاتف</th>
                    <th className="p-2 font-bold">المجموعة</th>
                    <th className="p-2 font-bold">المبلغ المستحق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {debtReport.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-400">لا توجد ديون مستحقة مسجلة</td>
                    </tr>
                  ) : (
                    debtReport.map((d, i) => (
                      <tr key={i}>
                        <td className="p-2 font-semibold">{d.studentName}</td>
                        <td className="p-2 font-mono">{d.phone || '—'}</td>
                        <td className="p-2">{d.groupName || '—'}</td>
                        <td className="p-2 font-bold text-red-600">{Number(d.debtAmount || d.balance || 0).toLocaleString('ar-DZ')} دج</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {previewId === 'groups' && (
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-2 font-bold">اسم الفوج</th>
                    <th className="p-2 font-bold">القاعة</th>
                    <th className="p-2 font-bold">السعر الشهري</th>
                    <th className="p-2 font-bold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groups.map(g => (
                    <tr key={g.id}>
                      <td className="p-2 font-semibold">{g.name}</td>
                      <td className="p-2">{g.room || 'القاعة الرئيسية'}</td>
                      <td className="p-2 font-bold">{g.monthlyPrice?.toLocaleString('ar-DZ')} دج</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${g.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                          {g.status === 'active' ? 'نشط' : 'غير نشط'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {previewId === 'attendance' && (
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-2 font-bold">التاريخ</th>
                    <th className="p-2 font-bold">الفوج</th>
                    <th className="p-2 font-bold">الحالة</th>
                    <th className="p-2 font-bold">نوع الحصة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.map(s => (
                    <tr key={s.id}>
                      <td className="p-2 font-mono">{s.sessionDate}</td>
                      <td className="p-2 font-semibold">{s.groupName || `فوج #${s.groupId}`}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.status === 'open' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                          {s.status === 'open' ? 'مفتوحة' : 'مغلقة'}
                        </span>
                      </td>
                      <td className="p-2">{s.sessionType === 'cancelled' ? 'ملغاة' : 'عادية'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              onClick={() => setPreviewId(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
