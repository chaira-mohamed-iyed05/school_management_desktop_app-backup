import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import {
  Wallet, Users, BookOpen, CheckCircle2, AlertTriangle, Clock,
  Printer, ArrowRight, RefreshCw, Check, X, ChevronDown, Filter,
  DollarSign, FileText, Sparkles, AlertCircle
} from 'lucide-react'
import type {
  Teacher, Group, TeacherPayoutMatrix, TeacherPayoutMatrixSession,
  TeacherPayoutReceiptTicket, TeacherPayout
} from '@shared/types/index'
import { useConfirm } from '../components/feedback/DialogProvider'
import TeacherPayoutTicketModal from '../components/TeacherPayoutTicketModal'

export default function TeacherPayouts() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const isRTL = lang === 'ar'
  const location = useLocation()
  const confirm = useConfirm()

  // Teachers & Groups Data
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')

  // Active view tab: 'matrix' | 'history'
  const [activeTab, setActiveTab] = useState<'matrix' | 'history'>('matrix')

  // Matrix State
  const [matrix, setMatrix] = useState<TeacherPayoutMatrix | null>(null)
  const [loadingMatrix, setLoadingMatrix] = useState(false)
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<number>>(new Set())

  // Payout Configuration
  const [teacherPercentage, setTeacherPercentage] = useState<number>(50)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'check'>('cash')
  const [notes, setNotes] = useState<string>('')
  const [executing, setExecuting] = useState(false)

  // Past Payouts History
  const [payoutsHistory, setPayoutsHistory] = useState<TeacherPayout[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Ticket Modal
  const [ticketModal, setTicketModal] = useState<TeacherPayoutReceiptTicket | null>(null)

  // 1. Initial Load: Fetch Teachers and Groups
  useEffect(() => {
    const init = async () => {
      try {
        const [teachersRes, groupsRes] = await Promise.all([
          window.schoolApp.teachers.list({ status: 'all' }),
          window.schoolApp.groups.list({ status: 'all' }),
        ])
        const grpList: Group[] = (groupsRes.success && groupsRes.data) ? groupsRes.data : []
        if (teachersRes.success && teachersRes.data) {
          setTeachers(teachersRes.data)
        }
        if (grpList.length > 0) {
          setGroups(grpList)
        }

        // Check URL params (e.g. ?teacherId=2 or ?groupId=5)
        const params = new URLSearchParams(location.search)
        const paramTeacherId = params.get('teacherId')
        const paramGroupId = params.get('groupId')

        if (paramTeacherId) {
          setSelectedTeacherId(paramTeacherId)
          const teacherGroups = grpList.filter((g: Group) => String(g.teacherId) === paramTeacherId)
          if (teacherGroups.length > 0) {
            setSelectedGroupId(paramGroupId || String(teacherGroups[0].id))
          }
        } else if (grpList.length > 0) {
          const firstGrp = grpList[0]
          setSelectedTeacherId(String(firstGrp.teacherId))
          setSelectedGroupId(String(firstGrp.id))
        }
      } catch (err) {
        console.error('Failed to load teachers or groups:', err)
      }
    }
    init()
  }, [location.search])

  // Groups available for the currently selected teacher
  const filteredGroups = useMemo(() => {
    if (!selectedTeacherId) return groups
    return groups.filter((g) => String(g.teacherId) === selectedTeacherId)
  }, [groups, selectedTeacherId])

  // 2. Load Matrix when selected group changes
  const loadMatrix = async (groupId: number) => {
    setLoadingMatrix(true)
    try {
      const res = await window.schoolApp.teachers.payoutMatrix(groupId)
      if (res.success && res.data) {
        setMatrix(res.data)
        if (res.data.teacher.defaultPercentage) {
          setTeacherPercentage(res.data.teacher.defaultPercentage)
        }

        // By default, select all sessions that have ready yellows
        const initialSelected = new Set<number>()
        for (const s of res.data.sessions) {
          if (s.yellowCount > 0) {
            initialSelected.add(s.id)
          }
        }
        setSelectedSessionIds(initialSelected)
      } else {
        setMatrix(null)
      }
    } catch (err) {
      console.error('Failed to fetch payout matrix:', err)
      setMatrix(null)
    } finally {
      setLoadingMatrix(false)
    }
  }

  // 3. Load Payout History
  const loadHistory = async (teacherId?: number, groupId?: number) => {
    setLoadingHistory(true)
    try {
      const res = await window.schoolApp.teachers.listPayouts({ teacherId, groupId })
      if (res.success && res.data) {
        setPayoutsHistory(res.data)
      }
    } catch (err) {
      console.error('Failed to fetch payouts history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    if (selectedGroupId) {
      loadMatrix(Number(selectedGroupId))
      loadHistory(selectedTeacherId ? Number(selectedTeacherId) : undefined, Number(selectedGroupId))
    }
  }, [selectedGroupId])

  // Handle Teacher Change
  const handleTeacherChange = (tId: string) => {
    setSelectedTeacherId(tId)
    const teacherGroups = groups.filter((g) => String(g.teacherId) === tId)
    if (teacherGroups.length > 0) {
      setSelectedGroupId(String(teacherGroups[0].id))
    } else {
      setSelectedGroupId('')
      setMatrix(null)
    }
  }

  // Toggle Session Selection
  const toggleSession = (sessionId: number) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev)
      if (next.has(sessionId)) next.delete(sessionId)
      else next.add(sessionId)
      return next
    })
  }

  // Action: Collect All Yellows
  const handleCollectAllYellows = () => {
    if (!matrix) return
    const yellowSessIds = new Set<number>()
    for (const sess of matrix.sessions) {
      if (sess.yellowCount > 0) {
        yellowSessIds.add(sess.id)
      }
    }
    setSelectedSessionIds(yellowSessIds)
  }

  // Action: Select All Sessions
  const handleSelectAll = () => {
    if (!matrix) return
    setSelectedSessionIds(new Set(matrix.sessions.map((s) => s.id)))
  }

  // Action: Deselect All
  const handleDeselectAll = () => {
    setSelectedSessionIds(new Set())
  }

  // Selected Metrics Calculation
  const selectedStats = useMemo(() => {
    if (!matrix) {
      return { grossAmount: 0, yellowsCount: 0, netPayout: 0, pendingDebt: 0, debtCount: 0 }
    }

    let grossAmount = 0
    let yellowsCount = 0
    let pendingDebt = 0
    let debtCount = 0

    for (const stu of matrix.students) {
      for (const sess of matrix.sessions) {
        if (!selectedSessionIds.has(sess.id)) continue
        const cell = stu.cells[sess.id]
        if (!cell) continue

        if (cell.state === 'yellow') {
          grossAmount += cell.sessionPrice
          yellowsCount++
        } else if (cell.state === 'red') {
          pendingDebt += cell.sessionPrice
          debtCount++
        }
      }
    }

    const netPayout = Math.round(grossAmount * (teacherPercentage / 100))

    return {
      grossAmount,
      yellowsCount,
      netPayout,
      pendingDebt,
      debtCount,
    }
  }, [matrix, selectedSessionIds, teacherPercentage])

  // Execute Payout Handler
  const handleExecutePayout = async () => {
    if (!matrix || selectedSessionIds.size === 0 || selectedStats.yellowsCount === 0) {
      alert(t('teacherPayouts.noYellowsSelected'))
      return
    }

    const ok = await confirm({
      title: t('teacherPayouts.confirmPayout'),
      message: t('teacherPayouts.confirmPayoutMsg', {
        amount: selectedStats.netPayout.toLocaleString(),
        teacher: matrix.teacher.name,
      }),
      variant: 'info',
    })

    if (!ok) return

    setExecuting(true)
    try {
      const res = await window.schoolApp.teachers.executePayout({
        groupId: matrix.group.id,
        sessionIds: Array.from(selectedSessionIds),
        percentage: teacherPercentage,
        paymentMethod,
        notes: notes.trim() || undefined,
      })

      if (res.success && res.data) {
        setTicketModal(res.data)
        // Refresh matrix and history
        await loadMatrix(matrix.group.id)
        await loadHistory(matrix.teacher.id, matrix.group.id)
      } else {
        alert(('error' in res ? res.error : undefined) || 'Failed to execute payout')
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred during payout')
    } finally {
      setExecuting(false)
    }
  }

  // Re-print past voucher
  const handleReprint = async (payoutId: number) => {
    try {
      const res = await window.schoolApp.teachers.getPayoutReceipt(payoutId)
      if (res.success && res.data) {
        setTicketModal(res.data)
      } else {
        alert(('error' in res ? res.error : undefined) || 'Could not fetch voucher')
      }
    } catch (err) {
      console.error('Reprint error:', err)
    }
  }

  return (
    <div className="animate-fade-in space-y-6 max-w-full pb-10">
      {/* ── Top Header & Navigation ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-purple-100 text-purple-700 rounded-xl">
              <Wallet size={22} />
            </span>
            <h1 className="text-xl font-extrabold text-[#0F172A]">
              {t('teacherPayouts.title')}
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            {t('teacherPayouts.subtitle')}
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'matrix'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles size={14} /> {lang === 'ar' ? 'مصفوفة الحصص والصرف' : 'Grille & Paiement'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText size={14} /> {t('teacherPayouts.payoutHistory')}
            {payoutsHistory.length > 0 && (
              <span className="px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded-full text-[10px]">
                {payoutsHistory.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Filter Bar: Teacher & Group Selectors ───────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-border shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 flex-1">
          {/* Teacher Select */}
          <div className="min-w-60 flex-1">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('teacherPayouts.selectTeacher')}
            </label>
            <select
              value={selectedTeacherId}
              onChange={(e) => handleTeacherChange(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-xl text-xs font-semibold focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 bg-slate-50"
            >
              <option value="">-- {t('teacherPayouts.selectTeacher')} --</option>
              {teachers.map((tch) => (
                <option key={tch.id} value={tch.id}>
                  {tch.firstName} {tch.lastName} {tch.courseNameAr ? `(${tch.courseNameAr})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Group Select */}
          <div className="min-w-60 flex-1">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('teacherPayouts.selectGroup')}
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              disabled={filteredGroups.length === 0}
              className="w-full px-3 py-2 border border-border rounded-xl text-xs font-semibold focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 bg-slate-50 disabled:opacity-50"
            >
              {filteredGroups.length === 0 ? (
                <option value="">{t('teacherPayouts.noGroups')}</option>
              ) : (
                filteredGroups.map((grp) => (
                  <option key={grp.id} value={grp.id}>
                    {grp.name} ({grp.monthlyPrice.toLocaleString()} DA/شهر)
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Refresh button */}
        {selectedGroupId && (
          <button
            onClick={() => loadMatrix(Number(selectedGroupId))}
            className="p-2.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all"
            title="تحديث البيانات"
          >
            <RefreshCw size={16} className={loadingMatrix ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {activeTab === 'matrix' ? (
        <>
          {/* ── Metric Cards ─────────────────────────────────────────────────── */}
          {matrix && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Sessions */}
              <div className="bg-white p-5 rounded-2xl border border-border shadow-xs">
                <div className="flex items-center gap-2 mb-1.5">
                  <BookOpen size={16} className="text-slate-500" />
                  <p className="text-xs font-semibold text-slate-500">{t('teacherPayouts.totalSessions')}</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-800">{matrix.sessions.length}</span>
                  <span className="text-xs text-slate-400">حصص منجزة</span>
                </div>
              </div>

              {/* Card 2: Ready for Payout (Yellows) */}
              <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-linear-to-br from-white to-amber-50/40 shadow-xs">
                <div className="flex items-center gap-2 mb-1.5">
                  <Clock size={16} className="text-amber-500" />
                  <p className="text-xs font-semibold text-amber-700">{t('teacherPayouts.readyPayout')}</p>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-amber-600 font-mono">
                    {matrix.summary.totalGrossYellowAmount.toLocaleString()} DA
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                    {matrix.summary.totalYellowCount} مساهمة جاهزة
                  </span>
                </div>
              </div>

              {/* Card 3: Net Teacher Due (Live Percentage Adjusted) */}
              <div className="bg-white p-5 rounded-2xl border border-purple-300 bg-linear-to-br from-white to-purple-50/50 shadow-xs ring-1 ring-purple-400/20">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Wallet size={16} className="text-purple-600" />
                    <p className="text-xs font-bold text-purple-900">{t('teacherPayouts.netPayout')}</p>
                  </div>
                  <span className="text-xs font-mono font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md">
                    {teacherPercentage}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-purple-900 font-mono">
                    {selectedStats.netPayout.toLocaleString()} DA
                  </span>
                  <span className="text-[11px] text-purple-600 font-semibold">
                    من إجمالي {selectedStats.grossAmount.toLocaleString()} DA
                  </span>
                </div>
              </div>

              {/* Card 4: Pending Student Debt (Red) */}
              <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-linear-to-br from-white to-rose-50/40 shadow-xs">
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle size={16} className="text-rose-500" />
                  <p className="text-xs font-semibold text-rose-700">{t('teacherPayouts.pendingDebt')}</p>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-rose-600 font-mono">
                    {matrix.summary.totalPendingDebtAmount.toLocaleString()} DA
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full">
                    {matrix.summary.totalRedCount} ديون معلقة
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Interactive Action Bar & Controls ───────────────────────────── */}
          {matrix && (
            <div className="bg-white p-4 rounded-2xl border border-border shadow-xs flex flex-wrap items-center justify-between gap-4">
              {/* Quick Select Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCollectAllYellows}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white font-bold text-xs rounded-xl hover:bg-amber-600 transition-all shadow-xs cursor-pointer"
                >
                  <Sparkles size={14} />
                  <span>{t('teacherPayouts.collectYellows')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-3 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-200 transition-all"
                >
                  {t('teacherPayouts.selectAll')}
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-3 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-200 transition-all"
                >
                  {t('teacherPayouts.deselectAll')}
                </button>
              </div>

              {/* Percentage & Payment Commit Section */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Percentage input */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5">
                  <span className="text-xs font-bold text-slate-700">{t('teacherPayouts.teacherPercentage')}:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={teacherPercentage}
                    onChange={(e) => setTeacherPercentage(Math.max(1, Math.min(100, Number(e.target.value) || 0)))}
                    className="w-14 text-center font-bold text-xs bg-white border border-slate-200 rounded-lg py-1 px-1 text-purple-900 focus:ring-1 focus:ring-purple-600 outline-none"
                  />
                  <span className="text-xs font-bold text-purple-700">%</span>
                </div>

                {/* Payment Method */}
                <select
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-slate-50 focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                >
                  <option value="cash">نقداً (خزينة المركز)</option>
                  <option value="transfer">تحويل بنكي / بريدي</option>
                  <option value="check">صك</option>
                </select>

                {/* Primary Execute Button */}
                <button
                  type="button"
                  disabled={selectedStats.yellowsCount === 0 || executing}
                  onClick={handleExecutePayout}
                  className="flex items-center gap-2 bg-linear-to-r from-purple-600 to-indigo-600 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Printer size={15} />
                  <span>
                    {executing ? 'جاري الصرف والطباعة...' : `${t('teacherPayouts.executePayout')} (${selectedStats.netPayout.toLocaleString()} DA)`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ── Traffic Light Legend ────────────────────────────────────────── */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-bold text-slate-700">{t('teacherPayouts.legendTitle')}</span>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-slate-700 font-medium">🟢 {t('teacherPayouts.greenDesc')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0 animate-pulse" />
                <span className="text-slate-700 font-bold text-amber-800">🟡 {t('teacherPayouts.yellowDesc')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
                <span className="text-slate-700 font-medium text-rose-800">🔴 {t('teacherPayouts.redDesc')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-300 shrink-0" />
                <span className="text-slate-500">⚪ {t('teacherPayouts.noneDesc')}</span>
              </div>
            </div>
          </div>

          {/* ── The Interactive Traffic Light Matrix Table ──────────────────── */}
          <div className="bg-white rounded-2xl border border-border shadow-xs overflow-hidden">
            {loadingMatrix ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-500 font-semibold">جاري حساب مصفوفة الحصص والديون بنظام FIFO...</p>
              </div>
            ) : !matrix || matrix.sessions.length === 0 ? (
              <div className="py-20 text-center text-slate-400">
                <BookOpen size={40} className="mx-auto mb-2 opacity-30" />
                <p className="font-medium text-sm">{t('teacherPayouts.noSessions')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[70vh]">
                <table className="w-full text-xs text-start border-collapse">
                  {/* Table Header */}
                  <thead className="bg-slate-100/90 backdrop-blur-xs sticky top-0 z-20 border-b border-border shadow-xs">
                    <tr>
                      {/* Fixed Student Column */}
                      <th className="p-3 text-start min-w-56 sticky start-0 bg-slate-100 z-30 border-e border-slate-200">
                        <div className="font-extrabold text-[#0F172A]">{t('teacherPayouts.student')}</div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          {matrix.students.length} طالب مسجل بالفوج
                        </div>
                      </th>

                      {/* Session Columns */}
                      {matrix.sessions.map((sess) => {
                        const isSelected = selectedSessionIds.has(sess.id)
                        return (
                          <th
                            key={sess.id}
                            onClick={() => toggleSession(sess.id)}
                            className={`p-2.5 text-center min-w-32 border-e border-slate-200 transition-colors cursor-pointer select-none ${
                              isSelected ? 'bg-purple-50/80 ring-2 ring-purple-500/20' : 'hover:bg-slate-200/60'
                            }`}
                          >
                            <div className="flex items-center justify-center gap-1.5 mb-1">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // handled by th onClick
                                className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                              />
                              <span className="font-bold text-slate-800 text-[11px]">
                                حصـة #{sess.sessionNumber}
                              </span>
                            </div>
                            <div className="font-mono text-[10px] text-slate-500">
                              {sess.sessionDate}
                            </div>
                            {/* Badges Count */}
                            <div className="mt-1 flex items-center justify-center gap-1 text-[9px] font-mono">
                              {sess.yellowCount > 0 && (
                                <span className="px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold" title="جاهز للصرف">
                                  {sess.yellowCount}🟡
                                </span>
                              )}
                              {sess.redCount > 0 && (
                                <span className="px-1 py-0.2 rounded bg-rose-100 text-rose-800 font-bold" title="دين معلق">
                                  {sess.redCount}🔴
                                </span>
                              )}
                              {sess.greenCount > 0 && (
                                <span className="px-1 py-0.2 rounded bg-emerald-100 text-emerald-800" title="مسدد للأستاذ">
                                  {sess.greenCount}🟢
                                </span>
                              )}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>

                  {/* Table Body */}
                  <tbody className="divide-y divide-slate-100">
                    {matrix.students.map((stu) => (
                      <tr key={stu.studentId} className="hover:bg-slate-50/80 transition-colors">
                        {/* Student Name & Balance Cell (Sticky) */}
                        <td className="p-3 sticky start-0 bg-white z-10 border-e border-slate-200">
                          <div className="font-bold text-[#0F172A] flex items-center gap-1.5">
                            <span className="truncate max-w-44">
                              {stu.studentNameAr || stu.studentNameFr}
                            </span>
                            {stu.isDeparted && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700 shrink-0">
                                {t('teacherPayouts.departedStudent')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                            <span className="font-mono text-slate-400">{stu.studentNumber}</span>
                            <span
                              className={`font-mono font-bold ${
                                stu.totalBalance < 0 ? 'text-red-600' : 'text-emerald-600'
                              }`}
                            >
                              {stu.totalBalance.toLocaleString()} DA
                            </span>
                          </div>
                        </td>

                        {/* Interactive Session Cells */}
                        {matrix.sessions.map((sess) => {
                          const cell = stu.cells[sess.id]
                          if (!cell || cell.state === 'none') {
                            return (
                              <td key={sess.id} className="p-2 text-center border-e border-slate-100 text-slate-300">
                                —
                              </td>
                            )
                          }

                          const isSelectedSession = selectedSessionIds.has(sess.id)

                          return (
                            <td
                              key={sess.id}
                              className={`p-2 text-center border-e border-slate-100 transition-all ${
                                isSelectedSession && cell.state === 'yellow' ? 'bg-amber-50/60' : ''
                              }`}
                            >
                              <div
                                className={`inline-flex flex-col items-center justify-center px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                                  cell.state === 'green'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : cell.state === 'yellow'
                                    ? 'bg-amber-100 text-amber-900 border-amber-400 ring-2 ring-amber-400/30 font-bold'
                                    : 'bg-rose-50 text-rose-800 border-rose-300'
                                }`}
                                title={
                                  cell.state === 'green'
                                    ? 'مسدد للأستاذ رسمياً ومغلق'
                                    : cell.state === 'yellow'
                                    ? 'مدفوع 100% من الطالب وجاهز للصرف'
                                    : 'دين معلق على الطالب — غير مدفوع للأستاذ'
                                }
                              >
                                <span className="flex items-center gap-1">
                                  {cell.state === 'green' && <Check size={11} className="text-emerald-600 stroke-[3]" />}
                                  {cell.state === 'yellow' && <Sparkles size={11} className="text-amber-600" />}
                                  {cell.state === 'red' && <AlertTriangle size={11} className="text-rose-600" />}
                                  <span>{cell.attendanceStatus === 'present' ? 'حاضر' : 'غائب'}</span>
                                </span>
                                <span className="text-[9px] font-mono opacity-80">
                                  {cell.sessionPrice} DA
                                </span>
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── Historic Vouchers Archive ─────────────────────────────────────── */
        <div className="bg-white rounded-2xl border border-border shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border bg-slate-50 flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-[#0F172A] flex items-center gap-2">
              <FileText size={16} className="text-purple-600" />
              <span>{t('teacherPayouts.payoutHistory')}</span>
            </h3>
            <span className="text-xs text-slate-500 font-semibold">
              {payoutsHistory.length} وصولات مسجلة
            </span>
          </div>

          {loadingHistory ? (
            <div className="py-16 flex justify-center">
              <div className="w-7 h-7 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : payoutsHistory.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <FileText size={36} className="mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-xs">لم يتم تسجيل أي وصولات دفع سابقة لهذا الفوج</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-start">{t('teacherPayouts.receiptNumber')}</th>
                    <th className="px-4 py-3 text-start">{t('teachers.title')}</th>
                    <th className="px-4 py-3 text-start">{t('courses.groups')}</th>
                    <th className="px-4 py-3 text-start">{t('teacherPayouts.payoutDate')}</th>
                    <th className="px-4 py-3 text-start">{t('teacherPayouts.sessionsCount')}</th>
                    <th className="px-4 py-3 text-start">{t('teacherPayouts.teacherPercentage')}</th>
                    <th className="px-4 py-3 text-start">{t('teacherPayouts.netPaid')}</th>
                    <th className="px-4 py-3 text-end">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payoutsHistory.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-purple-700">
                        {po.payoutNumber}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {po.teacherName}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {po.groupName}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">
                        {po.payoutDate}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full font-bold">
                          {po.sessionsCount} حصص ({po.yellowsConvertedCount} مساهمة)
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-700">
                        {po.percentage}%
                      </td>
                      <td className="px-4 py-3 font-mono font-black text-purple-900 text-sm">
                        {po.netPaidAmount.toLocaleString()} DA
                      </td>
                      <td className="px-4 py-3 text-end">
                        <button
                          type="button"
                          onClick={() => handleReprint(po.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                        >
                          <Printer size={13} /> {t('teacherPayouts.reprintTicket')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Printable Ticket Modal ─────────────────────────────────────────── */}
      {ticketModal && (
        <TeacherPayoutTicketModal
          ticket={ticketModal}
          onClose={() => setTicketModal(null)}
        />
      )}
    </div>
  )
}
