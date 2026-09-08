import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Plus, ChevronDown, Calendar, Clock, Edit2,
  Trash2, X, BookOpen, DollarSign, Users, ExternalLink, UserMinus, Search
} from 'lucide-react'
import type { Course, Group, Teacher } from '@shared/types/index'

interface ScheduleSlot {
  id: number
  groupId: number
  weekday: number // 0=Mon .. 6=Sun
  startTime: string
  endTime: string
  room?: string
  isActive: boolean
}

const WEEKDAYS = [
  { id: 0, ar: 'الإثنين', fr: 'Lundi', en: 'Monday' },
  { id: 1, ar: 'الثلاثاء', fr: 'Mardi', en: 'Tuesday' },
  { id: 2, ar: 'الأربعاء', fr: 'Mercredi', en: 'Wednesday' },
  { id: 3, ar: 'الخميس', fr: 'Jeudi', en: 'Thursday' },
  { id: 4, ar: 'الجمعة', fr: 'Vendredi', en: 'Friday' },
  { id: 5, ar: 'السبت', fr: 'Samedi', en: 'Saturday' },
  { id: 6, ar: 'الأحد', fr: 'Dimanche', en: 'Sunday' },
]

const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={onClose}>
    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in relative z-[101]" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-[#0F172A]">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  </div>
)

export default function Courses() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as 'ar' | 'fr' | 'en'

  const getWeekdayLabel = (day: typeof WEEKDAYS[0]) => {
    if (lang === 'ar') return day.ar
    if (lang === 'en') return day.en
    return day.fr
  }

  const [courses, setCourses] = useState<Course[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([])
  const [expandedCourse, setExpandedCourse] = useState<number | null>(null)
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null) // key: `${courseId}-${teacherId}`
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)

  // Modals
  const [showCourseModal, setShowCourseModal] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState<number | null>(null) // courseId
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState<Group | null>(null)
  const [showExtraSessionModal, setShowExtraSessionModal] = useState<Group | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  // Group Students Side Drawer
  const [viewGroupStudents, setViewGroupStudents] = useState<Group | null>(null)
  const [groupEnrollments, setGroupEnrollments] = useState<any[]>([])
  const [loadingGroupStudents, setLoadingGroupStudents] = useState(false)
  const [drawerSearch, setDrawerSearch] = useState('')

  // Slot enrollment modal
  const [enrollSessionSlot, setEnrollSessionSlot] = useState<ScheduleSlot | null>(null)
  const [enrollSearch, setEnrollSearch] = useState('')
  const [enrollStudents, setEnrollStudents] = useState<any[]>([])
  const [enrolling, setEnrolling] = useState(false)
  const enrollSearchRef = useRef<HTMLInputElement>(null)

  // Forms
  const [courseForm, setCourseForm] = useState({ nameAr: '', nameFr: '', defaultPrice: '' })
  const [groupForm, setGroupForm] = useState({ name: '', teacherId: '', capacity: '30', monthlyPrice: '', startDate: '', endDate: '', room: '' })
  const [slotForm, setSlotForm] = useState({ weekday: 0, startTime: '09:00', endTime: '11:00', room: '' })
  const [extraSessionForm, setExtraSessionForm] = useState<{
    date: string
    startTime: string
    endTime: string
    room: string
    priceType: 'default' | 'free' | 'custom'
    customPrice: string
  }>({
    date: new Date().toISOString().slice(0, 10),
    startTime: '14:00',
    endTime: '16:00',
    room: '',
    priceType: 'default',
    customPrice: '',
  })

  const loadData = useCallback(async () => {
    try {
      const [cr, gr, tr, sc] = await Promise.all([
        window.schoolApp.courses.list(),
        window.schoolApp.groups.list(),
        window.schoolApp.teachers.list(),
        window.schoolApp.schedules.list({ active: true }),
      ])
      if (cr.success && cr.data) setCourses(cr.data)
      if (gr.success && gr.data) {
        setGroups(gr.data)
        if (gr.data.length > 0 && !selectedGroup) setSelectedGroup(gr.data[0])
      }
      if (tr.success && tr.data) setTeachers(tr.data)
      if (sc.success && sc.data) setSchedules(sc.data)
    } finally {
      setLoading(false)
    }
  }, [selectedGroup])

  useEffect(() => { loadData() }, [loadData])

  const handleCreateCourse = async () => {
    if (!courseForm.nameAr.trim() || !courseForm.nameFr.trim()) {
      setError(t('courses.fillCourseNames'))
      return
    }
    setSaving(true)
    try {
      const res = await window.schoolApp.courses.create({
        nameAr: courseForm.nameAr,
        nameFr: courseForm.nameFr,
        defaultPrice: Number(courseForm.defaultPrice) || 0,
      })
      if (res.success) {
        setShowCourseModal(false)
        setCourseForm({ nameAr: '', nameFr: '', defaultPrice: '' })
        setError('')
        await loadData()
      } else {
        setError(res.error ?? t('common.error'))
      }
    } finally { setSaving(false) }
  }

  const handleCreateGroup = async (courseId: number) => {
    if (!groupForm.name.trim() || !groupForm.startDate || !groupForm.teacherId) {
      setError(lang === 'ar' ? 'الاسم والأستاذ وتاريخ البداية مطلوبة' : 'Nom, enseignant et date de début requis')
      return
    }
    setSaving(true)
    try {
      const res = await window.schoolApp.groups.create({
        courseId,
        teacherId: Number(groupForm.teacherId),
        name: groupForm.name,
        capacity: Number(groupForm.capacity) || 30,
        monthlyPrice: Number(groupForm.monthlyPrice) || 0,
        startDate: groupForm.startDate,
        endDate: groupForm.endDate || null,
        room: groupForm.room || null,
      })
      if (res.success) {
        setShowGroupModal(null)
        setGroupForm({ name: '', teacherId: '', capacity: '30', monthlyPrice: '', startDate: '', endDate: '', room: '' })
        setError('')
        await loadData()
      } else {
        setError(res.error ?? t('common.error'))
      }
    } finally { setSaving(false) }
  }

  const openEditGroup = (group: Group) => {
    setEditingGroup(group)
    setGroupForm({
      name: group.name,
      teacherId: String(group.teacherId),
      capacity: String(group.capacity || 30),
      monthlyPrice: String(group.monthlyPrice || 0),
      startDate: group.startDate || '',
      endDate: (group as any).endDate || '',
      room: (group as any).room || '',
    })
    setError('')
  }

  const handleUpdateGroup = async () => {
    if (!editingGroup) return
    if (!groupForm.name.trim() || !groupForm.teacherId) {
      setError(lang === 'ar' ? 'الاسم والأستاذ مطلوبان' : 'Nom et enseignant requis')
      return
    }
    setSaving(true)
    try {
      const newEndDate = groupForm.endDate || null
      const res = await window.schoolApp.groups.update(editingGroup.id, {
        name: groupForm.name,
        teacherId: Number(groupForm.teacherId),
        capacity: Number(groupForm.capacity) || 30,
        monthlyPrice: Number(groupForm.monthlyPrice) || 0,
        startDate: groupForm.startDate,
        endDate: newEndDate,
        room: groupForm.room || null,
      } as any)

      if (res.success) {
        // If end date changed, handle trimming/generation
        if (newEndDate && newEndDate !== (editingGroup as any).endDate) {
          await window.schoolApp.sessions.trimAfterDate(editingGroup.id, newEndDate)
          await window.schoolApp.sessions.generateForGroup(editingGroup.id)
        }
        setEditingGroup(null)
        setGroupForm({ name: '', teacherId: '', capacity: '30', monthlyPrice: '', startDate: '', endDate: '', room: '' })
        setError('')
        await loadData()
      } else {
        setError(res.error ?? t('common.error'))
      }
    } finally { setSaving(false) }
  }

  const handleAddSlot = async (groupId: number) => {
    if (slotForm.startTime >= slotForm.endTime) {
      setError(t('courses.invalidTimeRange'))
      return
    }
    setSaving(true)
    try {
      const res = await window.schoolApp.schedules.create({
        groupId,
        weekday: Number(slotForm.weekday),
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        room: slotForm.room || undefined,
      })
      if (res.success) {
        setSlotForm({ weekday: 0, startTime: '09:00', endTime: '11:00', room: '' })
        setError('')
        await loadData()
      } else {
        setError(res.error ?? t('common.error'))
      }
    } finally { setSaving(false) }
  }

  const handleDeleteSlot = async (slotId: number) => {
    if (!window.confirm(t('courses.deleteSlotConfirm'))) return
    await window.schoolApp.schedules.delete(slotId)
    await loadData()
  }

  const handleGroupEndDateChange = async (group: Group, newEndDate: string) => {
    try {
      await window.schoolApp.groups.update(group.id, { endDate: newEndDate || null } as any)
      if (newEndDate) {
        // If end date shortened, trim future sessions
        await window.schoolApp.sessions.trimAfterDate(group.id, newEndDate)
        // If end date extended, generate new sessions
        const currentEnd = (group as any).endDate
        if (!currentEnd || newEndDate > currentEnd) {
          await window.schoolApp.sessions.generateForGroup(group.id)
        }
      }
      await loadData()
    } catch (err) {
      console.error('Failed to update end date:', err)
    }
  }

  const handleAddExtraSession = async (groupId: number) => {
    setSaving(true)
    try {
      let finalPrice: number | null = null
      if (extraSessionForm.priceType === 'free') {
        finalPrice = 0
      } else if (extraSessionForm.priceType === 'custom') {
        finalPrice = parseFloat(extraSessionForm.customPrice) || 0
      }

      const res = await window.schoolApp.sessions.createExtra({
        groupId,
        sessionDate: extraSessionForm.date,
        startTime: extraSessionForm.startTime,
        endTime: extraSessionForm.endTime,
        room: extraSessionForm.room || undefined,
        price: finalPrice ?? undefined,
      })
      if (res.success) {
        setShowExtraSessionModal(null)
        alert(t('courses.extraSessionSuccess'))
      } else {
        setError(res.error ?? t('common.error'))
      }
    } finally { setSaving(false) }
  }

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchStudentsForEnroll = (query: string) => {
    setEnrollSearch(query)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (!query.trim()) { setEnrollStudents([]); return }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await window.schoolApp.students.searchByName(query.trim())
        if (res.success && res.data) setEnrollStudents(res.data)
        else setEnrollStudents([])
      } catch { setEnrollStudents([]) }
    }, 150)
  }

  const handleEnrollStudentToGroup = async (studentId: number) => {
    if (!selectedGroup) return
    setEnrolling(true)
    try {
      const res = await window.schoolApp.enrollments.create({
        studentId,
        groupId: selectedGroup.id,
        agreedPrice: selectedGroup.monthlyPrice,
        enrollmentDate: new Date().toISOString().slice(0, 10),
      })
      if (res.success) {
        alert(lang === 'ar' ? 'تم تسجيل الطالب في الفوج بنجاح!' : 'Étudiant inscrit au groupe avec succès !')
        setEnrollSessionSlot(null)
        setEnrollSearch('')
        setEnrollStudents([])
        await loadData()
        if (viewGroupStudents) {
          await loadGroupStudents(viewGroupStudents.id)
        }
      } else {
        alert(res.error ?? (lang === 'ar' ? 'فشل التسجيل (قد يكون مسجلاً بالفعل)' : 'Échec de l\'inscription'))
      }
    } finally {
      setEnrolling(false)
    }
  }

  const loadGroupStudents = useCallback(async (groupId: number) => {
    setLoadingGroupStudents(true)
    try {
      const res = await window.schoolApp.enrollments.byGroup(groupId)
      if (res.success && res.data) {
        const items = res.data
        const enriched = await Promise.all(
          items.map(async (item: any) => {
            const hasName = item.firstNameAr || item.lastNameAr || item.firstNameFr || item.lastNameFr || item.fullName || item.firstName || item.lastName
            if (!hasName) {
              try {
                const sRes = await window.schoolApp.students.getById(item.studentId)
                if (sRes.success && sRes.data) {
                  const s = sRes.data
                  return {
                    ...item,
                    studentNumber: s.studentNumber || item.studentNumber,
                    registrationNumber: s.studentNumber || item.studentNumber,
                    firstNameAr: s.firstNameAr || '',
                    lastNameAr: s.lastNameAr || '',
                    firstNameFr: s.firstNameFr || '',
                    lastNameFr: s.lastNameFr || '',
                    phone: s.phone || item.phone,
                  }
                }
              } catch {
                /* ignore */
              }
            }
            return item
          })
        )
        setGroupEnrollments(enriched)
      } else {
        setGroupEnrollments([])
      }
    } catch {
      setGroupEnrollments([])
    } finally {
      setLoadingGroupStudents(false)
    }
  }, [])

  const openGroupStudents = (group: Group) => {
    setViewGroupStudents(group)
    setDrawerSearch('')
    loadGroupStudents(group.id)
  }

  const handleUnenrollStudent = async (enrollmentId: number, studentName: string) => {
    const confirmMsg = lang === 'ar'
      ? `هل أنت متأكد من إلغاء تسجيل الطالب "${studentName}" من هذا الفوج؟`
      : `Voulez-vous vraiment désinscrire l'étudiant "${studentName}" de ce groupe ?`
    if (!window.confirm(confirmMsg)) return

    try {
      const res = await window.schoolApp.enrollments.update(enrollmentId, { status: 'inactive' })
      if (res.success) {
        if (viewGroupStudents) {
          await loadGroupStudents(viewGroupStudents.id)
        }
        await loadData()
      } else {
        alert(res.error ?? 'Erreur')
      }
    } catch (err: any) {
      alert(err.message || 'Erreur')
    }
  }


  const handleDeleteCourse = async (courseId: number, courseName: string) => {
    const msg = lang === 'ar'
      ? `هل أنت متأكد من حذف مادة "${courseName}" وجميع أفواجها وحصصها؟`
      : `Êtes-vous sûr de vouloir supprimer le cours "${courseName}" et tous ses groupes ?`
    if (!window.confirm(msg)) return
    await window.schoolApp.courses.delete(courseId)
    await loadData()
  }

  const handleDeleteGroup = async (groupId: number, groupName: string) => {
    const msg = lang === 'ar'
      ? `هل أنت متأكد من حذف فوج "${groupName}"؟`
      : `Êtes-vous sûr de vouloir supprimer le groupe "${groupName}" ?`
    if (!window.confirm(msg)) return
    await window.schoolApp.groups.delete(groupId)
    if (selectedGroup?.id === groupId) setSelectedGroup(null)
    await loadData()
  }

  const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 bg-white'
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1'

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Top Header Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-[#0F172A]">{t('nav.courses')}</h2>
          <p className="text-xs text-slate-400">{t('courses.subtitle')}</p>
        </div>
        <button
          onClick={() => { setShowCourseModal(true); setError('') }}
          className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] transition-colors"
        >
          <Plus size={15} /> {t('courses.addCourse')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── LEFT (7 cols): Course & Group Tree ── */}
        <div className="lg:col-span-7 space-y-3">
          {courses.length === 0 ? (
            <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-border">
              <BookOpen size={36} className="mx-auto mb-2 opacity-30" />
              <p className="font-medium">{t('courses.noCourses')}</p>
            </div>
          ) : (
            courses.map((course) => {
              const courseGroups = groups.filter((g) => g.courseId === course.id)
              const isExpanded = expandedCourse === course.id

              return (
                <div key={course.id} className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
                  {/* Course Header */}
                  <div
                    onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] font-bold text-base">
                        {course.nameAr.charAt(0)}
                      </div>
                      <div className="text-start">
                        <p className="font-bold text-[#0F172A] text-sm">{course.nameAr} ({course.nameFr})</p>
                        <p className="text-xs text-slate-400">{t('courses.groupsCount', { count: courseGroups.length })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      <span className="text-sm font-bold text-[#2563EB]">{course.defaultPrice.toLocaleString()} DZD</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteCourse(course.id, course.nameAr) }}
                        className="p-1 text-slate-300 hover:text-red-500 transition-colors rounded"
                        title={t('common.delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded: Teacher → Groups tree */}
                  {isExpanded && (() => {
                    const courseAssignedTeachers = teachers.filter(t => t.courseId === course.id)
                    const groupTeacherIds = [...new Set(courseGroups.map(g => g.teacherId))]
                    const allTeacherIds = [...new Set([...courseAssignedTeachers.map(t => t.id), ...groupTeacherIds])]

                    return (
                      <div className="border-t border-[#F1F5F9] p-3 bg-slate-50/50 space-y-3">
                        {/* Course Teachers Summary Bar */}
                        <div className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-xl shadow-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <BookOpen size={15} className="text-[#2563EB]" />
                            <span className="text-xs font-bold text-[#0F172A]">
                              {lang === 'ar' ? 'أساتذة هذه المادة:' : 'Enseignants du module:'}
                            </span>
                            {courseAssignedTeachers.length === 0 ? (
                              <span className="text-xs text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200 font-medium">
                                {lang === 'ar' ? 'لا يوجد أساتذة مسجلون هذه المادة' : 'Aucun enseignant'}
                              </span>
                            ) : (
                              courseAssignedTeachers.map(t => (
                                <span key={t.id} className="text-xs bg-blue-50 text-[#2563EB] font-bold px-2.5 py-0.5 rounded-lg border border-blue-200">
                                  {t.lastName} {t.firstName}
                                </span>
                              ))
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowGroupModal(course.id)
                              setGroupForm({
                                name: '',
                                teacherId: courseAssignedTeachers[0] ? String(courseAssignedTeachers[0].id) : '',
                                capacity: '30',
                                monthlyPrice: String(course.defaultPrice || 0),
                                startDate: new Date().toISOString().slice(0, 10),
                                endDate: '',
                                room: '',
                              })
                              setError('')
                            }}
                            className="flex items-center gap-1.5 bg-[#2563EB] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#1D4ED8] transition-colors shrink-0"
                          >
                            <Plus size={13} /> {lang === 'ar' ? 'إضافة فوج جديد' : 'Ajouter un groupe'}
                          </button>
                        </div>

                        {allTeacherIds.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-3">{t('courses.noGroups')}</p>
                        ) : allTeacherIds.map(tid => {
                          const teacher = teachers.find(t => t.id === tid)
                          const teacherGroups = courseGroups.filter(g => g.teacherId === tid)
                          const tKey = `${course.id}-${tid}`
                          const tExpanded = expandedTeacher === tKey
                          const teacherName = teacher ? `${teacher.lastName} ${teacher.firstName}` : t('courses.noTeacher')
                          const courseTitle = course.nameAr || course.nameFr

                          return (
                            <div key={tKey} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                              {/* Teacher row */}
                              <div
                                onClick={() => setExpandedTeacher(tExpanded ? null : tKey)}
                                className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-slate-50"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-xs">
                                    {teacherName.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-[#0F172A]">{teacherName} <span className="text-slate-400 font-normal">({courseTitle})</span></p>
                                    <p className="text-[10px] text-slate-400">{lang === 'ar' ? `${teacherGroups.length} فوج` : `${teacherGroups.length} groupe(s)`}</p>
                                  </div>
                                </div>
                                <ChevronDown size={14} className={`text-slate-400 transition-transform ${tExpanded ? 'rotate-180' : ''}`} />
                              </div>
                              {/* Groups under teacher */}
                              {tExpanded && (
                                <div className="border-t border-slate-100 p-2 space-y-2">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {teacherGroups.map(group => {
                                      const groupSlots = schedules.filter(s => s.groupId === group.id)
                                      const isSelected = selectedGroup?.id === group.id
                                      return (
                                        <div
                                          key={group.id}
                                          onClick={() => setSelectedGroup(group)}
                                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                            isSelected ? 'border-[#2563EB] bg-blue-50/50 shadow ring-1 ring-[#2563EB]/20' : 'border-slate-100 bg-slate-50 hover:border-slate-300'
                                          }`}
                                        >
                                          <div className="flex justify-between items-center mb-1">
                                            <h4 className="font-bold text-xs text-[#0F172A]">{group.name}</h4>
                                            <span className="text-[10px] font-bold text-[#2563EB]">{group.monthlyPrice.toLocaleString()} DA</span>
                                          </div>
                                          <div className="text-[10px] text-slate-500 space-y-0.5">
                                            <div className="flex justify-between">
                                              <span>{lang === 'ar' ? 'سعر الحصة' : 'Séance'}:</span>
                                              <span className="text-emerald-600 font-medium">{Math.round(group.monthlyPrice / 4).toLocaleString()} DA</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span>{lang === 'ar' ? 'الطلاب المسجلون' : 'Inscrits'}:</span>
                                              <span
                                                className="text-indigo-600 font-bold cursor-pointer hover:underline"
                                                onClick={(e) => { e.stopPropagation(); openGroupStudents(group) }}
                                                title={lang === 'ar' ? 'عرض قائمة الطلاب' : 'Voir la liste'}
                                              >
                                                {group.enrolledCount ?? 0} / {group.capacity}
                                              </span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span>{lang === 'ar' ? 'الحصص' : 'Créneaux'}:</span>
                                              <span className="text-[#2563EB]">{groupSlots.length}</span>
                                            </div>
                                          </div>
                                          <div className="flex gap-1 mt-2 pt-2 border-t border-slate-100 flex-wrap">
                                            <button onClick={e => { e.stopPropagation(); openEditGroup(group) }}
                                              className="px-1.5 py-0.5 bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] rounded text-[10px] flex items-center gap-0.5"
                                              title={lang === 'ar' ? 'تعديل الفوج' : 'Modifier le groupe'}>
                                              <Edit2 size={9} /> {lang === 'ar' ? 'تعديل' : 'Edit'}
                                            </button>
                                            <button onClick={e => { e.stopPropagation(); openGroupStudents(group) }}
                                              className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[10px] flex items-center gap-0.5 font-medium"
                                              title={lang === 'ar' ? 'عرض الطلاب المسجلين' : 'Voir les étudiants'}>
                                              <Users size={9} /> {lang === 'ar' ? 'الطلاب' : 'Étudiants'} ({group.enrolledCount ?? 0})
                                            </button>
                                            <button onClick={e => { e.stopPropagation(); setShowScheduleModal(group); setError('') }}
                                              className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] flex items-center gap-0.5">
                                              <Clock size={9} /> {t('courses.schedule')}
                                            </button>
                                            <button onClick={e => { e.stopPropagation(); setShowExtraSessionModal(group); setError('') }}
                                              className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-[10px] flex items-center gap-0.5">
                                              <Plus size={9} /> {lang === 'ar' ? 'حصة إضافية' : 'Extra'}
                                            </button>
                                            <button onClick={e => { e.stopPropagation(); handleDeleteGroup(group.id, group.name) }}
                                              className="px-1.5 py-0.5 bg-red-50 hover:bg-red-100 text-red-500 rounded text-[10px] flex items-center gap-0.5 ms-auto">
                                              <Trash2 size={9} /> {t('common.delete')}
                                            </button>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                        <button
                          onClick={() => { setShowGroupModal(course.id); setError(''); setGroupForm({ name: '', teacherId: '', capacity: '30', monthlyPrice: '', startDate: '', endDate: '', room: '' }) }}
                          className="flex items-center gap-1.5 text-xs text-[#2563EB] font-semibold hover:underline pt-1"
                        >
                          <Plus size={13} /> {t('courses.addGroup')}
                        </button>
                      </div>
                    )
                  })()}
                </div>
              )
            })
          )}
        </div>

        {/* ── RIGHT (5 cols): Timetable Panel for Selected Group ── */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm sticky top-6">
            <div className="flex justify-between items-center pb-3 border-b border-[#F1F5F9] mb-4">
              <div>
                <h3 className="font-bold text-sm text-[#0F172A]">
                  {selectedGroup
                    ? t('courses.groupSchedule', { name: selectedGroup.name })
                    : t('courses.groupTimetable')}
                </h3>
                <p className="text-[11px] text-slate-400">{t('courses.scheduleSubtitle')}</p>
              </div>
              {selectedGroup && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => openGroupStudents(selectedGroup)}
                    className="px-2.5 py-1 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1 transition-colors"
                    title={lang === 'ar' ? 'عرض الطلاب المسجلين' : 'Voir les étudiants'}
                  >
                    <Users size={12} /> {lang === 'ar' ? 'الطلاب' : 'Étudiants'} ({selectedGroup.enrolledCount ?? 0})
                  </button>
                  <button
                    onClick={() => {
                      setShowScheduleModal(selectedGroup)
                      setError('')
                    }}
                    className="px-2.5 py-1 bg-[#2563EB] text-white rounded text-xs font-semibold hover:bg-[#1D4ED8] flex items-center gap-1"
                  >
                    <Plus size={12} /> {t('courses.manage')}
                  </button>
                </div>
              )}
            </div>

            {!selectedGroup ? (
              <div className="text-center py-12 text-slate-400">
                <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">{t('courses.selectGroupPrompt')}</p>
              </div>
            ) : (() => {
              // Resolve course & teacher for selected group
              const selCourse = courses.find(c => c.id === selectedGroup.courseId)
              const selTeacher = teachers.find(tch => tch.id === selectedGroup.teacherId)
              const courseLabel = selCourse
                ? (lang === 'ar' ? selCourse.nameAr : selCourse.nameFr)
                : ''
              const teacherLabel = selTeacher
                ? `${selTeacher.lastName} ${selTeacher.firstName}`
                : t('courses.noTeacher')

              return (
                <div className="space-y-2">
                  {/* Group info bar */}
                  <div className="flex gap-3 mb-3 text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                    <span className="font-semibold text-[#0F172A]">{courseLabel}</span>
                    <span>•</span>
                    <span>{teacherLabel}</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-medium">{Math.round(selectedGroup.monthlyPrice / 4).toLocaleString()} DA/{lang === 'ar' ? 'حصة' : 'séance'}</span>
                  </div>
                  {WEEKDAYS.map((day) => {
                    const daySlots = schedules.filter(
                      (s) => s.groupId === selectedGroup.id && s.weekday === day.id
                    )

                    return (
                      <div key={day.id} className="p-3 bg-slate-50 rounded-lg text-xs flex justify-between items-center">
                        <span className="font-bold text-slate-700 w-24">
                          {getWeekdayLabel(day)}
                        </span>
                        <div className="flex-1 text-end flex flex-wrap justify-end gap-1">
                          {daySlots.length === 0 ? (
                            <span className="text-slate-400 italic">{t('courses.noClasses')}</span>
                          ) : (
                            daySlots.map((slot) => (
                              <button
                                key={slot.id}
                                onClick={() => setEnrollSessionSlot(slot)}
                                className="inline-block bg-white border border-[#2563EB]/30 px-2 py-1 rounded shadow-sm my-0.5 hover:bg-blue-50 hover:border-[#2563EB] transition-colors"
                              >
                                <div className="font-bold text-[#2563EB]">{slot.startTime} – {slot.endTime}</div>
                                {slot.room && <div className="text-[10px] text-slate-500">{slot.room}</div>}
                                <div className="text-[10px] text-[#2563EB]/60">{lang === 'ar' ? 'تسجيل طالب' : 'Inscrire'}</div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* ── Modal: Create Course ── */}
      {showCourseModal && (
        <Modal title={t('courses.addCourse')} onClose={() => setShowCourseModal(false)}>
          <div>
            <label className={labelCls}>{t('courses.nameAr')} *</label>
            <input className={inputCls} value={courseForm.nameAr} onChange={(e) => setCourseForm(f => ({ ...f, nameAr: e.target.value }))} dir="rtl" />
          </div>
          <div>
            <label className={labelCls}>{t('courses.nameFr')} *</label>
            <input className={inputCls} value={courseForm.nameFr} onChange={(e) => setCourseForm(f => ({ ...f, nameFr: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>{t('courses.defaultPrice')}</label>
            <input
              type="number"
              min="0"
              className={inputCls}
              value={courseForm.defaultPrice}
              onChange={(e) => setCourseForm(f => ({ ...f, defaultPrice: e.target.value }))}
              onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
              dir="ltr"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-3">
            <button onClick={() => setShowCourseModal(false)} className="px-4 py-2 border border-border rounded-lg text-xs text-slate-600">{t('common.cancel')}</button>
            <button onClick={handleCreateCourse} disabled={saving} className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-xs font-semibold hover:bg-[#1D4ED8]">
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Create Group ── */}
      {showGroupModal !== null && (() => {
        const targetCourse = courses.find(c => c.id === showGroupModal)
        const courseTeachers = teachers.filter(t => t.courseId === showGroupModal)
        const courseTitle = targetCourse ? (lang === 'ar' ? targetCourse.nameAr : targetCourse.nameFr) : ''

        return (
          <Modal title={lang === 'ar' ? `إضافة فوج لمادة: ${courseTitle}` : `Ajouter un groupe : ${courseTitle}`} onClose={() => setShowGroupModal(null)}>
            {courseTeachers.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-4 rounded-xl space-y-3">
                <p className="font-bold text-sm flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>{lang === 'ar' ? 'لا يوجد أساتذة مسجلين لهذه المادة' : 'Aucun enseignant pour ce module'}</span>
                </p>
                <p className="leading-relaxed">
                  {lang === 'ar'
                    ? `مادة (${courseTitle}) ليس لديها أي أستاذ مخصص بعد. يجب أولاً إضافة أستاذ جديد وتحديد هذه المادة له.`
                    : `Le module (${courseTitle}) n'a aucun enseignant. Ajoutez d'abord un enseignant.`}
                </p>
                <button
                  onClick={() => {
                    setShowGroupModal(null)
                    navigate('/teachers')
                  }}
                  className="w-full bg-[#2563EB] text-white py-2 rounded-lg font-bold text-xs hover:bg-[#1D4ED8] transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Plus size={14} />
                  <span>{lang === 'ar' ? 'الانتقال لصفحة الأساتذة وإضافة أستاذ' : 'Aller aux enseignants'}</span>
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className={labelCls}>{t('common.name')} *</label>
                  <input className={inputCls} value={groupForm.name} onChange={(e) => setGroupForm(f => ({ ...f, name: e.target.value }))} placeholder="مثال: فوج 1 (Groupe 1)" />
                </div>
                <div>
                  <label className={labelCls}>
                    {lang === 'ar' ? `أستاذ المادة (${courseTitle}) *` : `Enseignant (${courseTitle}) *`}
                  </label>
                  <select className={inputCls} value={groupForm.teacherId} onChange={e => setGroupForm(f => ({ ...f, teacherId: e.target.value }))}>
                    <option value="">{lang === 'ar' ? '— اختر أستاذ المادة —' : '— Choisir un enseignant —'}</option>
                    {courseTeachers.map(tch => (
                      <option key={tch.id} value={tch.id}>
                        {tch.lastName} {tch.firstName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>{lang === 'ar' ? 'سعر الشهر (DA)' : 'Prix mensuel (DA)'}</label>
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      value={groupForm.monthlyPrice}
                      onChange={(e) => setGroupForm(f => ({ ...f, monthlyPrice: e.target.value }))}
                      onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
                      dir="ltr"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {lang === 'ar' ? `الحصة: ${Math.round(Number(groupForm.monthlyPrice || 0) / 4).toLocaleString()} DA` : `Par séance: ${Math.round(Number(groupForm.monthlyPrice || 0) / 4).toLocaleString()} DA`}
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>{t('courses.capacity')}</label>
                    <input
                      type="number"
                      min="1"
                      className={inputCls}
                      value={groupForm.capacity}
                      onChange={(e) => setGroupForm(f => ({ ...f, capacity: e.target.value }))}
                      onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>{t('courses.startDate')} *</label>
                    <input type="date" className={inputCls} value={groupForm.startDate} onChange={(e) => setGroupForm(f => ({ ...f, startDate: e.target.value }))} dir="ltr" />
                  </div>
                  <div>
                    <label className={labelCls}>{lang === 'ar' ? 'تاريخ الانتهاء (اختياري)' : 'Date de fin (optionnel)'}</label>
                    <input type="date" className={inputCls} value={groupForm.endDate} onChange={(e) => setGroupForm(f => ({ ...f, endDate: e.target.value }))} dir="ltr" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>{t('courses.roomOptional')}</label>
                  <input className={inputCls} value={groupForm.room} onChange={(e) => setGroupForm(f => ({ ...f, room: e.target.value }))} placeholder={t('courses.roomPlaceholder')} />
                </div>
                {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
                <div className="flex justify-end gap-2 pt-3">
                  <button onClick={() => setShowGroupModal(null)} className="px-4 py-2 border border-border rounded-lg text-xs text-slate-600">{t('common.cancel')}</button>
                  <button onClick={() => handleCreateGroup(showGroupModal!)} disabled={saving} className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-xs font-semibold hover:bg-[#1D4ED8]">
                    {saving ? t('common.saving') : t('common.save')}
                  </button>
                </div>
              </>
            )}
          </Modal>
        )
      })()}

      {/* ── Modal: Edit Group ── */}
      {editingGroup && (() => {
        const courseTeachers = teachers.filter(t => t.courseId === editingGroup.courseId)
        return (
          <Modal title={lang === 'ar' ? `تعديل الفوج: ${editingGroup.name}` : `Modifier le groupe : ${editingGroup.name}`} onClose={() => setEditingGroup(null)}>
            <div>
              <label className={labelCls}>{t('common.name')} *</label>
              <input className={inputCls} value={groupForm.name} onChange={(e) => setGroupForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>{lang === 'ar' ? 'الأستاذ' : 'Enseignant'} *</label>
              <select className={inputCls} value={groupForm.teacherId} onChange={e => setGroupForm(f => ({ ...f, teacherId: e.target.value }))}>
                <option value="">{lang === 'ar' ? '— اختر أستاذ المادة —' : '— Choisir un enseignant —'}</option>
                {courseTeachers.map(tch => (
                  <option key={tch.id} value={tch.id}>
                    {tch.lastName} {tch.firstName}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>{lang === 'ar' ? 'سعر الشهر (DA)' : 'Prix mensuel (DA)'}</label>
              <input
                type="number"
                min="0"
                className={inputCls}
                value={groupForm.monthlyPrice}
                onChange={(e) => setGroupForm(f => ({ ...f, monthlyPrice: e.target.value }))}
                onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
                dir="ltr"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                {lang === 'ar' ? `الحصة: ${Math.round(Number(groupForm.monthlyPrice || 0) / 4).toLocaleString()} DA` : `Par séance: ${Math.round(Number(groupForm.monthlyPrice || 0) / 4).toLocaleString()} DA`}
              </p>
            </div>
            <div>
              <label className={labelCls}>{t('courses.capacity')}</label>
              <input
                type="number"
                min="1"
                className={inputCls}
                value={groupForm.capacity}
                onChange={(e) => setGroupForm(f => ({ ...f, capacity: e.target.value }))}
                onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
                dir="ltr"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>{t('courses.startDate')} *</label>
              <input type="date" className={inputCls} value={groupForm.startDate} onChange={(e) => setGroupForm(f => ({ ...f, startDate: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <label className={labelCls}>{lang === 'ar' ? 'تاريخ الانتهاء (اختياري)' : 'Date de fin (optionnel)'}</label>
              <input type="date" className={inputCls} value={groupForm.endDate} onChange={(e) => setGroupForm(f => ({ ...f, endDate: e.target.value }))} dir="ltr" />
            </div>
          </div>
          <div>
            <label className={labelCls}>{t('courses.roomOptional')}</label>
            <input className={inputCls} value={groupForm.room} onChange={(e) => setGroupForm(f => ({ ...f, room: e.target.value }))} placeholder={t('courses.roomPlaceholder')} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-3">
            <button onClick={() => setEditingGroup(null)} className="px-4 py-2 border border-border rounded-lg text-xs text-slate-600">{t('common.cancel')}</button>
            <button onClick={handleUpdateGroup} disabled={saving} className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-xs font-semibold hover:bg-[#1D4ED8]">
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </Modal>
      )
    })()}


      {/* ── Modal: Manage Schedule Slots ── */}
      {showScheduleModal && (
        <Modal title={t('courses.manageScheduleFor', { name: showScheduleModal.name })} onClose={() => setShowScheduleModal(null)}>
          <div className="space-y-4">
            {/* Existing slots */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700">{t('courses.currentSlots')}</p>
              {schedules.filter(s => s.groupId === showScheduleModal.id).length === 0 ? (
                <p className="text-xs text-slate-400 italic">{t('courses.noSlotsConfigured')}</p>
              ) : (
                schedules.filter(s => s.groupId === showScheduleModal.id).map(slot => {
                  const dayObj = WEEKDAYS.find(w => w.id === slot.weekday)
                  const dayName = dayObj ? getWeekdayLabel(dayObj) : ''
                  return (
                    <div key={slot.id} className="flex justify-between items-center p-2 bg-slate-50 rounded text-xs">
                      <span>
                        <strong>{dayName}:</strong> {slot.startTime} – {slot.endTime}
                        {slot.room ? ` (${slot.room})` : ''}
                      </span>
                      <button onClick={() => handleDeleteSlot(slot.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {/* Add new slot form */}
            <div className="border-t border-slate-200 pt-3 space-y-2">
              <p className="text-xs font-bold text-[#2563EB]">{t('courses.addWeeklySlot')}</p>
              <div>
                <label className={labelCls}>{t('courses.dayOfWeek')}</label>
                <select
                  className={inputCls}
                  value={slotForm.weekday}
                  onChange={e => setSlotForm(f => ({ ...f, weekday: Number(e.target.value) }))}
                >
                  {WEEKDAYS.map(w => (
                    <option key={w.id} value={w.id}>{getWeekdayLabel(w)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>{t('courses.startTime')}</label>
                  <input
                    type="time"
                    className={inputCls}
                    value={slotForm.startTime}
                    onChange={e => setSlotForm(f => ({ ...f, startTime: e.target.value }))}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('courses.endTime')}</label>
                  <input
                    type="time"
                    className={inputCls}
                    value={slotForm.endTime}
                    onChange={e => setSlotForm(f => ({ ...f, endTime: e.target.value }))}
                    dir="ltr"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>{t('courses.roomOptional')}</label>
                <input
                  className={inputCls}
                  value={slotForm.room}
                  onChange={e => setSlotForm(f => ({ ...f, room: e.target.value }))}
                  placeholder={t('courses.roomPlaceholder')}
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                onClick={() => handleAddSlot(showScheduleModal.id)}
                disabled={saving}
                className="w-full py-2 bg-[#2563EB] text-white rounded text-xs font-semibold hover:bg-[#1D4ED8]"
              >
                {saving ? t('common.saving') : t('courses.addWeeklySlot')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Extra Session ── */}
      {showExtraSessionModal && (
        <Modal title={t('courses.createExtraSession') + ' — ' + showExtraSessionModal.name} onClose={() => setShowExtraSessionModal(null)}>
          <div>
            <label className={labelCls}>{t('courses.sessionDate')} *</label>
            <input type="date" className={inputCls} value={extraSessionForm.date} onChange={e => setExtraSessionForm(f => ({ ...f, date: e.target.value }))} dir="ltr" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>{t('courses.startTime')} *</label>
              <input type="time" className={inputCls} value={extraSessionForm.startTime} onChange={e => setExtraSessionForm(f => ({ ...f, startTime: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <label className={labelCls}>{t('courses.endTime')} *</label>
              <input type="time" className={inputCls} value={extraSessionForm.endTime} onChange={e => setExtraSessionForm(f => ({ ...f, endTime: e.target.value }))} dir="ltr" />
            </div>
          </div>
          <div>
            <label className={labelCls}>{t('courses.roomOptional')}</label>
            <input className={inputCls} value={extraSessionForm.room} onChange={e => setExtraSessionForm(f => ({ ...f, room: e.target.value }))} placeholder={t('courses.roomPlaceholder')} />
          </div>

          {/* Price setting */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className={labelCls}>
              {lang === 'ar' ? 'سعر الحصة الإضافية وخيارات الاقتطاع:' : 'Prix de la séance supplémentaire:'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setExtraSessionForm(f => ({ ...f, priceType: 'default' }))}
                className={`py-2 px-2 rounded-lg border text-xs font-semibold transition-all ${
                  extraSessionForm.priceType === 'default'
                    ? 'bg-blue-50 border-[#2563EB] text-[#2563EB]'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {lang === 'ar' ? 'افتراضي (سعر الفوج)' : 'Par défaut (Groupe)'}
              </button>

              <button
                type="button"
                onClick={() => setExtraSessionForm(f => ({ ...f, priceType: 'free' }))}
                className={`py-2 px-2 rounded-lg border text-xs font-semibold transition-all ${
                  extraSessionForm.priceType === 'free'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-700 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                🎁 {lang === 'ar' ? 'مجانية (0 د.ج)' : 'Gratuite (0 DA)'}
              </button>

              <button
                type="button"
                onClick={() => setExtraSessionForm(f => ({ ...f, priceType: 'custom' }))}
                className={`py-2 px-2 rounded-lg border text-xs font-semibold transition-all ${
                  extraSessionForm.priceType === 'custom'
                    ? 'bg-amber-50 border-amber-600 text-amber-700 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                💰 {lang === 'ar' ? 'سعر مخصص' : 'Prix personnalisé'}
              </button>
            </div>

            {extraSessionForm.priceType === 'custom' && (
              <div className="mt-2 animate-fade-in">
                <label className="text-[11px] font-bold text-slate-600">
                  {lang === 'ar' ? 'المبلغ المقتطع من رصيد كل طالب (د.ج):' : 'Montant déduit par étudiant (DA):'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  className={inputCls}
                  placeholder={lang === 'ar' ? 'مثال: 500' : 'Ex: 500'}
                  value={extraSessionForm.customPrice}
                  onChange={e => setExtraSessionForm(f => ({ ...f, customPrice: e.target.value }))}
                />
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-3">
            <button onClick={() => setShowExtraSessionModal(null)} className="px-4 py-2 border border-border rounded-lg text-xs text-slate-600">{t('common.cancel')}</button>
            <button onClick={() => handleAddExtraSession(showExtraSessionModal.id)} disabled={saving} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700">
              {saving ? t('common.saving') : t('courses.extraSession')}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Side Drawer: Enrolled Students in Group ── */}
      {viewGroupStudents && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 animate-fade-in flex justify-end" onClick={() => setViewGroupStudents(null)}>
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 border-b border-border bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#0F172A]">
                    {lang === 'ar' ? `قائمة الطلاب: ${viewGroupStudents.name}` : `Liste des étudiants: ${viewGroupStudents.name}`}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {lang === 'ar'
                      ? `العدد الإجمالي: ${groupEnrollments.length} / ${viewGroupStudents.capacity} طالب`
                      : `Total: ${groupEnrollments.length} / ${viewGroupStudents.capacity} étudiants`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewGroupStudents(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Controls Bar: Search & Quick Add */}
            <div className="p-4 border-b border-border flex gap-2 bg-white">
              <div className="relative flex-1">
                <Search size={14} className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={drawerSearch}
                  onChange={(e) => setDrawerSearch(e.target.value)}
                  placeholder={lang === 'ar' ? 'بحث عن طالب في القائمة...' : 'Rechercher un étudiant...'}
                  className="w-full ps-9 pe-3 py-1.5 border border-border rounded-lg text-xs outline-none focus:border-indigo-500"
                />
              </div>
              <button
                onClick={() => {
                  const groupSlots = schedules.filter(s => s.groupId === viewGroupStudents.id)
                  setSelectedGroup(viewGroupStudents)
                  if (groupSlots.length > 0) setEnrollSessionSlot(groupSlots[0])
                  else setEnrollSessionSlot({ id: 0, groupId: viewGroupStudents.id, weekday: 0, startTime: '00:00', endTime: '00:00', isActive: true })
                }}
                className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-lg flex items-center gap-1 shrink-0"
              >
                <Plus size={14} />
                {lang === 'ar' ? 'إضافة طالب' : 'Ajouter'}
              </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingGroupStudents ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : groupEnrollments.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Users size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">{lang === 'ar' ? 'لا يوجد أي طالب مسجل في هذا الفوج بعد' : 'Aucun étudiant inscrit dans ce groupe'}</p>
                </div>
              ) : (() => {
                const q = drawerSearch.toLowerCase().trim()
                const filtered = groupEnrollments.filter((item) => {
                  const arName = `${item.lastNameAr || item.lastName || ''} ${item.firstNameAr || item.firstName || ''}`.toLowerCase()
                  const frName = `${item.lastNameFr || item.lastName || ''} ${item.firstNameFr || item.firstName || ''}`.toLowerCase()
                  const fullName = (item.fullName || '').toLowerCase()
                  const num = (item.studentNumber || item.registrationNumber || '').toLowerCase()
                  const phone = (item.phone || '').toLowerCase()
                  return arName.includes(q) || frName.includes(q) || fullName.includes(q) || num.includes(q) || phone.includes(q)
                })

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-8 text-xs text-slate-400">
                      {lang === 'ar' ? 'لم يتم العثور على أي نتائج' : 'Aucun résultat'}
                    </div>
                  )
                }

                return filtered.map((item) => {
                  const arName = `${item.lastNameAr || item.lastName || ''} ${item.firstNameAr || item.firstName || ''}`.trim()
                  const frName = `${item.lastNameFr || item.lastName || ''} ${item.firstNameFr || item.firstName || ''}`.trim()
                  const altName = item.fullName || item.studentName || item.name
                  const fallbackLabel = `#${item.studentNumber || item.studentId}`
                  const studentName = lang === 'ar'
                    ? (arName || frName || altName || fallbackLabel)
                    : (frName || arName || altName || fallbackLabel)

                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-white border border-border rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-100">
                          {studentName.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs text-[#0F172A] truncate">{studentName}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                            <span>#{item.studentNumber || item.studentId}</span>
                            {item.phone && <span>• {item.phone}</span>}
                            <span>• {item.agreedPrice} DA</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Direct Link to Student Profile */}
                        <button
                          onClick={() => navigate(`/students/${item.studentId}`)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                          title={lang === 'ar' ? 'الانتقال إلى الملف الشخصي للطالب' : 'Voir le profil de l\'étudiant'}
                        >
                          <ExternalLink size={12} />
                          <span>{lang === 'ar' ? 'الملف' : 'Profil'}</span>
                        </button>

                        {/* Unenroll Button */}
                        <button
                          onClick={() => handleUnenrollStudent(item.id, studentName)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title={lang === 'ar' ? 'إلغاء تسجيل الطالب من الفوج' : 'Désinscrire l\'étudiant'}
                        >
                          <UserMinus size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Enroll Student in Slot / Group ── */}
      {enrollSessionSlot && selectedGroup && (
        <Modal
          title={lang === 'ar' ? `تسجيل طالب في فوج: ${selectedGroup.name}` : `Inscrire un étudiant dans : ${selectedGroup.name}`}
          onClose={() => { setEnrollSessionSlot(null); setEnrollSearch(''); setEnrollStudents([]) }}
        >
          <div className="space-y-3">
            <div className="bg-blue-50 p-2.5 rounded-lg text-xs text-[#2563EB]">
              <span className="font-bold">{lang === 'ar' ? 'التوقيت' : 'Horaire'}: </span>
              {enrollSessionSlot.startTime} – {enrollSessionSlot.endTime} ({enrollSessionSlot.room ?? '—'})
            </div>

            <div>
              <label className={labelCls}>{lang === 'ar' ? 'البحث عن طالب (بالاسم أو اللقب)' : 'Rechercher un étudiant (par nom/prénom)'}</label>
              <input
                ref={enrollSearchRef}
                type="text"
                autoFocus
                className={inputCls}
                placeholder={lang === 'ar' ? 'اكتب اسم الطالب...' : 'Tapez le nom de l\'étudiant...'}
                value={enrollSearch}
                onChange={(e) => handleSearchStudentsForEnroll(e.target.value)}
              />
            </div>

            {/* Results list */}
            {enrollSearch.trim() && (
              <div className="max-h-52 overflow-y-auto border border-border rounded-lg divide-y divide-slate-100 bg-white">
                {enrollStudents.length === 0 ? (
                  <div className="p-3 text-xs text-slate-400 text-center">
                    {lang === 'ar' ? 'لم يتم العثور على أي طالب' : 'Aucun étudiant trouvé'}
                  </div>
                ) : (
                  enrollStudents.map((st) => {
                    const nameAr = `${st.lastNameAr || ''} ${st.firstNameAr || ''}`.trim()
                    const nameFr = `${st.lastNameFr || ''} ${st.firstNameFr || ''}`.trim()
                    const displayName = lang === 'ar'
                      ? (nameAr || nameFr || `${st.lastName || ''} ${st.firstName || ''}`.trim())
                      : (nameFr || nameAr || `${st.lastName || ''} ${st.firstName || ''}`.trim())
                    const number = st.studentNumber || st.registrationNumber || ''
                    return (
                      <div
                        key={st.id}
                        className="p-2.5 flex items-center justify-between hover:bg-slate-50 text-xs cursor-pointer"
                        onClick={() => handleEnrollStudentToGroup(st.id)}
                      >
                        <div>
                          <p className="font-bold text-[#0F172A]">{displayName || (lang === 'ar' ? 'طالب' : 'Étudiant')}</p>
                          {number && <p className="text-[10px] text-slate-400 font-mono">#{number}</p>}
                        </div>
                        <button
                          disabled={enrolling}
                          className="px-3 py-1 bg-[#2563EB] text-white text-[11px] font-semibold rounded hover:bg-[#1D4ED8] disabled:opacity-50"
                        >
                          {enrolling ? (lang === 'ar' ? 'جاري...' : '...') : (lang === 'ar' ? 'تسجيل' : 'Inscrire')}
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

