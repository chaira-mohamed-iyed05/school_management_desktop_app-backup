import { useState, useRef, useEffect, useCallback } from 'react'
import {
  ScanLine, Volume2, VolumeX, CheckCircle, XCircle, AlertTriangle,
  Users, Printer, Plus, Eye, RefreshCw, X, ShieldAlert
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'

type ScanState = 'idle' | 'success' | 'already' | 'invalid' | 'not-enrolled' | 'overdue'

interface ScannedStudentInfo {
  id: number
  studentNumber: string
  firstNameFr: string
  lastNameFr: string
  firstNameAr?: string
  lastNameAr?: string
  photoPath?: string | null
  photoUrl?: string | null
  creditBalance?: number | null
  wasInDebt?: boolean
  groupName?: string
  courseName?: string
}

interface LiveRecord {
  id: string
  studentId: number
  studentName: string
  studentNumber: string
  photoUrl?: string | null
  status: 'present' | 'absent' | 'inactive'
  scanTime: string
  source: 'qr' | 'manual'
  creditBalance?: number | null
  wasInDebt?: boolean
}

function playBeep(type: 'success' | 'error' | 'warning') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    if (type === 'success') {
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25)
      osc.start()
      osc.stop(ctx.currentTime + 0.25)
    } else if (type === 'warning') {
      osc.frequency.setValueAtTime(440, ctx.currentTime)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime)
      osc.frequency.setValueAtTime(180, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
      osc.start()
      osc.stop(ctx.currentTime + 0.35)
    }
  } catch {
    // AudioContext blocked or not supported
  }
}

export default function Attendance() {
  const [courses, setCourses] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string>('')
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [sessionTime, setSessionTime] = useState('08:00')
  const [activeSession, setActiveSession] = useState<any | null>(null)
  const [rosterStudents, setRosterStudents] = useState<any[]>([])
  const [groupSchedules, setGroupSchedules] = useState<any[]>([])
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelReasonPreset, setCancelReasonPreset] = useState('غياب الأستاذ')
  const [cancelCustomReason, setCancelCustomReason] = useState('')

  // Mode: 'attendance' vs 'lookup'
  const [mode, setMode] = useState<'attendance' | 'lookup'>('attendance')
  const [tokenInput, setTokenInput] = useState('')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [scannedStudent, setScannedStudent] = useState<ScannedStudentInfo | null>(null)
  const [scanMessage, setScanMessage] = useState('')
  const [debtAlertMessage, setDebtAlertMessage] = useState<string | null>(null)
  const [scanTime, setScanTime] = useState('')
  const [sound, setSound] = useState(true)
  const [loading, setLoading] = useState(false)

  // Lookup result modal
  const [lookupResult, setLookupResult] = useState<any | null>(null)
  const [manualModal, setManualModal] = useState(false)
  const [manualStudentId, setManualStudentId] = useState<number | ''>('')
  const [manualStatus, setManualStatus] = useState<'present' | 'absent' | 'inactive'>('present')

  const inputRef = useRef<HTMLInputElement>(null)
  const api = (window as any).schoolApp

  // Compute localized Arabic date
  const dateObj = new Date(sessionDate + 'T00:00:00')
  const dayNameAr = dateObj.toLocaleDateString('ar-DZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const dayOfWeekNumber = dateObj.getDay() === 0 ? 7 : dateObj.getDay() // 1=Mon ... 7=Sun

  // Find matching scheduled slot for today
  const matchingSchedule = groupSchedules.find(s => s.weekday === dayOfWeekNumber)

  // When group or date changes, load schedules
  useEffect(() => {
    const fetchSchedules = async () => {
      if (!api || !selectedGroup) return
      try {
        const res = await api.schedules.list({ groupId: Number(selectedGroup) })
        if (res.success && res.data) {
          setGroupSchedules(res.data)
          const match = res.data.find((s: any) => s.weekday === dayOfWeekNumber)
          if (match && match.startTime) {
            setSessionTime(match.startTime)
          }
        }
      } catch (err) {
        console.error('Failed to load schedules for group:', err)
      }
    }
    fetchSchedules()
  }, [selectedGroup, sessionDate, dayOfWeekNumber])

  // Load initial courses & groups
  useEffect(() => {
    const init = async () => {
      if (!api) return
      try {
        const cRes = await api.courses.list({ status: 'active' })
        if (cRes.success && cRes.data) {
          setCourses(cRes.data)
          if (cRes.data.length > 0) {
            setSelectedCourse(String(cRes.data[0].id))
          }
        }
      } catch (err) {
        console.error('Failed to load courses:', err)
      }
    }
    init()
  }, [])

  // Load groups when course changes
  useEffect(() => {
    const loadGroups = async () => {
      if (!api || !selectedCourse) return
      try {
        const gRes = await api.groups.byCourse(Number(selectedCourse))
        if (gRes.success && gRes.data) {
          setGroups(gRes.data)
          if (gRes.data.length > 0) {
            setSelectedGroup(String(gRes.data[0].id))
          } else {
            setSelectedGroup('')
          }
        }
      } catch (err) {
        console.error('Failed to load groups:', err)
      }
    }
    loadGroups()
  }, [selectedCourse])

  // Load group session & roster with live balances
  const loadGroupDetails = useCallback(async () => {
    if (!api || !selectedGroup) {
      setRosterStudents([])
      setActiveSession(null)
      return
    }

    try {
      // 1. Check for open session today
      const sessRes = await api.sessions.list({ groupId: Number(selectedGroup), status: 'open' })
      if (sessRes.success && sessRes.data && sessRes.data.length > 0) {
        const current = sessRes.data[0]
        setActiveSession(current)

        // Load full roster with live balance & attendance
        const rosterRes = await api.attendance.withRoster(current.id)
        if (rosterRes.success && rosterRes.data?.students) {
          setRosterStudents(rosterRes.data.students)
        }
      } else {
        setActiveSession(null)
        // If no active session, load enrolled students
        const enrollRes = await api.enrollments.byGroup(Number(selectedGroup))
        if (enrollRes.success && enrollRes.data) {
          const studentsList: any[] = []
          for (const en of enrollRes.data) {
            const sRes = await api.students.getById(en.studentId)
            let bal = { balance: 0 }
            try {
              const bRes = await api.payments.balance(en.id)
              if (bRes.success) bal = bRes.data
            } catch {}

            if (sRes.success && sRes.data) {
              let photoUrl = null
              if (sRes.data.photoPath) {
                const pRes = await api.media.getImageUrl(sRes.data.photoPath)
                if (pRes.success) photoUrl = pRes.data.url
              }
              studentsList.push({
                ...sRes.data,
                enrollmentId: en.id,
                photoUrl,
                creditBalance: bal.balance,
                wasInDebt: bal.balance < 0,
                attendanceStatus: null,
              })
            }
          }
          setRosterStudents(studentsList)
        }
      }
    } catch (err) {
      console.error('Failed to load group details:', err)
    }
  }, [selectedGroup])

  useEffect(() => {
    loadGroupDetails()
  }, [loadGroupDetails])

  useEffect(() => {
    inputRef.current?.focus()
  }, [mode, scanState])

  // Start a new session
  const handleStartSession = async () => {
    if (!api || !selectedGroup) return
    setLoading(true)
    try {
      const res = await api.attendance.startSession({
        groupId: Number(selectedGroup),
        sessionDate,
        plannedStartTime: sessionTime,
        lateThresholdMinutes: 10,
      })
      if (res.success && res.data) {
        setActiveSession(res.data)
        if (sound) playBeep('success')
        loadGroupDetails()
      } else {
        alert(res.error?.message || 'حدث خطأ أثناء بدء الحصة')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // End active session
  const handleEndSession = async () => {
    if (!api || !activeSession) return
    if (!confirm('هل تريد إنهاء وحفظ جلسة تسجيل الحضور؟')) return
    setLoading(true)
    try {
      const res = await api.attendance.endSession(activeSession.id)
      if (res.success) {
        setActiveSession(null)
        loadGroupDetails()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Cancel active session
  const handleConfirmCancelSession = async () => {
    if (!api || !activeSession) return
    const finalReason = cancelReasonPreset === 'other'
      ? cancelCustomReason.trim() || 'إلغاء الحصة'
      : cancelReasonPreset

    setLoading(true)
    try {
      const res = await api.sessions.cancel(activeSession.id, finalReason)
      if (res.success) {
        setCancelModalOpen(false)
        setActiveSession(null)
        alert(`تم إلغاء الحصة بنجاح. السبب: ${finalReason}`)
        loadGroupDetails()
      } else {
        alert(res.error?.message || 'حدث خطأ أثناء إلغاء الحصة')
      }
    } catch (err) {
      console.error('Error cancelling session:', err)
    } finally {
      setLoading(false)
    }
  }

  // Mark student status directly from roster
  const handleSetStudentStatus = async (studentId: number, status: 'present' | 'absent' | 'inactive') => {
    if (!api || !activeSession) return
    try {
      await api.attendance.markSession(activeSession.id, studentId, status)
      loadGroupDetails()
    } catch (err) {
      console.error(err)
    }
  }

  // Process QR or Manual Token Scan
  const processScan = async (token: string) => {
    const trimmed = token.trim()
    if (!trimmed || !api) return

    const now = new Date()
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    setScanTime(timeStr)
    setDebtAlertMessage(null)

    if (mode === 'lookup') {
      // Lookup mode
      try {
        const res = await api.attendance.lookup(trimmed)
        if (res.success && res.data) {
          setLookupResult(res.data)
          if (sound) playBeep('success')
        } else {
          setScanState('invalid')
          setScanMessage('الرمز غير موجود في النظام')
          if (sound) playBeep('error')
          setTimeout(() => setScanState('idle'), 3000)
        }
      } catch {
        setScanState('invalid')
        setTimeout(() => setScanState('idle'), 3000)
      }
      return
    }

    // Attendance mode
    if (!activeSession) {
      alert('يرجى بدء جلسة حضور قبل المسح')
      return
    }

    try {
      const res = await api.attendance.scan(activeSession.id, trimmed)
      if (res.success && res.data) {
        const { student, isDuplicate, creditBalance, wasInDebt } = res.data
        let photoUrl = null
        if (student?.photoPath) {
          const pRes = await api.media.getImageUrl(student.photoPath)
          if (pRes.success) photoUrl = pRes.data?.url
        }

        const currGroup = groups.find(g => String(g.id) === selectedGroup)
        const currCourse = courses.find(c => String(c.id) === selectedCourse)
        const groupName = currGroup?.name ?? 'المجموعة'
        const courseName = currCourse?.nameAr || currCourse?.nameFr || 'المادة'
        const studentName = `${student?.lastNameAr || student?.lastNameFr || ''} ${student?.firstNameAr || student?.firstNameFr || ''}`.trim()

        const studentInfo: ScannedStudentInfo = {
          id: student.id,
          studentNumber: student.studentNumber,
          firstNameFr: student.firstNameFr,
          lastNameFr: student.lastNameFr,
          firstNameAr: student.firstNameAr,
          lastNameAr: student.lastNameAr,
          photoPath: student.photoPath,
          photoUrl,
          creditBalance,
          wasInDebt,
          groupName,
          courseName,
        }
        setScannedStudent(studentInfo)

        // If in debt (< 0), construct specific alert message
        if (wasInDebt && creditBalance < 0) {
          setDebtAlertMessage(`الطالب ${studentName} متأخر في ${groupName} — المادة: ${courseName} (الرصيد: ${creditBalance?.toLocaleString('ar-DZ')} دج)`)
        }

        if (isDuplicate) {
          setScanState('already')
          setScanMessage('تم تسجيل حضور الطالب مسبقاً في هذه الحصة')
          if (sound) playBeep('warning')
        } else {
          setScanState('success')
          setScanMessage(`تم تسجيل الحضور بنجاح · ${timeStr}`)
          if (sound) playBeep('success')
          loadGroupDetails()
        }
        setTimeout(() => setScanState('idle'), 4000)
      } else {
        const errCode = res.error?.code
        const errMsg = res.error?.message || 'خطأ أثناء المسح'
        if (errCode === 'NOT_ENROLLED') {
          setScanState('not-enrolled')
          setScanMessage('الطالب غير مسجل في هذا الفوج')
        } else {
          setScanState('invalid')
          setScanMessage(errMsg)
        }
        if (sound) playBeep('error')
        setTimeout(() => setScanState('idle'), 3500)
      }
    } catch (err: any) {
      setScanState('invalid')
      setScanMessage(err?.message || 'خطأ مسح')
      if (sound) playBeep('error')
      setTimeout(() => setScanState('idle'), 3000)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      processScan(tokenInput)
      setTokenInput('')
    }
  }

  // Add manual attendance
  const handleAddManual = async () => {
    if (!api || !activeSession || !manualStudentId) return
    try {
      await api.attendance.markSession(activeSession.id, Number(manualStudentId), manualStatus)
      setManualModal(false)
      setManualStudentId('')
      loadGroupDetails()
    } catch (err) {
      console.error(err)
    }
  }

  const presentCount = rosterStudents.filter(r => r.attendanceStatus === 'present' || r.attendanceStatus === 'late').length
  const inactiveCount = rosterStudents.filter(r => r.attendanceStatus === 'inactive' || r.isInactive === 1).length
  const absentCount = rosterStudents.filter(r => !r.attendanceStatus || r.attendanceStatus === 'absent').length
  const totalStudents = rosterStudents.length
  const attendanceRate = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0

  const scanStateConfig = {
    idle: {
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      icon: ScanLine,
      iconColor: 'text-slate-400',
      label: mode === 'attendance' ? 'امسح رمز QR أو بطاقة الطالب' : 'وضع البحث السريع (معاينة فقط)',
      sublabel: mode === 'attendance' ? 'وجّه القارئ نحو الرمز أو أدخل المعرف يدوياً' : 'امسح للاستعلام عن الطالب دون تسجيل حضور'
    },
    success: {
      bg: 'bg-green-50',
      border: 'border-green-300',
      icon: CheckCircle,
      iconColor: 'text-green-500',
      label: scannedStudent ? `${scannedStudent.lastNameAr || scannedStudent.lastNameFr || ''} ${scannedStudent.firstNameAr || scannedStudent.firstNameFr || ''}`.trim() : '',
      sublabel: scanMessage
    },
    already: {
      bg: 'bg-amber-50',
      border: 'border-amber-300',
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
      label: scannedStudent ? `${scannedStudent.lastNameAr || scannedStudent.lastNameFr || ''} ${scannedStudent.firstNameAr || scannedStudent.firstNameFr || ''}`.trim() : '',
      sublabel: scanMessage
    },
    invalid: {
      bg: 'bg-red-50',
      border: 'border-red-300',
      icon: XCircle,
      iconColor: 'text-red-500',
      label: 'رمز غير صالح أو خطأ',
      sublabel: scanMessage
    },
    'not-enrolled': {
      bg: 'bg-orange-50',
      border: 'border-orange-300',
      icon: AlertTriangle,
      iconColor: 'text-orange-500',
      label: 'الطالب غير مسجل في هذا الفوج',
      sublabel: scanMessage
    },
    overdue: {
      bg: 'bg-red-50',
      border: 'border-red-400',
      icon: AlertTriangle,
      iconColor: 'text-red-600',
      label: 'تنبيه: الطالب متأخر في الدفع',
      sublabel: scanMessage
    }
  }

  const cfg = scanStateConfig[scanState]
  const CfgIcon = cfg.icon

  return (
    <div className="grid grid-cols-3 gap-5 h-full" dir="rtl">
      {/* Left: Scanner & Sessions */}
      <div className="col-span-2 flex flex-col gap-4">
        {/* Session config header */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md">
                📅 {dayNameAr}
              </span>
              {matchingSchedule ? (
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                  🕒 الحصة المجدولة: {matchingSchedule.startTime} - {matchingSchedule.endTime} ({matchingSchedule.room || 'القاعة الرئيسية'})
                </span>
              ) : (
                <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                  لا يوجد توقيت مجدول لهذا اليوم (حصة استثنائية أو تعويضية)
                </span>
              )}
            </div>

            {activeSession && activeSession.sessionType === 'cancelled' && (
              <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-md">
                الحصة ملغاة: {activeSession.cancelledReason || 'بدون سبب'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">المادة</label>
              <select
                value={selectedCourse}
                onChange={e => setSelectedCourse(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
              >
                {courses.map(c => <option key={c.id} value={c.id}>{c.nameAr || c.nameFr || c.nameEn}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">الفوج / المجموعة</label>
              <select
                value={selectedGroup}
                onChange={e => setSelectedGroup(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
              >
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">التاريخ والوقت</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={sessionDate}
                  onChange={e => setSessionDate(e.target.value)}
                  className="w-full px-2 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-medium"
                />
                <input
                  type="time"
                  value={sessionTime}
                  onChange={e => setSessionTime(e.target.value)}
                  className="w-20 px-2 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
                />
              </div>
            </div>
            <div>
              {!activeSession ? (
                <button
                  onClick={handleStartSession}
                  disabled={loading || !selectedGroup}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Plus size={14} /> بدء تسجيل الحضور
                </button>
              ) : (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-2 py-1.5 gap-1">
                  <div className="flex items-center gap-1.5 text-xs text-green-700 font-semibold truncate">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                    جارية
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleEndSession}
                      className="px-2 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded transition-colors"
                      title="إنهاء الجلسة وحفظ السجلات"
                    >
                      إنهاء
                    </button>
                    <button
                      onClick={() => setCancelModalOpen(true)}
                      className="px-2 py-1 text-xs font-semibold text-red-600 hover:text-white hover:bg-red-600 border border-red-200 rounded transition-colors"
                      title="إلغاء هذه الحصة"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Debt Banner Alert (if applicable during scan) */}
        {debtAlertMessage && (
          <div className="p-3 bg-red-50 border-2 border-red-300 rounded-xl flex items-center gap-3 text-red-800 text-sm font-bold shadow-sm animate-bounce">
            <ShieldAlert size={22} className="text-red-600 shrink-0" />
            <span>{debtAlertMessage}</span>
          </div>
        )}

        {/* Mode Toggle & Scanner */}
        <div className={`bg-white rounded-xl border-2 shadow-sm p-7 flex flex-col items-center justify-center transition-all duration-300 relative ${cfg.border} ${cfg.bg}`}>
          {/* Mode Switcher */}
          <div className="absolute top-3 left-3 flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setMode('attendance')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${mode === 'attendance' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              تسجيل الحضور
            </button>
            <button
              onClick={() => setMode('lookup')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${mode === 'lookup' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              معاينة سريعة
            </button>
          </div>

          <CfgIcon size={56} className={`mb-3 ${cfg.iconColor} transition-all`} />

          {scanState === 'success' && scannedStudent?.photoUrl && (
            <img
              src={scannedStudent.photoUrl}
              alt=""
              className="w-16 h-16 rounded-full object-cover border-4 border-green-300 mb-2 -mt-1 shadow"
            />
          )}

          <p className="text-lg font-bold text-slate-900 text-center">{cfg.label}</p>
          <p className="text-sm text-slate-500 mt-0.5 text-center">{cfg.sublabel}</p>

          <div className="mt-5 flex gap-2.5 w-full max-w-md">
            <input
              ref={inputRef}
              type="text"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="امسح الرمز أو اكتب رقم الطالب..."
              className="flex-1 px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono bg-white text-right"
              dir="rtl"
            />
            <button
              onClick={() => { processScan(tokenInput); setTokenInput('') }}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
            >
              مسح
            </button>
          </div>
        </div>

        {/* Live Attendance / Roster List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-white">
            <h3 className="text-sm font-semibold text-slate-800">
              قائمة طلاب الفوج ({rosterStudents.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setManualModal(true)}
                disabled={!activeSession}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <Plus size={12} /> إضافة يدوية
              </button>
              <button
                onClick={() => (window as any).schoolApp?.app.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Printer size={12} /> طباعة القائمة
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-72">
            {rosterStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <ScanLine size={32} className="mb-2 opacity-50" />
                <p className="text-sm">لا يوجد طلاب مسجلين في هذا الفوج</p>
                {!activeSession && <p className="text-xs text-slate-400 mt-1">ابدأ الحصة لتسجيل الحضور وتحديث الأرصدة</p>}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 sticky top-0">
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">الطالب</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">رقم الطالب</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">الرصيد المالي</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">الحالة</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">تعديل الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rosterStudents.map(s => {
                    const fullNameAr = `${s.lastNameAr || s.lastNameFr || ''} ${s.firstNameAr || s.firstNameFr || ''}`.trim()
                    const isInactive = s.attendanceStatus === 'inactive' || s.isInactive === 1
                    const isPresent = s.attendanceStatus === 'present' || s.attendanceStatus === 'late'
                    const isAbsent = !s.attendanceStatus || s.attendanceStatus === 'absent'

                    const bal = s.creditBalance ?? 0
                    const inDebt = bal < 0

                    return (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 flex items-center gap-2.5">
                          {s.photoUrl ? (
                            <img src={s.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover bg-slate-100" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                              {s.firstNameAr?.charAt(0) || s.firstNameFr?.charAt(0) || '؟'}
                            </div>
                          )}
                          <span className="font-medium text-slate-800">{fullNameAr}</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{s.studentNumber}</td>
                        <td className="px-4 py-2.5 text-xs font-bold">
                          <span className={inDebt ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded' : 'text-green-700'}>
                            {bal.toLocaleString('ar-DZ')} دج
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {isInactive ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                              غير نشط
                            </span>
                          ) : isPresent ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700">
                              حضر
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700">
                              غاب
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-left">
                          {activeSession && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleSetStudentStatus(s.id, 'present')}
                                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${isPresent ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-green-50 hover:text-green-700'}`}
                              >
                                حضر
                              </button>
                              <button
                                onClick={() => handleSetStudentStatus(s.id, 'absent')}
                                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${isAbsent && !isInactive ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-700'}`}
                              >
                                غاب
                              </button>
                              <button
                                onClick={() => handleSetStudentStatus(s.id, 'inactive')}
                                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${isInactive ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                              >
                                غير نشط
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Right: Stats & Overview */}
      <div className="flex flex-col gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">التنبيه الصوتي</span>
          <button
            onClick={() => setSound(s => !s)}
            className={`p-1.5 rounded-lg border transition-colors ${sound ? 'bg-blue-50 text-blue-600 border-blue-200' : 'text-slate-400 border-slate-200 hover:bg-slate-50'}`}
          >
            {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-xl p-3.5 text-center border border-green-100">
            <p className="text-3xl font-bold text-green-700">{presentCount}</p>
            <p className="text-xs text-green-800 font-medium mt-0.5">حاضرون</p>
          </div>
          <div className="bg-slate-100 rounded-xl p-3.5 text-center border border-slate-200">
            <p className="text-3xl font-bold text-slate-700">{inactiveCount}</p>
            <p className="text-xs text-slate-800 font-medium mt-0.5">غير نشطين</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3.5 text-center border border-red-100">
            <p className="text-3xl font-bold text-red-700">{absentCount}</p>
            <p className="text-xs text-red-800 font-medium mt-0.5">غائبون</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-slate-600 font-medium">نسبة الحضور</span>
            <span className="text-sm font-bold text-blue-700">{attendanceRate}%</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${attendanceRate}%` }} />
          </div>
        </div>

        {/* Debt Students in Group */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1 flex flex-col overflow-hidden">
          <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <ShieldAlert size={14} /> الطلاب المتأخرون في الدفع ({rosterStudents.filter(s => (s.creditBalance ?? 0) < 0).length})
          </h4>
          <div className="space-y-2 overflow-y-auto flex-1 max-h-56">
            {rosterStudents
              .filter(s => (s.creditBalance ?? 0) < 0)
              .map(s => {
                const fullNameAr = `${s.lastNameAr || s.lastNameFr || ''} ${s.firstNameAr || s.firstNameFr || ''}`.trim()
                return (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-red-800">{fullNameAr}</span>
                      <span className="text-[10px] font-mono text-slate-400">({s.studentNumber})</span>
                    </div>
                    <span className="text-xs font-bold text-red-600 font-mono">{s.creditBalance?.toLocaleString('ar-DZ')} دج</span>
                  </div>
                )
              })}
            {rosterStudents.filter(s => (s.creditBalance ?? 0) < 0).length === 0 && (
              <p className="text-xs text-green-600 font-medium py-4 text-center">لا توجد ديون مستحقة على طلاب هذا الفوج !</p>
            )}
          </div>
        </div>
      </div>

      {/* Manual Attendance Modal */}
      <Modal open={manualModal} onClose={() => setManualModal(false)} title="تسجيل حضور يدوي" size="sm">
        <div className="space-y-4" dir="rtl">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">الطالب</label>
            <select
              value={manualStudentId}
              onChange={e => setManualStudentId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
            >
              <option value="">اختر طالباً...</option>
              {rosterStudents.map(s => {
                const name = `${s.lastNameAr || s.lastNameFr || ''} ${s.firstNameAr || s.firstNameFr || ''}`.trim()
                return <option key={s.id} value={s.id}>{name} ({s.studentNumber})</option>
              })}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">الحالة</label>
            <select
              value={manualStatus}
              onChange={e => setManualStatus(e.target.value as any)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
            >
              <option value="present">حضر</option>
              <option value="absent">غاب</option>
              <option value="inactive">غير نشط</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setManualModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">إلغاء</button>
            <button onClick={handleAddManual} disabled={!manualStudentId} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg">حفظ</button>
          </div>
        </div>
      </Modal>

      {/* Lookup Mode Result Modal */}
      <Modal open={lookupResult !== null} onClose={() => setLookupResult(null)} title="معاينة بيانات الطالب" size="md">
        {lookupResult && (
          <div className="space-y-4" dir="rtl">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xl text-blue-600 border">
                {lookupResult.student.firstNameAr?.charAt(0) || lookupResult.student.firstNameFr?.charAt(0) || '؟'}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {lookupResult.student.lastNameAr || lookupResult.student.lastNameFr} {lookupResult.student.firstNameAr || lookupResult.student.firstNameFr}
                </h3>
                <p className="text-xs font-mono text-slate-500">{lookupResult.student.studentNumber}</p>
                <div className="flex gap-2 mt-1">
                  <Badge variant={lookupResult.student.status === 'active' ? 'active' : 'inactive'}>
                    {lookupResult.student.status === 'active' ? 'نشط' : 'غير نشط'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg">
                <span className="text-slate-400 block mb-1">إجمالي الحضور</span>
                <span className="text-sm font-bold text-green-700">{lookupResult.summary?.presentCount ?? 0} حصص</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <span className="text-slate-400 block mb-1">الغيابات</span>
                <span className="text-sm font-bold text-red-600">{lookupResult.summary?.absentCount ?? 0} حصص</span>
              </div>
            </div>

            {lookupResult.enrollments && lookupResult.enrollments.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">التسجيلات الحالية</h4>
                <div className="space-y-1.5">
                  {lookupResult.enrollments.map((en: any) => (
                    <div key={en.id} className="p-2 rounded bg-slate-50 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-semibold text-slate-800">{en.group?.name || 'الفوج'}</span>
                        <span className="text-slate-500 mr-2">({en.group?.course?.nameAr || en.group?.course?.nameFr || 'المادة'})</span>
                      </div>
                      <span className="font-mono text-blue-700 font-semibold">{en.agreedPrice} دج</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={() => setLookupResult(null)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">إغلاق</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel Session Modal */}
      <Modal open={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="إلغاء الحصة" size="sm">
        <div className="space-y-4" dir="rtl">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            سيؤدي هذا الإجراء إلى تعيين الحصة كـ <strong>ملغاة</strong> وإغلاق جلسة تسجيل الحضور.
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">سبب الإلغاء *</label>
            <select
              value={cancelReasonPreset}
              onChange={e => setCancelReasonPreset(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
            >
              <option value="غياب الأستاذ">غياب الأستاذ</option>
              <option value="عطلة رسمية / إجازة مدرسية">عطلة رسمية / إجازة مدرسية</option>
              <option value="سوء الأحوال الجوية">سوء الأحوال الجوية</option>
              <option value="مشكلة تقنية / القاعة غير متوفرة">مشكلة تقنية / القاعة غير متوفرة</option>
              <option value="other">سبب آخر...</option>
            </select>
          </div>

          {cancelReasonPreset === 'other' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">يرجى توضيح السبب:</label>
              <input
                type="text"
                placeholder="مثال: اجتماع طارئ..."
                value={cancelCustomReason}
                onChange={e => setCancelCustomReason(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                autoFocus
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setCancelModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              رجوع
            </button>
            <button
              onClick={handleConfirmCancelSession}
              className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm"
            >
              تأكيد الإلغاء
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
