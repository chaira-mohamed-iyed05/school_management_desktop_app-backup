import { getSqlite } from '../database/connection'
import { AppError, ErrorCode } from '../../shared/errors/index'
import { requireSession } from './auth.service'
import { getEnrollmentBalance } from './payment.service'
import type {
  TeacherPayout,
  TeacherPayoutMatrix,
  TeacherPayoutMatrixSession,
  TeacherPayoutMatrixStudent,
  TeacherPayoutMatrixStudentCell,
  TeacherPayoutReceiptTicket,
  SchoolSettings,
} from '../../shared/types/index'
import log from 'electron-log'

// ─── Generate Unique Payout Number (TP-YYYYMMDD-XXXX) ──────────────────────────

export async function generatePayoutNumber(): Promise<string> {
  const sqlite = getSqlite()
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `TP-${today}-`

  const row = sqlite.prepare(`
    SELECT payout_number FROM teacher_payouts
    WHERE payout_number LIKE ?
    ORDER BY id DESC LIMIT 1
  `).get(`${prefix}%`) as { payout_number: string } | undefined

  let nextSeq = 1
  if (row && row.payout_number) {
    const parts = row.payout_number.split('-')
    const seq = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(seq)) nextSeq = seq + 1
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`
}

// ─── Get Teacher Payout Matrix ────────────────────────────────────────────────

export async function getTeacherPayoutMatrix(groupId: number): Promise<TeacherPayoutMatrix> {
  const sqlite = getSqlite()

  // 1. Fetch Group and Course details
  const group = sqlite.prepare(`
    SELECT g.id, g.name, g.course_id, g.teacher_id, g.monthly_price,
           c.name_ar as course_name_ar, c.name_fr as course_name_fr,
           t.first_name as teacher_first_name, t.last_name as teacher_last_name,
           t.phone as teacher_phone
    FROM groups g
    JOIN courses c ON g.course_id = c.id
    LEFT JOIN teachers t ON g.teacher_id = t.id
    WHERE g.id = ?
  `).get(groupId) as any

  if (!group) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Group not found')
  }

  const teacherName = group.teacher_first_name
    ? `${group.teacher_first_name} ${group.teacher_last_name}`
    : '—'

  // Default teacher percentage (typically 50% if not configured)
  const defaultPercentage = 50

  // 2. Fetch Sessions for this group that are closed, conducted, or cancelled
  const sessionRows = sqlite.prepare(`
    SELECT id, session_date, planned_start_time, actual_start_time, end_time,
           status, session_type, price, late_threshold_minutes, updated_at, created_at,
           cancelled_reason, teacher_payout_id
    FROM attendance_sessions
    WHERE group_id = ?
      AND (status = 'closed' OR (actual_start_time IS NOT NULL AND end_time IS NOT NULL) OR session_type = 'cancelled')
    ORDER BY session_date ASC, id ASC
  `).all(groupId) as any[]

  const sessionIds = sessionRows.map((s) => s.id)

  // 3. Fetch Enrolled Students for this group (including inactive / archived)
  const enrolledStudents = sqlite.prepare(`
    SELECT st.id as student_id, st.student_number, st.first_name_ar, st.last_name_ar,
           st.first_name_fr, st.last_name_fr, st.phone, st.status as student_status,
           e.id as enrollment_id, e.agreed_price, e.enrollment_date, e.created_at as enrollment_created_at,
           e.status as enrollment_status, e.cancelled_at
    FROM enrollments e
    JOIN students st ON e.student_id = st.id
    WHERE e.group_id = ?
    ORDER BY st.last_name_ar ASC, st.first_name_ar ASC
  `).all(groupId) as any[]

  const enrollmentIds = enrolledStudents.map((s) => s.enrollment_id)

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

  // 5. Fetch all student payments/credits for these enrollments to apply FIFO
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

  // 6. Fetch existing teacher_payout_items for these sessions
  const payoutItemsMap = new Map<string, any>()
  if (sessionIds.length > 0) {
    const placeholders = sessionIds.map(() => '?').join(',')
    const existingItems = sqlite.prepare(`
      SELECT id, payout_id, session_id, student_id, enrollment_id, state, session_price,
             teacher_percentage, teacher_share, paid_at
      FROM teacher_payout_items
      WHERE session_id IN (${placeholders})
    `).all(...sessionIds) as any[]

    for (const item of existingItems) {
      payoutItemsMap.set(`${item.session_id}_${item.student_id}`, item)
    }
  }

  // 7. Calculate cell status per student and per session using FIFO and Full Payment Only
  const studentsList: TeacherPayoutMatrixStudent[] = []
  const sessionStatsMap = new Map<number, {
    yellowCount: number
    greenCount: number
    redCount: number
    totalStudents: number
    price: number
  }>()

  for (const s of sessionRows) {
    const defaultSessPrice = (s.price != null && s.price > 0)
      ? s.price
      : (group.monthly_price ? Math.round(group.monthly_price / 4) : 0)
    sessionStatsMap.set(s.id, {
      yellowCount: 0,
      greenCount: 0,
      redCount: 0,
      totalStudents: 0,
      price: defaultSessPrice,
    })
  }

  let totalGrossYellowAmount = 0
  let totalPendingDebtAmount = 0
  let totalYellowCount = 0
  let totalGreenCount = 0
  let totalRedCount = 0

  for (const st of enrolledStudents) {
    const enrPayments = paymentsByEnrollment.get(st.enrollment_id) || []
    const balInfo = await getEnrollmentBalance(st.enrollment_id)

    // Calculate total net credit the student paid for this enrollment
    let totalStudentPaidCredit = 0
    for (const p of enrPayments) {
      const amt = Number(p.amount) || 0
      if (['credit', 'payment', 'transfer_in', 'credit_transfer_in', 'session_refund'].includes(p.payment_type)) {
        totalStudentPaidCredit += amt
      } else if (p.payment_type === 'refund' && p.session_id != null) {
        totalStudentPaidCredit += amt
      } else if (['transfer_out', 'credit_transfer_out', 'enrollment_refund'].includes(p.payment_type)) {
        totalStudentPaidCredit -= amt
      } else if (p.payment_type === 'refund' && p.session_id == null) {
        totalStudentPaidCredit -= amt
      }
    }

    const cells: Record<number, TeacherPayoutMatrixStudentCell> = {}
    let runningRequiredDeductions = 0

    for (const sess of sessionRows) {
      const rec = attendanceRecordsMap.get(`${sess.id}_${st.student_id}`)
      const existingPayoutItem = payoutItemsMap.get(`${sess.id}_${st.student_id}`)

      // Determine enrollment validity at the time of the session
      const wasCancelledBeforeSession = st.cancelled_at && sess.session_date > st.cancelled_at.slice(0, 10)
      const enrDate = st.enrollment_date || (st.enrollment_created_at ? st.enrollment_created_at.slice(0, 10) : '')
      const isEnrolledBefore = !enrDate || enrDate <= sess.session_date

      let status: 'present' | 'absent' | 'not_active' | 'not_enrolled_yet' | 'cancelled'
      if (sess.session_type === 'cancelled') {
        status = 'cancelled'
      } else if (rec) {
        if (rec.is_inactive === 1 || rec.attendance_status === 'inactive' || rec.attendance_status === 'not_active') {
          status = 'not_active'
        } else if (rec.attendance_status === 'present' || rec.attendance_status === 'late') {
          status = 'present'
        } else if (rec.attendance_status === 'absent') {
          status = 'absent'
        } else {
          status = isEnrolledBefore && !wasCancelledBeforeSession ? 'absent' : 'not_enrolled_yet'
        }
      } else if (wasCancelledBeforeSession || !isEnrolledBefore) {
        status = 'not_enrolled_yet'
      } else {
        status = 'absent'
      }

      // Determine session price for this student
      let sessionPrice = 0
      if (status === 'present' || status === 'absent') {
        if (sess.price != null && sess.price > 0) {
          sessionPrice = sess.price
        } else if (st.agreed_price != null && st.agreed_price > 0) {
          sessionPrice = Math.round(st.agreed_price / 4)
        } else {
          sessionPrice = group.monthly_price ? Math.round(group.monthly_price / 4) : 0
        }
      }

      let state: 'green' | 'yellow' | 'red' | 'none' = 'none'
      let isPaidToTeacher = false
      let payoutId: number | null = null
      let teacherShare = 0

      if (status === 'present' || status === 'absent') {
        runningRequiredDeductions += sessionPrice

        // If already paid to teacher in a previous payout (Green)
        if (existingPayoutItem && (existingPayoutItem.state === 'green' || existingPayoutItem.payout_id != null)) {
          state = 'green'
          isPaidToTeacher = true
          payoutId = existingPayoutItem.payout_id
          teacherShare = existingPayoutItem.teacher_share || Math.round(sessionPrice * (defaultPercentage / 100))
        } else {
          // FIFO & Full Payment Only check:
          // Does the student's total payments cover the cumulative cost up to this session?
          if (totalStudentPaidCredit >= runningRequiredDeductions) {
            state = 'yellow' // 100% paid by student, ready for teacher payout!
            teacherShare = Math.round(sessionPrice * (defaultPercentage / 100))
          } else {
            state = 'red' // In debt / incomplete payment, teacher withheld
          }
        }

        const stats = sessionStatsMap.get(sess.id)!
        stats.totalStudents++
        if (state === 'green') {
          stats.greenCount++
          totalGreenCount++
        } else if (state === 'yellow') {
          stats.yellowCount++
          totalYellowCount++
          totalGrossYellowAmount += sessionPrice
        } else if (state === 'red') {
          stats.redCount++
          totalRedCount++
          totalPendingDebtAmount += sessionPrice
        }
      }

      cells[sess.id] = {
        sessionId: sess.id,
        attendanceStatus: status,
        state,
        sessionPrice,
        isPaidToTeacher,
        payoutId,
        teacherShare,
      }
    }

    const isDeparted = st.student_status === 'archived' || st.student_status === 'inactive' || st.enrollment_status === 'cancelled'

    studentsList.push({
      studentId: st.student_id,
      enrollmentId: st.enrollment_id,
      studentNumber: st.student_number,
      studentNameAr: `${st.last_name_ar} ${st.first_name_ar}`.trim(),
      studentNameFr: `${st.last_name_fr} ${st.first_name_fr}`.trim(),
      phone: st.phone,
      studentStatus: st.student_status,
      isDeparted,
      totalBalance: balInfo.balance,
      cells,
    })
  }

  // Build sessions matrix headers
  const sessions: TeacherPayoutMatrixSession[] = sessionRows.map((s, idx) => {
    const stats = sessionStatsMap.get(s.id)!
    return {
      id: s.id,
      sessionDate: s.session_date,
      sessionNumber: idx + 1,
      sessionType: s.session_type,
      status: s.status,
      price: stats.price,
      yellowCount: stats.yellowCount,
      greenCount: stats.greenCount,
      redCount: stats.redCount,
      totalStudents: stats.totalStudents,
      isFullyPaid: stats.redCount === 0 && stats.yellowCount === 0 && stats.greenCount > 0,
    }
  })

  const readySessionsCount = sessions.filter((s) => s.yellowCount > 0).length
  const estimatedNetPayout = Math.round(totalGrossYellowAmount * (defaultPercentage / 100))

  return {
    group: {
      id: group.id,
      name: group.name,
      courseId: group.course_id,
      courseNameAr: group.course_name_ar,
      courseNameFr: group.course_name_fr,
      teacherId: group.teacher_id,
      teacherName,
      monthlyPrice: group.monthly_price,
    },
    teacher: {
      id: group.teacher_id,
      name: teacherName,
      phone: group.teacher_phone,
      defaultPercentage,
    },
    sessions,
    students: studentsList,
    summary: {
      totalSessions: sessions.length,
      readySessionsCount,
      totalYellowCount,
      totalGreenCount,
      totalRedCount,
      totalGrossYellowAmount,
      totalPendingDebtAmount,
      defaultPercentage,
      estimatedNetPayout,
    },
  }
}

// ─── Execute Teacher Payout ───────────────────────────────────────────────────

export async function executeTeacherPayout(data: {
  groupId: number
  sessionIds?: number[]
  percentage: number
  paymentMethod?: 'cash' | 'transfer' | 'check'
  notes?: string | null
}): Promise<TeacherPayoutReceiptTicket> {
  const session = requireSession()
  const sqlite = getSqlite()

  if (data.percentage <= 0 || data.percentage > 100) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Percentage must be between 1 and 100')
  }

  // 1. Get current fresh matrix
  const matrix = await getTeacherPayoutMatrix(data.groupId)
  if (!matrix.teacher.id) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Group has no assigned teacher')
  }

  const selectedSessionIdSet = data.sessionIds && data.sessionIds.length > 0
    ? new Set(data.sessionIds)
    : new Set(matrix.sessions.map((s) => s.id))

  // 2. Identify all Yellow cells that will be converted to Green
  const yellowItemsToConvert: Array<{
    sessionId: number
    sessionDate: string
    sessionNumber: number
    studentId: number
    studentNumber: string
    studentName: string
    enrollmentId: number
    attendanceStatus: string
    price: number
    teacherShare: number
    isDeparted: boolean
  }> = []

  const debtItemsToReport: Array<{
    sessionId: number
    sessionDate: string
    sessionNumber: number
    studentId: number
    studentNumber: string
    studentName: string
    isDeparted: boolean
    price: number
    currentBalance: number
  }> = []

  let grossAmount = 0
  let pendingDebtAmount = 0

  for (const stu of matrix.students) {
    for (const sess of matrix.sessions) {
      if (!selectedSessionIdSet.has(sess.id)) continue
      const cell = stu.cells[sess.id]
      if (!cell) continue

      if (cell.state === 'yellow') {
        const teacherShare = Math.round(cell.sessionPrice * (data.percentage / 100))
        yellowItemsToConvert.push({
          sessionId: sess.id,
          sessionDate: sess.sessionDate,
          sessionNumber: sess.sessionNumber,
          studentId: stu.studentId,
          studentNumber: stu.studentNumber,
          studentName: stu.studentNameAr || stu.studentNameFr,
          enrollmentId: stu.enrollmentId,
          attendanceStatus: cell.attendanceStatus,
          price: cell.sessionPrice,
          teacherShare,
          isDeparted: stu.isDeparted,
        })
        grossAmount += cell.sessionPrice
      } else if (cell.state === 'red') {
        debtItemsToReport.push({
          sessionId: sess.id,
          sessionDate: sess.sessionDate,
          sessionNumber: sess.sessionNumber,
          studentId: stu.studentId,
          studentNumber: stu.studentNumber,
          studentName: stu.studentNameAr || stu.studentNameFr,
          isDeparted: stu.isDeparted,
          price: cell.sessionPrice,
          currentBalance: stu.totalBalance,
        })
        pendingDebtAmount += cell.sessionPrice
      }
    }
  }

  if (yellowItemsToConvert.length === 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'No yellow cells available to pay for the selected sessions')
  }

  const netPaidAmount = Math.round(grossAmount * (data.percentage / 100))
  const payoutNumber = await generatePayoutNumber()
  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  const sessionsCount = selectedSessionIdSet.size
  const paymentMethod = data.paymentMethod || 'cash'

  // 3. Atomic Database Execution
  const executeTransaction = sqlite.transaction(() => {
    // A. Insert into teacher_payouts
    const insertPayoutStmt = sqlite.prepare(`
      INSERT INTO teacher_payouts (
        payout_number, teacher_id, group_id, payout_date, sessions_count,
        yellows_converted_count, gross_amount, percentage, net_paid_amount,
        pending_debt_amount, payment_method, notes, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const payoutResult = insertPayoutStmt.run(
      payoutNumber,
      matrix.teacher.id,
      matrix.group.id,
      today,
      sessionsCount,
      yellowItemsToConvert.length,
      grossAmount,
      data.percentage,
      netPaidAmount,
      pendingDebtAmount,
      paymentMethod,
      data.notes || null,
      session.adminId,
      now,
      now
    )
    const payoutId = Number(payoutResult.lastInsertRowid)

    // B. Insert or update teacher_payout_items to Green
    const upsertItemStmt = sqlite.prepare(`
      INSERT INTO teacher_payout_items (
        payout_id, session_id, student_id, enrollment_id, attendance_status,
        student_balance_at_session, state, session_price, teacher_percentage,
        teacher_share, paid_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'green', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, student_id) DO UPDATE SET
        payout_id = excluded.payout_id,
        state = 'green',
        teacher_percentage = excluded.teacher_percentage,
        teacher_share = excluded.teacher_share,
        paid_at = excluded.paid_at,
        updated_at = excluded.updated_at
    `)

    for (const it of yellowItemsToConvert) {
      upsertItemStmt.run(
        payoutId,
        it.sessionId,
        it.studentId,
        it.enrollmentId,
        it.attendanceStatus,
        0,
        it.price,
        data.percentage,
        it.teacherShare,
        today,
        now,
        now
      )
    }

    // C. Link sessions to this payout if all yellow cells in session are settled
    for (const sid of selectedSessionIdSet) {
      sqlite.prepare(`
        UPDATE attendance_sessions
        SET teacher_payout_id = ?, updated_at = ?
        WHERE id = ?
      `).run(payoutId, now, sid)
    }

    // D. Insert negative expense transaction into payments table
    const paymentNote = `أجر أستاذ: ${matrix.teacher.name} — فوج: ${matrix.group.name} (${sessionsCount} حصص، ${yellowItemsToConvert.length} مساهمة مسددة)`
    sqlite.prepare(`
      INSERT INTO payments (
        receipt_number, teacher_id, teacher_payout_id, billing_period, amount,
        payment_type, payment_method, payment_date, notes, received_by, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'teacher_payout', ?, ?, ?, ?, 'paid', ?, ?)
    `).run(
      payoutNumber,
      matrix.teacher.id,
      payoutId,
      today.slice(0, 7),
      netPaidAmount,
      paymentMethod,
      today,
      paymentNote,
      session.adminId,
      now,
      now
    )

    return payoutId
  })

  const payoutId = executeTransaction()
  log.info(`[TeacherPayout] Successfully executed payout #${payoutNumber} (ID: ${payoutId}) for teacher ${matrix.teacher.name}: ${netPaidAmount} DA`)

  // 4. Return Ticket Details
  return getPayoutReceiptDetails(payoutId)
}

// ─── Get Payout Receipt Details ───────────────────────────────────────────────

export async function getPayoutReceiptDetails(payoutId: number): Promise<TeacherPayoutReceiptTicket> {
  const sqlite = getSqlite()

  const payout = sqlite.prepare(`
    SELECT tp.*, t.first_name as teacher_first_name, t.last_name as teacher_last_name, t.phone as teacher_phone,
           g.name as group_name, g.course_id, c.name_ar as course_name_ar, c.name_fr as course_name_fr,
           a.full_name as created_by_name
    FROM teacher_payouts tp
    JOIN teachers t ON tp.teacher_id = t.id
    JOIN groups g ON tp.group_id = g.id
    JOIN courses c ON g.course_id = c.id
    LEFT JOIN administrators a ON tp.created_by = a.id
    WHERE tp.id = ?
  `).get(payoutId) as any

  if (!payout) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Teacher payout voucher not found')
  }

  // Fetch School Settings
  const settingsRow = sqlite.prepare(`SELECT * FROM school_settings LIMIT 1`).get() as any

  // Fetch Paid Items
  const paidItemsRows = sqlite.prepare(`
    SELECT tpi.*, s.session_date, st.student_number, st.first_name_ar, st.last_name_ar,
           st.first_name_fr, st.last_name_fr, st.status as student_status, e.status as enrollment_status
    FROM teacher_payout_items tpi
    JOIN attendance_sessions s ON tpi.session_id = s.id
    JOIN students st ON tpi.student_id = st.id
    JOIN enrollments e ON tpi.enrollment_id = e.id
    WHERE tpi.payout_id = ?
    ORDER BY s.session_date ASC, s.id ASC, st.last_name_ar ASC
  `).all(payoutId) as any[]

  // Fetch session numbers map for this group
  const allSessions = sqlite.prepare(`
    SELECT id, session_date FROM attendance_sessions
    WHERE group_id = ?
    ORDER BY session_date ASC, id ASC
  `).all(payout.group_id) as any[]
  const sessionNumberMap = new Map<number, number>()
  allSessions.forEach((s, idx) => sessionNumberMap.set(s.id, idx + 1))

  const paidItems = paidItemsRows.map((r) => ({
    sessionId: r.session_id,
    sessionDate: r.session_date,
    sessionNumber: sessionNumberMap.get(r.session_id) || 1,
    studentId: r.student_id,
    studentNumber: r.student_number,
    studentName: `${r.last_name_ar || r.last_name_fr || ''} ${r.first_name_ar || r.first_name_fr || ''}`.trim(),
    isDeparted: r.student_status === 'archived' || r.student_status === 'inactive' || r.enrollment_status === 'cancelled',
    price: r.session_price,
    teacherShare: r.teacher_share,
  }))

  // For transparency on the ticket: get current red debt items for the sessions in this payout
  const distinctSessionIds = Array.from(new Set(paidItems.map((it) => it.sessionId)))
  let debtItems: any[] = []

  if (distinctSessionIds.length > 0) {
    // Compute current matrix for this group to get accurate remaining debts
    try {
      const currentMatrix = await getTeacherPayoutMatrix(payout.group_id)
      const sessSet = new Set(distinctSessionIds)
      for (const stu of currentMatrix.students) {
        for (const sess of currentMatrix.sessions) {
          if (!sessSet.has(sess.id)) continue
          const cell = stu.cells[sess.id]
          if (cell && cell.state === 'red') {
            debtItems.push({
              sessionId: sess.id,
              sessionDate: sess.sessionDate,
              sessionNumber: sess.sessionNumber,
              studentId: stu.studentId,
              studentNumber: stu.studentNumber,
              studentName: stu.studentNameAr || stu.studentNameFr,
              isDeparted: stu.isDeparted,
              price: cell.sessionPrice,
              currentBalance: stu.totalBalance,
            })
          }
        }
      }
    } catch (err) {
      log.warn('Could not recompute current debt items for ticket:', err)
    }
  }

  const teacherName = payout.teacher_first_name
    ? `${payout.teacher_first_name} ${payout.teacher_last_name}`
    : '—'

  const formattedPayout: TeacherPayout = {
    id: payout.id,
    payoutNumber: payout.payout_number,
    teacherId: payout.teacher_id,
    groupId: payout.group_id,
    payoutDate: payout.payout_date,
    sessionsCount: payout.sessions_count,
    yellowsConvertedCount: payout.yellows_converted_count,
    grossAmount: payout.gross_amount,
    percentage: payout.percentage,
    netPaidAmount: payout.net_paid_amount,
    pendingDebtAmount: payout.pending_debt_amount,
    paymentMethod: payout.payment_method,
    notes: payout.notes,
    createdBy: payout.created_by,
    createdAt: payout.created_at,
    updatedAt: payout.updated_at,
    teacherName,
    groupName: payout.group_name,
    courseName: payout.course_name_ar ? `${payout.course_name_ar} (${payout.course_name_fr})` : payout.course_name_fr,
    createdByName: payout.created_by_name,
  }

  return {
    payout: formattedPayout,
    group: {
      id: payout.group_id,
      name: payout.group_name,
      courseNameAr: payout.course_name_ar,
      courseNameFr: payout.course_name_fr,
    },
    teacher: {
      id: payout.teacher_id,
      name: teacherName,
      phone: payout.teacher_phone,
    },
    schoolSettings: settingsRow ? {
      id: settingsRow.id,
      schoolNameAr: settingsRow.school_name_ar,
      schoolNameFr: settingsRow.school_name_fr,
      schoolNameEn: settingsRow.school_name_en,
      phone: settingsRow.phone,
      email: settingsRow.email,
      address: settingsRow.address,
      academicYear: settingsRow.academic_year,
      currency: settingsRow.currency,
      studentNumberPrefix: settingsRow.student_number_prefix,
      receiptPrefix: settingsRow.receipt_prefix,
      defaultLanguage: settingsRow.default_language,
      backupDirectory: settingsRow.backup_directory,
      automaticBackupEnabled: Boolean(settingsRow.automatic_backup_enabled),
      backupsToRetain: settingsRow.backups_to_retain,
      updatedAt: settingsRow.updated_at,
    } : undefined,
    paidItems,
    debtItems,
  }
}

// ─── List Teacher Payouts ─────────────────────────────────────────────────────

export async function listTeacherPayouts(filters?: {
  teacherId?: number
  groupId?: number
}): Promise<TeacherPayout[]> {
  const sqlite = getSqlite()
  let where = 'WHERE 1=1'
  const params: any[] = []

  if (filters?.teacherId) {
    where += ' AND tp.teacher_id = ?'
    params.push(filters.teacherId)
  }
  if (filters?.groupId) {
    where += ' AND tp.group_id = ?'
    params.push(filters.groupId)
  }

  const rows = sqlite.prepare(`
    SELECT tp.*, t.first_name as teacher_first_name, t.last_name as teacher_last_name,
           g.name as group_name, c.name_ar as course_name_ar, c.name_fr as course_name_fr,
           a.full_name as created_by_name
    FROM teacher_payouts tp
    JOIN teachers t ON tp.teacher_id = t.id
    JOIN groups g ON tp.group_id = g.id
    JOIN courses c ON g.course_id = c.id
    LEFT JOIN administrators a ON tp.created_by = a.id
    ${where}
    ORDER BY tp.payout_date DESC, tp.id DESC
  `).all(...params) as any[]

  return rows.map((r) => ({
    id: r.id,
    payoutNumber: r.payout_number,
    teacherId: r.teacher_id,
    groupId: r.group_id,
    payoutDate: r.payout_date,
    sessionsCount: r.sessions_count,
    yellowsConvertedCount: r.yellows_converted_count,
    grossAmount: r.gross_amount,
    percentage: r.percentage,
    netPaidAmount: r.net_paid_amount,
    pendingDebtAmount: r.pending_debt_amount,
    paymentMethod: r.payment_method,
    notes: r.notes,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    teacherName: `${r.teacher_first_name} ${r.teacher_last_name}`.trim(),
    groupName: r.group_name,
    courseName: r.course_name_ar ? `${r.course_name_ar} (${r.course_name_fr})` : r.course_name_fr,
    createdByName: r.created_by_name,
  }))
}
