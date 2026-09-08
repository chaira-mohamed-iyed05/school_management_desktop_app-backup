import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Edit2, QrCode, RefreshCw, Archive,
  Phone, MapPin, Calendar, User, Shield, CreditCard,
  BookOpen, Clock, CheckCircle2, XCircle, StickyNote,
  Plus, AlertCircle, ArrowRightLeft, X, Check, ChevronDown, RotateCcw, AlertTriangle, Trash2
} from 'lucide-react'
import type { Student, Payment, Group, Course, Teacher } from '@shared/types/index'
import { getCourseName, formatCurrency } from '../utils/format'
import QRCode from 'qrcode'

// Convert Eastern Arabic numerals (٠-٩) and Persian numerals (۰-۹) to standard ASCII (0-9)
function normalizeNumberInput(val: string): string {
  const ascii = val
    .replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
    .replace(/[۰-۹]/g, (d) => '0123456789'['۰۱۲۳۴۵٦٧٨٩'.indexOf(d)])
  return ascii.replace(/[^0-9.]/g, '')
}

function FilterCombobox({
  label,
  placeholder,
  value,
  onChange,
  options,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (val: string) => void
  options: string[]
}) {
  const [open, setOpen] = useState(false)

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(value.toLowerCase().trim())
  )

  return (
    <div className="relative w-full">
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full text-xs bg-white border border-slate-300 rounded-xl ps-3 pe-8 py-2.5 font-medium focus:ring-2 focus:ring-[#2563EB] focus:outline-none shadow-2xs"
        />
        {value ? (
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className="absolute right-2 text-slate-400 hover:text-slate-600 p-1"
          >
            <X size={13} />
          </button>
        ) : (
          <ChevronDown
            size={14}
            className="absolute right-2 text-slate-400 pointer-events-none"
          />
        )}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 text-xs">
            <div
              onClick={() => { onChange(''); setOpen(false); }}
              className="px-3 py-1.5 cursor-pointer hover:bg-slate-100 font-bold text-slate-400 border-b border-slate-100"
            >
              -- {label} --
            </div>
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-slate-400 italic">
                لا توجد نتائج
              </div>
            ) : (
              filteredOptions.map(opt => (
                <div
                  key={opt}
                  onClick={() => { onChange(opt); setOpen(false); }}
                  className={`px-3 py-2 cursor-pointer hover:bg-blue-50 hover:text-[#2563EB] font-medium transition-colors ${
                    value === opt ? 'bg-blue-50 text-[#2563EB] font-bold' : 'text-slate-700'
                  }`}
                >
                  {opt}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

type Tab = 'overview' | 'attendance' | 'payments' | 'enrollments' | 'notes'

interface EnrollmentWithDetails {
  id: number
  studentId: number
  groupId: number
  agreedPrice: number
  enrollmentDate: string
  status: string
  groupName?: string
  courseName?: string
  teacherName?: string
  balance?: number
  sessionsUsed?: number
}

interface NoteItem {
  id: number
  noteText: string
  adminName?: string
  createdAt: string
}

interface SessionHistoryItem {
  sessionId: number
  sessionDate: string
  plannedStartTime: string | null
  endTime: string | null
  sessionStatus: string
  sessionType: string
  groupId: number
  groupName: string
  courseNameAr: string
  courseNameFr: string
  teacherName: string | null
  attendanceStatus: 'present' | 'absent' | 'inactive' | 'not_active' | 'unmarked'
  scannedAt: string | null
  source: string | null
}

export default function StudentProfile() {
  const { t, i18n } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const lang = i18n.language as 'ar' | 'fr' | 'en'

  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  // Render student QR code to canvas whenever student or token updates
  const renderQrCode = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas || !student?.qrToken) return
    QRCode.toCanvas(canvas, student.qrToken, {
      width: 150,
      margin: 1,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    }).catch((err) => {
      console.error('Failed to generate student QR code:', err)
    })
  }, [student?.qrToken])

  const qrCanvasCallback = useCallback((node: HTMLCanvasElement | null) => {
    qrCanvasRef.current = node
    if (node) {
      renderQrCode(node)
    }
  }, [renderQrCode])

  useEffect(() => {
    if (qrCanvasRef.current) {
      renderQrCode(qrCanvasRef.current)
    }
  }, [renderQrCode])

  // Tab data
  const [enrollments, setEnrollments] = useState<EnrollmentWithDetails[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([])
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [newNote, setNewNote] = useState(() => (id ? sessionStorage.getItem(`draft_note_${id}`) || '' : ''))
  const [savingNote, setSavingNote] = useState(false)
  const [tabLoading, setTabLoading] = useState(false)

  // Available groups/courses/teachers for adding enrollment or transfer
  const [availableGroups, setAvailableGroups] = useState<Group[]>([])
  const [availableCourses, setAvailableCourses] = useState<Course[]>([])
  const [availableTeachers, setAvailableTeachers] = useState<Teacher[]>([])

  // Modal: Add Enrollment with Hierarchical Combobox Filter
  const [showAddEnrollModal, setShowAddEnrollModal] = useState(false)
  const [newEnrollGroupId, setNewEnrollGroupId] = useState('')
  const [modalModule, setModalModule] = useState('')
  const [modalTeacher, setModalTeacher] = useState('')
  const [modalGroup, setModalGroup] = useState('')
  const [savingEnroll, setSavingEnroll] = useState(false)

  // Modal: Transfer Credit (Idea Implementation)
  const [transferModalSource, setTransferModalSource] = useState<EnrollmentWithDetails | null>(null)
  const [transferTargetEnrollId, setTransferTargetEnrollId] = useState('')
  const [transferAmount, setTransferAmount] = useState('1000')
  const [transferCloseSource, setTransferCloseSource] = useState(true)
  const [transferReason, setTransferReason] = useState('')
  const [savingTransfer, setSavingTransfer] = useState(false)

  // Helper to load enrollments along with their credit balances
  const loadEnrollmentsWithBalances = useCallback(async (studentId: number) => {
    const res = await window.schoolApp.enrollments.byStudent(studentId)
    if (res.success && res.data) {
      const list = res.data as EnrollmentWithDetails[]
      const withBalances = await Promise.all(
        list.map(async (e) => {
          try {
            const balRes = await window.schoolApp.payments.balance(e.id)
            if (balRes.success && balRes.data) {
              return {
                ...e,
                balance: balRes.data.balance,
                sessionsUsed: balRes.data.sessionsUsed,
              }
            }
          } catch { /* ignore */ }
          return { ...e, balance: 0, sessionsUsed: 0 }
        })
      )
      setEnrollments(withBalances)
    }
  }, [])

  const load = useCallback(async () => {
    const res = await window.schoolApp.students.getById(Number(id))
    if (res.success && res.data) {
      setStudent(res.data)
      // Always load enrollments with balances immediately so profile debt/balance badge is accurate on any tab
      await loadEnrollmentsWithBalances(res.data.id)
      if (res.data.photoPath) {
        try {
          const photoRes = await window.schoolApp.media.getImageUrl(res.data.photoPath)
          if (photoRes.success && photoRes.data?.url) setPhotoUrl(photoRes.data.url)
        } catch { /* ignore */ }
      }
    }
    setLoading(false)
  }, [id, loadEnrollmentsWithBalances])

  useEffect(() => { load() }, [load])

  // Helper to load session history for student
  const loadSessionHistory = useCallback(async (studentId: number) => {
    try {
      const res = await window.schoolApp.attendance.getSessionHistory(studentId)
      const data = (res as any)?.data ?? res
      if (Array.isArray(data)) setSessionHistory(data)
    } catch (err) {
      console.error('Failed to load session history:', err)
    }
  }, [])

  // Helper to load notes for student
  const loadStudentNotes = useCallback(async (studentId: number) => {
    try {
      const res = await window.schoolApp.notes.list(studentId)
      if (res.success && Array.isArray(res.data)) {
        setNotes(res.data.map((n: any) => ({
          id: n.id,
          noteText: n.noteText,
          adminName: n.createdByName ?? t('common.administrator'),
          createdAt: n.createdAt,
        })))
      }
    } catch (err) {
      console.error('Failed to load notes:', err)
    }
  }, [t])

  // Load tab data when switching
  useEffect(() => {
    if (!student) return
    setTabLoading(true)

    async function loadTabData() {
      try {
        await loadEnrollmentsWithBalances(student!.id)
        if (activeTab === 'enrollments' || activeTab === 'overview') {
          const [grpRes, crsRes, tchRes] = await Promise.all([
            window.schoolApp.groups.list({ status: 'active' }),
            window.schoolApp.courses.list({ status: 'active' }),
            window.schoolApp.teachers.list({ status: 'active' }),
          ])
          if (grpRes.success && grpRes.data) setAvailableGroups(grpRes.data)
          if (crsRes.success && crsRes.data) setAvailableCourses(crsRes.data)
          if (tchRes.success && tchRes.data) setAvailableTeachers(tchRes.data)
        }
        if (activeTab === 'attendance') {
          await loadSessionHistory(student!.id)
        }
        if (activeTab === 'payments') {
          const res = await window.schoolApp.payments.byStudent(student!.id)
          if (res.success && res.data) setPayments(res.data)
        }
        if (activeTab === 'notes') {
          await loadStudentNotes(student!.id)
        }
      } finally {
        setTabLoading(false)
      }
    }

    loadTabData()
  }, [activeTab, student, loadEnrollmentsWithBalances, loadSessionHistory, loadStudentNotes])

  // ─── Cascaded Combobox Options & Auto-fill Logic for Enrollment Modal ────────
  const getCourseNameHelper = useCallback((c: Course) => getCourseName(c, lang), [lang])

  const getTeacherName = useCallback((t: Teacher) => {
    const fullName = `${t.lastName ?? ''} ${t.firstName ?? ''}`.trim()
    return fullName || `Prof #${t.id}`
  }, [])

  // Modules list
  const moduleOptions = useMemo(() => {
    const set = new Set<string>()
    availableCourses.forEach(c => {
      const name = getCourseNameHelper(c)
      if (name) set.add(name)
    })
    return Array.from(set).sort()
  }, [availableCourses, getCourseNameHelper])

  // Teachers list (filtered by modalModule if selected)
  const teacherOptions = useMemo(() => {
    let filtered = availableTeachers
    if (modalModule) {
      const course = availableCourses.find(c => getCourseName(c, lang).toLowerCase() === modalModule.toLowerCase())
      if (course) {
        filtered = filtered.filter(t => t.courseId === course.id)
      }
    }
    const set = new Set<string>()
    filtered.forEach(t => {
      const name = getTeacherName(t)
      if (name) set.add(name)
    })
    return Array.from(set).sort()
  }, [availableTeachers, availableCourses, modalModule, getTeacherName, lang])

  // Groups list & map (filtered by modalModule & modalTeacher if selected)
  const groupOptionsMap = useMemo(() => {
    let filtered = availableGroups
    if (modalModule) {
      const course = availableCourses.find(c => getCourseName(c, lang).toLowerCase() === modalModule.toLowerCase())
      if (course) {
        filtered = filtered.filter(g => g.courseId === course.id)
      }
    }
    if (modalTeacher) {
      const teacher = availableTeachers.find(t => getTeacherName(t).toLowerCase() === modalTeacher.toLowerCase())
      if (teacher) {
        filtered = filtered.filter(g => g.teacherId === teacher.id)
      }
    }
    const map = new Map<string, Group>()
    filtered.forEach(g => {
      const c = availableCourses.find(crs => crs.id === g.courseId)
      const cName = c ? getCourseName(c, lang) : ''
      const label = `${cName ? `${cName} — ` : ''}${g.name}`
      map.set(label, g)
    })
    return map
  }, [availableGroups, availableCourses, availableTeachers, modalModule, modalTeacher, getTeacherName, lang])

  const groupOptions = useMemo(() => {
    return Array.from(groupOptionsMap.keys()).sort()
  }, [groupOptionsMap])

  // Cascading Change Handlers
  const handleModalModuleChange = (newMod: string) => {
    setModalModule(newMod)
    if (!newMod) {
      setModalTeacher('')
      setModalGroup('')
      setNewEnrollGroupId('')
      return
    }
    if (modalTeacher) {
      const course = availableCourses.find(c => getCourseName(c, lang).toLowerCase() === newMod.toLowerCase())
      const teacher = availableTeachers.find(t => getTeacherName(t).toLowerCase() === modalTeacher.toLowerCase())
      if (course && teacher && teacher.courseId !== course.id) {
        setModalTeacher('')
        setModalGroup('')
        setNewEnrollGroupId('')
      }
    }
  }

  const handleModalTeacherChange = (newTeacher: string) => {
    setModalTeacher(newTeacher)
    if (!newTeacher) {
      setModalGroup('')
      setNewEnrollGroupId('')
      return
    }
    // Auto-fill module if skipped directly to teacher!
    const teacher = availableTeachers.find(t => getTeacherName(t).toLowerCase() === newTeacher.toLowerCase())
    if (teacher && teacher.courseId) {
      const course = availableCourses.find(c => c.id === teacher.courseId)
      if (course) {
        setModalModule(getCourseName(course, lang))
      }
    }
    if (modalGroup) {
      const selectedGrp = groupOptionsMap.get(modalGroup)
      if (selectedGrp && teacher && selectedGrp.teacherId !== teacher.id) {
        setModalGroup('')
        setNewEnrollGroupId('')
      }
    }
  }

  const handleModalGroupChange = (newGroupLabel: string) => {
    setModalGroup(newGroupLabel)
    if (!newGroupLabel) {
      setNewEnrollGroupId('')
      return
    }
    let targetGrp = groupOptionsMap.get(newGroupLabel)
    if (!targetGrp) {
      for (const g of availableGroups) {
        const c = availableCourses.find(crs => crs.id === g.courseId)
        const cName = c ? getCourseName(c, lang) : ''
        const label = `${cName ? `${cName} — ` : ''}${g.name}`
        if (label.toLowerCase() === newGroupLabel.toLowerCase()) {
          targetGrp = g
          break
        }
      }
    }

    if (targetGrp) {
      setNewEnrollGroupId(String(targetGrp.id))
      // Auto-fill teacher & module if skipped directly to group!
      if (targetGrp.teacherId) {
        const teacher = availableTeachers.find(t => t.id === targetGrp.teacherId)
        if (teacher) {
          setModalTeacher(getTeacherName(teacher))
          if (teacher.courseId) {
            const course = availableCourses.find(c => c.id === teacher.courseId)
            if (course) setModalModule(getCourseName(course, lang))
          }
        }
      } else if (targetGrp.courseId) {
        const course = availableCourses.find(c => c.id === targetGrp.courseId)
        if (course) setModalModule(getCourseName(course, lang))
      }
    }
  }

  const handleOpenAddEnrollModal = () => {
    setModalModule('')
    setModalTeacher('')
    setModalGroup('')
    setNewEnrollGroupId('')
    setShowAddEnrollModal(true)
  }

  const handleRegenQR = async () => {
    if (!student) return
    if (!window.confirm(t('students.regenQRConfirm'))) return
    const res = await window.schoolApp.students.regenQR(student.id)
    if (res.success) await load()
  }

  const handleArchive = async () => {
    if (!student) return
    if (!window.confirm(t('students.archiveConfirm'))) return
    await window.schoolApp.students.archive(student.id)
    navigate('/students')
  }

  const handleRestore = async () => {
    if (!student) return
    if (!window.confirm(t('students.restoreConfirm') || 'Restaurer cet étudiant ?')) return
    await window.schoolApp.students.update(student.id, { status: 'active' } as any)
    await window.schoolApp.students.regenQR(student.id)
    await load()
  }

  const handleChangePhoto = async () => {
    if (!student) return
    const res = await window.schoolApp.media.selectImage('student', String(student.id))
    if (res.success && res.data?.path) {
      await window.schoolApp.students.update(student.id, { photoPath: res.data.path } as any)
      const photoRes = await window.schoolApp.media.getImageUrl(res.data.path)
      if (photoRes.success && photoRes.data?.url) setPhotoUrl(photoRes.data.url)
    }
  }

  // Toggle enrollment status specifically per module (Active <-> Inactive)
  const handleToggleEnrollmentStatus = async (enrollId: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active'
    const confirmMsg = nextStatus === 'inactive'
      ? t('students.suspendConfirm')
      : t('students.reactivateConfirm')
    if (!window.confirm(confirmMsg)) return

    await window.schoolApp.enrollments.update(enrollId, { status: nextStatus })
    if (student) await loadEnrollmentsWithBalances(student.id)
  }

  // Mark student in a specific session (Present, Absent, Inactive)
  const handleMarkStudentInSession = async (sessionId: number, newStatus: 'present' | 'absent' | 'inactive') => {
    if (!student) return
    try {
      const res = await window.schoolApp.attendance.markSession(sessionId, student.id, newStatus)
      if (res.success) {
        await loadSessionHistory(student.id)
        await loadEnrollmentsWithBalances(student.id)
      }
    } catch (err: any) {
      alert(err?.message ?? t('common.error'))
    }
  }

  // Cancel Enrollment (Atomic refund remaining balance & mark cancelled)
  const handleCancelEnrollment = async (enroll: EnrollmentWithDetails) => {
    if (!student) return
    const bal = enroll.balance ?? 0
    const confirmMsg = bal > 0
      ? `${t('students.cancelEnrollmentConfirm')} (${t('payments.refund')}: ${bal.toLocaleString()} DA)`
      : t('students.cancelEnrollmentConfirm')
    if (!window.confirm(confirmMsg)) return

    try {
      const res = await window.schoolApp.enrollments.cancel(enroll.id, student.id)
      if (res.success) {
        alert(t('students.enrollmentCancelledSuccess'))
        await loadEnrollmentsWithBalances(student.id)
        const payListRes = await window.schoolApp.payments.byStudent(student.id)
        if (payListRes.success && payListRes.data) setPayments(payListRes.data)
      } else {
        alert(res.error ?? t('common.error'))
      }
    } catch (err: any) {
      alert(err?.message ?? t('common.error'))
    }
  }

  // Add new enrollment from profile (uses group monthlyPrice by default)
  const handleAddEnrollment = async () => {
    if (!student || !newEnrollGroupId) return
    setSavingEnroll(true)
    try {
      const selectedGrp = availableGroups.find((g) => g.id === Number(newEnrollGroupId))
      if (!selectedGrp) {
        alert(t('students.selectGroupFirst'))
        return
      }

      const res = await window.schoolApp.enrollments.create({
        studentId: student.id,
        groupId: Number(newEnrollGroupId),
        agreedPrice: selectedGrp.monthlyPrice || 0,
        enrollmentDate: new Date().toISOString().slice(0, 10),
      })

      if (res.success) {
        setShowAddEnrollModal(false)
        setNewEnrollGroupId('')
        setModalModule('')
        setModalTeacher('')
        setModalGroup('')
        await loadEnrollmentsWithBalances(student.id)
      } else {
        alert(res.error)
      }
    } finally {
      setSavingEnroll(false)
    }
  }

  // Execute Credit Transfer between courses (Atomic 100% positive balance transfer)
  const handleExecuteCreditTransfer = async () => {
    if (!student || !transferModalSource || !transferTargetEnrollId) return
    setSavingTransfer(true)
    try {
      const res = await window.schoolApp.payments.transfer({
        fromEnrollmentId: transferModalSource.id,
        toEnrollmentId: Number(transferTargetEnrollId),
        studentId: student.id,
      })

      if (res.success) {
        setTransferModalSource(null)
        setTransferTargetEnrollId('')
        setTransferReason('')

        // Reload data
        await loadEnrollmentsWithBalances(student.id)
        const payListRes = await window.schoolApp.payments.byStudent(student.id)
        if (payListRes.success && payListRes.data) setPayments(payListRes.data)

        alert(t('students.transferSuccess'))
      } else {
        alert(res.error ?? t('common.error'))
      }
    } catch (err: any) {
      alert(err?.message ?? t('common.error'))
    } finally {
      setSavingTransfer(false)
    }
  }

  // Student Notes CRUD
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [editingNoteText, setEditingNoteText] = useState('')
  const [savingEditNote, setSavingEditNote] = useState(false)

  const handleCreateNote = async () => {
    if (!student || !newNote.trim() || savingNote) return
    setSavingNote(true)
    const textToSave = newNote.trim()
    try {
      const res = await window.schoolApp.notes.create({
        studentId: student.id,
        noteText: textToSave,
      })
      if (res.success) {
        if (res.data) {
          setNotes(prev => [{
            id: res.data.id,
            noteText: res.data.noteText,
            adminName: res.data.createdByName ?? t('common.administrator'),
            createdAt: res.data.createdAt,
          }, ...prev])
        }
        setNewNote('')
        if (student) sessionStorage.removeItem(`draft_note_${student.id}`)
      } else {
        alert(res.error ?? t('common.error'))
      }
    } catch (err: any) {
      alert(err?.message ?? t('common.error'))
    } finally {
      setSavingNote(false)
    }
  }

  const handleUpdateNote = async (noteId: number) => {
    if (!editingNoteText.trim() || savingEditNote) return
    setSavingEditNote(true)
    try {
      const res = await window.schoolApp.notes.update(noteId, editingNoteText.trim())
      if (res.success) {
        if (res.data) {
          setNotes(prev => prev.map(n => n.id === noteId ? {
            ...n,
            noteText: res.data.noteText,
          } : n))
        }
        setEditingNoteId(null)
        setEditingNoteText('')
      } else {
        alert(res.error ?? t('common.error'))
      }
    } catch (err: any) {
      alert(err?.message ?? t('common.error'))
    } finally {
      setSavingEditNote(false)
    }
  }

  const handleDeleteNote = async (noteId: number) => {
    if (!window.confirm(t('students.deleteNoteConfirm') || 'Are you sure you want to delete this note?')) return
    try {
      const res = await window.schoolApp.notes.delete(noteId)
      if (res.success) {
        setNotes(prev => prev.filter(n => n.id !== noteId))
      } else {
        alert(res.error ?? t('common.error'))
      }
    } catch (err: any) {
      alert(err?.message ?? t('common.error'))
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-7 h-7 border-2 border-[#2563EB] border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!student) {
    return <div className="text-center py-20 text-slate-400">{t('errors.STUDENT_NOT_FOUND')}</div>
  }

  const initials = student.firstNameAr.charAt(0) + student.lastNameAr.charAt(0)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: t('students.overview') },
    { key: 'attendance', label: t('students.courseHistory') },
    { key: 'payments', label: t('nav.payments') },
    { key: 'enrollments', label: t('students.enrollments') },
    { key: 'notes', label: t('common.notes') },
  ]

  // Net student debt across active enrollments
  const totalNetBalance = enrollments.reduce((acc, e) => acc + (e.balance ?? 0), 0)
  const isStudentInDebt = totalNetBalance < 0

  return (
    <div className="animate-fade-in space-y-5">
      {/* Top toolbar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm transition-colors font-medium"
        >
          <ArrowLeft size={15} /> {t('common.back')}
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/students/${student.id}/card`)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <QrCode size={13} /> {t('students.card')}
          </button>
          <button
            onClick={() => navigate(`/students/${student.id}/edit`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] text-white rounded-lg text-xs font-semibold hover:bg-[#1D4ED8] transition-colors shadow-xs"
          >
            <Edit2 size={13} /> {t('common.edit')}
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── LEFT: Profile card ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col items-center">
              {/* Photo */}
              <div className="relative group cursor-pointer mb-3" onClick={handleChangePhoto} title={t('students.changePhoto')}>
                <div className="w-20 h-20 rounded-full overflow-hidden bg-[#EFF6FF] border-2 border-[#2563EB]/20 flex items-center justify-center text-[#2563EB] font-bold text-xl shadow-xs">
                  {photoUrl ? (
                    <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{initials}</span>
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Edit2 size={14} className="text-white" />
                  </div>
                </div>
              </div>

              {/* Name & badges */}
              <div className="text-center mb-4">
                <h2 className="font-bold text-[#0F172A] text-base" dir="rtl">
                  {student.lastNameAr} {student.firstNameAr}
                </h2>
                <p className="text-slate-400 text-sm">{student.lastNameFr} {student.firstNameFr}</p>
                <p className="text-[10px] font-mono text-slate-400 mt-1">{student.studentNumber}</p>

                {/* Overall Debt/Payment Status Badge */}
                <div className="flex gap-2 justify-center mt-2.5 flex-wrap">
                  {totalNetBalance < 0 ? (
                    <span className="text-xs px-3 py-1 rounded-full font-bold bg-red-100 text-red-700 border border-red-200 flex items-center gap-1 shadow-2xs">
                      <AlertCircle size={12} />
                      {t('students.inDebtWithAmount', { amount: Math.abs(totalNetBalance).toLocaleString() })}
                    </span>
                  ) : totalNetBalance > 0 ? (
                    <span className="text-xs px-3 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 shadow-2xs">
                      <CheckCircle2 size={12} />
                      {t('students.positiveBalance', { amount: totalNetBalance.toLocaleString() })}
                    </span>
                  ) : (
                    <span className="text-xs px-3 py-1 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1 shadow-2xs">
                      <CheckCircle2 size={12} />
                      {t('students.paidZeroDebt')}
                    </span>
                  )}
                </div>
              </div>

              {/* Info rows */}
              <div className="space-y-2 text-sm w-full pt-3 border-t border-slate-100">
                {student.phone && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone size={13} className="text-slate-400 shrink-0" />
                    <span dir="ltr">{student.phone}</span>
                  </div>
                )}
                {student.address && (
                  <div className="flex items-start gap-2 text-slate-600">
                    <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                    <span className="text-xs">{student.address}</span>
                  </div>
                )}
                {student.registrationDate && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Calendar size={13} className="text-slate-400 shrink-0" />
                    <span className="text-xs">{t('students.registrationDate')}: {student.registrationDate}</span>
                  </div>
                )}
                {student.dateOfBirth && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <User size={13} className="text-slate-400 shrink-0" />
                    <span className="text-xs">{t('students.dateOfBirth')}: {student.dateOfBirth}</span>
                  </div>
                )}
              </div>

              {/* QR status */}
              <div className="mt-4 pt-3 border-t border-[#F1F5F9] text-center w-full">
                <div className="flex items-center justify-center gap-1 text-xs">
                  {student.qrTokenActive ? (
                    <><CheckCircle2 size={12} className="text-green-500" /><span className="text-green-600 font-medium">QR Active</span></>
                  ) : (
                    <><XCircle size={12} className="text-red-500" /><span className="text-red-600 font-medium">QR Disabled</span></>
                  )}
                </div>
              </div>

              {/* QR Code */}
              <div className="mt-3 text-center">
                <canvas
                  ref={qrCanvasCallback}
                  onClick={() => navigate(`/students/${student.id}/card`)}
                  title={t('students.card')}
                  className={`mx-auto rounded-lg border border-slate-100 shadow-xs cursor-pointer hover:shadow-md transition-all ${
                    student.qrTokenActive ? '' : 'opacity-40 grayscale'
                  }`}
                />
                <button
                  onClick={handleRegenQR}
                  className="mt-2 flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#2563EB] transition-colors mx-auto font-medium cursor-pointer"
                >
                  <RefreshCw size={11} /> {t('students.regenQR')}
                </button>
              </div>
            </div>
          </div>

          {/* Guardian panel */}
          {(student.guardianName || student.guardianPhone) && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Shield size={12} /> {t('students.guardianLabel')}
              </h3>
              {student.guardianName && (
                <div className="mb-2">
                  <p className="text-xs text-slate-400">{t('students.guardianName')}</p>
                  <p className="text-sm font-medium text-[#0F172A]">{student.guardianName}</p>
                </div>
              )}
              {student.guardianRelationship && (
                <div className="mb-2">
                  <p className="text-xs text-slate-400">{t('students.guardianRelationship')}</p>
                  <p className="text-sm text-[#0F172A]">{student.guardianRelationship}</p>
                </div>
              )}
              {student.guardianPhone && (
                <div className="flex items-center gap-2 text-sm text-[#0F172A]" dir="ltr">
                  <Phone size={12} className="text-slate-400" />
                  {student.guardianPhone}
                </div>
              )}
            </div>
          )}

          {/* Archive / Restore Box */}
          {student.status === 'archived' ? (
            <div className="bg-white rounded-xl border border-emerald-200 p-4 bg-emerald-50/40 shadow-xs">
              <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                <CheckCircle2 size={13} /> {t('students.restoreStudent')}
              </h3>
              <p className="text-xs text-slate-600 mb-3">
                {t('students.archivedNotice')}
              </p>
              <button
                onClick={handleRestore}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs"
              >
                <RefreshCw size={13} /> {t('students.restoreAndActivate')}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-red-100 p-4 shadow-xs">
              <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <AlertCircle size={12} /> {t('students.archiveDangerZone')}
              </h3>
              <button
                onClick={handleArchive}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors"
              >
                <Archive size={13} /> {t('students.archive')}
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT (2 cols): Tabbed content ── */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50/50">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? 'text-[#2563EB] border-[#2563EB] bg-white'
                    : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-100/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5 flex-1">
            {tabLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* ─── Overview Tab ─── */}
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                          <BookOpen size={14} className="text-[#2563EB]" />
                          <span>{t('courses.groups')}</span>
                        </div>
                        <p className="text-xl font-bold text-[#0F172A]">{t('students.activeGroupsCount', { count: enrollments.filter(e => e.status === 'active').length })}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                          <CreditCard size={14} className="text-emerald-500" />
                          <span>{t('students.monthlyTotal')}</span>
                        </div>
                        <p className="text-xl font-bold text-emerald-600">
                          {enrollments.filter(e => e.status === 'active').reduce((acc, e) => acc + (e.agreedPrice || 0), 0).toLocaleString()} DA
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-[#0F172A] mb-3">{t('students.enrollmentsAndBalances')}</h4>
                      {enrollments.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-3">{t('students.noEnrollmentsYet')}</p>
                      ) : (
                        <div className="space-y-2.5">
                          {enrollments.map((enr) => {
                            const isEnrActive = enr.status === 'active'
                            const bal = enr.balance ?? 0
                            const sessionPrice = (enr.agreedPrice || 2000) / 4
                            const remSessions = Math.round((bal / sessionPrice) * 10) / 10

                            return (
                              <div key={enr.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex justify-between items-center text-xs">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-[#0F172A] text-sm">{enr.courseName ?? ''} — {enr.groupName ?? `Groupe #${enr.groupId}`}</p>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                      isEnrActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                                    }`}>
                                      {isEnrActive ? t('teachers.active') : t('teachers.inactive')}
                                    </span>
                                  </div>
                                  <p className="text-slate-400 mt-0.5">{enr.enrollmentDate} · {enr.agreedPrice.toLocaleString()} DA / {t('students.perMonth')}</p>
                                </div>
                                <div className="text-end">
                                  {bal < 0 ? (
                                    <span className="font-bold text-red-600 text-sm block">
                                      {t('students.inDebtWithAmount', { amount: Math.abs(bal).toLocaleString() })}
                                    </span>
                                  ) : (
                                    <span className="font-bold text-emerald-600 text-sm block">
                                      +{formatCurrency(bal, lang)}
                                    </span>
                                  )}
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    {remSessions} séances
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ─── Attendance & Session Audit Log Tab ─── */}
                {activeTab === 'attendance' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-sm text-[#0F172A]">{t('students.sessionHistory')}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {t('students.sessionHistorySubtitle')}
                        </p>
                      </div>
                      <button
                        onClick={() => student && loadSessionHistory(student.id)}
                        className="p-1.5 text-slate-400 hover:text-[#2563EB] hover:bg-slate-100 rounded-lg transition-colors"
                        title={t('common.refresh')}
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>

                    {sessionHistory.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <Clock size={36} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-medium">{t('students.noSessionsRecorded')}</p>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                                <th className="text-start px-3 py-2.5">{t('attendance.dateTime')}</th>
                                <th className="text-start px-3 py-2.5">{t('students.courseAndGroup')}</th>
                                <th className="text-start px-3 py-2.5">{t('students.teacher')}</th>
                                <th className="text-start px-3 py-2.5">{t('students.statusInSession')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {sessionHistory.map((s) => {
                                const status = s.attendanceStatus

                                return (
                                  <tr key={s.sessionId} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="px-3 py-2.5 font-medium">
                                      <p className="font-bold text-[#0F172A]">{s.sessionDate}</p>
                                      {s.plannedStartTime && <p className="text-[11px] text-slate-400 font-mono">{s.plannedStartTime}</p>}
                                    </td>
                                    <td className="px-3 py-2.5 font-medium">
                                      <p className="font-bold text-[#0F172A]">{s.courseNameAr || s.courseNameFr}</p>
                                      <p className="text-[11px] text-slate-500">{s.groupName}</p>
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-600 font-medium">{s.teacherName ?? '—'}</td>
                                    <td className="px-3 py-2.5">
                                      <div className="flex items-center gap-1">
                                        {status === 'present' ? (
                                          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                                            <span className="font-extrabold">✓</span>
                                            <span>{t('attendance.present')}</span>
                                          </span>
                                        ) : status === 'absent' ? (
                                          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg font-bold bg-red-100 text-red-800 border border-red-200 shadow-2xs">
                                            <span className="font-extrabold">✗</span>
                                            <span>{t('attendance.absent')}</span>
                                          </span>
                                        ) : status === 'inactive' || status === 'not_active' ? (
                                          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg font-bold bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs">
                                            <span>{t('teachers.inactive')}</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium bg-slate-50 text-slate-400 border border-slate-200">
                                            —
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Payments Tab ─── */}
                {activeTab === 'payments' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-sm text-[#0F172A]">{t('nav.payments')}</h4>
                      <button
                        onClick={() => navigate(`/payments?studentId=${student.id}`)}
                        className="text-xs text-[#2563EB] hover:underline font-semibold flex items-center gap-1"
                      >
                        + {t('payments.add')}
                      </button>
                    </div>

                    {payments.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <CreditCard size={36} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-medium">{t('payments.noPayments')}</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {payments.map((p) => (
                          <div key={p.id} className="p-3.5 bg-slate-50 rounded-xl flex justify-between items-center text-xs border border-slate-200/60">
                            <div>
                              <p className="font-mono font-bold text-[#0F172A]">{p.receiptNumber}</p>
                              <p className="text-slate-400 mt-0.5">{p.billingPeriod} · {p.paymentDate}</p>
                              {p.notes && <p className="text-[11px] text-slate-500 mt-0.5 italic">{p.notes}</p>}
                            </div>
                            <div className="text-end">
                              <p className="font-bold text-[#2563EB] text-sm">{p.amount.toLocaleString()} DA</p>
                              <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold mt-1 ${
                                p.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                              }`}>
                                {p.status === 'paid' ? t('payments.paid') : t('payments.cancelled')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Enrollments Tab (With Per-Module Status & Credit Balances) ─── */}
                {activeTab === 'enrollments' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-sm text-[#0F172A]">{t('students.enrollments')}</h4>
                      <button
                        onClick={handleOpenAddEnrollModal}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] text-white rounded-lg text-xs font-semibold hover:bg-[#1D4ED8] transition-colors shadow-xs"
                      >
                        <Plus size={13} /> {t('students.addEnrollmentToGroup')}
                      </button>
                    </div>

                    {enrollments.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <BookOpen size={36} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-medium">{t('students.noEnrollmentsYet')}</p>
                        <button
                          onClick={handleOpenAddEnrollModal}
                          className="mt-3 text-xs text-[#2563EB] hover:underline font-semibold"
                        >
                          + {t('students.enrollInFirstGroup')}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {enrollments.map((enroll) => {
                          const isActive = enroll.status === 'active'
                          const isInactive = enroll.status === 'inactive'
                          const bal = enroll.balance ?? 0
                          const sessionPrice = (enroll.agreedPrice || 2000) / 4
                          const remSessions = Math.round((bal / sessionPrice) * 10) / 10
                          const otherActiveEnrollments = enrollments.filter(e => e.id !== enroll.id && e.status === 'active')

                          return (
                            <div
                              key={enroll.id}
                              className={`p-4 rounded-xl border transition-all ${
                                isActive
                                  ? 'border-[#2563EB]/30 bg-[#EFF6FF]/40'
                                  : isInactive
                                  ? 'border-amber-200 bg-amber-50/40'
                                  : 'border-slate-200 bg-slate-50/60 opacity-80'
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h5 className="font-bold text-sm text-[#0F172A]">
                                      {enroll.courseName ?? ''} — {enroll.groupName ?? `Groupe #${enroll.groupId}`}
                                    </h5>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                      isActive
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : isInactive
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-slate-200 text-slate-600'
                                    }`}>
                                      {isActive
                                        ? t('students.activeInModule')
                                        : isInactive
                                        ? t('students.inactiveSuspended')
                                        : t('students.inactive')}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {t('courses.monthlyPrice')}: <span className="font-bold text-[#0F172A]">{enroll.agreedPrice.toLocaleString()} DA</span> / {t('students.perMonth')}
                                  </p>
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    {t('students.registrationDate')}: {enroll.enrollmentDate}
                                  </p>
                                </div>

                                {/* Enrollment Group Credit Balance Badge */}
                                <div className="text-end">
                                  {bal < 0 ? (
                                    <div className="bg-red-100 border border-red-200 text-red-700 px-3 py-1 rounded-xl text-end">
                                      <span className="font-extrabold text-xs block">{t('students.inDebtWithAmount', { amount: Math.abs(bal).toLocaleString() })}</span>
                                      <span className="text-[10px] font-medium text-red-600">{Math.abs(remSessions)} séances</span>
                                    </div>
                                  ) : (
                                    <div className="bg-emerald-100 border border-emerald-200 text-emerald-800 px-3 py-1 rounded-xl text-end">
                                      <span className="font-extrabold text-xs block">+{formatCurrency(bal, lang)}</span>
                                      <span className="text-[10px] font-medium text-emerald-700">{remSessions} séances</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Action buttons on enrollment */}
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200/60 flex-wrap justify-end">
                                {/* Transfer Credit action button */}
                                {isActive && (enroll.balance ?? 0) > 0 && otherActiveEnrollments.length > 0 && (
                                  <button
                                    onClick={() => {
                                      setTransferModalSource(enroll)
                                      setTransferTargetEnrollId(String(otherActiveEnrollments[0].id))
                                      setTransferAmount(String(enroll.balance ?? 0))
                                      setTransferCloseSource(true)
                                    }}
                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 text-white rounded text-xs font-semibold hover:bg-amber-600 transition-colors shadow-xs"
                                    title={t('students.transferCreditTooltip')}
                                  >
                                    <ArrowRightLeft size={12} /> {t('students.transferBalanceToAnother')}
                                  </button>
                                )}



                                {/* Module Active / Inactive Status Toggle */}
                                <button
                                  onClick={() => handleToggleEnrollmentStatus(enroll.id, enroll.status)}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                                    isActive
                                      ? 'border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100'
                                      : 'border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                  }`}
                                >
                                  {isActive ? (
                                    <><AlertTriangle size={12} /> {t('students.markInactive')}</>
                                  ) : (
                                    <><Check size={12} /> {t('students.reactivateEnrollment')}</>
                                  )}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Notes Tab ─── */}
                {activeTab === 'notes' && (
                  <div>
                    <div className="mb-4">
                      <textarea
                        value={newNote}
                        onChange={(e) => {
                          const val = e.target.value
                          setNewNote(val)
                          if (student) {
                            if (val) sessionStorage.setItem(`draft_note_${student.id}`, val)
                            else sessionStorage.removeItem(`draft_note_${student.id}`)
                          }
                        }}
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            handleCreateNote()
                          }
                        }}
                        placeholder={t('students.addNote')}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 resize-none bg-white"
                        rows={3}
                      />
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-[11px] text-slate-400">Ctrl + Enter {lang === 'ar' ? 'للحفظ السريع' : 'pour enregistrer'}</span>
                        <button
                          onClick={handleCreateNote}
                          disabled={!newNote.trim() || savingNote}
                          className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                        >
                          <Plus size={14} />
                          {savingNote ? t('common.saving') : t('common.save')}
                        </button>
                      </div>
                    </div>

                    {notes.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <StickyNote size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">{t('students.noNotes')}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {notes.map((note) => (
                          <div key={note.id} className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-4 shadow-2xs group relative">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm text-[#0F172A] whitespace-pre-wrap flex-1">{note.noteText}</p>
                              <button
                                onClick={() => handleDeleteNote(note.id)}
                                className="text-slate-400 hover:text-red-600 p-1 rounded-md transition-colors opacity-80 hover:opacity-100 cursor-pointer"
                                title={t('common.delete')}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-amber-200/50 text-xs text-slate-500 font-medium">
                              <span>👤 {note.adminName ?? 'Admin'}</span>
                              <span className="text-[11px] text-slate-400 font-mono">{new Date(note.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal: Add New Enrollment ── */}
      {showAddEnrollModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowAddEnrollModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-[#0F172A] text-base">{t('students.enrollInNewGroup')}</h3>
              <button onClick={() => setShowAddEnrollModal(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
            </div>

            <div className="space-y-3">
              {/* 1. Module Filter (Choose + Search) */}
              <FilterCombobox
                label={t('students.moduleFilter')}
                placeholder={t('students.filterModulePlaceholder')}
                value={modalModule}
                onChange={handleModalModuleChange}
                options={moduleOptions}
              />

              {/* 2. Teacher Filter (Choose + Search) */}
              <FilterCombobox
                label={t('students.teacherFilter')}
                placeholder={t('students.filterTeacherPlaceholder')}
                value={modalTeacher}
                onChange={handleModalTeacherChange}
                options={teacherOptions}
              />

              {/* 3. Group Filter (Choose + Search) */}
              <FilterCombobox
                label={t('students.groupFilter')}
                placeholder={t('students.filterGroupPlaceholder')}
                value={modalGroup}
                onChange={handleModalGroupChange}
                options={groupOptions}
              />

              {/* Selected Group details summary box if group is chosen */}
              {newEnrollGroupId && (() => {
                const grp = availableGroups.find(g => g.id === Number(newEnrollGroupId))
                if (!grp) return null
                return (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-center justify-between font-medium animate-fade-in mt-2">
                    <div>
                      <span className="font-bold">{grp.name}</span>
                      <p className="text-[11px] text-blue-700 mt-0.5">{t('courses.monthlyPrice')}:</p>
                    </div>
                    <span className="text-sm font-bold text-[#2563EB] font-mono bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs">
                      {grp.monthlyPrice.toLocaleString()} DA
                    </span>
                  </div>
                )
              })()}
            </div>

            {/* Reset Filters button if any filter is active */}
            {(modalModule || modalTeacher || modalGroup) && (
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => {
                    setModalModule('')
                    setModalTeacher('')
                    setModalGroup('')
                    setNewEnrollGroupId('')
                  }}
                  className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-red-600 font-bold hover:underline"
                >
                  <RotateCcw size={12} />
                  <span>{t('students.resetOptions')}</span>
                </button>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAddEnrollModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddEnrollment}
                disabled={savingEnroll || !newEnrollGroupId}
                className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                {savingEnroll ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Transfer Credit between Courses (User's Idea) ── */}
      {transferModalSource && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setTransferModalSource(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[#0F172A] flex items-center gap-2">
                <ArrowRightLeft size={16} className="text-amber-500" />
                {t('students.transferCreditModalTitle')}
              </h3>
              <button onClick={() => setTransferModalSource(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-700">
              {/* Source info */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[11px] text-slate-400">{t('students.sourceCourse')}:</p>
                <p className="font-bold text-[#0F172A] text-sm mt-0.5">
                  {transferModalSource.courseName ?? `Groupe #${transferModalSource.groupId}`}
                </p>
                <p className="text-slate-500 mt-0.5">
                  {t('courses.monthlyPrice')}: {transferModalSource.agreedPrice.toLocaleString()} DA
                </p>
              </div>

              {/* Destination Enrollment */}
              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  {t('students.targetCourseGroup')} *
                </label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  value={transferTargetEnrollId}
                  onChange={(e) => setTransferTargetEnrollId(e.target.value)}
                >
                  <option value="">— {t('students.selectTargetGroup')} —</option>
                  {enrollments
                    .filter(e => e.id !== transferModalSource.id && e.status === 'active')
                    .map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.courseName ?? ''} — {target.groupName ?? `Groupe #${target.groupId}`} ({target.agreedPrice.toLocaleString()} DA)
                      </option>
                    ))}
                </select>
              </div>

              {/* Remaining balance to transfer */}
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                <p className="text-[11px] text-emerald-800 font-bold">
                  {lang === 'ar' ? 'الرصيد المتبقي المراد تحويله بالكامل:' : lang === 'en' ? 'Remaining balance to transfer in full:' : 'Solde restant à transférer en totalité :'}
                </p>
                <p className="text-2xl font-black text-emerald-700 mt-1">
                  {(transferModalSource.balance ?? 0).toLocaleString()} DA
                </p>
                <p className="text-[11px] text-emerald-600 mt-1">
                  {lang === 'ar'
                    ? 'سيتم تحويل كامل الرصيد المتبقي من هذا الفوج إلى الفوج المستهدف تلقائياً.'
                    : lang === 'en'
                    ? 'The entire remaining balance will be transferred to the target group.'
                    : 'Le solde restant sera transféré intégralement vers le groupe cible.'}
                </p>
              </div>

              {/* Checkbox: Close source group */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={transferCloseSource}
                  onChange={(e) => setTransferCloseSource(e.target.checked)}
                  className="rounded text-[#2563EB] focus:ring-0"
                />
                <span className="text-slate-700">
                  {t('students.closeSourceGroupCheckbox')}
                </span>
              </label>

              {/* Notes */}
              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  {t('students.transferReasonLabel')}
                </label>
                <input
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder={t('students.transferReasonPlaceholder')}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setTransferModalSource(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-600"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleExecuteCreditTransfer}
                disabled={savingTransfer || !transferTargetEnrollId || (transferModalSource.balance ?? 0) <= 0}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 disabled:opacity-60 flex items-center gap-1.5 shadow-xs"
              >
                <ArrowRightLeft size={13} />
                {savingTransfer ? t('common.saving') : t('students.confirmTransfer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
