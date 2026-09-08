import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Archive, Camera, RefreshCw, BookOpen, Filter } from 'lucide-react'
import type { Teacher, Course } from '@shared/types/index'
import { getCourseName } from '../utils/format'

function TeacherAvatar({ teacher, onUpload, title }: { teacher: Teacher; onUpload: () => void; title: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (teacher.photoPath) {
      window.schoolApp.media.getImageUrl(teacher.photoPath).then((res) => {
        if (res.success && res.data?.url) setUrl(res.data.url)
      }).catch(() => {})
    } else {
      setUrl(null)
    }
  }, [teacher.photoPath])

  return (
    <div
      onClick={onUpload}
      className="relative group cursor-pointer w-11 h-11 rounded-full bg-[#F0FDF4] flex items-center justify-center text-green-700 font-bold text-base border-2 border-emerald-200 shrink-0 overflow-hidden"
      title={title}
    >
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        teacher.firstName.charAt(0)
      )}
      <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Camera size={14} className="text-white" />
      </div>
    </div>
  )
}

export default function Teachers() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', courseId: '', phone: '', email: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all')
  const [courseFilter, setCourseFilter] = useState<string>('')

  const load = async (filter = statusFilter, selectedCourse = courseFilter) => {
    const [tRes, cRes] = await Promise.all([
      window.schoolApp.teachers.list({
        status: filter,
        courseId: selectedCourse ? Number(selectedCourse) : undefined,
      }),
      window.schoolApp.courses.list(),
    ])
    if (tRes.success && tRes.data) setTeachers(tRes.data)
    if (cRes.success && cRes.data) setCourses(cRes.data)
    setLoading(false)
  }

  useEffect(() => { load(statusFilter, courseFilter) }, [statusFilter, courseFilter])

  const openCreate = () => {
    setEditing(null)
    setForm({ firstName: '', lastName: '', courseId: courseFilter || '', phone: '', email: '', address: '' })
    setError('')
    setShowForm(true)
  }

  const openEdit = (teacher: Teacher) => {
    setEditing(teacher)
    setForm({
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      courseId: teacher.courseId ? String(teacher.courseId) : '',
      phone: teacher.phone ?? '',
      email: teacher.email ?? '',
      address: teacher.address ?? '',
    })
    setError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError(t('teachers.fillNames'))
      return
    }
    if (!form.courseId) {
      setError(t('teachers.selectModuleRequired'))
      return
    }

    setSaving(true)
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        courseId: Number(form.courseId),
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
      }
      const res = editing
        ? await window.schoolApp.teachers.update(editing.id, payload)
        : await window.schoolApp.teachers.create(payload)

      if (res.success) {
        setShowForm(false)
        await load()
      } else {
        setError(res.error ?? t('common.error'))
      }
    } finally { setSaving(false) }
  }

  const handleArchive = async (id: number) => {
    if (!window.confirm(t('teachers.archiveConfirm'))) return
    await window.schoolApp.teachers.archive(id)
    await load()
  }

  const handleUploadPhoto = async (teacherId: number) => {
    const res = await window.schoolApp.media.selectImage('teacher', String(teacherId))
    if (res.success && res.data?.path) {
      await window.schoolApp.teachers.update(teacherId, { photoPath: res.data.path } as any)
      await load()
    }
  }

  const handleRestore = async (id: number) => {
    if (!window.confirm(t('teachers.restoreConfirm'))) return
    await window.schoolApp.teachers.update(id, { status: 'active' } as any)
    await load()
  }

  const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all bg-white'

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-[#0F172A]">{t('nav.teachers')}</h2>
          <p className="text-xs text-slate-400">
            {t('teachers.subtitle')}
          </p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] transition-colors shadow-xs">
          <Plus size={15} /> {t('teachers.add')}
        </button>
      </div>

      {/* Filter tabs & Course filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-border">
        <div className="flex gap-2">
          {(['all', 'active', 'archived'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === s
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'bg-white border border-border text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s === 'all' ? t('common.all') : s === 'active' ? t('teachers.active') : t('common.archived')}
            </button>
          ))}
        </div>

        {/* Filter by module */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="text-xs border border-border rounded-lg px-3 py-1.5 font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
          >
            <option value="">{t('teachers.allModules')}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {getCourseName(c, lang)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
      ) : teachers.length === 0 ? (
        <div className="text-center py-20 text-slate-400 bg-white rounded-xl border border-border">
          <p className="font-medium">{t('teachers.noTeachers')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teachers.map((teacher) => {
            const courseTitle = getCourseName({ nameAr: teacher.courseNameAr, nameFr: teacher.courseNameFr }, lang) || t('teachers.unspecified')

            return (
              <div key={teacher.id} className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <TeacherAvatar
                        teacher={teacher}
                        onUpload={() => handleUploadPhoto(teacher.id)}
                        title={t('teachers.changePhoto')}
                      />
                      <div>
                        <p className="font-semibold text-[#0F172A] text-sm">{teacher.lastName} {teacher.firstName}</p>
                        <p className="text-xs text-slate-400">{teacher.phone ?? teacher.email ?? '—'}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      teacher.status === 'active' ? 'bg-green-100 text-green-700' :
                      teacher.status === 'inactive' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {teacher.status === 'active' ? t('teachers.active') : teacher.status === 'inactive' ? t('teachers.inactive') : t('common.archived')}
                    </span>
                  </div>

                  {/* Module badge */}
                  <div className="my-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs bg-blue-50 border border-blue-200 text-[#2563EB] px-2.5 py-1 rounded-lg font-bold">
                      <BookOpen size={13} />
                      <span>{t('teachers.moduleLabel', { name: courseTitle })}</span>
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <button onClick={() => openEdit(teacher)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#2563EB] transition-colors font-medium">
                    <Pencil size={11} /> {t('common.edit')}
                  </button>
                  {teacher.status === 'archived' ? (
                    <button onClick={() => handleRestore(teacher.id)} className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 transition-colors ms-auto font-semibold">
                      <RefreshCw size={11} /> {t('teachers.restore')}
                    </button>
                  ) : (
                    <button onClick={() => handleArchive(teacher.id)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors ms-auto">
                      <Archive size={11} /> {t('teachers.archive')}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Teacher Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-[#0F172A] mb-4">{editing ? t('teachers.edit') : t('teachers.add')}</h3>
            
            <div className="space-y-3">
              {/* Mandatory Module Selection */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  {t('teachers.assignedModule')}
                </label>
                <select
                  className={inputCls}
                  value={form.courseId}
                  onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}
                >
                  <option value="">{t('teachers.selectModulePlaceholder')}</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {getCourseName(c, lang)}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-lg mt-1.5 leading-tight">
                  💡 {t('teachers.singleModuleNotice')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('teachers.lastName')} *</label>
                  <input className={inputCls} value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('teachers.firstName')} *</label>
                  <input className={inputCls} value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('teachers.phone')}</label>
                <input className={inputCls} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('teachers.email')}</label>
                <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} dir="ltr" />
              </div>
            </div>

            {error && <p className="text-red-600 text-xs mt-3 font-semibold">{error}</p>}
            
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] transition-colors disabled:opacity-60 flex items-center gap-2">
                {saving && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
