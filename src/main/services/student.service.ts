import { eq, like, and, or, desc, asc, sql, count } from 'drizzle-orm'
import crypto from 'node:crypto'
import { getDb, getSqlite, schema } from '../database/connection'
import { AppError, ErrorCode } from '../../shared/errors/index'
import { QR_TOKEN_PREFIX, QR_TOKEN_BYTES, DEFAULT_STUDENT_NUMBER_PREFIX } from '../../shared/constants/index'
import { requireSession } from './auth.service'
import type { Student, PaginatedResult } from '../../shared/types/index'
import log from 'electron-log'

// ─── QR token generation ──────────────────────────────────────────────────────

function generateQRToken(): string {
  const random = crypto.randomBytes(QR_TOKEN_BYTES).toString('hex')
  return `${QR_TOKEN_PREFIX}${random}`
}

// ─── Student number generation ────────────────────────────────────────────────

async function generateStudentNumber(prefix: string): Promise<string> {
  const db = getDb()
  const result = await db
    .select({ count: count() })
    .from(schema.students)
  const total = result[0]?.count ?? 0
  const num = String(total + 1).padStart(4, '0')
  return `${prefix}-${num}`
}

function mapRow(row: any): Student {
  return {
    id: row.id,
    studentNumber: row.studentNumber ?? row.student_number,
    firstNameAr: row.firstNameAr ?? row.first_name_ar ?? '',
    lastNameAr: row.lastNameAr ?? row.last_name_ar ?? '',
    firstNameFr: row.firstNameFr ?? row.first_name_fr ?? '',
    lastNameFr: row.lastNameFr ?? row.last_name_fr ?? '',
    dateOfBirth: row.dateOfBirth ?? row.date_of_birth ?? null,
    gender: (row.gender as 'male' | 'female') ?? 'male',
    phone: row.phone ?? null,
    guardianName: row.guardianName ?? row.guardian_name ?? null,
    guardianRelationship: row.guardianRelationship ?? row.guardian_relationship ?? null,
    guardianPhone: row.guardianPhone ?? row.guardian_phone ?? null,
    secondaryPhone: row.secondaryPhone ?? row.secondary_phone ?? null,
    address: row.address ?? null,
    photoPath: row.photoPath ?? row.photo_path ?? null,
    registrationDate: row.registrationDate ?? row.registration_date,
    status: row.status as Student['status'],
    qrToken: row.qrToken ?? row.qr_token,
    qrTokenActive: Boolean(row.qrTokenActive ?? row.qr_token_active),
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
  }
}

// ─── List students ────────────────────────────────────────────────────────────

export async function listStudents(opts: {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  courseId?: number
  teacherId?: number
  groupId?: number
}): Promise<PaginatedResult<Student>> {
  const sqlite = getSqlite()
  const page = Math.max(1, opts.page ?? 1)
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50))
  const offset = (page - 1) * pageSize

  let whereClauses: string[] = []
  let params: any[] = []

  // Status filter
  if (opts.status === 'archived') {
    whereClauses.push("s.status = 'archived'")
  } else if (opts.status === 'active' || opts.status === 'inactive') {
    whereClauses.push(`s.status = '${opts.status}'`)
  } else if (opts.status !== 'all' && opts.status !== 'paid' && opts.status !== 'in_debt') {
    whereClauses.push("s.status != 'archived'")
  }

  // Hierarchy filters: courseId, teacherId, groupId
  if (opts.groupId) {
    whereClauses.push("s.id IN (SELECT student_id FROM enrollments WHERE group_id = ? AND status = 'active')")
    params.push(opts.groupId)
  } else if (opts.teacherId) {
    whereClauses.push("s.id IN (SELECT e.student_id FROM enrollments e JOIN groups g ON e.group_id = g.id WHERE g.teacher_id = ? AND e.status = 'active')")
    params.push(opts.teacherId)
  } else if (opts.courseId) {
    whereClauses.push("s.id IN (SELECT e.student_id FROM enrollments e JOIN groups g ON e.group_id = g.id WHERE g.course_id = ? AND e.status = 'active')")
    params.push(opts.courseId)
  }

  // Search query
  if (opts.search && opts.search.trim()) {
    const q = `%${opts.search.trim()}%`
    whereClauses.push("(s.first_name_ar LIKE ? OR s.last_name_ar LIKE ? OR s.first_name_fr LIKE ? OR s.last_name_fr LIKE ? OR s.student_number LIKE ? OR s.phone LIKE ? OR s.qr_token LIKE ?)")
    params.push(q, q, q, q, q, q, q)
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const query = `
    SELECT
      s.*,
      COALESCE((
        SELECT SUM(
          CASE
            WHEN payment_type IN ('credit', 'payment', 'top_up', 'transfer_in', 'credit_transfer_in', 'session_refund') THEN amount
            WHEN payment_type = 'refund' AND session_id IS NOT NULL THEN amount
            WHEN payment_type = 'refund' AND session_id IS NULL THEN -amount
            WHEN payment_type IN ('deduction', 'session_charge', 'transfer_out', 'credit_transfer_out', 'enrollment_refund') THEN -amount
            ELSE 0
          END
        )
        FROM payments p
        WHERE p.student_id = s.id AND p.status = 'paid'
      ), 0) as net_balance,
      (
        SELECT GROUP_CONCAT(g.name, ', ')
        FROM enrollments e
        JOIN groups g ON e.group_id = g.id
        WHERE e.student_id = s.id AND e.status = 'active'
      ) as group_names
    FROM students s
    ${whereSql}
    ORDER BY s.created_at DESC
  `

  let allMatchedRows = sqlite.prepare(query).all(...params) as any[]

  // Filter by paymentStatus if requested
  if (opts.status === 'paid') {
    allMatchedRows = allMatchedRows.filter(r => (r.net_balance ?? 0) >= 0 && r.status !== 'archived')
  } else if (opts.status === 'in_debt') {
    allMatchedRows = allMatchedRows.filter(r => (r.net_balance ?? 0) < 0 && r.status !== 'archived')
  }

  const total = allMatchedRows.length
  const pagedRows = allMatchedRows.slice(offset, offset + pageSize)

  const items = pagedRows.map(r => ({
    ...mapRow(r),
    netBalance: r.net_balance ?? 0,
    paymentStatus: (r.net_balance ?? 0) >= 0 ? 'paid' : 'in_debt',
    groupNames: r.group_names ?? '',
  }))

  return {
    items: items as any[],
    total,
    page,
    pageSize,
  }
}

// ─── Get by ID ────────────────────────────────────────────────────────────────

export async function getStudentById(id: number): Promise<Student> {
  const db = getDb()
  const row = await db.query.students.findFirst({
    where: eq(schema.students.id, id),
  })
  if (!row) throw new AppError(ErrorCode.STUDENT_NOT_FOUND, `Student ${id} not found`)
  return mapRow(row)
}

// ─── Create student ───────────────────────────────────────────────────────────

export async function createStudent(data: {
  firstNameAr: string
  lastNameAr: string
  firstNameFr: string
  lastNameFr: string
  dateOfBirth?: string | null
  gender: 'male' | 'female'
  phone?: string | null
  guardianName?: string | null
  guardianRelationship?: string | null
  guardianPhone?: string | null
  secondaryPhone?: string | null
  address?: string | null
  photoPath?: string | null
}): Promise<Student> {
  requireSession()
  const db = getDb()

  // Get prefix from settings
  const settings = await db.query.schoolSettings.findFirst()
  const prefix = settings?.studentNumberPrefix ?? DEFAULT_STUDENT_NUMBER_PREFIX
  const studentNumber = await generateStudentNumber(prefix)
  const qrToken = generateQRToken()

  const now = new Date().toISOString()
  const result = await db.insert(schema.students).values({
    studentNumber,
    firstNameAr: data.firstNameAr,
    lastNameAr: data.lastNameAr,
    firstNameFr: data.firstNameFr,
    lastNameFr: data.lastNameFr,
    dateOfBirth: data.dateOfBirth ?? null,
    gender: data.gender,
    phone: data.phone ?? null,
    guardianName: data.guardianName ?? null,
    guardianRelationship: data.guardianRelationship ?? null,
    guardianPhone: data.guardianPhone ?? null,
    secondaryPhone: data.secondaryPhone ?? null,
    address: data.address ?? null,
    photoPath: data.photoPath ?? null,
    registrationDate: new Date().toISOString().slice(0, 10),
    qrToken,
    updatedAt: now,
  }).returning()

  const row = result[0]
  if (!row) throw new AppError(ErrorCode.DB_ERROR, 'Failed to create student')
  log.info(`Student created: ${studentNumber}`)
  return mapRow(row)
}

// ─── Update student ───────────────────────────────────────────────────────────

export async function updateStudent(
  id: number,
  data: Partial<{
    firstNameAr: string
    lastNameAr: string
    firstNameFr: string
    lastNameFr: string
    dateOfBirth: string | null
    gender: 'male' | 'female'
    phone: string | null
    guardianName: string | null
    guardianRelationship: string | null
    guardianPhone: string | null
    secondaryPhone: string | null
    address: string | null
    photoPath: string | null
    status: 'active' | 'inactive' | 'archived'
  }>
): Promise<Student> {
  requireSession()
  const db = getDb()

  const existing = await db.query.students.findFirst({ where: eq(schema.students.id, id) })
  if (!existing) throw new AppError(ErrorCode.STUDENT_NOT_FOUND, `Student ${id} not found`)

  const result = await db
    .update(schema.students)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.students.id, id))
    .returning()

  return mapRow(result[0]!)
}

// ─── Archive student ──────────────────────────────────────────────────────────

export async function archiveStudent(id: number): Promise<void> {
  const session = requireSession()
  const db = getDb()

  const existing = await db.query.students.findFirst({ where: eq(schema.students.id, id) })
  if (!existing) throw new AppError(ErrorCode.STUDENT_NOT_FOUND, `Student ${id} not found`)

  const now = new Date().toISOString()
  await db.update(schema.students).set({
    status: 'archived',
    qrTokenActive: false,
    archivedAt: now,
    updatedAt: now,
  }).where(eq(schema.students.id, id))

  // Audit
  await db.insert(schema.auditLogs).values({
    administratorId: session.adminId,
    action: 'student.archive',
    entityType: 'student',
    entityId: id,
    sanitizedDetailsJson: JSON.stringify({ studentNumber: existing.studentNumber }),
  })
}

// ─── Regenerate QR token ──────────────────────────────────────────────────────

export async function regenerateQRToken(id: number): Promise<string> {
  const session = requireSession()
  const db = getDb()

  const existing = await db.query.students.findFirst({ where: eq(schema.students.id, id) })
  if (!existing) throw new AppError(ErrorCode.STUDENT_NOT_FOUND, `Student ${id} not found`)

  const newToken = generateQRToken()
  await db.update(schema.students).set({
    qrToken: newToken,
    qrTokenActive: true,
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.students.id, id))

  await db.insert(schema.auditLogs).values({
    administratorId: session.adminId,
    action: 'student.regenQR',
    entityType: 'student',
    entityId: id,
    sanitizedDetailsJson: JSON.stringify({ studentNumber: existing.studentNumber }),
  })

  log.info(`QR token regenerated for student ${id}`)
  return newToken
}
