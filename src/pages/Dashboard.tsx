import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Users, TrendingUp, Plus, ScanLine, CreditCard, BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'

export default function Dashboard() {
  const navigate = useNavigate()
  const [students, setStudents] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [todaySessions, setTodaySessions] = useState<any[]>([])
  const [summary, setSummary] = useState({ monthRevenue: 0, todayCollected: 0, outstanding: 0, overdue: 0 })
  const [loading, setLoading] = useState(true)

  const api = (window as any).schoolApp

  const loadDashboardData = useCallback(async () => {
    if (!api) return
    setLoading(true)
    try {
      const [sRes, cRes, gRes, pRes, sessRes, sumRes] = await Promise.all([
        api.students.list({ pageSize: 500 }),
        api.courses.list(),
        api.groups.list(),
        api.payments.list({ pageSize: 500 }),
        api.sessions.upcoming ? api.sessions.upcoming(10) : api.sessions.list({ limit: 10 }),
        api.payments.summary ? api.payments.summary() : Promise.resolve({ success: false }),
      ])

      if (sRes.success && sRes.data) setStudents(sRes.data.items || [])
      if (cRes.success && cRes.data) setCourses(cRes.data || [])
      if (gRes.success && gRes.data) setGroups(gRes.data || [])
      if (pRes.success && pRes.data) setPayments(pRes.data.items || [])
      if (sessRes.success && sessRes.data) setTodaySessions(sessRes.data || [])
      if (sumRes.success && sumRes.data) setSummary(sumRes.data)
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const activeStudents = students.filter(s => s.status === 'active').length

  // Monthly revenue chart grouping
  const revenueByMonth = payments
    .filter(p => p.status === 'paid' && p.paymentType === 'credit')
    .reduce((acc: Record<string, number>, p) => {
      const m = p.billingPeriod || p.paymentDate?.substring(0, 7) || '2026-08'
      acc[m] = (acc[m] || 0) + p.amount
      return acc
    }, {})

  const monthlyRevenueData = Object.entries(revenueByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({ month, revenue }))

  return (
    <div className="space-y-6" dir="rtl">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="الطلاب النشطون"
          value={activeStudents}
          change={`إجمالي المسجلين: ${students.length}`}
          changePositive={true}
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="الأفواج والمجموعات"
          value={groups.length}
          change={`${courses.length} مواد تعليمية`}
          changePositive={true}
          icon={BookOpen}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
        />
        <StatCard
          title="مداخيل هذا الشهر"
          value={`${summary.monthRevenue.toLocaleString('ar-DZ')} دج`}
          change="مداخيل الاشتراكات"
          changePositive={true}
          icon={TrendingUp}
          iconColor="text-teal-600"
          iconBg="bg-teal-50"
        />
        <StatCard
          title="المحصل اليوم"
          value={`${summary.todayCollected.toLocaleString('ar-DZ')} دج`}
          icon={CreditCard}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
      </div>

      {/* Financial Chart row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 mb-4">المداخيل الشهرية (دج)</h2>
          {monthlyRevenueData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400">
              لا توجد بيانات مدفوعات حالياً لعرضها في الرسم البياني
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [`${Number(v).toLocaleString('ar-DZ')} دج`, 'المداخيل']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0', direction: 'rtl' }} />
                <Line type="monotone" dataKey="revenue" stroke="#14B8A6" strokeWidth={2.5} dot={{ fill: '#14B8A6', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Today's upcoming sessions */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">الحصص والجلسات</h2>
            <button onClick={() => navigate('/attendance')} className="text-xs text-blue-600 hover:text-blue-800 font-medium">تسجيل الحضور ←</button>
          </div>
          <div className="divide-y divide-slate-50 flex-1 overflow-y-auto max-h-56">
            {todaySessions.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">لا توجد حصص مبرمجة حالياً</div>
            ) : (
              todaySessions.map((sess: any) => {
                const grp = groups.find(g => g.id === sess.groupId)
                return (
                  <div key={sess.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 transition-colors">
                    <span className="text-xs font-mono font-semibold text-blue-700 w-16 shrink-0">{sess.startTime || '09:00'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{grp?.name || `فوج #${sess.groupId}`}</p>
                      <p className="text-xs text-slate-400 truncate">{sess.sessionDate} · {sess.room || 'القاعة الرئيسية'}</p>
                    </div>
                    <Badge variant={sess.status === 'open' ? 'warning' : sess.status === 'completed' ? 'success' : 'neutral'}>
                      {sess.status === 'open' ? 'جارية' : sess.status === 'completed' ? 'مكتملة' : 'مبرمجة'}
                    </Badge>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800 mb-3">إجراءات سريعة</h2>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: 'إضافة طالب', icon: Plus, to: '/students/new', color: 'bg-blue-600 hover:bg-blue-700' },
            { label: 'تسجيل الحضور', icon: ScanLine, to: '/attendance', color: 'bg-teal-600 hover:bg-teal-700' },
            { label: 'تسجيل دفعة جديدة', icon: CreditCard, to: '/payments', color: 'bg-green-600 hover:bg-green-700' },
            { label: 'إدارة المواد والأفواج', icon: BookOpen, to: '/courses', color: 'bg-indigo-600 hover:bg-indigo-700' },
          ].map(a => (
            <button
              key={a.label}
              onClick={() => navigate(a.to)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm ${a.color}`}
            >
              <a.icon size={15} /> {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
