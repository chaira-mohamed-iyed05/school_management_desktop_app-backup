export interface CourseEntity {
  nameAr?: string | null
  nameFr?: string | null
  nameEn?: string | null
  [key: string]: any
}

export interface TeacherEntity {
  firstName?: string | null
  lastName?: string | null
  nameAr?: string | null
  nameFr?: string | null
  nameEn?: string | null
  [key: string]: any
}

/**
 * Get localized course module name according to current language
 */
export function getCourseName(course: CourseEntity | null | undefined, lang: string): string {
  if (!course) return ''
  if (lang === 'ar') return course.nameAr || course.nameFr || course.nameEn || ''
  if (lang === 'en') return course.nameEn || course.nameFr || course.nameAr || ''
  return course.nameFr || course.nameAr || course.nameEn || ''
}

/**
 * Get localized teacher name according to current language
 */
export function getTeacherName(teacher: TeacherEntity | null | undefined, lang: string): string {
  if (!teacher) return ''
  const first = teacher.firstName || ''
  const last = teacher.lastName || ''
  if (first || last) return `${first} ${last}`.trim()
  if (lang === 'ar') return teacher.nameAr || teacher.nameFr || teacher.nameEn || ''
  if (lang === 'en') return teacher.nameEn || teacher.nameFr || teacher.nameAr || ''
  return teacher.nameFr || teacher.nameAr || teacher.nameEn || ''
}

/**
 * Get localized weekday name (0 = Saturday, 1 = Sunday, ..., 6 = Friday or 0-6 standard JS)
 */
export function getDayName(dayIndex: number, lang: string): string {
  const daysAr = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
  const daysFr = ['Samedi', 'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']
  const daysEn = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

  const idx = ((dayIndex % 7) + 7) % 7
  if (lang === 'ar') return daysAr[idx]
  if (lang === 'en') return daysEn[idx]
  return daysFr[idx]
}

/**
 * Format currency string according to language (DA in DZD / دج)
 */
export function formatCurrency(amount: number | null | undefined, lang: string): string {
  const val = typeof amount === 'number' && !isNaN(amount) ? amount : 0
  const num = Math.abs(val).toLocaleString()
  const suffix = lang === 'ar' ? 'دج' : 'DA'
  if (val < 0) {
    return `-${num} ${suffix}`
  }
  return `${num} ${suffix}`
}

/**
 * Get localized attendance status label
 */
export function getAttendanceStatusLabel(status: string, lang: string): string {
  switch (status) {
    case 'present':
      return lang === 'ar' ? 'حاضر' : lang === 'en' ? 'Present' : 'Présent'
    case 'late':
      return lang === 'ar' ? 'متأخر' : lang === 'en' ? 'Late' : 'En retard'
    case 'absent':
      return lang === 'ar' ? 'غائب' : lang === 'en' ? 'Absent' : 'Absent'
    case 'not_active':
      return lang === 'ar' ? 'غير نشط' : lang === 'en' ? 'Not Active' : 'Non actif'
    default:
      return status
  }
}
