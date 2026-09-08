import { handle } from './_handler'
import { IPC_CHANNELS } from '../../shared/constants/index'
import {
  CreateStudentSchema, UpdateStudentSchema,
  StudentIdSchema, StudentListSchema
} from '../../shared/schemas/index'
import {
  listStudents, getStudentById, createStudent,
  updateStudent, archiveStudent, regenerateQRToken
} from '../services/student.service'
import { getPhotoAsDataUrl } from '../services/media.service'
import { getSqlite } from '../database/connection'
import { getStudentAttendanceHistory } from '../services/attendance.service'
import { z } from 'zod'

export function registerStudentHandlers(): void {
  handle(IPC_CHANNELS.STUDENTS_LIST, async (payload) => {
    const opts = StudentListSchema.parse(payload ?? {})
    return listStudents(opts)
  })

  handle(IPC_CHANNELS.STUDENTS_GET, async (payload) => {
    const { id } = StudentIdSchema.parse(payload)
    return getStudentById(id)
  })

  handle(IPC_CHANNELS.STUDENTS_CREATE, async (payload) => {
    const data = CreateStudentSchema.parse(payload)
    return createStudent(data)
  })

  handle(IPC_CHANNELS.STUDENTS_UPDATE, async (payload) => {
    const data = UpdateStudentSchema.parse(payload)
    const { id, ...rest } = data
    return updateStudent(id, rest)
  })

  handle(IPC_CHANNELS.STUDENTS_ARCHIVE, async (payload) => {
    const { id } = StudentIdSchema.parse(payload)
    await archiveStudent(id)
    return true
  })

  handle(IPC_CHANNELS.STUDENTS_REGEN_QR, async (payload) => {
    const { id } = StudentIdSchema.parse(payload)
    const token = await regenerateQRToken(id)
    return { token }
  })

  handle(IPC_CHANNELS.STUDENTS_GET_PHOTO_URL, async (payload) => {
    const { filename, entityType } = z.object({
      filename: z.string().max(200),
      entityType: z.enum(['student', 'teacher']),
    }).parse(payload)
    const dataUrl = getPhotoAsDataUrl(filename, entityType)
    return { dataUrl }
  })

  // ─── Live name search (autocomplete, max 7 results) ─────────────────────

  handle(IPC_CHANNELS.STUDENTS_SEARCH_NAME, async (payload) => {
    const { query } = z.object({ query: z.string().min(1).max(100) }).parse(payload)
    const sqlite = getSqlite()
    const q = `%${query.trim()}%`
    const rows = sqlite.prepare(`
      SELECT id, student_number, first_name_ar, last_name_ar, first_name_fr, last_name_fr, status
      FROM students
      WHERE status != 'archived'
        AND (
          first_name_ar  LIKE ? OR last_name_ar  LIKE ?
          OR first_name_fr LIKE ? OR last_name_fr LIKE ?
          OR (last_name_ar || ' ' || first_name_ar) LIKE ?
          OR (first_name_ar || ' ' || last_name_ar) LIKE ?
          OR (last_name_fr || ' ' || first_name_fr) LIKE ?
          OR (first_name_fr || ' ' || last_name_fr) LIKE ?
          OR student_number LIKE ?
        )
      ORDER BY last_name_ar, first_name_ar
      LIMIT 25
    `).all(q, q, q, q, q, q, q, q, q) as any[]

    return rows.map(r => ({
      id: r.id,
      studentNumber: r.student_number,
      registrationNumber: r.student_number,
      firstNameAr: r.first_name_ar,
      lastNameAr: r.last_name_ar,
      firstNameFr: r.first_name_fr,
      lastNameFr: r.last_name_fr,
      firstName: r.first_name_ar || r.first_name_fr || '',
      lastName: r.last_name_ar || r.last_name_fr || '',
      status: r.status,
    }))
  })

  // ─── Full attendance history for a student ────────────────────────────────

  handle('students:attendanceHistory', async (payload) => {
    const { studentId } = z.object({ studentId: z.number().int().positive() }).parse(payload)
    return getStudentAttendanceHistory(studentId)
  })
}
