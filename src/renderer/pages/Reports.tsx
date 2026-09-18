import { useEffect, useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Printer, Download, Eye, X, Users, CreditCard, CalendarCheck, TrendingUp, CalendarDays, Ban, AlertTriangle, RotateCcw } from 'lucide-react'
import type { AttendanceSession, Payment, Student, SchoolSettings, Group, Course, Teacher } from '@shared/types/index'

type ReportType = 'students' | 'attendance' | 'payments' | 'revenue' | 'group_sessions'

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

export default function Reports() {
  const { t, i18n } = useTranslation()
  const isRTL = i18n.language === 'ar'
  const [reportType, setReportType] = useState<ReportType>('students')
  const [fromDate, setFromDate] = useState(formatDateInput(new Date(new Date().setMonth(new Date().getMonth() - 1))))
  const [toDate, setToDate] = useState(formatDateInput(new Date()))

  const [students, setStudents] = useState<Student[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null)
  const [groupsList, setGroupsList] = useState<Group[]>([])
  const [coursesList, setCoursesList] = useState<Course[]>([])
  const [teachersList, setTeachersList] = useState<Teacher[]>([])

  // Cascading filters for group sessions report
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [groupReportData, setGroupReportData] = useState<any | null>(null)
  const [groupReportLoading, setGroupReportLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)

  const reportOptions = useMemo(() => [
    { id: 'students' as const, label: t('reports.students'), description: t('reports.studentsDesc') },
    { id: 'attendance' as const, label: t('reports.attendance'), description: t('reports.attendanceDesc') },
    { id: 'payments' as const, label: t('reports.payments'), description: t('reports.paymentsDesc') },
    { id: 'revenue' as const, label: t('reports.revenue'), description: t('reports.revenueDesc') },
    { id: 'group_sessions' as const, label: t('reports.groupSessions'), description: t('reports.groupSessionsDesc') },
  ], [t])

  const loadGroupReport = useCallback(async (groupId: number) => {
    if (!groupId) return
    setGroupReportLoading(true)
    try {
      const res = await window.schoolApp.attendance.groupSessionsReport(groupId)
      const data = (res as any)?.data ?? res
      if (data && data.group) {
        setGroupReportData(data)
      } else {
        setGroupReportData(null)
      }
    } catch (err) {
      console.error('Failed to load group sessions report:', err)
      setGroupReportData(null)
    } finally {
      setGroupReportLoading(false)
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [stRes, payRes, sessRes, setRes, grpRes, crsRes, tchRes] = await Promise.all([
        window.schoolApp.students.list({ pageSize: 100, status: 'all' }),
        window.schoolApp.payments.list({ pageSize: 100 }),
        window.schoolApp.attendance.listSessions({ limit: 100 }),
        window.schoolApp.settings.get(),
        window.schoolApp.groups.list(),
        window.schoolApp.courses.list(),
        window.schoolApp.teachers.list(),
      ])
      if (stRes.success && stRes.data) setStudents(stRes.data.items ?? [])
      if (payRes.success && payRes.data) setPayments(payRes.data.items ?? [])
      if (sessRes.success && sessRes.data) setSessions(sessRes.data ?? [])
      if (setRes.success && setRes.data) setSchoolSettings(setRes.data)
      if (crsRes.success && crsRes.data) setCoursesList(crsRes.data ?? [])
      if (tchRes.success && tchRes.data) setTeachersList(tchRes.data ?? [])
      if (grpRes.success && grpRes.data) {
        const grps = grpRes.data ?? []
        setGroupsList(grps)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ─── Cascading Handlers (Module -> Teacher -> Group) ───
  const handleCourseChange = (courseId: number | null) => {
    setSelectedCourseId(courseId)
    if (!courseId) {
      // If course is cleared and current group doesn't match selected teacher, clear it
      if (selectedGroupId && selectedTeacherId) {
        const grp = groupsList.find(g => g.id === selectedGroupId)
        if (grp && grp.teacherId !== selectedTeacherId) {
          setSelectedGroupId(null)
          setGroupReportData(null)
        }
      }
      return
    }

    // If a teacher is selected, check if they are associated with this course
    if (selectedTeacherId) {
      const tch = teachersList.find(t => t.id === selectedTeacherId)
      const tchHasGroupInCourse = groupsList.some(g => g.teacherId === selectedTeacherId && g.courseId === courseId)
      if (tch && tch.courseId !== courseId && !tchHasGroupInCourse) {
        setSelectedTeacherId(null)
      }
    }

    // If current group does not belong to new course, clear it
    if (selectedGroupId) {
      const grp = groupsList.find(g => g.id === selectedGroupId)
      if (grp && grp.courseId !== courseId) {
        setSelectedGroupId(null)
        setGroupReportData(null)
      }
    }
  }

  const handleTeacherChange = (teacherId: number | null) => {
    setSelectedTeacherId(teacherId)
    if (!teacherId) {
      if (selectedGroupId && selectedCourseId) {
        const grp = groupsList.find(g => g.id === selectedGroupId)
        if (grp && grp.courseId !== selectedCourseId) {
          setSelectedGroupId(null)
          setGroupReportData(null)
        }
      }
      return
    }

    const tch = teachersList.find(t => t.id === teacherId)
    // Auto-fill module if teacher has courseId or groups in a specific course
    if (tch?.courseId) {
      setSelectedCourseId(tch.courseId)
    } else {
      const tchGroup = groupsList.find(g => g.teacherId === teacherId && g.courseId)
      if (tchGroup) {
        setSelectedCourseId(tchGroup.courseId)
      }
    }

    // If currently selected group doesn't belong to this teacher, clear it
    if (selectedGroupId) {
      const grp = groupsList.find(g => g.id === selectedGroupId)
      if (grp && grp.teacherId !== teacherId) {
        setSelectedGroupId(null)
        setGroupReportData(null)
      }
    }
  }

  const handleGroupChange = (groupId: number | null) => {
    setSelectedGroupId(groupId)
    if (!groupId) {
      setGroupReportData(null)
      return
    }

    const grp = groupsList.find(g => g.id === groupId)
    if (grp) {
      // Auto-fill teacher
      if (grp.teacherId) {
        setSelectedTeacherId(grp.teacherId)
      }
      // Auto-fill module
      if (grp.courseId) {
        setSelectedCourseId(grp.courseId)
      } else if (grp.teacherId) {
        const tch = teachersList.find(t => t.id === grp.teacherId)
        if (tch?.courseId) setSelectedCourseId(tch.courseId)
      }

      loadGroupReport(groupId)
    }
  }

  const handleResetFilters = () => {
    setSelectedCourseId(null)
    setSelectedTeacherId(null)
    setSelectedGroupId(null)
    setGroupReportData(null)
  }

  // Filtered dropdown options
  const availableTeachers = useMemo(() => {
    if (!selectedCourseId) return teachersList
    return teachersList.filter(t => {
      if (t.courseId === selectedCourseId) return true
      return groupsList.some(g => g.teacherId === t.id && g.courseId === selectedCourseId)
    })
  }, [teachersList, selectedCourseId, groupsList])

  const availableGroups = useMemo(() => {
    return groupsList.filter(g => {
      if (selectedCourseId && g.courseId !== selectedCourseId) return false
      if (selectedTeacherId && g.teacherId !== selectedTeacherId) return false
      return true
    })
  }, [groupsList, selectedCourseId, selectedTeacherId])

  useEffect(() => {
    if (selectedGroupId && reportType === 'group_sessions') {
      loadGroupReport(selectedGroupId)
    }
  }, [selectedGroupId, reportType, loadGroupReport])

  useEffect(() => {
    const onFocus = () => {
      if (selectedGroupId && reportType === 'group_sessions') {
        loadGroupReport(selectedGroupId)
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [selectedGroupId, reportType, loadGroupReport])

  const filteredStudents = useMemo(() => students, [students])

  const filteredPayments = useMemo(() => {
    const from = new Date(fromDate)
    const to = new Date(toDate)
    to.setHours(23, 59, 59, 999)
    return payments.filter((p) => {
      if (!p.paymentDate) return false
      const d = new Date(p.paymentDate)
      return d >= from && d <= to
    })
  }, [payments, fromDate, toDate])

  const filteredSessions = useMemo(() => {
    const from = new Date(fromDate)
    const to = new Date(toDate)
    to.setHours(23, 59, 59, 999)
    return sessions.filter((s) => {
      if (!s.sessionDate) return false
      const d = new Date(s.sessionDate)
      return d >= from && d <= to
    })
  }, [sessions, fromDate, toDate])

  const revenueTotal = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  }, [filteredPayments])

  const revenueByMonth = useMemo(() => {
    return filteredPayments.reduce<Record<string, number>>((acc, p) => {
      const m = (p.paymentDate || '').slice(0, 7)
      if (m) {
        const amt = Number(p.amount) || 0
        acc[m] = (acc[m] ?? 0) + amt
      }
      return acc
    }, {})
  }, [filteredPayments])

  const maleCount = useMemo(() => students.filter(s => s.gender === 'male').length, [students])
  const femaleCount = useMemo(() => students.filter(s => s.gender === 'female').length, [students])

  const handlePrint = async () => {
    await window.schoolApp.app.print()
  }

  const handleExportPdf = async () => {
    setExporting(true)
    setExportMessage(null)
    try {
      const res = await window.schoolApp.app.printToPdf({
        pageSize: 'A4',
        marginsType: 0,
        filename: `Rapport-${reportType}-${fromDate}-au-${toDate}.pdf`,
      })
      if (res.success && res.data?.path) {
        setExportMessage(`${t('common.success')}: ${res.data.path}`)
      } else if (!res.success) {
        setExportMessage(`${t('common.error')}: ${res.error}`)
      }
    } finally {
      setExporting(false)
    }
  }



  const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20'
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1'

  /* ── Full Printable Report Document Component ── */
  const ReportDocument = () => (
    <div className="report-print-sheet bg-white text-[#0F172A] p-8 max-w-4xl mx-auto">
      {/* Document Header */}
      <div className="border-b-2 border-[#0F172A] pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">
              {(schoolSettings?.schoolNameFr && !/edupilot/i.test(schoolSettings.schoolNameFr)) ? schoolSettings.schoolNameFr : (schoolSettings?.schoolNameAr || '')}
            </h1>
            <p className="text-sm font-bold text-slate-700" dir="rtl">
              {schoolSettings?.schoolNameAr || ''}
            </p>
            {schoolSettings?.address && (
              <p className="text-xs text-slate-500 mt-1">{schoolSettings.address}</p>
            )}
            {schoolSettings?.phone && (
              <p className="text-xs text-slate-500">{t('common.phone')}: {schoolSettings.phone}</p>
            )}
          </div>
          <div className="text-end">
            <div className="inline-block bg-slate-100 text-slate-800 px-3 py-1 rounded text-xs font-bold uppercase tracking-wider mb-1">
              {t('reports.officialDocument')}
            </div>
            <p className="text-xs text-slate-500">{t('reports.academicYearLabel')} {schoolSettings?.academicYear || '2025-2026'}</p>
            <p className="text-xs text-slate-500">{t('reports.issueDate')} {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-[#2563EB] uppercase tracking-wide">
              {reportOptions.find(o => o.id === reportType)?.label}
            </h2>
            {reportType === 'group_sessions' && groupReportData ? (
              <p className="text-xs text-slate-700 font-semibold mt-0.5">
                {t('attendance.group')}: <span className="text-[#2563EB]">{groupReportData.group.name}</span>
                {groupReportData.group.courseNameAr ? ` • ${groupReportData.group.courseNameAr}` : ''}
                {groupReportData.group.teacherName ? ` • ${groupReportData.group.teacherName}` : ''}
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                {t('reports.periodFrom')} <span className="font-semibold">{fromDate}</span> {t('reports.to')} <span className="font-semibold">{toDate}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Summary KPI Badges */}
      {reportType === 'group_sessions' ? (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
            <span className="block text-xs text-slate-500 font-medium">{t('reports.closedSessions')}</span>
            <span className="text-xl font-bold text-[#0F172A]">{groupReportData?.metrics?.totalSessions ?? 0}</span>
          </div>
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-center">
            <span className="block text-xs text-blue-700 font-medium">{t('reports.totalStudents')}</span>
            <span className="text-xl font-bold text-blue-800">{groupReportData?.metrics?.totalStudents ?? 0}</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-center">
            <span className="block text-xs text-emerald-700 font-medium">{t('reports.groupAttendanceRate')}</span>
            <span className="text-xl font-bold text-emerald-800">{groupReportData?.metrics?.attendanceRate ?? 0}%</span>
          </div>
          <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg text-center">
            <span className="block text-xs text-purple-700 font-medium">{t('reports.sessionDeduction')}</span>
            <span className="text-xl font-bold text-purple-800">{(groupReportData?.metrics?.totalDeductions ?? 0).toLocaleString()} DZD</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {reportType === 'students' && (
            <>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                <span className="block text-xs text-slate-500 font-medium">{t('reports.totalStudents')}</span>
                <span className="text-xl font-bold text-[#0F172A]">{students.length}</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                <span className="block text-xs text-slate-500 font-medium">{t('reports.boys')}</span>
                <span className="text-xl font-bold text-blue-600">{maleCount}</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                <span className="block text-xs text-slate-500 font-medium">{t('reports.girls')}</span>
                <span className="text-xl font-bold text-pink-600">{femaleCount}</span>
              </div>
            </>
          )}

          {reportType === 'payments' && (
            <>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                <span className="block text-xs text-slate-500 font-medium">{t('reports.totalPayments')}</span>
                <span className="text-xl font-bold text-[#0F172A]">{filteredPayments.length}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-center col-span-2">
                <span className="block text-xs text-emerald-700 font-medium">{t('reports.totalCollected')}</span>
                <span className="text-2xl font-bold text-emerald-800">{revenueTotal.toLocaleString()} DZD</span>
              </div>
            </>
          )}

          {reportType === 'revenue' && (
            <>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                <span className="block text-xs text-slate-500 font-medium">{t('reports.monthsCount')}</span>
                <span className="text-xl font-bold text-[#0F172A]">{Object.keys(revenueByMonth).length}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-center col-span-2">
                <span className="block text-xs text-emerald-700 font-medium">{t('reports.periodTotalRevenue')}</span>
                <span className="text-2xl font-bold text-emerald-800">{revenueTotal.toLocaleString()} DZD</span>
              </div>
            </>
          )}

          {reportType === 'attendance' && (
            <>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                <span className="block text-xs text-slate-500 font-medium">{t('reports.scheduledSessions')}</span>
                <span className="text-xl font-bold text-[#0F172A]">{filteredSessions.length}</span>
              </div>
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-center">
                <span className="block text-xs text-blue-700 font-medium">{t('reports.closedSessions')}</span>
                <span className="text-xl font-bold text-blue-800">{filteredSessions.filter(s => s.status === 'closed').length}</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-center">
                <span className="block text-xs text-amber-700 font-medium">{t('reports.openSessions')}</span>
                <span className="text-xl font-bold text-amber-800">{filteredSessions.filter(s => s.status === 'open').length}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Main Data Table */}
      <div className="border border-slate-300 rounded-lg overflow-x-auto mb-8">
        {reportType === 'students' && (
          <table className="w-full text-xs text-start min-w-150">
            <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
              <tr>
                <th className="p-2.5 text-start">{t('students.studentNumber')}</th>
                <th className="p-2.5 text-start">{t('students.nameArSection')}</th>
                <th className="p-2.5 text-start">{t('students.nameFrSection')}</th>
                <th className="p-2.5 text-start">{t('students.gender')}</th>
                <th className="p-2.5 text-start">{t('students.phone')}</th>
                <th className="p-2.5 text-start">{t('students.paymentStatusHeader')}</th>
                <th className="p-2.5 text-center">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredStudents.map((st: any, i) => (
                <tr key={st.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="p-2.5 font-mono font-bold text-[#2563EB]">{st.studentNumber}</td>
                  <td className="p-2.5 font-bold" dir="rtl">{st.lastNameAr} {st.firstNameAr}</td>
                  <td className="p-2.5">{st.lastNameFr} {st.firstNameFr}</td>
                  <td className="p-2.5">{st.gender === 'male' ? t('students.male') : t('students.female')}</td>
                  <td className="p-2.5 font-mono">{st.phone || '—'}</td>
                  <td className="p-2.5">
                    {(st.netBalance ?? 0) < 0 ? (
                      <span className="text-red-700 font-bold">
                        {t('students.inDebtWithAmount', { amount: Math.abs(st.netBalance ?? 0).toLocaleString() })}
                      </span>
                    ) : (st.netBalance ?? 0) > 0 ? (
                      <span className="text-emerald-700 font-bold">
                        {t('students.positiveBalance', { amount: (st.netBalance ?? 0).toLocaleString() })}
                      </span>
                    ) : (
                      <span className="text-slate-600">
                        {t('students.paidZeroDebt')}
                      </span>
                    )}
                  </td>
                  <td className="p-2.5 text-center">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800">
                      {t(`students.${st.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {reportType === 'payments' && (
          <table className="w-full text-xs text-start min-w-150">
            <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
              <tr>
                <th className="p-2.5 text-start">{t('payments.receiptNumber')}</th>
                <th className="p-2.5 text-start">{t('payments.date')}</th>
                <th className="p-2.5 text-start">{t('payments.student')}</th>
                <th className="p-2.5 text-start">{t('payments.billingPeriod')}</th>
                <th className="p-2.5 text-start">{t('payments.method')}</th>
                <th className="p-2.5 text-end">{t('payments.amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredPayments.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="p-2.5 font-mono font-bold text-[#2563EB]">{p.receiptNumber}</td>
                  <td className="p-2.5">{p.paymentDate}</td>
                  <td className="p-2.5 font-medium">{p.studentName || `#${p.studentId}`}</td>
                  <td className="p-2.5">{p.billingPeriod}</td>
                  <td className="p-2.5 capitalize">{t(`payments.${p.paymentMethod}`)}</td>
                  <td className="p-2.5 text-end font-bold text-[#0F172A]">{(Number(p.amount) || 0).toLocaleString()} DA</td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                <td colSpan={5} className="p-2.5 text-end">{t('payments.total')}:</td>
                <td className="p-2.5 text-end text-[#2563EB] text-sm">{revenueTotal.toLocaleString()} DA</td>
              </tr>
            </tbody>
          </table>
        )}

        {reportType === 'revenue' && (
          <table className="w-full text-xs text-start min-w-125">
            <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
              <tr>
                <th className="p-2.5 text-start">{t('payments.billingPeriod')}</th>
                <th className="p-2.5 text-end">{t('reports.totalPayments')}</th>
                <th className="p-2.5 text-end">{t('reports.periodTotalRevenue')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {Object.entries(revenueByMonth).map(([month, total], i) => (
                <tr key={month} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="p-2.5 font-bold">{month}</td>
                  <td className="p-2.5 text-end font-medium">
                    {filteredPayments.filter(p => p.paymentDate && p.paymentDate.startsWith(month)).length}
                  </td>
                  <td className="p-2.5 text-end font-bold text-emerald-700">{total.toLocaleString()} DA</td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                <td className="p-2.5">{t('payments.total')}</td>
                <td className="p-2.5 text-end">{filteredPayments.length}</td>
                <td className="p-2.5 text-end text-emerald-800 text-sm">{revenueTotal.toLocaleString()} DA</td>
              </tr>
            </tbody>
          </table>
        )}

        {reportType === 'attendance' && (
          <table className="w-full text-xs text-start min-w-125">
            <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
              <tr>
                <th className="p-2.5 text-start">{t('attendance.sessionId')}</th>
                <th className="p-2.5 text-start">{t('attendance.date')}</th>
                <th className="p-2.5 text-start">{t('attendance.group')}</th>
                <th className="p-2.5 text-start">{t('common.time')}</th>
                <th className="p-2.5 text-center">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredSessions.map((s, i) => (
                <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="p-2.5 font-mono">#{s.id}</td>
                  <td className="p-2.5 font-bold">{s.sessionDate}</td>
                  <td className="p-2.5">{s.groupName || `#${s.groupId}`}</td>
                  <td className="p-2.5">{s.actualStartTime || s.plannedStartTime || '—'} - {s.endTime || '—'}</td>
                  <td className="p-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.status === 'closed' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>
                      {s.status === 'closed' ? t('attendance.sessionClosed') : t('attendance.inProgress')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {reportType === 'group_sessions' && (
          <div>
            {!groupReportData || groupReportData.sessions.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                {t('reports.noClosedSessions')}
              </div>
            ) : (
              <table className="w-full text-[10px] text-start border-collapse">
                <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                  <tr>
                    <th className="p-2 text-start border-e border-slate-300 min-w-36">{t('reports.student')}</th>
                    {groupReportData.sessions.map((sess: any) => {
                      const isCancelled = sess.sessionType === 'cancelled'
                      return (
                        <th key={sess.id} className={`p-1.5 text-center border-e border-slate-300 ${isCancelled ? 'bg-rose-50' : ''}`}>
                          <div className={isCancelled ? 'text-rose-700 font-bold' : ''}>
                            {t('reports.sessionNumber')} {sess.sessionNumber}
                            {isCancelled && (
                              <span className="ms-1 text-[8px] bg-rose-200 text-rose-800 px-1 py-0.2 rounded font-bold">
                                {t('reports.cancelled')}
                              </span>
                            )}
                          </div>
                          <div className={`text-[9px] font-normal ${isCancelled ? 'line-through text-rose-500' : 'text-slate-500'}`}>
                            {sess.sessionDate}
                          </div>
                        </th>
                      )
                    })}
                    <th className="p-2 text-center min-w-24">الملخص</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {groupReportData.students.map((st: any, i: number) => (
                    <tr key={st.studentId} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="p-2 border-e border-slate-200">
                        <div className="font-bold">{st.lastNameAr} {st.firstNameAr}</div>
                        <div className="text-[9px] text-slate-500 font-mono">#{st.studentNumber}</div>
                        <div className="text-[8.5px] font-bold text-slate-700 mt-0.5">
                          {st.currentBalance > 0 ? `+${st.currentBalance.toLocaleString()} دج` : `${st.currentBalance.toLocaleString()} دج`}
                        </div>
                      </td>
                      {groupReportData.sessions.map((sess: any) => {
                        const sData = st.sessionData[sess.id] || { status: 'not_enrolled_yet', sessionDeduction: 0, runningBalance: 0 }
                        const isCancelled = sess.sessionType === 'cancelled' || sData.status === 'cancelled'
                        return (
                          <td key={sess.id} className={`p-1.5 text-center border-e border-slate-200 align-middle ${isCancelled ? 'bg-rose-50/40' : ''}`}>
                            <div className={`font-bold ${
                              isCancelled ? 'text-rose-700' :
                              sData.status === 'present' ? 'text-emerald-700' :
                              sData.status === 'absent' ? 'text-red-700' :
                              sData.status === 'not_active' ? 'text-amber-700' : 'text-slate-400'
                            }`}>
                              {isCancelled ? `⚠️ ${t('reports.cancelled')}` :
                               sData.status === 'present' ? 'حاضر ✓' :
                               sData.status === 'absent' ? 'غائب ✗' :
                               sData.status === 'not_active' ? 'غير نشط' : 'غير مسجل'}
                            </div>
                            <div className="text-[8.5px] font-mono text-slate-600 mt-0.5">
                              {sData.runningBalance > 0 ? `+${sData.runningBalance.toLocaleString()}` : sData.runningBalance.toLocaleString()} دج
                            </div>
                            {isCancelled ? (
                              <div className="text-[7.5px] font-medium text-rose-600">
                                ({t('reports.noDeductionCancelled')})
                              </div>
                            ) : sData.sessionDeduction > 0 ? (
                              <div className="text-[8px] font-mono text-slate-400">
                                (-{sData.sessionDeduction.toLocaleString()} دج)
                              </div>
                            ) : null}
                          </td>
                        )
                      })}
                      <td className="p-2 text-center font-bold">
                        <div>{st.summary.presentCount} / {st.summary.presentCount + st.summary.absentCount}</div>
                        <div className="text-[8.5px] text-purple-700 font-mono mt-0.5">{st.summary.totalDeductions.toLocaleString()} دج</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Document Signature Footer */}
      <div className="pt-6 border-t border-slate-300 grid grid-cols-2 text-xs">
        <div>
          <p className="text-slate-500 text-[10px]">{t('reports.autoGenerated')}</p>
          <p className="text-slate-500 text-[10px]">{t('reports.internalDoc')}</p>
        </div>
        <div className="text-end">
          <p className="font-bold text-slate-800 mb-10">{t('reports.signature')}</p>
          <div className="border-b border-dashed border-slate-400 w-48 ms-auto" />
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Dedicated Printable Document Container — Visible ONLY on print ── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .report-print-container,
          .report-print-container * { visibility: visible !important; }
          .report-print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10mm !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>

      {/* Hidden print element */}
      <div className="report-print-container" style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <ReportDocument />
      </div>

      {/* ── Screen UI ── */}
      <div className="animate-fade-in space-y-6 no-print">
        {/* Top Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">{t('nav.reports')}</h2>
            <p className="text-xs text-slate-400">{t('reports.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPreviewModal(true)}
              className="px-4 py-2 border border-border bg-white text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 shadow-xs"
            >
              <Eye size={14} /> {t('reports.previewDoc')}
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exporting}
              className="px-4 py-2 border border-[#2563EB] text-[#2563EB] rounded-lg text-xs font-semibold hover:bg-[#EFF6FF] flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download size={14} /> PDF
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-xs font-semibold hover:bg-[#1D4ED8] flex items-center gap-1.5 shadow-xs"
            >
              <Printer size={14} /> {t('common.print')}
            </button>
          </div>
        </div>

        {/* Filter and Control Panel */}
        <div className="bg-white rounded-xl border border-border p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {reportType === 'group_sessions' ? (
                <>
                  {/* Module (Course) Filter */}
                  <div className="min-w-44">
                    <label className={labelCls}>{t('reports.module')}</label>
                    <select
                      value={selectedCourseId ?? ''}
                      onChange={(e) => handleCourseChange(Number(e.target.value) || null)}
                      className={inputCls}
                    >
                      <option value="">{t('reports.allModules')}</option>
                      {coursesList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nameAr || c.nameFr}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Teacher Filter */}
                  <div className="min-w-44">
                    <label className={labelCls}>{t('reports.teacher')}</label>
                    <select
                      value={selectedTeacherId ?? ''}
                      onChange={(e) => handleTeacherChange(Number(e.target.value) || null)}
                      className={inputCls}
                    >
                      <option value="">{t('reports.allTeachers')}</option>
                      {availableTeachers.map((tItem) => (
                        <option key={tItem.id} value={tItem.id}>
                          {`${tItem.firstName || ''} ${tItem.lastName || ''}`.trim() || `#${tItem.id}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Group Filter */}
                  <div className="min-w-56">
                    <label className={labelCls}>{t('reports.selectGroup')}</label>
                    <select
                      value={selectedGroupId ?? ''}
                      onChange={(e) => handleGroupChange(Number(e.target.value) || null)}
                      className={inputCls}
                    >
                      <option value="">{t('reports.selectGroupPrompt')}</option>
                      {availableGroups.map((g) => {
                        const crs = coursesList.find(c => c.id === g.courseId)
                        const tch = teachersList.find(t => t.id === g.teacherId)
                        return (
                          <option key={g.id} value={g.id}>
                            {g.name} {crs?.nameAr ? `(${crs.nameAr})` : ''} {tch ? `- ${tch.firstName} ${tch.lastName}` : ''}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  {/* Clear Filters Button */}
                  {(selectedCourseId !== null || selectedTeacherId !== null || selectedGroupId !== null) && (
                    <div className="flex items-end pb-0.5">
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                        title={t('reports.clearFilters')}
                      >
                        <RotateCcw size={13} />
                        <span>{t('reports.clearFilters')}</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className={labelCls}>{t('reports.startDate')}</label>
                    <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputCls} dir="ltr" />
                  </div>
                  <div>
                    <label className={labelCls}>{t('reports.endDate')}</label>
                    <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputCls} dir="ltr" />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  loadData()
                  if (selectedGroupId) loadGroupReport(selectedGroupId)
                }}
                className="px-3.5 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs"
              >
                {t('common.refresh')}
              </button>
              <button
                onClick={() => setShowPreviewModal(true)}
                className="bg-[#2563EB] text-white py-2 px-4 rounded-lg text-xs font-semibold hover:bg-[#1D4ED8] flex items-center justify-center gap-1.5 transition-colors shadow-xs"
              >
                <Eye size={14} /> {t('reports.previewA4')}
              </button>
            </div>
          </div>

          {exportMessage && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs flex justify-between items-center">
              <span>{exportMessage}</span>
              <button onClick={() => setExportMessage(null)} className="text-blue-500 hover:text-blue-700">✕</button>
            </div>
          )}
        </div>

        {/* 5 Cards Grid of report types */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {reportOptions.map((opt) => {
            const isSelected = reportType === opt.id
            const Icon = opt.id === 'students' ? Users
              : opt.id === 'payments' ? CreditCard
              : opt.id === 'attendance' ? CalendarCheck
              : opt.id === 'revenue' ? TrendingUp
              : CalendarDays
            return (
              <div
                key={opt.id}
                onClick={() => setReportType(opt.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[#2563EB] bg-[#EFF6FF] ring-2 ring-[#2563EB]/10'
                    : 'border-border bg-white hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 font-bold ${
                  isSelected ? 'bg-[#2563EB] text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  <Icon size={18} />
                </div>
                <h3 className="font-bold text-sm text-[#0F172A] mb-0.5">{opt.label}</h3>
                <p className="text-xs text-slate-400">{opt.description}</p>
              </div>
            )
          })}
        </div>

        {/* Main On-Screen Table Preview Section */}
        <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="flex justify-between items-center p-4 border-b border-[#F1F5F9] bg-slate-50/50">
            <div>
              <h3 className="font-bold text-sm text-[#0F172A]">
                {reportOptions.find(o => o.id === reportType)?.label}
              </h3>
              <p className="text-xs text-slate-400">
                {reportType === 'students' ? `${students.length} ${t('reports.totalStudents')}` :
                 reportType === 'payments' ? `${filteredPayments.length} ${t('reports.totalPayments')} (${revenueTotal.toLocaleString()} DA)` :
                 reportType === 'revenue' ? `${t('payments.total')}: ${revenueTotal.toLocaleString()} DA` :
                 reportType === 'group_sessions' ? (
                   groupReportData
                     ? `${groupReportData.metrics?.totalSessions ?? 0} ${t('reports.closedSessions')} • ${groupReportData.metrics?.totalStudents ?? 0} ${t('reports.totalStudents')} • ${groupReportData.group?.name || ''}`
                     : t('reports.selectGroupPrompt')
                 ) :
                 `${filteredSessions.length} ${t('reports.scheduledSessions')}`}
              </p>
            </div>
            <button
              onClick={() => setShowPreviewModal(true)}
              className="px-3 py-1.5 bg-white border border-border text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Eye size={13} /> {t('reports.viewPrintFormat')}
            </button>
          </div>

          {/* Group Sessions KPI Summary Banner on Screen */}
          {reportType === 'group_sessions' && groupReportData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50/70 border-b border-border">
              <div className="bg-white p-3 rounded-xl border border-border shadow-2xs text-center">
                <span className="text-[11px] text-slate-500 font-medium block mb-0.5">{t('reports.closedSessions')}</span>
                <span className="text-lg font-bold text-[#0F172A]">{groupReportData.metrics.totalSessions}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-border shadow-2xs text-center">
                <span className="text-[11px] text-blue-600 font-medium block mb-0.5">{t('reports.totalStudents')}</span>
                <span className="text-lg font-bold text-blue-700">{groupReportData.metrics.totalStudents}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-border shadow-2xs text-center">
                <span className="text-[11px] text-emerald-600 font-medium block mb-0.5">{t('reports.groupAttendanceRate')}</span>
                <span className="text-lg font-bold text-emerald-700">{groupReportData.metrics.attendanceRate}%</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-border shadow-2xs text-center">
                <span className="text-[11px] text-purple-600 font-medium block mb-0.5">{t('reports.sessionDeduction')}</span>
                <span className="text-lg font-bold text-purple-700">{groupReportData.metrics.totalDeductions.toLocaleString()} DZD</span>
              </div>
            </div>
          )}

          <div className="p-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                {reportType === 'students' && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-border text-slate-500 font-semibold text-start">
                        <th className="p-3 text-start">{t('students.studentNumber')}</th>
                        <th className="p-3 text-start">{t('students.nameArSection')}</th>
                        <th className="p-3 text-start">{t('students.nameFrSection')}</th>
                        <th className="p-3 text-start">{t('students.gender')}</th>
                        <th className="p-3 text-start">{t('students.phone')}</th>
                        <th className="p-3 text-start">{t('students.paymentStatusHeader')}</th>
                        <th className="p-3 text-center">{t('common.status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students.map((st: any) => (
                        <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3 font-mono font-bold text-[#2563EB]">{st.studentNumber}</td>
                          <td className="p-3 font-medium text-[#0F172A]" dir="rtl">{st.lastNameAr} {st.firstNameAr}</td>
                          <td className="p-3 text-slate-600">{st.lastNameFr} {st.firstNameFr}</td>
                          <td className="p-3 text-slate-500">{st.gender === 'male' ? t('students.male') : t('students.female')}</td>
                          <td className="p-3 text-slate-500 font-mono">{st.phone ?? '—'}</td>
                          <td className="p-3">
                            {(st.netBalance ?? 0) < 0 ? (
                              <span className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200">
                                {t('students.inDebtWithAmount', { amount: Math.abs(st.netBalance ?? 0).toLocaleString() })}
                              </span>
                            ) : (st.netBalance ?? 0) > 0 ? (
                              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                {t('students.positiveBalance', { amount: (st.netBalance ?? 0).toLocaleString() })}
                              </span>
                            ) : (
                              <span className="text-slate-600 font-medium bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                {t('students.paidZeroDebt')}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold text-[10px]">
                              {t(`students.${st.status}`)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {reportType === 'payments' && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-border text-slate-500 font-semibold text-start">
                        <th className="p-3 text-start">{t('payments.receiptNumber')}</th>
                        <th className="p-3 text-start">{t('payments.date')}</th>
                        <th className="p-3 text-start">{t('payments.student')}</th>
                        <th className="p-3 text-start">{t('payments.billingPeriod')}</th>
                        <th className="p-3 text-start">{t('payments.method')}</th>
                        <th className="p-3 text-end">{t('payments.amount')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-[#2563EB]">{p.receiptNumber}</td>
                          <td className="p-3 text-slate-600">{p.paymentDate}</td>
                          <td className="p-3 font-medium">{p.studentName || `#${p.studentId}`}</td>
                          <td className="p-3 text-slate-600">{p.billingPeriod}</td>
                          <td className="p-3 text-slate-500 capitalize">{t(`payments.${p.paymentMethod}`)}</td>
                          <td className="p-3 text-end font-bold text-emerald-600">{(Number(p.amount) || 0).toLocaleString()} DZD</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {reportType === 'revenue' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center">
                      <div>
                        <p className="text-xs text-emerald-700 font-semibold">{t('reports.periodTotalRevenue')}</p>
                        <p className="text-2xl font-bold text-emerald-800 mt-1">{revenueTotal.toLocaleString()} DZD</p>
                      </div>
                      <span className="text-xs bg-emerald-200 text-emerald-800 px-2.5 py-1 rounded-full font-bold">
                        {filteredPayments.length} {t('reports.totalPayments')}
                      </span>
                    </div>

                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-border text-slate-500 font-semibold text-start">
                          <th className="p-3 text-start">{t('payments.billingPeriod')}</th>
                          <th className="p-3 text-end">{t('reports.totalPayments')}</th>
                          <th className="p-3 text-end">{t('reports.periodTotalRevenue')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Object.entries(revenueByMonth).map(([m, val]) => (
                          <tr key={m} className="hover:bg-slate-50">
                            <td className="p-3 font-bold">{m}</td>
                            <td className="p-3 text-end">{filteredPayments.filter(p => p.paymentDate && p.paymentDate.startsWith(m)).length}</td>
                            <td className="p-3 text-end font-bold text-emerald-700">{val.toLocaleString()} DZD</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {reportType === 'attendance' && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-border text-slate-500 font-semibold text-start">
                        <th className="p-3 text-start">{t('attendance.sessionId')}</th>
                        <th className="p-3 text-start">{t('attendance.date')}</th>
                        <th className="p-3 text-start">{t('attendance.group')}</th>
                        <th className="p-3 text-start">{t('common.time')}</th>
                        <th className="p-3 text-center">{t('common.status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSessions.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-[#2563EB]">#{s.id}</td>
                          <td className="p-3 text-slate-600 font-medium">{s.sessionDate}</td>
                          <td className="p-3 text-slate-600">{s.groupName || `#${s.groupId}`}</td>
                          <td className="p-3 text-slate-500">{s.actualStartTime || s.plannedStartTime || '—'} - {s.endTime || '—'}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.status === 'closed' ? 'bg-slate-100 text-slate-700' : 'bg-green-100 text-green-700'}`}>
                              {s.status === 'closed' ? t('attendance.sessionClosed') : t('attendance.inProgress')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {reportType === 'group_sessions' && (
                  <div>
                    {!selectedGroupId ? (
                      <div className="py-16 text-center text-slate-400">
                        <Users className="mx-auto mb-3 opacity-30" size={48} />
                        <p className="text-sm font-semibold text-slate-600">{t('reports.selectGroupPrompt')}</p>
                        <p className="text-xs text-slate-400 mt-1">اختر فوجاً من القائمة المنسدلة أعلاه لعرض تقرير الحصص بالتفصيل</p>
                      </div>
                    ) : groupReportLoading ? (
                      <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : !groupReportData || groupReportData.sessions.length === 0 ? (
                      <div className="py-16 text-center text-slate-400">
                        <CalendarCheck className="mx-auto mb-3 opacity-30" size={48} />
                        <p className="text-sm font-semibold text-slate-600">{t('reports.noClosedSessions')}</p>
                        <p className="text-xs text-slate-400 mt-1">لم يتم تسجيل أي حصة مكتملة لهذا الفوج بعد</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Group Header Info Card */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#2563EB] flex items-center justify-center font-bold shrink-0">
                              <Users size={20} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-slate-800 text-sm">{groupReportData.group.name}</h3>
                                <span className="text-[11px] bg-blue-50 text-[#2563EB] border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                                  {groupReportData.group.courseNameAr || groupReportData.group.courseNameFr}
                                </span>
                                {groupReportData.group.teacherName && (
                                  <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                                    {groupReportData.group.teacherName}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {groupReportData.metrics.totalStudents} طالب مسجل • {groupReportData.metrics.totalSessions} حصة مسجلة • نسبة الحضور: {groupReportData.metrics.attendanceRate}%
                              </p>
                            </div>
                          </div>

                          {/* Cancelled Sessions Notice */}
                          {groupReportData.sessions.some((s: any) => s.sessionType === 'cancelled') && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                              <Ban size={14} className="text-rose-600 shrink-0" />
                              <span>
                                يحتوي هذا الفوج على {groupReportData.sessions.filter((s: any) => s.sessionType === 'cancelled').length} حصة ملغاة (بدون اقتطاع من رصيد الطلاب)
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Table Container */}
                        <div className="overflow-x-auto border border-border rounded-xl">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50/80 border-b border-border text-slate-700">
                                {/* Sticky Student Column Header */}
                                <th className="p-3 text-start sticky right-0 bg-slate-100 z-10 min-w-56 border-l border-border shadow-xs">
                                  <div className="font-bold text-slate-800">{t('reports.student')}</div>
                                  <div className="text-[10px] text-slate-400 font-normal">الاسم واللقب والرصيد الحالي</div>
                                </th>

                                {/* Session Columns */}
                                {groupReportData.sessions.map((sess: any) => {
                                  const isCancelled = sess.sessionType === 'cancelled'
                                  return (
                                    <th key={sess.id} className={`p-3 text-center min-w-36 border-l border-border ${isCancelled ? 'bg-rose-50/70' : ''}`}>
                                      <div className="flex items-center justify-center gap-1 mb-1">
                                        <span className={`inline-block px-2 py-0.5 rounded font-bold text-[11px] ${
                                          isCancelled ? 'bg-rose-100 text-rose-800' : 'bg-blue-50 text-[#2563EB]'
                                        }`}>
                                          {t('reports.sessionNumber')} {sess.sessionNumber}
                                        </span>
                                        {isCancelled && (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-rose-600 text-white shadow-2xs">
                                            <Ban size={10} />
                                            <span>{t('reports.cancelled')}</span>
                                          </span>
                                        )}
                                      </div>
                                      <div className={`font-mono font-semibold text-[11px] ${isCancelled ? 'line-through text-rose-700' : 'text-slate-800'}`}>
                                        {sess.sessionDate}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-normal">
                                        {sess.actualStartTime || sess.plannedStartTime || '—'} - {sess.endTime || '—'}
                                      </div>
                                      {isCancelled ? (
                                        <div className="text-[9.5px] text-rose-600 font-bold mt-0.5">
                                          0 دج ({t('reports.cancelled')})
                                        </div>
                                      ) : (
                                        <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
                                          {sess.price !== null ? sess.price : Math.round((groupReportData.group.monthlyPrice / 4) * 100) / 100} دج
                                        </div>
                                      )}
                                      {sess.cancelledReason && (
                                        <div className="text-[9px] text-rose-700 bg-rose-100 rounded px-1.5 py-0.5 mt-1 truncate max-w-[130px] mx-auto" title={sess.cancelledReason}>
                                          {sess.cancelledReason}
                                        </div>
                                      )}
                                    </th>
                                  )
                                })}

                                {/* Summary Column */}
                                <th className="p-3 text-center min-w-36 bg-slate-100/70">
                                  <div className="font-bold text-slate-800">الملخص</div>
                                  <div className="text-[10px] text-slate-400 font-normal">نسبة الحضور والإجمالي</div>
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {groupReportData.students.map((st: any, idx: number) => (
                                <tr key={st.studentId} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50/60' : 'bg-slate-50/30 hover:bg-slate-50/60'}>
                                  {/* Sticky Student Info Cell */}
                                  <td className="p-3 sticky right-0 bg-inherit z-10 border-l border-border shadow-xs">
                                    <div className="font-bold text-slate-900" dir="rtl">
                                      {st.lastNameAr} {st.firstNameAr}
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-sans">
                                      {st.lastNameFr} {st.firstNameFr}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                      <span className="font-mono text-[10px] text-slate-400">#{st.studentNumber}</span>
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                        st.currentBalance > 0
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : st.currentBalance < 0
                                          ? 'bg-red-50 text-red-700 border border-red-200'
                                          : 'bg-slate-100 text-slate-600'
                                      }`}>
                                        {st.currentBalance > 0 ? `+${st.currentBalance.toLocaleString()} دج` : st.currentBalance < 0 ? `${st.currentBalance.toLocaleString()} دج` : '0 دج'}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Session Data Cells */}
                                  {groupReportData.sessions.map((sess: any) => {
                                    const sData = st.sessionData[sess.id] || { status: 'not_enrolled_yet', sessionDeduction: 0, runningBalance: 0 }
                                    const isCancelled = sess.sessionType === 'cancelled' || sData.status === 'cancelled'
                                    return (
                                      <td key={sess.id} className={`p-2.5 text-center border-l border-border/60 align-middle ${isCancelled ? 'bg-rose-50/25' : ''}`}>
                                        {/* Attendance Status Badge */}
                                        {isCancelled ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
                                            <Ban size={11} />
                                            <span>{t('reports.sessionCancelled')}</span>
                                          </span>
                                        ) : sData.status === 'present' ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                                            <span>✓</span>
                                            <span>{t('reports.present')}</span>
                                          </span>
                                        ) : sData.status === 'absent' ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-red-100 text-red-800 border border-red-200 shadow-2xs">
                                            <span>✗</span>
                                            <span>{t('reports.absent')}</span>
                                          </span>
                                        ) : sData.status === 'not_active' ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                                            <span>⏸</span>
                                            <span>{t('reports.notActive')}</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-400 border border-dashed border-slate-300">
                                            <span>—</span>
                                            <span>{t('reports.notEnrolledYet')}</span>
                                          </span>
                                        )}

                                        {/* Credits Info */}
                                        <div className="mt-1.5 space-y-0.5">
                                          <div className={`text-[10px] font-mono font-semibold ${
                                            sData.runningBalance > 0
                                              ? 'text-emerald-700'
                                              : sData.runningBalance < 0
                                              ? 'text-red-700'
                                              : 'text-slate-500'
                                          }`}>
                                            {t('reports.creditAtSession')}: {sData.runningBalance > 0 ? `+${sData.runningBalance.toLocaleString()}` : sData.runningBalance.toLocaleString()} دج
                                          </div>
                                          {isCancelled ? (
                                            <div className="text-[9px] text-rose-600 font-medium">
                                              {t('reports.noDeductionCancelled')}
                                            </div>
                                          ) : sData.sessionDeduction > 0 ? (
                                            <div className="text-[9px] text-slate-400 font-mono">
                                              (-{sData.sessionDeduction.toLocaleString()} دج)
                                            </div>
                                          ) : null}
                                        </div>
                                      </td>
                                    )
                                  })}

                                  {/* Summary Cell */}
                                  <td className="p-2.5 text-center bg-slate-50/40 align-middle font-medium">
                                    <div className="text-slate-800 font-bold text-xs">
                                      {st.summary.presentCount} / {st.summary.presentCount + st.summary.absentCount}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                      {st.summary.presentCount + st.summary.absentCount > 0
                                        ? `${Math.round((st.summary.presentCount / (st.summary.presentCount + st.summary.absentCount)) * 100)}% حضور`
                                        : '—'}
                                    </div>
                                    <div className="text-[10px] font-mono font-bold text-purple-700 mt-1">
                                      {st.summary.totalDeductions.toLocaleString()} دج
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Interactive In-app Print Preview Modal ── */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-6" onClick={() => setShowPreviewModal(false)}>
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-fade-in overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header — Fixed on Top */}
            <div className="flex justify-between items-center px-5 py-3.5 border-b border-border bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="text-[#2563EB]" size={18} />
                <h3 className="font-bold text-[#0F172A] text-sm">{t('reports.previewA4')}</h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExportPdf}
                  disabled={exporting}
                  className="flex items-center gap-1.5 text-xs border border-[#2563EB] text-[#2563EB] px-3 py-1.5 rounded-lg hover:bg-[#EFF6FF] transition-colors disabled:opacity-50 font-semibold"
                >
                  <Download size={13} /> PDF
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 text-xs bg-[#2563EB] text-white px-3 py-1.5 rounded-lg hover:bg-[#1D4ED8] transition-colors font-semibold"
                >
                  <Printer size={13} /> {t('common.print')}
                </button>
                <button onClick={() => setShowPreviewModal(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body — Scrollable preview sheet */}
            <div className="p-4 sm:p-8 bg-slate-200 overflow-y-auto flex-1 flex justify-center">
              <div className="bg-white shadow-xl rounded-sm w-full max-w-4xl overflow-x-auto">
                <ReportDocument />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
