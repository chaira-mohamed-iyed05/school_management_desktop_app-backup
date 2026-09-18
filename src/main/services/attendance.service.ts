import { eq, and, desc, ne } from 'drizzle-orm'
import { getDb, getSqlite, schema } from '../database/connection'
import { AppError, ErrorCode } from '../../shared/errors/index'
import { requireSession } from './auth.service'
import type { AttendanceSession, AttendanceRecord, QRScanResult, AttendanceStatusType } from '../../shared/types/index'
import log from 'electron-log'

/**
 * Resolves the deterministic session deduction price for an enrollment.
 * - If sessionPrice is 0 -> 0 DA (Free session)
 * - If sessionPrice > 0 -> sessionPrice DA (Custom session price)
 * - If sessionPrice is null/undefined -> regular group session price: (agreedPrice || monthlyPrice) / 4
 */
export function getSessionDeductionPrice(
  sessionPrice: number | null | undefined,
  agreedPrice: number | null | undefined,
  monthlyPrice: number | null | undefined
): number {
  if (sessionPrice !== null && sessionPrice !== undefined) {
    return Number(sessionPrice)
  }
  const base = agreedPrice || monthlyPrice || 0
  return Math.round((base / 4) * 100) / 100
}

// ─── Start session ────────────────────────────────────────────────────────────

export async function startAttendanceSession(data: {
  groupId: number
  sessionDate: string
  plannedStartTime?: string | null
  lateThresholdMinutes?: number
}): Promise<AttendanceSession> {
  const session = requireSession()
  const db = getDb()
  const sqlite = getSqlite()

  // Validate group exists
  const group = await db.query.groups.findFirst({
    where: eq(schema.groups.id, data.groupId),
  })
  if (!group) throw new AppError(ErrorCode.NOT_FOUND, 'Group not found')

  // Check if a session already exists for this group on this date
  const existingForDate = await db.query.attendanceSessions.findFirst({
    where: and(
      eq(schema.attendanceSessions.groupId, data.groupId),
      eq(schema.attendanceSessions.sessionDate, data.sessionDate)
    ),
    orderBy: desc(schema.attendanceSessions.createdAt),
  })

  const now = new Date().toISOString()

  let sessionRow: typeof existingForDate

  if (existingForDate) {
    if (existingForDate.status !== 'open') {
      await db.update(schema.attendanceSessions).set({
        status: 'open',
        sessionType: existingForDate.sessionType === 'cancelled' ? 'regular' : existingForDate.sessionType,
        actualStartTime: existingForDate.actualStartTime || now.slice(11, 16),
        updatedAt: now,
      }).where(eq(schema.attendanceSessions.id, existingForDate.id))
      existingForDate.status = 'open'
      existingForDate.actualStartTime = existingForDate.actualStartTime || now.slice(11, 16)
    }
    sessionRow = existingForDate
  } else {
    // Generate new regular session
    const [inserted] = await db.insert(schema.attendanceSessions).values({
      groupId: data.groupId,
      sessionDate: data.sessionDate,
      plannedStartTime: data.plannedStartTime ?? null,
      actualStartTime: now.slice(11, 16),
      lateThresholdMinutes: data.lateThresholdMinutes ?? 10,
      status: 'open',
      sessionType: 'regular',
      createdBy: session.adminId,
    }).returning()
    sessionRow = inserted
  }

  // Auto-seed absent attendance_records + deductions for all active enrollments
  // (idempotent: uses INSERT OR IGNORE / deductSession checks for existing)
  try {
    const { deductSession } = await import('./payment.service')
    const enrolled = sqlite.prepare(`
      SELECT e.id as enrollment_id, e.student_id, e.agreed_price, g.monthly_price
      FROM enrollments e
      JOIN groups g ON e.group_id = g.id
      JOIN students st ON e.student_id = st.id
      WHERE e.group_id = ? AND e.status = 'active' AND st.status = 'active'
    `).all(data.groupId) as any[]

    for (const en of enrolled) {
      // Insert absent record if not already existing
      sqlite.prepare(`
        INSERT OR IGNORE INTO attendance_records
          (session_id, student_id, attendance_status, is_inactive, source, was_enrolled, created_by, created_at, updated_at)
        VALUES (?, ?, 'absent', 0, 'manual', 1, ?, datetime('now'), datetime('now'))
      `).run(sessionRow!.id, en.student_id, session.adminId)

      // Deduct session fee (idempotent — deductSession skips if already deducted)
      const sessPrice = getSessionDeductionPrice(sessionRow?.price, en.agreed_price, en.monthly_price)
      if (sessPrice > 0) {
        try {
          await deductSession({
            studentId: en.student_id,
            enrollmentId: en.enrollment_id,
            sessionId: sessionRow!.id,
            sessionDate: data.sessionDate,
            sessionPrice: sessPrice,
          })
        } catch (err) {
          log.warn(`Auto-deduction failed for student ${en.student_id}:`, err)
        }
      }
    }
  } catch (err) {
    log.warn('Failed to auto-seed attendance records:', err)
  }

  return mapSessionRow(sessionRow!)
}

// ─── End session (غلق الحصة) ──────────────────────────────────────────────────
// Automatically mark all students enrolled in the group before session closing as absent ('غائب')
// New students enrolled after session closing remain unmarked ('غير مسجل')

export function parseUtcTimestamp(d: string | null | undefined): number {
  if (!d) return 0
  const s = String(d).trim().replace(' ', 'T')
  const withZ = s.endsWith('Z') ? s : (s.includes('T') ? s + 'Z' : s)
  const time = new Date(withZ).getTime()
  return isNaN(time) ? 0 : time
}

export function isEnrolledBeforeSessionClose(
  enrollmentDate: string,
  enrollmentCreatedAt: string | null | undefined,
  sessionDate: string,
  sessionStatus: string,
  sessionClosedAt?: string | null
): boolean {
  if (enrollmentDate > sessionDate) {
    return false
  }
  if (enrollmentDate < sessionDate) {
    return true
  }

  // Same day: if session is closed and we have timestamps, compare precisely
  if (sessionStatus === 'closed' && sessionClosedAt && enrollmentCreatedAt) {
    const enrTime = parseUtcTimestamp(enrollmentCreatedAt)
    const closeTime = parseUtcTimestamp(sessionClosedAt)
    if (enrTime > 0 && closeTime > 0) {
      return enrTime <= closeTime
    }
  }

  return true
}

export async function endAttendanceSession(sessionId: number): Promise<void> {
  const session = requireSession()
  const db = getDb()
  const sqlite = getSqlite()

  const existing = await db.query.attendanceSessions.findFirst({
    where: eq(schema.attendanceSessions.id, sessionId),
  })
  if (!existing) throw new AppError(ErrorCode.SESSION_NOT_FOUND, 'Session not found')

  const nowIso = new Date().toISOString()
  const endTimeStr = existing.endTime || nowIso.slice(11, 16)

  await db.update(schema.attendanceSessions).set({
    status: 'closed',
    endTime: endTimeStr,
    updatedAt: nowIso,
  }).where(eq(schema.attendanceSessions.id, sessionId))

  // Mark students enrolled before session closing as absent if not already marked
  try {
    const { deductSession } = await import('./payment.service')

    const enrolled = sqlite.prepare(`
      SELECT e.id as enrollment_id, e.student_id, e.agreed_price, e.enrollment_date, e.created_at as enrollment_created_at,
             g.monthly_price, st.status as student_status
      FROM enrollments e
      JOIN groups g ON e.group_id = g.id
      JOIN students st ON e.student_id = st.id
      WHERE e.group_id = ? AND e.status = 'active' AND st.status = 'active'
    `).all(existing.groupId) as any[]

    for (const en of enrolled) {
      const wasEnrolledBefore = isEnrolledBeforeSessionClose(
        en.enrollment_date,
        en.enrollment_created_at,
        existing.sessionDate,
        'closed',
        nowIso
      )

      if (!wasEnrolledBefore) {
        // Enrolled after session closing: keep unmarked ('غير مسجل')
        continue
      }

      const existingRecord = sqlite.prepare(`
        SELECT id, attendance_status, is_inactive FROM attendance_records
        WHERE session_id = ? AND student_id = ?
      `).get(sessionId, en.student_id) as any

      const sessPrice = getSessionDeductionPrice(existing.price, en.agreed_price, en.monthly_price)

      if (!existingRecord) {
        // Insert absent record
        sqlite.prepare(`
          INSERT INTO attendance_records
            (session_id, student_id, attendance_status, is_inactive, source, was_enrolled, created_by, created_at, updated_at)
          VALUES (?, ?, 'absent', 0, 'manual', 1, ?, datetime('now'), datetime('now'))
        `).run(sessionId, en.student_id, session.adminId)

        if (sessPrice > 0) {
          try {
            await deductSession({
              studentId: en.student_id,
              enrollmentId: en.enrollment_id,
              sessionId,
              sessionDate: existing.sessionDate,
              sessionPrice: sessPrice,
            })
          } catch (err) {
            log.warn(`Session close deduction failed for student ${en.student_id}:`, err)
          }
        }
      } else if (existingRecord.is_inactive === 0 && existingRecord.attendance_status === 'absent') {
        if (sessPrice > 0) {
          try {
            await deductSession({
              studentId: en.student_id,
              enrollmentId: en.enrollment_id,
              sessionId,
              sessionDate: existing.sessionDate,
              sessionPrice: sessPrice,
            })
          } catch (err) {
            log.warn(`Session close deduction verification failed for student ${en.student_id}:`, err)
          }
        }
      }
    }
  } catch (err) {
    log.error('Failed to auto-mark absent students on session close:', err)
  }
}

// ─── Mark session attended (Shared pipeline for QR scan & manual search) ──────
// Requirements 14-25, 41-43: Unified pipeline, deterministic financial effect

export async function markSessionAttended(
  sessionId: number,
  studentId: number,
  source: 'qr' | 'manual' = 'manual'
): Promise<QRScanResult> {
  const authSession = requireSession()
  const db = getDb()
  const sqlite = getSqlite()

  // 1. Verify session exists and is open
  const attendanceSession = await db.query.attendanceSessions.findFirst({
    where: eq(schema.attendanceSessions.id, sessionId),
  })
  if (!attendanceSession) return { code: 'session_closed' }
  if (attendanceSession.status !== 'open') return { code: 'session_closed' }

  // 2. Verify student exists and is active
  const matchedStudent = await db.query.students.findFirst({
    where: eq(schema.students.id, studentId),
  })
  if (!matchedStudent) return { code: 'unknown_card' }
  if (matchedStudent.status !== 'active') {
    const studentName = `${matchedStudent.lastNameAr ?? ''} ${matchedStudent.firstNameAr ?? ''}`.trim() || matchedStudent.studentNumber
    return { code: 'student_inactive', studentId: matchedStudent.id, studentName }
  }

  // 3. Confirm enrollment in the session's group
  const enrollment = sqlite.prepare(`
    SELECT e.id, e.enrollment_date, e.agreed_price, e.status as enrollment_status, g.monthly_price
    FROM enrollments e
    JOIN groups g ON e.group_id = g.id
    WHERE e.student_id = ? AND e.group_id = ? AND e.status = 'active'
    LIMIT 1
  `).get(studentId, attendanceSession.groupId) as any

  const studentNameAr = `${matchedStudent.lastNameAr ?? ''} ${matchedStudent.firstNameAr ?? ''}`.trim()
  const studentNameFr = `${matchedStudent.lastNameFr ?? ''} ${matchedStudent.firstNameFr ?? ''}`.trim()
  const studentName = studentNameAr || studentNameFr || matchedStudent.studentNumber

  if (!enrollment) {
    return {
      code: 'not_enrolled',
      studentId: matchedStudent.id,
      studentName,
    }
  }

  // Calculate session price
  const sessionPrice = getSessionDeductionPrice(
    attendanceSession.price,
    enrollment.agreed_price,
    enrollment.monthly_price
  )
  const baseMonthly = enrollment.agreed_price || enrollment.monthly_price || 0
  const regularSessPrice = Math.round((baseMonthly / 4) * 100) / 100

  const { getEnrollmentBalance, deductSession, rechargeSessionCharge } = await import('./payment.service')
  const now = new Date().toISOString()

  // 4. Check existing record
  const existingRecord = sqlite.prepare(`
    SELECT id, attendance_status, is_inactive, scanned_at FROM attendance_records
    WHERE session_id = ? AND student_id = ?
  `).get(sessionId, studentId) as any

  let recordScannedAt = now

  if (existingRecord) {
    if (existingRecord.attendance_status === 'present' && existingRecord.is_inactive === 0) {
      // Already marked present
      const curBal = await getEnrollmentBalance(enrollment.id)
      return {
        code: 'already_scanned',
        studentId: matchedStudent.id,
        studentName,
        studentNumber: matchedStudent.studentNumber,
        phone: matchedStudent.phone,
        scannedAt: existingRecord.scanned_at ?? undefined,
        attendanceStatus: 'present',
        creditBalance: curBal.balance,
        sessionPrice,
        remainingSessions: regularSessPrice > 0 ? Math.floor(curBal.balance / regularSessPrice) : 0,
        wasInDebt: curBal.balance < 0,
      }
    }

    if (existingRecord.is_inactive === 1) {
      // Was inactive: recharge 1 session fee and reactivate
      if (sessionPrice > 0) {
        await rechargeSessionCharge(
          enrollment.id,
          sessionId,
          studentId,
          attendanceSession.sessionDate,
          sessionPrice,
          authSession.adminId
        )
      }
    } else {
      // Was absent: fee was already charged (or ensure charged)
      if (sessionPrice > 0) {
        await deductSession({
          studentId,
          enrollmentId: enrollment.id,
          sessionId,
          sessionDate: attendanceSession.sessionDate,
          sessionPrice,
        })
      }
    }

    sqlite.prepare(`
      UPDATE attendance_records
      SET attendance_status = 'present', is_inactive = 0, source = ?, scanned_at = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(source, now, existingRecord.id)
    recordScannedAt = now
  } else {
    // Brand new attendance record
    sqlite.prepare(`
      INSERT INTO attendance_records
        (session_id, student_id, attendance_status, is_inactive, source, scanned_at, was_enrolled, created_by, created_at, updated_at)
      VALUES (?, ?, 'present', 0, ?, ?, 1, ?, datetime('now'), datetime('now'))
    `).run(sessionId, studentId, source, now, authSession.adminId)

    if (sessionPrice > 0) {
      await deductSession({
        studentId,
        enrollmentId: enrollment.id,
        sessionId,
        sessionDate: attendanceSession.sessionDate,
        sessionPrice,
      })
    }
  }

  // Audit
  await db.insert(schema.auditLogs).values({
    administratorId: authSession.adminId,
    action: `attendance.${source}Mark`,
    entityType: 'attendance_record',
    entityId: existingRecord?.id || sessionId,
    sanitizedDetailsJson: JSON.stringify({ sessionId, studentId, status: 'present', source }),
  })

  // Get fresh balance
  const updatedBal = await getEnrollmentBalance(enrollment.id)
  return {
    code: 'recorded',
    studentId: matchedStudent.id,
    studentName,
    studentNumber: matchedStudent.studentNumber,
    phone: matchedStudent.phone,
    scannedAt: recordScannedAt,
    attendanceStatus: 'present',
    creditBalance: updatedBal.balance,
    sessionPrice,
    remainingSessions: regularSessPrice > 0 ? Math.floor(updatedBal.balance / regularSessPrice) : 0,
    wasInDebt: updatedBal.balance < 0,
  }
}

// ─── QR scan pipeline (resolves card token and marks attended) ───────────────

export async function scanQRToken(sessionId: number, rawToken: string): Promise<QRScanResult> {
  requireSession()
  const db = getDb()

  let token = rawToken.trim()
  // 1. If QR code is a JSON payload
  if (token.startsWith('{') && token.endsWith('}')) {
    try {
      const parsed = JSON.parse(token)
      if (parsed.token) token = String(parsed.token).trim()
      else if (parsed.id || parsed.matricule) {
        const studentNum = String(parsed.id || parsed.matricule).trim()
        const found = await db.query.students.findFirst({
          where: eq(schema.students.studentNumber, studentNum),
        })
        if (found) token = found.qrToken
      }
    } catch {}
  }

  // 2. If multiline plain text (contains STD-... or ETU-...)
  const stdMatch = token.match(/STD-[a-f0-9A-F]+/i)
  if (stdMatch) {
    token = stdMatch[0]
  } else {
    const etuMatch = token.match(/ETU-\d+/i)
    if (etuMatch) {
      const found = await db.query.students.findFirst({
        where: eq(schema.students.studentNumber, etuMatch[0].toUpperCase()),
      })
      if (found) token = found.qrToken
    }
  }

  const upperToken = token.toUpperCase()

  // 3. Validate token format
  if (!token || token.length < 5) {
    return { code: 'unknown_card' }
  }

  // 4. Find the active student
  const student = await db.query.students.findFirst({
    where: eq(schema.students.qrToken, token),
  })

  const students_found = await db.query.students.findMany()
  const matchedStudent = student ?? students_found.find(
    (s: typeof schema.students.$inferSelect) => s.qrToken.toUpperCase() === upperToken
  )

  if (!matchedStudent) {
    return { code: 'unknown_card' }
  }

  // 5. Check token is active
  if (!matchedStudent.qrTokenActive) {
    return { code: 'disabled_card', studentId: matchedStudent.id }
  }

  // 6. Delegate to shared markSessionAttended pipeline
  return markSessionAttended(sessionId, matchedStudent.id, 'qr')
}

// ─── Manual attendance ────────────────────────────────────────────────────────

export async function markManually(data: {
  sessionId: number
  studentId: number
  attendanceStatus: 'present' | 'absent' | 'inactive' | 'not_active'
  notes?: string | null
}): Promise<AttendanceRecord> {
  const session = requireSession()
  const db = getDb()

  const attendanceSession = await db.query.attendanceSessions.findFirst({
    where: eq(schema.attendanceSessions.id, data.sessionId),
  })
  if (!attendanceSession || attendanceSession.status !== 'open') {
    throw new AppError(ErrorCode.SESSION_CLOSED, 'Attendance session is closed')
  }

  // Upsert: if record exists update it, otherwise insert
  const existing = await db.query.attendanceRecords.findFirst({
    where: and(
      eq(schema.attendanceRecords.sessionId, data.sessionId),
      eq(schema.attendanceRecords.studentId, data.studentId)
    ),
  })

  const now = new Date().toISOString()

  if (existing) {
    const updated = await db
      .update(schema.attendanceRecords)
      .set({
        attendanceStatus: data.attendanceStatus,
        source: 'manual',
        notes: data.notes ?? null,
        createdBy: session.adminId,
        updatedAt: now,
      })
      .where(eq(schema.attendanceRecords.id, existing.id))
      .returning()
    return mapRecordRow(updated[0]!)
  }

  const result = await db.insert(schema.attendanceRecords).values({
    sessionId: data.sessionId,
    studentId: data.studentId,
    scannedAt: now,
    attendanceStatus: data.attendanceStatus,
    source: 'manual',
    notes: data.notes ?? null,
    createdBy: session.adminId,
    updatedAt: now,
  }).returning()

  // Audit manual entry
  await db.insert(schema.auditLogs).values({
    administratorId: session.adminId,
    action: 'attendance.manualMark',
    entityType: 'attendance_record',
    entityId: result[0]!.id,
    sanitizedDetailsJson: JSON.stringify({ sessionId: data.sessionId, studentId: data.studentId, status: data.attendanceStatus }),
  })

  return mapRecordRow(result[0]!)
}

// ─── Get session with records ─────────────────────────────────────────────────

export async function getSession(sessionId: number): Promise<AttendanceSession & { records: AttendanceRecord[] }> {
  const db = getDb()
  const session = await db.query.attendanceSessions.findFirst({
    where: eq(schema.attendanceSessions.id, sessionId),
  })
  if (!session) throw new AppError(ErrorCode.SESSION_NOT_FOUND, 'Session not found')

  const records = await db.query.attendanceRecords.findMany({
    where: eq(schema.attendanceRecords.sessionId, sessionId),
  })

  return {
    ...mapSessionRow(session),
    records: records.map(mapRecordRow),
  }
}

// ─── List sessions ────────────────────────────────────────────────────────────

export async function listSessions(opts: { groupId?: number; status?: 'open' | 'closed'; limit?: number }): Promise<AttendanceSession[]> {
  const db = getDb()
  const conditions = []
  if (opts.groupId) conditions.push(eq(schema.attendanceSessions.groupId, opts.groupId))
  if (opts.status) conditions.push(eq(schema.attendanceSessions.status, opts.status))

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined
  const rows = await db.select().from(schema.attendanceSessions)
    .where(whereClause)
    .orderBy(desc(schema.attendanceSessions.createdAt))
    .limit(opts.limit ?? 50)
  return rows.map(mapSessionRow)
}

// ─── Student Lookup (for QR scanning without attendance) ──────────────────────

export async function lookupStudentByToken(rawToken: string): Promise<{
  student: any
  enrollments: any[]
  nextSession?: any
  attendanceSummary?: any
  paymentsSummary?: any
  error?: string
} | null> {
  const db = getDb()

  let token = rawToken.trim()
  if (token.startsWith('{') && token.endsWith('}')) {
    try {
      const parsed = JSON.parse(token)
      if (parsed.token) token = String(parsed.token).trim()
      else if (parsed.id || parsed.matricule) {
        const found = await db.query.students.findFirst({
          where: eq(schema.students.studentNumber, String(parsed.id || parsed.matricule).trim()),
        })
        if (found) token = found.qrToken
      }
    } catch {}
  }

  // Remove spaces or linebreaks in token
  const compactToken = token.replace(/\s+/g, '')

  let cleanToken = token
  const stdMatch = compactToken.match(/STD-[a-f0-9A-F]+/i) || token.match(/STD-[a-f0-9A-F]+/i)
  if (stdMatch) {
    cleanToken = stdMatch[0]
  } else {
    const etuMatch = compactToken.match(/ETU-\d+/i) || token.match(/ETU-\d+/i)
    if (etuMatch) {
      const found = await db.query.students.findFirst({
        where: eq(schema.students.studentNumber, etuMatch[0].toUpperCase()),
      })
      if (found) cleanToken = found.qrToken
    }
  }

  // Find student by token or studentNumber
  let student = await db.query.students.findFirst({
    where: eq(schema.students.qrToken, cleanToken),
  })

  if (!student) {
    student = await db.query.students.findFirst({
      where: eq(schema.students.studentNumber, cleanToken.toUpperCase()),
    })
  }

  if (!student) {
    return null
  }

  // Get enrollments
  const enrollments = await db.query.enrollments.findMany({
    where: eq(schema.enrollments.studentId, student.id),
  })

  // Get attendance stats
  const records = await db.query.attendanceRecords.findMany({
    where: eq(schema.attendanceRecords.studentId, student.id),
  })
  const present = records.filter((r) => r.attendanceStatus === 'present').length
  const absent = records.filter((r) => r.attendanceStatus === 'absent').length
  const late = 0
  const totalSessions = records.length
  const attendanceRate = totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 100

  // Get payment summary
  const payments = await db.query.payments.findMany({
    where: eq(schema.payments.studentId, student.id),
    orderBy: desc(schema.payments.paymentDate),
  })
  const totalPaid = payments.filter((p) => p.status === 'paid').reduce((acc, p) => acc + p.amount, 0)
  const lastPayment = payments[0]

  return {
    student: {
      id: student.id,
      studentNumber: student.studentNumber,
      firstNameAr: student.firstNameAr,
      lastNameAr: student.lastNameAr,
      firstNameFr: student.firstNameFr,
      lastNameFr: student.lastNameFr,
      fullNameAr: `${student.lastNameAr} ${student.firstNameAr}`,
      fullNameFr: `${student.lastNameFr} ${student.firstNameFr}`,
      phone: student.phone,
      photoPath: student.photoPath,
      status: student.status,
      gender: student.gender,
    },
    enrollments: enrollments.map((e) => ({
      id: e.id,
      groupId: e.groupId,
      status: e.status,
      enrollmentDate: e.enrollmentDate,
      agreedPrice: e.agreedPrice,
    })),
    attendanceSummary: {
      totalSessions,
      present,
      absent,
      late,
      attendanceRate,
    },
    paymentsSummary: {
      totalPaid,
      lastPaymentDate: lastPayment?.paymentDate,
      status: payments.some((p) => p.status === 'paid') ? 'paid' : 'pending',
    },
  }
}

// ─── Get comprehensive student summary ──────────────────────────────────────

export async function getStudentSummary(studentId: number, sessionId?: number): Promise<{
  student: any
  enrollments: any[]
  upcomingSessions: any[]
  attendanceStats: {
    totalSessions: number
    presentCount: number
    absentCount: number
    lateCount: number
    attendanceRate: number
  }
} | null> {
  const db = getDb()

  // Get student
  const student = await db.query.students.findFirst({
    where: eq(schema.students.id, studentId),
  })

  if (!student) return null

  // Get enrollments
  const enrollments = await db.query.enrollments.findMany({
    where: eq(schema.enrollments.studentId, studentId),
  })

  // Get upcoming sessions
  const upcomingSessions = await db.select().from(schema.attendanceSessions)
    .where(eq(schema.attendanceSessions.status, 'open'))
    .orderBy(desc(schema.attendanceSessions.sessionDate))
    .limit(5)

  // Get attendance statistics
  const records = await db.query.attendanceRecords.findMany({
    where: eq(schema.attendanceRecords.studentId, studentId),
  })

  const presentCount = records.filter((r) => r.attendanceStatus === 'present').length
  const absentCount = records.filter((r) => r.attendanceStatus === 'absent').length
  const lateCount = 0
  const totalSessions = records.length
  const attendanceRate = totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0

  return {
    student: {
      id: student.id,
      firstNameAr: student.firstNameAr,
      lastNameAr: student.lastNameAr,
      firstNameFr: student.firstNameFr,
      lastNameFr: student.lastNameFr,
      studentNumber: student.studentNumber,
      photoPath: student.photoPath,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth,
    },
    enrollments: enrollments.map((e) => ({
      id: e.id,
      groupId: e.groupId,
      status: e.status,
      enrollmentDate: e.enrollmentDate,
      agreedPrice: e.agreedPrice,
    })),
    upcomingSessions: upcomingSessions.map(mapSessionRow),
    attendanceStats: {
      totalSessions,
      presentCount,
      absentCount,
      lateCount,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
    },
  }
}

// ─── Get remaining sessions count ──────────────────────────────────────────

export async function getRemainingSessionsCount(enrollmentId: number): Promise<number> {
  const db = getDb()

  // Get enrollment
  const enrollment = await db.query.enrollments.findFirst({
    where: eq(schema.enrollments.id, enrollmentId),
  })

  if (!enrollment) return 0

  // Count total non-cancelled sessions for the group
  const totalSessions = await db.query.attendanceSessions.findMany({
    where: and(
      eq(schema.attendanceSessions.groupId, enrollment.groupId),
      ne(schema.attendanceSessions.sessionType, 'cancelled')
    ),
  })

  // Count attended sessions
  const attendedRecords = await db.query.attendanceRecords.findMany({
    where: and(
      eq(schema.attendanceRecords.studentId, enrollment.studentId),
      eq(schema.attendanceRecords.attendanceStatus, 'present'),
    ),
  })

  const remaining = Math.max(0, totalSessions.length - attendedRecords.length)
  return remaining
}

// ─── Resolve student + their sessions for a given date ─────────────────────

export async function resolveStudentSessions(rawToken: string, date: string): Promise<{
  student: any
  enrollmentsWithBalance?: any[]
  todaySessions: any[]
  paymentsSummary: any
  recentAttendance: any[]
} | null> {
  const db = getDb()
  const sqlite = getSqlite()

  // Parse token / name
  let token = rawToken.trim()
  if (token.startsWith('{') && token.endsWith('}')) {
    try { const p = JSON.parse(token); if (p.token) token = p.token } catch {}
  }
  const stdMatch = token.match(/STD-[a-f0-9A-F]+/i)
  if (stdMatch) token = stdMatch[0]

  // Find student by QR token, student number, numeric ID, or combined name
  let student = await db.query.students.findFirst({ where: eq(schema.students.qrToken, token) })
  if (!student) {
    student = await db.query.students.findFirst({ where: eq(schema.students.studentNumber, token.toUpperCase()) })
  }
  if (!student) {
    const num = Number(token)
    if (!isNaN(num) && num > 0) {
      student = await db.query.students.findFirst({ where: eq(schema.students.id, num) })
    }
  }
  if (!student) {
    // Name search — raw SQL for partial & combined name match
    const rows = sqlite.prepare(`
      SELECT id FROM students
      WHERE status = 'active'
        AND (
          first_name_ar LIKE ? OR last_name_ar LIKE ? OR first_name_fr LIKE ? OR last_name_fr LIKE ?
          OR (last_name_ar || ' ' || first_name_ar) LIKE ? OR (first_name_ar || ' ' || last_name_ar) LIKE ?
          OR (last_name_fr || ' ' || first_name_fr) LIKE ? OR (first_name_fr || ' ' || last_name_fr) LIKE ?
        )
      LIMIT 1
    `).get(`%${token}%`, `%${token}%`, `%${token}%`, `%${token}%`, `%${token}%`, `%${token}%`, `%${token}%`, `%${token}%`) as any
    if (rows) student = await db.query.students.findFirst({ where: eq(schema.students.id, rows.id) })
  }
  if (!student) return null

  // Get active enrollments
  const enrollments = await db.query.enrollments.findMany({
    where: and(eq(schema.enrollments.studentId, student.id), eq(schema.enrollments.status, 'active')),
  })
  const groupIds = enrollments.map(e => e.groupId)

  // Find sessions on this date for enrolled groups
  const todaySessions: any[] = []
  for (const groupId of groupIds) {
    // Check for existing session instances
    const allExisting = sqlite.prepare(`
      SELECT s.*, g.name as group_name, g.monthly_price, c.name_ar as course_name_ar, c.name_fr as course_name_fr
      FROM attendance_sessions s
      JOIN groups g ON s.group_id = g.id
      JOIN courses c ON g.course_id = c.id
      WHERE s.group_id = ? AND s.session_date = ?
    `).all(groupId, date) as any[]

    const activeExisting = allExisting.filter(r => r.session_type !== 'cancelled')
    const hasCancelled = allExisting.some(r => r.session_type === 'cancelled')

    if (activeExisting.length > 0) {
      todaySessions.push(...activeExisting.map(r => ({
        id: r.id,
        groupId: r.group_id,
        groupName: r.group_name,
        courseNameAr: r.course_name_ar,
        courseNameFr: r.course_name_fr,
        sessionDate: r.session_date,
        plannedStartTime: r.planned_start_time,
        endTime: r.end_time,
        room: r.room,
        status: r.status,
        sessionType: r.session_type,
        price: r.price !== undefined ? r.price : null,
        monthlyPrice: r.monthly_price ?? null,
      })))
    } else if (!hasCancelled) {
      // Auto-create from schedule slots if today matches weekday and not cancelled
      const jsDay = new Date(date + 'T00:00:00Z').getUTCDay()
      const weekday = jsDay === 0 ? 6 : jsDay - 1
      const slots = sqlite.prepare(`
        SELECT * FROM group_schedule_slots WHERE group_id = ? AND weekday = ? AND is_active = 1
      `).all(groupId, weekday) as any[]

      for (const slot of slots) {
        sqlite.prepare(`
          INSERT OR IGNORE INTO attendance_sessions (group_id, session_date, planned_start_time, end_time, room, status, session_type, schedule_slot_id, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'open', 'regular', ?, 1, datetime('now'), datetime('now'))
        `).run(groupId, date, slot.start_time, slot.end_time, slot.room, slot.id)

        const sessRow = sqlite.prepare(`
          SELECT s.*, g.name as group_name, g.monthly_price, c.name_ar as course_name_ar, c.name_fr as course_name_fr
          FROM attendance_sessions s
          JOIN groups g ON s.group_id = g.id
          JOIN courses c ON g.course_id = c.id
          WHERE s.group_id = ? AND s.session_date = ? AND s.session_type != 'cancelled' AND (s.schedule_slot_id = ? OR (s.planned_start_time = ? AND s.end_time = ?))
          LIMIT 1
        `).get(groupId, date, slot.id, slot.start_time, slot.end_time) as any

        if (sessRow) {
          todaySessions.push({
            id: sessRow.id,
            groupId,
            groupName: sessRow.group_name,
            courseNameAr: sessRow.course_name_ar,
            courseNameFr: sessRow.course_name_fr,
            sessionDate: date,
            plannedStartTime: sessRow.planned_start_time,
            endTime: sessRow.end_time,
            room: sessRow.room,
            status: sessRow.status || 'open',
            sessionType: sessRow.session_type,
            price: sessRow.price !== undefined ? sessRow.price : null,
            monthlyPrice: sessRow.monthly_price ?? null,
          })
        }
      }
    }
  }

  // Calculate balance & remaining sessions for each active enrollment
  const { getEnrollmentBalance } = await import('./payment.service')
  const enrollmentsWithBalance: any[] = []
  for (const en of enrollments) {
    const bal = await getEnrollmentBalance(en.id)
    const grp = sqlite.prepare(`
      SELECT g.name as group_name, g.monthly_price, c.name_ar as course_name_ar, c.name_fr as course_name_fr
      FROM groups g JOIN courses c ON g.course_id = c.id WHERE g.id = ?
    `).get(en.groupId) as any
    const price = en.agreedPrice || grp?.monthly_price || 0
    const sessPrice = Math.round((price / 4) * 100) / 100
    const remSessions = sessPrice > 0 ? Math.floor(bal.balance / sessPrice) : 0
    enrollmentsWithBalance.push({
      enrollmentId: en.id,
      groupId: en.groupId,
      groupName: grp?.group_name,
      courseNameAr: grp?.course_name_ar,
      courseNameFr: grp?.course_name_fr,
      agreedPrice: price,
      sessionPrice: sessPrice,
      balance: bal.balance,
      remainingSessions: remSessions,
      wasInDebt: bal.balance < 0,
    })
  }

  // Payment summary
  const payments = await db.query.payments.findMany({
    where: eq(schema.payments.studentId, student.id),
    orderBy: desc(schema.payments.paymentDate),
  })
  const totalPaid = payments.filter(p => p.status === 'paid').reduce((a, p) => a + p.amount, 0)

  // Recent attendance (last 5 records)
  const recentRecords = sqlite.prepare(`
    SELECT ar.*, s.session_date, g.name as group_name, c.name_ar as course_name_ar, c.name_fr as course_name_fr
    FROM attendance_records ar
    JOIN attendance_sessions s ON ar.session_id = s.id
    JOIN groups g ON s.group_id = g.id
    JOIN courses c ON g.course_id = c.id
    WHERE ar.student_id = ?
    ORDER BY s.session_date DESC, ar.created_at DESC
    LIMIT 5
  `).all(student.id) as any[]

  return {
    student: {
      id: student.id,
      studentNumber: student.studentNumber,
      firstNameAr: student.firstNameAr,
      lastNameAr: student.lastNameAr,
      firstNameFr: student.firstNameFr,
      lastNameFr: student.lastNameFr,
      status: student.status,
      phone: student.phone,
    },
    enrollmentsWithBalance,
    todaySessions,
    paymentsSummary: {
      totalPaid,
      lastPaymentDate: payments[0]?.paymentDate,
      status: payments.some(p => p.status === 'paid') ? 'paid' : 'pending',
    },
    recentAttendance: recentRecords.map(r => ({
      date: r.session_date,
      status: r.attendance_status,
      groupName: r.group_name,
      courseNameAr: r.course_name_ar,
      courseNameFr: r.course_name_fr,
    })),
  }
}

// ─── Mark student in session (deterministic transition matrix) ───────────────
// Requirements 14-25: ABSENT = 1 fee, ATTENDED = 1 fee, INACTIVE = 0 fee

export async function markStudentInSession(
  sessionId: number,
  studentId: number,
  status: 'present' | 'absent' | 'late' | 'not_active' | 'inactive',
): Promise<{ success: boolean; studentName: string; status: string; wasEnrolled: boolean; creditBalance: number | null; wasInDebt: boolean }> {
  const authSession = requireSession()
  const db = getDb()
  const sqlite = getSqlite()
  const now = new Date().toISOString()

  const session = await db.query.attendanceSessions.findFirst({
    where: eq(schema.attendanceSessions.id, sessionId),
  })
  if (!session) throw new AppError(ErrorCode.SESSION_NOT_FOUND, 'Session not found')
  if (session.sessionType === 'cancelled') throw new AppError(ErrorCode.SESSION_CLOSED, 'Session is cancelled')

  const student = await db.query.students.findFirst({ where: eq(schema.students.id, studentId) })
  if (!student) throw new AppError(ErrorCode.NOT_FOUND, 'Student not found')

  // Normalize status: late -> present, not_active -> inactive
  let targetStatus: 'present' | 'absent' | 'inactive' = 'present'
  if (status === 'absent') targetStatus = 'absent'
  else if (status === 'inactive' || status === 'not_active') targetStatus = 'inactive'
  else targetStatus = 'present'

  // Check enrollment
  const enrollment = sqlite.prepare(`
    SELECT e.id, e.enrollment_date, e.agreed_price, e.status as enrollment_status, g.monthly_price
    FROM enrollments e
    JOIN groups g ON e.group_id = g.id
    WHERE e.student_id = ? AND e.group_id = ?
    LIMIT 1
  `).get(studentId, session.groupId) as any

  const wasEnrolled = enrollment ? (session.sessionDate >= enrollment.enrollment_date) : false
  const sessionPrice = getSessionDeductionPrice(
    session.price,
    enrollment?.agreed_price,
    enrollment?.monthly_price
  )

  const { getEnrollmentBalance, deductSession, refundSessionCharge, rechargeSessionCharge } = await import('./payment.service')

  const existingRecord = sqlite.prepare(`
    SELECT id, attendance_status, is_inactive, scanned_at FROM attendance_records
    WHERE session_id = ? AND student_id = ?
  `).get(sessionId, studentId) as any

  if (targetStatus === 'inactive') {
    // Transition to INACTIVE: 0 fee. Refund if paid deduction exists.
    sqlite.prepare(`
      INSERT INTO attendance_records (session_id, student_id, attendance_status, is_inactive, source, scanned_at, was_enrolled, created_by, created_at, updated_at)
      VALUES (?, ?, 'absent', 1, 'manual', ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(session_id, student_id) DO UPDATE SET
        is_inactive = 1,
        source = 'manual',
        was_enrolled = excluded.was_enrolled,
        updated_at = datetime('now')
    `).run(sessionId, studentId, now, wasEnrolled ? 1 : 0, authSession.adminId)

    if (enrollment) {
      await refundSessionCharge(enrollment.id, sessionId, studentId, authSession.adminId)
    }
  } else {
    // Target is 'present' or 'absent'
    const wasInactive = existingRecord && existingRecord.is_inactive === 1

    sqlite.prepare(`
      INSERT INTO attendance_records (session_id, student_id, attendance_status, is_inactive, source, scanned_at, was_enrolled, created_by, created_at, updated_at)
      VALUES (?, ?, ?, 0, 'manual', ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(session_id, student_id) DO UPDATE SET
        attendance_status = excluded.attendance_status,
        is_inactive = 0,
        source = 'manual',
        was_enrolled = excluded.was_enrolled,
        updated_at = datetime('now')
    `).run(sessionId, studentId, targetStatus, now, wasEnrolled ? 1 : 0, authSession.adminId)

    if (enrollment && wasEnrolled && sessionPrice > 0) {
      if (wasInactive) {
        // Restoring from inactive to active (present/absent) re-charges session fee
        await rechargeSessionCharge(enrollment.id, sessionId, studentId, session.sessionDate, sessionPrice, authSession.adminId)
      } else {
        // Ensure deduction exists
        await deductSession({
          studentId,
          enrollmentId: enrollment.id,
          sessionId,
          sessionDate: session.sessionDate,
          sessionPrice,
        })
      }
    }
  }

  let creditBalance: number | null = null
  let wasInDebt = false
  if (enrollment) {
    const bal = await getEnrollmentBalance(enrollment.id)
    creditBalance = bal.balance
    wasInDebt = bal.balance < 0
  }

  return {
    success: true,
    studentName: `${student.lastNameAr ?? ''} ${student.firstNameAr ?? ''}`.trim(),
    status: targetStatus,
    wasEnrolled,
    creditBalance,
    wasInDebt,
  }
}


// ─── Get full attendance history for a student ───────────────────────────────

export async function getStudentAttendanceHistory(studentId: number): Promise<any[]> {
  const sqlite = getSqlite()
  const rows = sqlite.prepare(`
    SELECT
      ar.id as record_id,
      ar.attendance_status,
      ar.is_inactive,
      ar.scanned_at,
      ar.source,
      s.id as session_id,
      s.session_date,
      s.planned_start_time,
      s.status as session_status,
      g.id as group_id,
      g.name as group_name,
      c.name_ar as course_name_ar,
      c.name_fr as course_name_fr
    FROM attendance_records ar
    JOIN attendance_sessions s ON ar.session_id = s.id
    JOIN groups g ON s.group_id = g.id
    JOIN courses c ON g.course_id = c.id
    WHERE ar.student_id = ?
    ORDER BY s.session_date DESC, s.planned_start_time DESC
  `).all(studentId) as any[]

  return rows.map(r => ({
    recordId: r.record_id,
    sessionId: r.session_id,
    sessionDate: r.session_date,
    plannedStartTime: r.planned_start_time,
    sessionStatus: r.session_status,
    groupId: r.group_id,
    groupName: r.group_name,
    courseNameAr: r.course_name_ar,
    courseNameFr: r.course_name_fr,
    // isInactive=1 → display as 'inactive', otherwise use attendance_status
    attendanceStatus: r.is_inactive === 1 ? 'inactive' : (r.attendance_status ?? 'absent'),
    scannedAt: r.scanned_at,
    source: r.source,
  }))
}

// ─── Get complete session history for a student across enrolled groups ──────

export async function getStudentSessionHistory(studentId: number): Promise<any[]> {
  const sqlite = getSqlite()
  const rows = sqlite.prepare(`
    SELECT
      s.id as session_id,
      s.session_date,
      s.planned_start_time,
      s.end_time,
      s.status as session_status,
      s.session_type,
      g.id as group_id,
      g.name as group_name,
      c.name_ar as course_name_ar,
      c.name_fr as course_name_fr,
      t.first_name as teacher_first_name,
      t.last_name as teacher_last_name,
      ar.attendance_status,
      ar.is_inactive,
      ar.scanned_at,
      ar.source
    FROM enrollments e
    JOIN groups g ON e.group_id = g.id
    JOIN courses c ON g.course_id = c.id
    LEFT JOIN teachers t ON g.teacher_id = t.id
    JOIN attendance_sessions s ON s.group_id = g.id
    LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.student_id = ?
    WHERE e.student_id = ?
      AND (ar.id IS NOT NULL OR s.status = 'closed' OR (s.session_date <= date('now') AND s.actual_start_time IS NOT NULL))
    ORDER BY s.session_date DESC, s.planned_start_time DESC
  `).all(studentId, studentId) as any[]

  return rows.map(r => ({
    sessionId: r.session_id,
    sessionDate: r.session_date,
    plannedStartTime: r.planned_start_time,
    endTime: r.end_time,
    sessionStatus: r.session_status,
    sessionType: r.session_type,
    groupId: r.group_id,
    groupName: r.group_name,
    courseNameAr: r.course_name_ar,
    courseNameFr: r.course_name_fr,
    teacherName: r.teacher_first_name ? `${r.teacher_last_name ?? ''} ${r.teacher_first_name}`.trim() : null,
    attendanceStatus: r.is_inactive === 1 ? 'inactive' : (r.attendance_status ?? 'unmarked'),
    scannedAt: r.scanned_at,
    source: r.source,
  }))
}

// ─── Get session with full roster (enrolled students + their attendance) ────

export async function getSessionWithRoster(sessionId: number): Promise<{
  session: any
  students: any[]
}> {
  const sqlite = getSqlite()

  const session = sqlite.prepare(`
    SELECT s.*, g.name as group_name, g.course_id, g.monthly_price as group_monthly_price,
           c.name_ar as course_name_ar, c.name_fr as course_name_fr
    FROM attendance_sessions s
    JOIN groups g ON s.group_id = g.id
    JOIN courses c ON g.course_id = c.id
    WHERE s.id = ?
  `).get(sessionId) as any
  if (!session) throw new Error('Session not found')

  const enrolled = sqlite.prepare(`
    SELECT st.id, st.student_number, st.first_name_ar, st.last_name_ar, st.first_name_fr, st.last_name_fr,
           st.status as student_status, e.id as enrollment_id, e.agreed_price, g.monthly_price,
           e.enrollment_date, e.created_at as enrollment_created_at,
           ar.attendance_status, ar.is_inactive, ar.source, ar.scanned_at, ar.id as record_id
    FROM enrollments e
    JOIN students st ON e.student_id = st.id
    JOIN groups g ON e.group_id = g.id
    LEFT JOIN attendance_records ar ON ar.session_id = ? AND ar.student_id = st.id
    WHERE e.group_id = ? AND e.status = 'active'
    ORDER BY st.last_name_ar, st.first_name_ar
  `).all(sessionId, session.group_id) as any[]

  // For closed sessions (that are not cancelled), auto-heal any missing absent records for students enrolled before closing
  if (session.status === 'closed' && session.session_type !== 'cancelled') {
    const { deductSession } = await import('./payment.service')
    for (const s of enrolled) {
      const wasEnrolledBefore = isEnrolledBeforeSessionClose(
        s.enrollment_date,
        s.enrollment_created_at,
        session.session_date,
        session.status,
        session.updated_at || session.created_at
      )

      if (!s.record_id && wasEnrolledBefore && s.student_status === 'active') {
        try {
          sqlite.prepare(`
            INSERT OR IGNORE INTO attendance_records
              (session_id, student_id, attendance_status, is_inactive, source, was_enrolled, created_by, created_at, updated_at)
            VALUES (?, ?, 'absent', 0, 'manual', 1, ?, datetime('now'), datetime('now'))
          `).run(session.id, s.id, session.created_by || 1)

          s.attendance_status = 'absent'
          s.is_inactive = 0

          const sessPrice = getSessionDeductionPrice(
            session.price,
            s.agreed_price,
            s.monthly_price
          )
          if (sessPrice > 0 && s.enrollment_id) {
            await deductSession({
              studentId: s.id,
              enrollmentId: s.enrollment_id,
              sessionId: session.id,
              sessionDate: session.session_date,
              sessionPrice: sessPrice,
            })
          }
        } catch (e) {
          log.warn('Auto-heal absent record failed:', e)
        }
      }
    }
  }

  const { getEnrollmentBalance } = await import('./payment.service')
  const studentsWithBalance = await Promise.all(enrolled.map(async s => {
    const bal = s.enrollment_id ? await getEnrollmentBalance(s.enrollment_id) : { balance: 0 }
    const sessPrice = getSessionDeductionPrice(
      session.price,
      s.agreed_price,
      s.monthly_price
    )
    const baseMonthly = s.agreed_price || s.monthly_price || 0
    const regularSessPrice = Math.round((baseMonthly / 4) * 100) / 100
    const remSessions = regularSessPrice > 0 ? Math.floor(bal.balance / regularSessPrice) : 0

    const wasEnrolledBefore = isEnrolledBeforeSessionClose(
      s.enrollment_date,
      s.enrollment_created_at,
      session.session_date,
      session.status,
      session.updated_at || session.created_at
    )

    let attendanceStatus: string | null = null
    if (session.session_type === 'cancelled') {
      // Cancelled session: do not mark absent
      attendanceStatus = null
    } else if (s.is_inactive === 1 || s.attendance_status === 'inactive' || s.attendance_status === 'not_active') {
      attendanceStatus = 'inactive'
    } else if (s.attendance_status === 'present' || s.attendance_status === 'late') {
      attendanceStatus = 'present'
    } else if (s.attendance_status === 'absent') {
      attendanceStatus = 'absent'
    } else if (session.status === 'closed') {
      // If enrolled before closing -> absent; otherwise unregistered ('غير مسجل')
      attendanceStatus = wasEnrolledBefore ? 'absent' : null
    } else {
      // Open session: not yet recorded
      attendanceStatus = null
    }

    return {
      id: s.id,
      enrollmentId: s.enrollment_id,
      studentNumber: s.student_number,
      firstNameAr: s.first_name_ar,
      lastNameAr: s.last_name_ar,
      firstNameFr: s.first_name_fr,
      lastNameFr: s.last_name_fr,
      status: s.student_status,
      attendanceStatus,
      recordId: s.record_id ?? null,
      source: s.source ?? null,
      scannedAt: s.scanned_at ?? null,
      creditBalance: bal.balance,
      sessionPrice: sessPrice,
      remainingSessions: remSessions,
      wasInDebt: bal.balance < 0,
      wasEnrolledBefore,
    }
  }))

  const presentCount = studentsWithBalance.filter(s => s.attendanceStatus === 'present').length
  const absentCount = studentsWithBalance.filter(s => s.attendanceStatus === 'absent').length
  const inactiveCount = studentsWithBalance.filter(s => s.attendanceStatus === 'inactive').length
  const sessionEnrolledTotal = (session.status === 'closed' && session.session_type !== 'cancelled')
    ? studentsWithBalance.filter(s => s.wasEnrolledBefore || s.attendanceStatus !== null).length
    : enrolled.length

  return {
    session: {
      id: session.id,
      groupId: session.group_id,
      groupName: session.group_name,
      courseNameAr: session.course_name_ar,
      courseNameFr: session.course_name_fr,
      sessionDate: session.session_date,
      plannedStartTime: session.planned_start_time,
      endTime: session.end_time,
      room: session.room,
      status: session.status,
      sessionType: session.session_type,
      price: session.price !== undefined ? session.price : null,
      monthlyPrice: session.group_monthly_price ?? session.monthly_price ?? null,
      stats: { present: presentCount, absent: absentCount, inactive: inactiveCount, total: sessionEnrolledTotal },
    },
    students: studentsWithBalance,
  }
}

// ─── Auto-instantiate sessions for a date range (SCHEDULE ONLY — NO PRE-DEDUCTION) ─
// Requirement 4.5 & Req 14-25: Future sessions must NEVER deduct fees in advance!

export async function autoInstantiateSessionsForRange(startDate: string, endDate: string): Promise<void> {
  const sqlite = getSqlite()

  // Generate array of dates from startDate to endDate
  const start = new Date(startDate + 'T00:00:00Z')
  const end = new Date(endDate + 'T00:00:00Z')

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10)
    const jsDay = d.getUTCDay()
    const weekday = jsDay === 0 ? 6 : jsDay - 1 // Mon=0 .. Sun=6

    // Find active schedule slots on this weekday
    const slots = sqlite.prepare(`
      SELECT s.*, g.monthly_price
      FROM group_schedule_slots s
      JOIN groups g ON s.group_id = g.id
      WHERE s.weekday = ? AND s.is_active = 1 AND g.status = 'active'
    `).all(weekday) as any[]

    for (const slot of slots) {
      // Check if session already exists or cancelled
      const existing = sqlite.prepare(`
        SELECT id, session_type FROM attendance_sessions
        WHERE group_id = ? AND session_date = ?
      `).get(slot.group_id, dateStr) as any

      if (!existing) {
        // Auto-create session instance without deducting fees
        sqlite.prepare(`
          INSERT INTO attendance_sessions (group_id, session_date, planned_start_time, end_time, room, status, session_type, schedule_slot_id, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'open', 'regular', ?, 1, datetime('now'), datetime('now'))
        `).run(slot.group_id, dateStr, slot.start_time, slot.end_time, slot.room, slot.id)
      }
    }
  }
}

// ─── Offline desktop attendance reconciliation ────────────────────────────────
// Requirement 4.4 & Req 23-25: Reconcile past sessions and charge active students

export async function reconcilePastSessionsAttendance(): Promise<{ reconciledCount: number }> {
  const sqlite = getSqlite()
  const { deductSession } = await import('./payment.service')

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  // Find all past or currently-started non-cancelled sessions
  const pastSessions = sqlite.prepare(`
    SELECT s.id, s.group_id, s.session_date, s.planned_start_time, s.actual_start_time,
           s.status, s.created_at, s.updated_at, s.price,
           g.monthly_price
    FROM attendance_sessions s
    JOIN groups g ON s.group_id = g.id
    WHERE s.session_type != 'cancelled'
      AND (
        s.session_date < ?
        OR (s.session_date = ? AND (s.actual_start_time IS NOT NULL OR (s.planned_start_time IS NOT NULL AND s.planned_start_time <= ?)))
      )
  `).all(todayStr, todayStr, nowTime) as any[]

  let reconciledCount = 0

  for (const sess of pastSessions) {
    // Get all students actively enrolled on that session date
    const enrolled = sqlite.prepare(`
      SELECT e.id as enrollment_id, e.student_id, e.agreed_price, e.enrollment_date, e.created_at as enrollment_created_at, st.status as student_status
      FROM enrollments e
      JOIN students st ON e.student_id = st.id
      WHERE e.group_id = ?
        AND e.status = 'active'
        AND st.status = 'active'
        AND e.enrollment_date <= ?
    `).all(sess.group_id, sess.session_date) as any[]

    for (const en of enrolled) {
      const wasEnrolledBefore = isEnrolledBeforeSessionClose(
        en.enrollment_date,
        en.enrollment_created_at,
        sess.session_date,
        sess.status || 'closed',
        sess.updated_at || sess.created_at
      )

      if (!wasEnrolledBefore) {
        // Enrolled after session closing: do not mark absent
        continue
      }

      const existing = sqlite.prepare(`
        SELECT id, attendance_status, is_inactive FROM attendance_records
        WHERE session_id = ? AND student_id = ?
      `).get(sess.id, en.student_id) as any

      const sessPrice = getSessionDeductionPrice(
        sess.price,
        en.agreed_price,
        sess.monthly_price
      )

      if (!existing) {
        // Insert absent record
        sqlite.prepare(`
          INSERT INTO attendance_records
            (session_id, student_id, attendance_status, is_inactive, source, was_enrolled, created_by, created_at, updated_at)
          VALUES (?, ?, 'absent', 0, 'reconciliation', 1, 1, datetime('now'), datetime('now'))
        `).run(sess.id, en.student_id)
        reconciledCount++

        if (sessPrice > 0) {
          try {
            await deductSession({
              studentId: en.student_id,
              enrollmentId: en.enrollment_id,
              sessionId: sess.id,
              sessionDate: sess.session_date,
              sessionPrice: sessPrice,
            })
          } catch (err) {
            log.warn('Reconciliation deduction error:', err)
          }
        }
      } else if (existing.is_inactive === 0) {
        // Active record (absent or present) — ensure deduction was created (idempotent)
        if (sessPrice > 0) {
          try {
            await deductSession({
              studentId: en.student_id,
              enrollmentId: en.enrollment_id,
              sessionId: sess.id,
              sessionDate: sess.session_date,
              sessionPrice: sessPrice,
            })
          } catch (err) {
            log.warn('Reconciliation existing deduction check error:', err)
          }
        }
      }
    }
  }

  log.info(`Attendance reconciliation complete: reconciled ${reconciledCount} missing records`)
  return { reconciledCount }
}

// ─── Group Sessions Detailed Report (Matrix) ─────────────────────────────────

export async function getGroupSessionsReport(groupId: number): Promise<{
  group: {
    id: number
    name: string
    courseId: number
    courseNameAr: string
    courseNameFr: string
    teacherName: string | null
    monthlyPrice: number
    startDate: string
    endDate: string | null
    status: string
  }
  sessions: Array<{
    id: number
    sessionDate: string
    plannedStartTime: string | null
    actualStartTime: string | null
    endTime: string | null
    status: string
    sessionType: string
    cancelledReason: string | null
    price: number | null
    sessionNumber: number
  }>
  students: Array<{
    studentId: number
    enrollmentId: number
    studentNumber: string
    firstNameAr: string
    lastNameAr: string
    firstNameFr: string
    lastNameFr: string
    phone: string | null
    studentStatus: string
    enrollmentDate: string
    agreedPrice: number
    currentBalance: number
    sessionData: Record<number, {
      status: 'present' | 'absent' | 'not_active' | 'not_enrolled_yet' | 'cancelled'
      sessionDeduction: number
      runningBalance: number
    }>
    summary: {
      presentCount: number
      absentCount: number
      notActiveCount: number
      notEnrolledCount: number
      cancelledCount: number
      totalDeductions: number
    }
  }>
  metrics: {
    totalSessions: number
    totalStudents: number
    attendanceRate: number
    totalDeductions: number
  }
}> {
  const sqlite = getSqlite()

  // 1. Fetch Group Details
  const group = sqlite.prepare(`
    SELECT g.id, g.name, g.course_id, g.teacher_id, g.monthly_price, g.start_date, g.end_date, g.status,
           c.name_ar as course_name_ar, c.name_fr as course_name_fr,
           t.first_name as teacher_first_name, t.last_name as teacher_last_name
    FROM groups g
    JOIN courses c ON g.course_id = c.id
    LEFT JOIN teachers t ON g.teacher_id = t.id
    WHERE g.id = ?
  `).get(groupId) as any

  if (!group) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Group not found')
  }

  // 2. Fetch Sessions that started and finished, or are marked cancelled
  const sessionRows = sqlite.prepare(`
    SELECT id, session_date, planned_start_time, actual_start_time, end_time,
           status, session_type, price, late_threshold_minutes, updated_at, created_at, cancelled_reason
    FROM attendance_sessions
    WHERE group_id = ?
      AND (status = 'closed' OR (actual_start_time IS NOT NULL AND end_time IS NOT NULL) OR session_type = 'cancelled')
    ORDER BY session_date ASC, id ASC
  `).all(groupId) as any[]

  const sessions = sessionRows.map((s, idx) => ({
    id: s.id,
    sessionDate: s.session_date,
    plannedStartTime: s.planned_start_time,
    actualStartTime: s.actual_start_time,
    endTime: s.end_time,
    status: s.status,
    sessionType: s.session_type,
    cancelledReason: s.cancelled_reason ?? null,
    price: s.price,
    sessionNumber: idx + 1,
    updatedAt: s.updated_at,
    createdAt: s.created_at,
  }))

  const sessionIds = sessions.map(s => s.id)

  // 3. Fetch Enrolled Students for this group
  const enrolledStudents = sqlite.prepare(`
    SELECT st.id as student_id, st.student_number, st.first_name_ar, st.last_name_ar,
           st.first_name_fr, st.last_name_fr, st.phone, st.status as student_status,
           e.id as enrollment_id, e.agreed_price, e.enrollment_date, e.created_at as enrollment_created_at,
           e.status as enrollment_status
    FROM enrollments e
    JOIN students st ON e.student_id = st.id
    WHERE e.group_id = ?
    ORDER BY st.last_name_ar ASC, st.first_name_ar ASC
  `).all(groupId) as any[]

  const enrollmentIds = enrolledStudents.map(s => s.enrollment_id)

  // 4. Fetch Attendance Records for these sessions
  const attendanceRecordsMap = new Map<string, any>()
  if (sessionIds.length > 0) {
    const placeholders = sessionIds.map(() => '?').join(',')
    const records = sqlite.prepare(`
      SELECT session_id, student_id, attendance_status, is_inactive, scanned_at
      FROM attendance_records
      WHERE session_id IN (${placeholders})
    `).all(...sessionIds) as any[]

    for (const r of records) {
      attendanceRecordsMap.set(`${r.session_id}_${r.student_id}`, r)
    }
  }

  // 5. Fetch all payments/deductions for these enrollments
  const paymentsByEnrollment = new Map<number, any[]>()
  if (enrollmentIds.length > 0) {
    const placeholders = enrollmentIds.map(() => '?').join(',')
    const paymentRows = sqlite.prepare(`
      SELECT id, enrollment_id, student_id, session_id, amount, payment_type, payment_date, created_at, status
      FROM payments
      WHERE enrollment_id IN (${placeholders}) AND status = 'paid'
      ORDER BY payment_date ASC, created_at ASC, id ASC
    `).all(...enrollmentIds) as any[]

    for (const p of paymentRows) {
      if (!paymentsByEnrollment.has(p.enrollment_id)) {
        paymentsByEnrollment.set(p.enrollment_id, [])
      }
      paymentsByEnrollment.get(p.enrollment_id)!.push(p)
    }
  }

  // 6. Build matrix for each student across all sessions
  const { getEnrollmentBalance } = await import('./payment.service')

  let grandTotalDeductions = 0
  let totalPresentCount = 0
  let totalApplicableSessions = 0

  const studentResults = await Promise.all(enrolledStudents.map(async (st) => {
    const currentBal = await getEnrollmentBalance(st.enrollment_id)
    const enrPayments = paymentsByEnrollment.get(st.enrollment_id) || []

    const sessionData: Record<number, {
      status: 'present' | 'absent' | 'not_active' | 'not_enrolled_yet' | 'cancelled'
      sessionDeduction: number
      runningBalance: number
    }> = {}

    let presentCount = 0
    let absentCount = 0
    let notActiveCount = 0
    let notEnrolledCount = 0
    let cancelledCount = 0
    let studentTotalDeductions = 0

    for (const sess of sessions) {
      const rec = attendanceRecordsMap.get(`${sess.id}_${st.student_id}`)

      const wasEnrolledBefore = isEnrolledBeforeSessionClose(
        st.enrollment_date,
        st.enrollment_created_at,
        sess.sessionDate,
        sess.status,
        sess.updatedAt || sess.createdAt
      )

      let status: 'present' | 'absent' | 'not_active' | 'not_enrolled_yet' | 'cancelled'

      if (sess.sessionType === 'cancelled') {
        status = 'cancelled'
      } else if (rec) {
        if (rec.is_inactive === 1 || rec.attendance_status === 'inactive' || rec.attendance_status === 'not_active') {
          status = 'not_active'
        } else if (rec.attendance_status === 'present' || rec.attendance_status === 'late') {
          status = 'present'
        } else if (rec.attendance_status === 'absent') {
          status = 'absent'
        } else {
          status = wasEnrolledBefore ? 'absent' : 'not_enrolled_yet'
        }
      } else {
        if (wasEnrolledBefore) {
          status = 'absent'
        } else {
          status = 'not_enrolled_yet'
        }
      }

      // Determine deduction amount for this session
      let sessionDeduction = 0
      if (status === 'cancelled') {
        sessionDeduction = 0
      } else if (status === 'present' || status === 'absent') {
        const sessionPayment = enrPayments.find(p => p.session_id === sess.id && (p.payment_type === 'session_charge' || p.payment_type === 'deduction'))
        if (sessionPayment) {
          sessionDeduction = Number(sessionPayment.amount) || 0
        } else {
          sessionDeduction = getSessionDeductionPrice(sess.price, st.agreed_price, group.monthly_price)
        }
      } else {
        sessionDeduction = 0
      }

      // Compute running balance at this session:
      // Sum credits/top-ups on or before session date minus session charges up to this session
      let runningBal = 0
      for (const p of enrPayments) {
        const pDate = p.payment_date || ''
        const amt = Number(p.amount) || 0

        // Credits / Top-ups
        if (['credit', 'payment', 'transfer_in', 'credit_transfer_in'].includes(p.payment_type)) {
          if (pDate <= sess.sessionDate) {
            runningBal += amt
          }
        } else if (p.payment_type === 'session_refund') {
          if (pDate <= sess.sessionDate) {
            runningBal += amt
          }
        } else if (p.payment_type === 'refund' && p.session_id != null) {
          if (pDate <= sess.sessionDate) {
            runningBal += amt
          }
        } else if (['deduction', 'session_charge'].includes(p.payment_type)) {
          // Check if this deduction was for this session or an earlier session
          const pSess = sessions.find(s => s.id === p.session_id)
          if (pSess ? pSess.sessionDate <= sess.sessionDate : pDate <= sess.sessionDate) {
            runningBal -= amt
          }
        } else if (['transfer_out', 'credit_transfer_out', 'enrollment_refund'].includes(p.payment_type)) {
          if (pDate <= sess.sessionDate) {
            runningBal -= amt
          }
        }
      }

      if (status === 'cancelled') {
        cancelledCount++
      } else if (status === 'present') {
        presentCount++
        totalPresentCount++
        totalApplicableSessions++
      } else if (status === 'absent') {
        absentCount++
        totalApplicableSessions++
      } else if (status === 'not_active') {
        notActiveCount++
      } else if (status === 'not_enrolled_yet') {
        notEnrolledCount++
      }

      studentTotalDeductions += sessionDeduction
      grandTotalDeductions += sessionDeduction

      sessionData[sess.id] = {
        status,
        sessionDeduction: Math.round(sessionDeduction * 100) / 100,
        runningBalance: Math.round(runningBal * 100) / 100,
      }
    }

    return {
      studentId: st.student_id,
      enrollmentId: st.enrollment_id,
      studentNumber: st.student_number,
      firstNameAr: st.first_name_ar,
      lastNameAr: st.last_name_ar,
      firstNameFr: st.first_name_fr,
      lastNameFr: st.last_name_fr,
      phone: st.phone,
      studentStatus: st.student_status,
      enrollmentDate: st.enrollment_date,
      agreedPrice: st.agreed_price,
      currentBalance: currentBal.balance,
      sessionData,
      summary: {
        presentCount,
        absentCount,
        notActiveCount,
        notEnrolledCount,
        cancelledCount,
        totalDeductions: Math.round(studentTotalDeductions * 100) / 100,
      },
    }
  }))

  const attendanceRate = totalApplicableSessions > 0
    ? Math.round((totalPresentCount / totalApplicableSessions) * 100)
    : 0

  return {
    group: {
      id: group.id,
      name: group.name,
      courseId: group.course_id,
      courseNameAr: group.course_name_ar,
      courseNameFr: group.course_name_fr,
      teacherName: group.teacher_first_name
        ? `${group.teacher_last_name || ''} ${group.teacher_first_name}`.trim()
        : null,
      monthlyPrice: group.monthly_price,
      startDate: group.start_date,
      endDate: group.end_date,
      status: group.status,
    },
    sessions: sessions.map(s => ({
      id: s.id,
      sessionDate: s.sessionDate,
      plannedStartTime: s.plannedStartTime,
      actualStartTime: s.actualStartTime,
      endTime: s.endTime,
      status: s.status,
      sessionType: s.sessionType,
      cancelledReason: s.cancelledReason ?? null,
      price: s.price,
      sessionNumber: s.sessionNumber,
    })),
    students: studentResults,
    metrics: {
      totalSessions: sessions.length,
      totalStudents: enrolledStudents.length,
      attendanceRate,
      totalDeductions: Math.round(grandTotalDeductions * 100) / 100,
    },
  }
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function mapSessionRow(row: typeof schema.attendanceSessions.$inferSelect): AttendanceSession {
  return {
    id: row.id,
    groupId: row.groupId,
    sessionDate: row.sessionDate,
    plannedStartTime: row.plannedStartTime ?? null,
    actualStartTime: row.actualStartTime ?? null,
    endTime: row.endTime ?? null,
    lateThresholdMinutes: row.lateThresholdMinutes,
    status: row.status as 'open' | 'closed',
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapRecordRow(row: typeof schema.attendanceRecords.$inferSelect): AttendanceRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    studentId: row.studentId,
    scannedAt: row.scannedAt ?? null,
    attendanceStatus: row.attendanceStatus as AttendanceStatusType,
    source: row.source as 'qr' | 'manual',
    notes: row.notes ?? null,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

