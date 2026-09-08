import { useState, useEffect, useCallback } from 'react'
import { Plus, ChevronDown, ChevronLeft, BookOpen, Calendar, Trash2, Clock, MapPin, User, Sparkles } from 'lucide-react'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'

const WEEKDAYS = [
  { id: 0, label: 'الأحد', short: 'الأحد' },
  { id: 1, label: 'الإثنين', short: 'الإثنين' },
  { id: 2, label: 'الثلاثاء', short: 'الثلاثاء' },
  { id: 3, label: 'الأربعاء', short: 'الأربعاء' },
  { id: 4, label: 'الخميس', short: 'الخميس' },
  { id: 5, label: 'الجمعة', short: 'الجمعة' },
  { id: 6, label: 'السبت', short: 'السبت' },
]

function CapacityBar({ enrolled, capacity }: { enrolled: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0
  const color = pct > 85 ? 'bg-rose-500' : pct > 65 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2" dir="ltr">
      <span className="text-xs text-slate-500 w-14 font-mono text-left">{enrolled}/{capacity}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function Courses() {
  const [courses, setCourses] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const [courseModal, setCourseModal] = useState(false)
  const [groupModal, setGroupModal] = useState(false)
  const [slotModal, setSlotModal] = useState(false)
  const [generateModal, setGenerateModal] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

  const [courseForm, setCourseForm] = useState({ nameAr: '', nameFr: '', descriptionAr: '', defaultPrice: '2500' })
  const [groupForm, setGroupForm] = useState({
    name: '', teacherId: '', room: '', capacity: '25', monthlyPrice: '2500',
    startDate: new Date().toISOString().split('T')[0]
  })
  const [slotForm, setSlotForm] = useState({ weekday: 0, startTime: '08:00', endTime: '10:00', room: '' })

  const [genPreset, setGenPreset] = useState<'year' | '3m' | '6m' | 'custom'>('year')
  const [genStartDate, setGenStartDate] = useState(new Date().toISOString().split('T')[0])
  const [genEndDate, setGenEndDate] = useState(
    new Date(new Date().getFullYear(), 5, 30).toISOString().split('T')[0]
  )
  const [generating, setGenerating] = useState(false)

  const api = (window as any).schoolApp

  const loadData = useCallback(async () => {
    if (!api) return
    try {
      const [cRes, gRes, tRes, sRes] = await Promise.all([
        api.courses.list(),
        api.groups.list(),
        api.teachers.list(),
        api.schedules.list({ active: true })
      ])

      if (cRes.success && cRes.data) setCourses(cRes.data)
      if (gRes.success && gRes.data) setGroups(gRes.data)
      if (tRes.success && tRes.data) setTeachers(tRes.data)
      if (sRes.success && sRes.data) setSchedules(sRes.data)
    } catch (err) {
      console.error('Failed to load courses & groups:', err)
    }
  }, [api])

  useEffect(() => {
    loadData()
  }, [loadData])

  const toggleExpand = (id: number) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const getCourseGroups = (courseId: number) => groups.filter(g => g.courseId === courseId)
  const getGroupSlots = (groupId: number) => schedules.filter(s => s.groupId === groupId)

  // Open generate modal with calculated dates based on preset
  const handleOpenGenerateModal = (groupId: number) => {
    setSelectedGroupId(groupId)
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() // 0-11
    
    // Academic year runs Sept -> June
    const academicEnd = currentMonth >= 8 ? `${currentYear + 1}-06-30` : `${currentYear}-06-30`

    setGenStartDate(today.toISOString().split('T')[0])
    setGenEndDate(academicEnd)
    setGenPreset('year')
    setGenerateModal(true)
  }

  const handleExecuteGenerate = async () => {
    if (!api || !selectedGroupId) return
    let start = genStartDate
    let end = genEndDate

    const today = new Date()
    if (genPreset === '3m') {
      start = today.toISOString().split('T')[0]
      const endD = new Date(today)
      endD.setMonth(endD.getMonth() + 3)
      end = endD.toISOString().split('T')[0]
    } else if (genPreset === '6m') {
      start = today.toISOString().split('T')[0]
      const endD = new Date(today)
      endD.setMonth(endD.getMonth() + 6)
      end = endD.toISOString().split('T')[0]
    }

    setGenerating(true)
    try {
      const res = await api.sessions.generate(selectedGroupId, start, end)
      if (res.success) {
        setGenerateModal(false)
        alert(`تم بنجاح! تم إنشاء ${res.data.generated} حصة دورية لهذا الفوج من ${start} إلى ${end} دون أي تكرار.`)
      } else {
        alert(res.error?.message || 'حدث خطأ أثناء توليد الحصص')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  const handleAddCourse = async () => {
    if (!api || (!courseForm.nameAr && !courseForm.nameFr)) {
      alert('يرجى إدخال اسم المادة / الدورة')
      return
    }
    try {
      const res = await api.courses.create({
        nameAr: courseForm.nameAr || courseForm.nameFr,
        nameFr: courseForm.nameFr || courseForm.nameAr,
        descriptionFr: courseForm.descriptionAr,
        defaultPrice: Number(courseForm.defaultPrice) || 0,
      })
      if (res.success) {
        setCourseModal(false)
        setCourseForm({ nameAr: '', nameFr: '', descriptionAr: '', defaultPrice: '2500' })
        loadData()
      } else {
        alert(res.error?.message || 'خطأ أثناء إنشاء المادة')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleAddGroup = async () => {
    if (!api || !selectedCourseId || !groupForm.name || !groupForm.teacherId) {
      alert('يرجى ملء الحقول الإجبارية (اسم الفوج، الأستاذ المشرف)')
      return
    }
    try {
      const res = await api.groups.create({
        courseId: selectedCourseId,
        teacherId: Number(groupForm.teacherId),
        name: groupForm.name,
        room: groupForm.room || null,
        capacity: Number(groupForm.capacity) || 25,
        monthlyPrice: Number(groupForm.monthlyPrice) || 0,
        startDate: groupForm.startDate || new Date().toISOString().split('T')[0],
      })
      if (res.success) {
        setGroupModal(false)
        setGroupForm({ name: '', teacherId: '', room: '', capacity: '25', monthlyPrice: '2500', startDate: new Date().toISOString().split('T')[0] })
        loadData()
      } else {
        alert(res.error?.message || 'خطأ أثناء إنشاء الفوج')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleAddSlot = async () => {
    if (!api || !selectedGroupId) return
    try {
      const res = await api.schedules.create({
        groupId: selectedGroupId,
        weekday: Number(slotForm.weekday),
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        room: slotForm.room || undefined,
      })
      if (res.success) {
        setSlotModal(false)
        loadData()
      } else {
        alert(res.error?.message || 'خطأ أثناء إضافة التوقيت')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteSlot = async (slotId: number) => {
    if (!api || !confirm('هل أنت متأكد من حذف هذا التوقيت الأسبوعي؟')) return
    try {
      const res = await api.schedules.delete(slotId)
      if (res.success) {
        loadData()
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Weekly schedule calculation from schedule slots
  const scheduleView = WEEKDAYS.map(({ id, short, label }) => {
    const slots = schedules.filter(s => s.weekday === id)
    return { day: short, fullDay: label, slots }
  })

  return (
    <div className="grid grid-cols-3 gap-6" dir="rtl">
      {/* Course & Groups List */}
      <div className="col-span-2 space-y-4">
        <div className="flex items-center justify-between pb-1">
          <div>
            <h2 className="text-base font-bold text-slate-900">المواد والأفواج التعليمية ({courses.length})</h2>
            <p className="text-xs text-slate-500">إدارة المواد، الأفواج الدراسية، الحصص والمواقيت الأسبوعية</p>
          </div>
          <button
            onClick={() => setCourseModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={16} /> إضافة مادة / دورة
          </button>
        </div>

        {courses.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 shadow-sm">
            <BookOpen size={40} className="mx-auto mb-2 opacity-40 text-blue-600" />
            <p className="text-sm font-medium text-slate-600">لم يتم تسجيل أي مادة أو دورة بعد</p>
            <button
              onClick={() => setCourseModal(true)}
              className="mt-3 text-xs text-blue-600 font-bold hover:underline cursor-pointer"
            >
              + إضافة المادة الأولى
            </button>
          </div>
        ) : (
          courses.map(course => {
            const courseGroups = getCourseGroups(course.id)
            const isOpen = expanded.has(course.id)
            return (
              <div key={course.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50/80 transition-colors"
                  onClick={() => toggleExpand(course.id)}
                >
                  <button className="text-slate-400 shrink-0">
                    {isOpen ? <ChevronDown size={18} /> : <ChevronLeft size={18} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-slate-900 text-sm">{course.nameAr || course.nameFr}</h3>
                      {course.nameFr && course.nameAr && course.nameFr !== course.nameAr && (
                        <span className="text-xs text-slate-400 font-normal font-sans" dir="ltr">({course.nameFr})</span>
                      )}
                      <Badge variant={course.status}>{course.status === 'active' ? 'نشط' : course.status}</Badge>
                    </div>
                    {course.descriptionFr && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{course.descriptionFr}</p>
                    )}
                  </div>
                  <div className="text-left shrink-0" dir="ltr">
                    <p className="text-sm font-bold text-slate-800 font-mono">
                      {Number(course.defaultPrice).toLocaleString('ar-DZ')} دج / شهر
                    </p>
                    <p className="text-xs text-slate-400 text-right" dir="rtl">
                      {courseGroups.length} فوج
                    </p>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/50">
                    <div className="px-5 py-2.5 flex items-center justify-between bg-slate-100/70 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-700">الأفواج التابعة لهذه المادة ({courseGroups.length})</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedCourseId(course.id)
                          setGroupModal(true)
                        }}
                        className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 font-bold transition-colors cursor-pointer"
                      >
                        <Plus size={14} /> إضافة فوج جديد
                      </button>
                    </div>

                    {courseGroups.length === 0 ? (
                      <div className="px-5 py-6 text-xs text-slate-400 text-center">
                        لا توجد أي أفواج مسجلة لهذه المادة
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 bg-white">
                        {courseGroups.map(g => {
                          const teacher = teachers.find(t => t.id === g.teacherId)
                          const slots = getGroupSlots(g.id)
                          return (
                            <div key={g.id} className="px-5 py-4 space-y-3">
                              <div className="grid grid-cols-4 gap-4 items-center">
                                <div>
                                  <p className="text-sm font-bold text-slate-900">{g.name}</p>
                                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                    <MapPin size={11} className="text-slate-400" />
                                    <span>القاعة: {g.room || 'غير محددة'}</span>
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-800 font-bold flex items-center gap-1">
                                    <User size={12} className="text-blue-600" />
                                    <span>{teacher ? `${teacher.firstName} ${teacher.lastName}` : 'أستاذ غير محدد'}</span>
                                  </p>
                                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                                    {slots.length} مواقيت أسبوعية
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span>نسبة الامتلاء:</span>
                                  </div>
                                  <CapacityBar enrolled={g.enrolledCount ?? 0} capacity={g.capacity} />
                                </div>
                                <div className="flex items-center justify-end gap-2.5">
                                  <span className="text-xs font-bold text-slate-800 font-mono" dir="ltr">
                                    {Number(g.monthlyPrice).toLocaleString('ar-DZ')} دج
                                  </span>
                                  <button
                                    onClick={() => handleOpenGenerateModal(g.id)}
                                    title="توليد الحصص الدورية"
                                    className="px-2.5 py-1.5 rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <Sparkles size={13} />
                                    <span>توليد الحصص</span>
                                  </button>
                                </div>
                              </div>

                              {/* Slots sub-list */}
                              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                                  <Clock size={12} />
                                  <span>التوقيت الأسبوعي:</span>
                                </span>
                                {slots.length === 0 ? (
                                  <span className="text-xs text-slate-400">لم يتم تحديد مواعيد أسبوعية بعد</span>
                                ) : (
                                  slots.map(s => {
                                    const dayObj = WEEKDAYS.find(w => w.id === s.weekday)
                                    const dayName = dayObj?.label ?? 'يوم'
                                    return (
                                      <div key={s.id} className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-md border border-slate-200 text-xs shadow-2xs">
                                        <span className="font-bold text-blue-700">{dayName}</span>
                                        <span className="text-slate-600 font-mono" dir="ltr">{s.startTime}–{s.endTime}</span>
                                        {s.room && <span className="text-slate-400 text-[10px]">({s.room})</span>}
                                        <button
                                          onClick={() => handleDeleteSlot(s.id)}
                                          className="text-slate-300 hover:text-rose-600 mr-1 transition-colors cursor-pointer"
                                          title="حذف التوقيت"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    )
                                  })
                                )}
                                <button
                                  onClick={() => {
                                    setSelectedGroupId(g.id)
                                    setSlotModal(true)
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-bold mr-auto flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus size={13} /> إضافة توقيت
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Weekly Schedule Timetable */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">الجدول الأسبوعي العام</h2>
          <p className="text-xs text-slate-500">توزيع الحصص الأسبوعية حسب أيام الأسبوع</p>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {scheduleView.map(({ day, fullDay, slots }) => (
            <div key={day} className="border-b border-slate-100 last:border-0">
              <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">{fullDay}</span>
                <span className="text-xs text-slate-500 font-medium">{slots.length} حصة</span>
              </div>
              {slots.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-400 text-center">لا توجد حصص مبرمجة</div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {slots.map(s => {
                    const group = groups.find(g => g.id === s.groupId)
                    const course = courses.find(c => c.id === group?.courseId)
                    const teacher = teachers.find(t => t.id === group?.teacherId)
                    return (
                      <div key={s.id} className="px-4 py-2.5 flex items-start gap-2.5 hover:bg-slate-50/60 transition-colors">
                        <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-slate-800 truncate">{group?.name}</p>
                            <span className="text-xs font-mono font-bold text-blue-700" dir="ltr">{s.startTime}–{s.endTime}</span>
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {course?.nameAr || course?.nameFr} · {teacher ? `${teacher.firstName} ${teacher.lastName}` : '—'}
                          </p>
                          {s.room && <p className="text-[11px] text-slate-400 mt-0.5">القاعة: {s.room}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add Course Modal */}
      <Modal open={courseModal} onClose={() => setCourseModal(false)} title="إضافة مادة / دورة تعليمية" size="sm">
        <div className="space-y-4" dir="rtl">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم المادة / الدورة (بالعربية) *</label>
            <input
              type="text"
              placeholder="مثال: الرياضيات، اللغة الفرنسية، الفيزياء..."
              value={courseForm.nameAr}
              onChange={e => setCourseForm(prev => ({ ...prev, nameAr: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم المادة (بالفرنسية / اللاتينية)</label>
            <input
              type="text"
              placeholder="ex: Mathématiques, Français B1..."
              value={courseForm.nameFr}
              onChange={e => setCourseForm(prev => ({ ...prev, nameFr: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-sans text-left"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">الوصف (اختياري)</label>
            <input
              type="text"
              placeholder="وصف مختصر للمادة..."
              value={courseForm.descriptionAr}
              onChange={e => setCourseForm(prev => ({ ...prev, descriptionAr: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">الرسوم الشهرية الافتراضية (دج)</label>
            <input
              type="number"
              value={courseForm.defaultPrice}
              onChange={e => setCourseForm(prev => ({ ...prev, defaultPrice: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button onClick={() => setCourseModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer">
              إلغاء
            </button>
            <button onClick={handleAddCourse} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer">
              حفظ المادة
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Group Modal */}
      <Modal open={groupModal} onClose={() => setGroupModal(false)} title="إضافة فوج دراسي جديد" size="md">
        <div className="grid grid-cols-2 gap-4" dir="rtl">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم الفوج *</label>
            <input
              type="text"
              placeholder="مثال: فوج A1 (صباحي)"
              value={groupForm.name}
              onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">الأستاذ المشرف *</label>
            <select
              value={groupForm.teacherId}
              onChange={e => setGroupForm(f => ({ ...f, teacherId: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
            >
              <option value="">-- اختر الأستاذ --</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">القاعة</label>
            <input
              type="text"
              placeholder="مثال: قاعة 101، مخبر 2..."
              value={groupForm.room}
              onChange={e => setGroupForm(f => ({ ...f, room: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">الطاقة الاستيعابية القصوى</label>
            <input
              type="number"
              value={groupForm.capacity}
              onChange={e => setGroupForm(f => ({ ...f, capacity: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">الرسوم الشهرية للفوج (دج)</label>
            <input
              type="number"
              value={groupForm.monthlyPrice}
              onChange={e => setGroupForm(f => ({ ...f, monthlyPrice: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">تاريخ بدء الفوج</label>
            <input
              type="date"
              value={groupForm.startDate}
              onChange={e => setGroupForm(f => ({ ...f, startDate: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2.5 pt-4 mt-4 border-t border-slate-100" dir="rtl">
          <button onClick={() => setGroupModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer">
            إلغاء
          </button>
          <button onClick={handleAddGroup} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer">
            حفظ الفوج
          </button>
        </div>
      </Modal>

      {/* Add Schedule Slot Modal */}
      <Modal open={slotModal} onClose={() => setSlotModal(false)} title="إضافة توقيت أسبوعي للفوج" size="sm">
        <div className="space-y-4" dir="rtl">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">يوم الأسبوع</label>
            <select
              value={slotForm.weekday}
              onChange={e => setSlotForm(s => ({ ...s, weekday: Number(e.target.value) }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
            >
              {WEEKDAYS.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">وقت البدء</label>
              <input
                type="time"
                value={slotForm.startTime}
                onChange={e => setSlotForm(s => ({ ...s, startTime: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">وقت الانتهاء</label>
              <input
                type="time"
                value={slotForm.endTime}
                onChange={e => setSlotForm(s => ({ ...s, endTime: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">القاعة (اختياري)</label>
            <input
              type="text"
              placeholder="قاعة محددة لهذا التوقيت..."
              value={slotForm.room}
              onChange={e => setSlotForm(s => ({ ...s, room: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button onClick={() => setSlotModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer">
              إلغاء
            </button>
            <button onClick={handleAddSlot} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer">
              إضافة التوقيت
            </button>
          </div>
        </div>
      </Modal>

      {/* Generate Sessions Modal */}
      <Modal open={generateModal} onClose={() => setGenerateModal(false)} title="توليد الحصص التلقائية للفوج" size="sm">
        <div className="space-y-4" dir="rtl">
          <p className="text-xs text-slate-600 leading-relaxed">
            سيقوم النظام بإنشاء جميع الحصص الدورية في جدول الحصص بناءً على المواقيت المحددة دون أي تكرار.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">الفترة الزمنية</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setGenPreset('year')}
                className={`py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                  genPreset === 'year' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                كامل الموسم
              </button>
              <button
                type="button"
                onClick={() => setGenPreset('3m')}
                className={`py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                  genPreset === '3m' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                3 أشهر قادمة
              </button>
              <button
                type="button"
                onClick={() => setGenPreset('6m')}
                className={`py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                  genPreset === '6m' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                6 أشهر قادمة
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button onClick={() => setGenerateModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer">
              إلغاء
            </button>
            <button
              onClick={handleExecuteGenerate}
              disabled={generating}
              className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles size={14} />
              <span>{generating ? 'جاري التوليد...' : 'توليد الحصص'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
