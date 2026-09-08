import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, UserX, RotateCcw, X, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react'
import type { PaginatedResult, Student, Course, Teacher, Group } from '@shared/types/index'
import { getCourseName } from '../utils/format'

const PAGE_SIZE = 20

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
    <div className="relative min-w-[180px] flex-1">
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
          className="w-full text-xs bg-white border border-slate-300 rounded-xl ps-3 pe-8 py-2 font-medium focus:ring-2 focus:ring-[#2563EB] focus:outline-none shadow-2xs"
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

type StudentItem = Student & { paymentStatus?: string; netBalance?: number; groupNames?: string }

export default function Students() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const lang = i18n.language as 'ar' | 'fr' | 'en'

  const [result, setResult] = useState<PaginatedResult<StudentItem> | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'in_debt' | 'archived'>('all')
  const [loading, setLoading] = useState(true)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hierarchy filter lists
  const [availableCourses, setAvailableCourses] = useState<Course[]>([])
  const [availableTeachers, setAvailableTeachers] = useState<Teacher[]>([])
  const [availableGroups, setAvailableGroups] = useState<Group[]>([])

  // Selected filter text values
  const [selectedModule, setSelectedModule] = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')

  // Load courses, teachers, groups on mount for filters
  useEffect(() => {
    async function loadEntityOptions() {
      try {
        const [cRes, tRes, gRes] = await Promise.all([
          window.schoolApp.courses.list({ status: 'active' }),
          window.schoolApp.teachers.list({ status: 'active' }),
          window.schoolApp.groups.list({ status: 'active' }),
        ])
        if (cRes.success && cRes.data) setAvailableCourses(cRes.data)
        if (tRes.success && tRes.data) setAvailableTeachers(tRes.data)
        if (gRes.success && gRes.data) setAvailableGroups(gRes.data)
      } catch (err) {
        console.error('Failed to load filter options:', err)
      }
    }
    loadEntityOptions()
  }, [])

  // Helper getters
  const getCourseNameHelper = useCallback((c: Course) => getCourseName(c, lang), [lang])
  const getTeacherName = useCallback((t: Teacher) => {
    const fullName = `${t.lastName ?? ''} ${t.firstName ?? ''}`.trim()
    return fullName || `Prof #${t.id}`
  }, [])

  // Filter combo options
  const moduleOptions = useMemo(() => {
    const set = new Set<string>()
    availableCourses.forEach(c => {
      const name = getCourseName(c, lang)
      if (name) set.add(name)
    })
    return Array.from(set).sort()
  }, [availableCourses, lang])

  const teacherOptions = useMemo(() => {
    let filtered = availableTeachers
    if (selectedModule) {
      const course = availableCourses.find(c => getCourseName(c, lang).toLowerCase() === selectedModule.toLowerCase())
      if (course) filtered = filtered.filter(t => t.courseId === course.id)
    }
    const set = new Set<string>()
    filtered.forEach(t => {
      const name = getTeacherName(t)
      if (name) set.add(name)
    })
    return Array.from(set).sort()
  }, [availableTeachers, availableCourses, selectedModule, getTeacherName, lang])

  const groupOptionsMap = useMemo(() => {
    let filtered = availableGroups
    if (selectedModule) {
      const course = availableCourses.find(c => getCourseName(c, lang).toLowerCase() === selectedModule.toLowerCase())
      if (course) filtered = filtered.filter(g => g.courseId === course.id)
    }
    if (selectedTeacher) {
      const teacher = availableTeachers.find(t => getTeacherName(t).toLowerCase() === selectedTeacher.toLowerCase())
      if (teacher) filtered = filtered.filter(g => g.teacherId === teacher.id)
    }
    const map = new Map<string, Group>()
    filtered.forEach(g => {
      const c = availableCourses.find(crs => crs.id === g.courseId)
      const cName = c ? getCourseName(c, lang) : ''
      const label = `${cName ? `${cName} — ` : ''}${g.name}`
      map.set(label, g)
    })
    return map
  }, [availableGroups, availableCourses, availableTeachers, selectedModule, selectedTeacher, getTeacherName, lang])

  const groupOptions = useMemo(() => {
    return Array.from(groupOptionsMap.keys()).sort()
  }, [groupOptionsMap])

  // Cascading Handlers
  const handleModuleChange = (val: string) => {
    setSelectedModule(val)
    if (!val) {
      setSelectedTeacher('')
      setSelectedGroup('')
      return
    }
    if (selectedTeacher) {
      const course = availableCourses.find(c => getCourseName(c, lang).toLowerCase() === val.toLowerCase())
      const teacher = availableTeachers.find(t => getTeacherName(t).toLowerCase() === selectedTeacher.toLowerCase())
      if (course && teacher && teacher.courseId !== course.id) {
        setSelectedTeacher('')
        setSelectedGroup('')
      }
    }
  }

  const handleTeacherChange = (val: string) => {
    setSelectedTeacher(val)
    if (!val) {
      setSelectedGroup('')
      return
    }
    const teacher = availableTeachers.find(t => getTeacherName(t).toLowerCase() === val.toLowerCase())
    if (teacher && teacher.courseId) {
      const course = availableCourses.find(c => c.id === teacher.courseId)
      if (course) setSelectedModule(getCourseName(course, lang))
    }
    if (selectedGroup) {
      const selectedGrp = groupOptionsMap.get(selectedGroup)
      if (selectedGrp && teacher && selectedGrp.teacherId !== teacher.id) {
        setSelectedGroup('')
      }
    }
  }

  const handleGroupChange = (val: string) => {
    setSelectedGroup(val)
    if (!val) return
    let targetGrp = groupOptionsMap.get(val)
    if (!targetGrp) {
      for (const g of availableGroups) {
        const c = availableCourses.find(crs => crs.id === g.courseId)
        const cName = c ? getCourseName(c, lang) : ''
        const label = `${cName ? `${cName} — ` : ''}${g.name}`
        if (label.toLowerCase() === val.toLowerCase()) {
          targetGrp = g
          break
        }
      }
    }

    if (targetGrp) {
      if (targetGrp.teacherId) {
        const teacher = availableTeachers.find(t => t.id === targetGrp.teacherId)
        if (teacher) {
          setSelectedTeacher(getTeacherName(teacher))
          if (teacher.courseId) {
            const course = availableCourses.find(c => c.id === teacher.courseId)
            if (course) setSelectedModule(getCourseName(course, lang))
          }
        }
      } else if (targetGrp.courseId) {
        const course = availableCourses.find(c => c.id === targetGrp.courseId)
        if (course) setSelectedModule(getCourseName(course, lang))
      }
    }
  }

  const handleResetFilters = () => {
    setSelectedModule('')
    setSelectedTeacher('')
    setSelectedGroup('')
    setSearch('')
    setStatusFilter('all')
    setPage(1)
  }

  // Derive target courseId, teacherId, groupId for API query
  const targetCourseId = useMemo(() => {
    if (!selectedModule) return undefined
    const c = availableCourses.find(crs => getCourseName(crs, lang).toLowerCase() === selectedModule.toLowerCase())
    return c?.id
  }, [selectedModule, availableCourses, lang])

  const targetTeacherId = useMemo(() => {
    if (!selectedTeacher) return undefined
    const t = availableTeachers.find(tch => getTeacherName(tch).toLowerCase() === selectedTeacher.toLowerCase())
    return t?.id
  }, [selectedTeacher, availableTeachers, getTeacherName])

  const targetGroupId = useMemo(() => {
    if (!selectedGroup) return undefined
    const g = groupOptionsMap.get(selectedGroup)
    return g?.id
  }, [selectedGroup, groupOptionsMap])

  // Load student list
  const load = useCallback(async (
    p = page,
    q = search,
    st = statusFilter,
    cId = targetCourseId,
    tId = targetTeacherId,
    gId = targetGroupId
  ) => {
    setLoading(true)
    try {
      const res = await window.schoolApp.students.list({
        page: p,
        pageSize: PAGE_SIZE,
        search: q || undefined,
        status: st,
        courseId: cId,
        teacherId: tId,
        groupId: gId,
      })
      if (res.success && res.data) setResult(res.data as PaginatedResult<StudentItem>)
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, targetCourseId, targetTeacherId, targetGroupId])

  useEffect(() => {
    load(page, search, statusFilter, targetCourseId, targetTeacherId, targetGroupId)
  }, [page, statusFilter, targetCourseId, targetTeacherId, targetGroupId, load])

  const handleSearch = (v: string) => {
    setSearch(v)
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => {
      setPage(1)
      load(1, v, statusFilter, targetCourseId, targetTeacherId, targetGroupId)
    }, 350)
  }

  const total = result?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="animate-fade-in space-y-4">
      {/* Search & Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={14} className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            placeholder={t('students.search')}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full ps-9 pe-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all font-medium"
          />
        </div>

        {/* Easy Access Status Filters: All, Paid, In Debt, Archived */}
        <div className="flex gap-1 border border-slate-200 rounded-xl p-1 bg-white shadow-2xs overflow-x-auto">
          <button
            onClick={() => { setStatusFilter('all'); setPage(1); }}
            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
              statusFilter === 'all' ? 'bg-[#2563EB] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t('common.all')}
          </button>
          <button
            onClick={() => { setStatusFilter('paid'); setPage(1); }}
            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 whitespace-nowrap ${
              statusFilter === 'paid' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <CheckCircle2 size={13} />
            {t('students.paidNoDebt')}
          </button>
          <button
            onClick={() => { setStatusFilter('in_debt'); setPage(1); }}
            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 whitespace-nowrap ${
              statusFilter === 'in_debt' ? 'bg-red-600 text-white' : 'text-red-600 hover:bg-red-50'
            }`}
          >
            <AlertCircle size={13} />
            {t('students.inDebt')}
          </button>
          <button
            onClick={() => { setStatusFilter('archived'); setPage(1); }}
            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
              statusFilter === 'archived' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {t('students.archived')}
          </button>
        </div>

        <button
          onClick={() => navigate('/students/new')}
          className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#1D4ED8] transition-colors shrink-0 shadow-xs"
        >
          <Plus size={14} />
          {t('students.add')}
        </button>
      </div>

      {/* Hierarchical Filters (Module -> Teacher -> Group) */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <FilterCombobox
            label={t('students.moduleFilter')}
            placeholder={t('students.filterModulePlaceholder')}
            value={selectedModule}
            onChange={handleModuleChange}
            options={moduleOptions}
          />
          <FilterCombobox
            label={t('students.teacherFilter')}
            placeholder={t('students.filterTeacherPlaceholder')}
            value={selectedTeacher}
            onChange={handleTeacherChange}
            options={teacherOptions}
          />
          <FilterCombobox
            label={t('students.groupFilter')}
            placeholder={t('students.filterGroupPlaceholder')}
            value={selectedGroup}
            onChange={handleGroupChange}
            options={groupOptions}
          />

          {(selectedModule || selectedTeacher || selectedGroup || search || statusFilter !== 'all') && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-500 hover:text-red-600 transition-colors hover:bg-red-50 rounded-xl border border-slate-200 shrink-0"
              title={t('students.resetFiltersTitle')}
            >
              <RotateCcw size={12} />
              <span>{t('students.resetFilters')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && (!result?.items.length) && (
          <div className="text-center py-16 text-slate-400">
            <UserX size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium text-sm">{t('students.noStudents')}</p>
            <p className="text-xs mt-1">{t('students.noStudentsDesc')}</p>
            <button
              onClick={() => navigate('/students/new')}
              className="mt-4 text-xs font-bold text-[#2563EB] hover:underline"
            >
              + {t('students.add')}
            </button>
          </div>
        )}

        {!loading && !!result?.items.length && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wide">
                  <th className="text-start px-4 py-3 font-semibold">{t('students.studentNumber')}</th>
                  <th className="text-start px-4 py-3 font-semibold">{t('students.lastNameAr')} / {t('students.firstNameAr')}</th>
                  <th className="text-start px-4 py-3 font-semibold hidden md:table-cell">{t('students.lastNameFr')}</th>
                  <th className="text-start px-4 py-3 font-semibold hidden sm:table-cell">{t('students.enrolledGroups')}</th>
                  <th className="text-start px-4 py-3 font-semibold hidden lg:table-cell">{t('students.phone')}</th>
                  <th className="text-start px-4 py-3 font-semibold">{t('students.paymentStatusHeader')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.map((student) => {
                  const isDebt = (student.netBalance ?? 0) < 0
                  const absDebt = Math.abs(student.netBalance ?? 0)

                  return (
                    <tr
                      key={student.id}
                      onClick={() => navigate(`/students/${student.id}`)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-slate-600">{student.studentNumber}</td>
                      <td className="px-4 py-3 font-bold text-[#0F172A]">
                        {student.lastNameAr} {student.firstNameAr}
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden md:table-cell font-medium">
                        {student.lastNameFr} {student.firstNameFr}
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell font-medium">
                        {student.groupNames ? (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200">
                            {student.groupNames}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden lg:table-cell font-mono">{student.phone ?? '—'}</td>
                      <td className="px-4 py-3">
                        {isDebt ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-red-100 text-red-700 border border-red-200">
                            <AlertCircle size={11} />
                            {t('students.inDebtWithAmount', { amount: absDebt.toLocaleString() })}
                          </span>
                        ) : (student.netBalance ?? 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 size={11} />
                            {t('students.positiveBalance', { amount: (student.netBalance ?? 0).toLocaleString() })}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            <CheckCircle2 size={11} />
                            {t('students.paidZeroDebt')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/students/${student.id}`) }}
                          className="text-xs font-bold text-[#2563EB] hover:underline"
                        >
                          {t('students.profile')}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-500 font-medium">
              {t('students.total')} <span className="font-bold text-[#0F172A]">{total}</span>
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-white transition-colors font-bold"
              >
                ‹
              </button>
              <span className="px-3 py-1 text-xs border border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] rounded-lg font-bold">
                {page}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-xs border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-white transition-colors font-bold"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
