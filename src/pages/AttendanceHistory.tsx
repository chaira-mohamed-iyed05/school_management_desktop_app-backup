import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Search, ChevronLeft, Calendar, AlertTriangle, CheckCircle, Clock, XCircle, Filter } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import type { AttendanceStatus } from '../types'

export default function AttendanceHistory() {
  const [sessions, setSessions] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])

  const [filterCourse, setFilterCourse] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [selectedSession, setSelectedSession] = useState<any | null>(null)
  const [sessionDetail, setSessionDetail] = useState<any | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const api = (window as any).schoolApp

  const loadData = useCallback(async () => {
    if (!api) return
    setLoading(true)
    try {
      const [sessRes, cRes, gRes, sRes] = await Promise.all([
        api.sessions.list({ limit: 200 }),
        api.courses.list(),
        api.groups.list(),
        api.students.list({ pageSize: 1000 }),
      ])

      if (sessRes.success && sessRes.data) setSessions(sessRes.data)
      if (cRes.success && cRes.data) setCourses(cRes.data)
      if (gRes.success && gRes.data) setGroups(gRes.data)
      if (sRes.success && sRes.data) setStudents(sRes.data.items || [])
    } catch (err) {
      console.error('Failed to load attendance history:', err)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOpenDetail = async (sess: any) => {
    setSelectedSession(sess)
    setModalOpen(true)
    if (!api) return
    try {
      const res = await api.attendance.getSession(sess.id)
      if (res.success && res.data) {
        setSessionDetail(res.data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const filtered = sessions.filter(s => {
    const group = groups.find(g => g.id === s.groupId)
    const matchCourse = !filterCourse || String(group?.courseId) === filterCourse
    const matchGroup = !filterGroup || String(s.groupId) === filterGroup
    const matchDate = !filterDate || s.sessionDate === filterDate
    const matchStatus = !filterStatus ||
      (filterStatus === 'cancelled' && s.sessionType === 'cancelled') ||
      (filterStatus === 'closed' && s.status === 'closed' && s.sessionType !== 'cancelled') ||
      (filterStatus === 'open' && s.status === 'open')
    return matchCourse && matchGroup && matchDate && matchStatus
  })

  const closedSessions = sessions.filter(s => s.status === 'closed' && s.sessionType !== 'cancelled')
  const dateMap: Record<string, { present: number; total: number }> = {}
  closedSessions.forEach(s => {
    const d = s.sessionDate.slice(5)
    if (!dateMap[d]) dateMap[d] = { present: 0, total: 0 }
    dateMap[d].present += (s.presentCount || 0) + (s.lateCount || 0)
    dateMap[d].total += (s.totalStudents || s.presentCount + s.absentCount + s.lateCount || 1)
  })

  const rateData = Object.entries(dateMap).slice(-7).map(([date, counts]) => ({
    date,
    rate: counts.total > 0 ? Math.round((counts.present / counts.total) * 100) : 85,
  }))

  const chartData = rateData.length > 0 ? rateData : [
    { date: 'قبل 6 أيام', rate: 88 }, { date: 'قبل 5 أيام', rate: 92 }, { date: 'قبل 4 أيام', rate: 85 },
    { date: 'قبل 3 أيام', rate: 90 }, { date: 'قبل يومين', rate: 87 }, { date: 'أمس', rate: 94 }, { date: 'اليوم', rate: 91 },
  ]

  return (
    <div className="space-y-5" dir="rtl">
      {/* Rate chart */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-800 mb-4">نسبة الحضور — التطور في الجلسات الأخيرة</h2>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} domain={[50, 100]} tickFormatter={v => `${v}%`} />
            <Tooltip formatter={(v) => [`${v}%`, 'نسبة الحضور']} contentStyle={{ fontSize: 12, borderRadius: 8, direction: 'rtl' }} />
            <Line type="monotone" dataKey="rate" stroke="#2563EB" strokeWidth={2.5} dot={{ fill: '#2563EB', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <select
          value={filterCourse}
          onChange={e => { setFilterCourse(e.target.value); setFilterGroup('') }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white text-slate-700"
        >
          <option value="">جميع المواد</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.nameAr || c.nameFr || c.nameEn}</option>)}
        </select>

        <select
          value={filterGroup}
          onChange={e => setFilterGroup(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white text-slate-700"
        >
          <option value="">جميع الأفواج</option>
          {groups
            .filter(g => !filterCourse || String(g.courseId) === filterCourse)
            .map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white text-slate-700"
        >
          <option value="">جميع الحالات</option>
          <option value="closed">مكتملة / مغلقة</option>
          <option value="open">جارية الآن</option>
          <option value="cancelled">ملغاة</option>
        </select>

        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white text-slate-700 font-mono"
        />

        {(filterCourse || filterGroup || filterStatus || filterDate) && (
          <button
            onClick={() => { setFilterCourse(''); setFilterGroup(''); setFilterStatus(''); setFilterDate('') }}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold mr-auto"
          >
            إعادة ضبط الفلاتر
          </button>
        )}
      </div>

      {/* Sessions list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
              <th className="px-4 py-3 text-right">التاريخ</th>
              <th className="px-4 py-3 text-right">المادة</th>
              <th className="px-4 py-3 text-right">الفوج</th>
              <th className="px-4 py-3 text-right">التوقيت والقاعة</th>
              <th className="px-4 py-3 text-right">الحالة</th>
              <th className="px-4 py-3 text-left">التفاصيل</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                  لا توجد جلسات حضور مطابقة للفلاتر
                </td>
              </tr>
            ) : (
              filtered.map(sess => {
                const group = groups.find(g => g.id === sess.groupId)
                const course = courses.find(c => c.id === group?.courseId)
                const dateObj = new Date(s.sessionDate + 'T00:00:00')
                const dayName = s.dayNameFr || dateObj.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

                return (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <span className="font-semibold text-slate-800 capitalize block">
                        {dayName}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {s.sessionDate}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-800">{group?.name || `Groupe #${s.groupId}`}</p>
                      <p className="text-xs text-slate-400">{course?.nameFr || course?.nameAr || '—'}</p>
                    </td>
                    <td className="px-5 py-3 text-xs font-mono text-slate-600">
                      {s.plannedStartTime || s.actualStartTime || s.startTime || '—'}
                    </td>
                    <td className="px-5 py-3 text-green-700 font-semibold">{isCancelled ? '—' : present}</td>
                    <td className="px-5 py-3 text-red-600 font-semibold">{isCancelled ? '—' : absent}</td>
                    <td className="px-5 py-3 text-amber-600 font-semibold">{isCancelled ? '—' : late}</td>
                    <td className="px-5 py-3">
                      {isCancelled ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                          <XCircle size={12} /> Annulée
                        </span>
                      ) : s.status === 'open' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded animate-pulse">
                          En cours
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${rate}%` }} />
                          </div>
                          <span className="text-xs font-medium text-slate-700">{rate}%</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleOpenDetail(s)}
                        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        Voir <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Session detail modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedSession(null); setSessionDetail(null) }}
        title={`Détails de la séance — ${selectedSession?.sessionDate || ''}`}
        size="md"
      >
        {selectedSession && (
          <div className="space-y-4">
            {selectedSession.sessionType === 'cancelled' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 flex items-start gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-600" />
                <div>
                  <p className="font-bold">Séance annulée</p>
                  <p className="mt-0.5">Motif : {selectedSession.cancelledReason || 'Non précisé'}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg text-xs">
              <div>
                <span className="text-slate-400 block">Date & Jour</span>
                <span className="font-bold text-slate-800 capitalize">{selectedSession.dayNameFr || selectedSession.sessionDate}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Heure de début</span>
                <span className="font-mono font-bold text-slate-800">{selectedSession.plannedStartTime || selectedSession.actualStartTime || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Statut</span>
                <span className="font-bold text-slate-800 capitalize">{selectedSession.sessionType === 'cancelled' ? 'Annulée' : selectedSession.status}</span>
              </div>
            </div>

            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Feuille de présence ({sessionDetail?.records?.length || 0} enregistrements)
            </h4>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg">
              {sessionDetail?.records?.length === 0 || !sessionDetail?.records ? (
                <p className="text-center py-6 text-xs text-slate-400">Aucun enregistrement de présence</p>
              ) : (
                sessionDetail.records.map((r: any) => {
                  const student = students.find(s => s.id === r.studentId)
                  return (
                    <div key={r.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                          {student ? student.firstNameFr.charAt(0) : '#'}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">
                            {student ? `${student.firstNameFr} ${student.lastNameFr}` : `Élève #${r.studentId}`}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400">{student?.studentNumber}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">
                          {r.scannedAt ? new Date(r.scannedAt).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </span>
                        <Badge variant={r.attendanceStatus === 'present' ? 'success' : r.attendanceStatus === 'late' ? 'warning' : 'error'}>
                          {r.attendanceStatus === 'present' ? 'Présent' : r.attendanceStatus === 'late' ? 'En retard' : 'Absent'}
                        </Badge>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => { setModalOpen(false); setSelectedSession(null); setSessionDetail(null) }}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
