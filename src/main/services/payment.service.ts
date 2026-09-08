import { eq, desc, and, like, count, sql } from 'drizzle-orm'
import { getDb, getSqlite, schema } from '../database/connection'
import { AppError, ErrorCode } from '../../shared/errors/index'
import { DEFAULT_RECEIPT_PREFIX } from '../../shared/constants/index'
import { requireSession } from './auth.service'
import type { Payment, PaginatedResult } from '../../shared/types/index'
import log from 'electron-log'

// ─── Receipt number generator ─────────────────────────────────────────────────

async function generateReceiptNumber(): Promise<string> {
  const db = getDb()
  const settings = await db.query.schoolSettings.findFirst()
  const prefix = settings?.receiptPrefix ?? DEFAULT_RECEIPT_PREFIX
  const result = await db.select({ count: count() }).from(schema.payments)
  const total = (result[0]?.count ?? 0) + 1
  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `${prefix}-${ts}-${String(total).padStart(4, '0')}`
}

// ─── Session price = monthlyPrice / 4 ────────────────────────────────────────

export function getSessionPrice(monthlyPrice: number): number {
  return Math.round((monthlyPrice / 4) * 100) / 100
}

// ─── Get credit balance for an enrollment ────────────────────────────────────

export async function getEnrollmentBalance(enrollmentId: number): Promise<{
  balance: number
  totalCharged: number
  totalDeducted: number
  sessionsUsed: number
}> {
  const sqlite = getSqlite()
  const rows = sqlite.prepare(`
    SELECT payment_type, session_id, SUM(amount) as total
    FROM payments
    WHERE enrollment_id = ? AND status = 'paid'
    GROUP BY payment_type, (session_id IS NOT NULL)
  `).all(enrollmentId) as { payment_type: string; session_id: number | null; total: number }[]

  let totalCredit = 0
  let totalDebit = 0

  for (const r of rows) {
    const amt = r.total ?? 0
    switch (r.payment_type) {
      case 'credit':
      case 'payment':
      case 'transfer_in':
      case 'credit_transfer_in':
        totalCredit += amt
        break
      case 'session_refund':
        // Session refund adds previously deducted session fee back to student credit
        totalCredit += amt
        break
      case 'refund':
        // If tied to a session, it is a session refund (adds to balance)
        // If not tied to a session, it is an enrollment cancellation cash refund (settles balance to 0)
        if (r.session_id != null) {
          totalCredit += amt
        } else {
          totalDebit += amt
        }
        break
      case 'deduction':
      case 'session_charge':
      case 'transfer_out':
      case 'credit_transfer_out':
      case 'enrollment_refund':
        totalDebit += amt
        break
      default:
        break
    }
  }

  const balance = totalCredit - totalDebit
  const sessionCount = sqlite.prepare(`
    SELECT COUNT(*) as cnt FROM payments
    WHERE enrollment_id = ? AND payment_type IN ('deduction', 'session_charge') AND status = 'paid'
  `).get(enrollmentId) as { cnt: number }

  return {
    balance: Math.round(balance * 100) / 100,
    totalCharged: Math.round(totalCredit * 100) / 100,
    totalDeducted: Math.round(totalDebit * 100) / 100,
    sessionsUsed: sessionCount?.cnt ?? 0,
  }
}

// ─── Get comprehensive balance for a student across all enrollments ───────────
// Requirement 28, 29, 30: Canonical student balance service & debt breakdown

export async function getStudentBalance(studentId: number): Promise<{
  studentId: number
  totalBalance: number
  isDebt: boolean
  enrollmentBalances: Array<{
    enrollmentId: number
    groupId: number
    groupName: string
    courseNameAr: string
    courseNameFr: string
    balance: number
    isDebt: boolean
    status: string
  }>
}> {
  const sqlite = getSqlite()
  const enrollments = sqlite.prepare(`
    SELECT e.id as enrollment_id, e.group_id, g.name as group_name,
           c.name_ar as course_name_ar, c.name_fr as course_name_fr,
           e.status as enrollment_status
    FROM enrollments e
    JOIN groups g ON e.group_id = g.id
    JOIN courses c ON g.course_id = c.id
    WHERE e.student_id = ?
    ORDER BY e.created_at DESC
  `).all(studentId) as any[]

  let totalBalance = 0
  const enrollmentBalances = []

  for (const enr of enrollments) {
    const bal = await getEnrollmentBalance(enr.enrollment_id)
    totalBalance += bal.balance
    enrollmentBalances.push({
      enrollmentId: enr.enrollment_id,
      groupId: enr.group_id,
      groupName: enr.group_name,
      courseNameAr: enr.course_name_ar ?? '',
      courseNameFr: enr.course_name_fr ?? '',
      balance: bal.balance,
      isDebt: bal.balance < 0,
      status: enr.enrollment_status,
    })
  }

  totalBalance = Math.round(totalBalance * 100) / 100
  return {
    studentId,
    totalBalance,
    isDebt: totalBalance < 0,
    enrollmentBalances,
  }
}

// ─── Top up student credit (recharge) ────────────────────────────────────────

export async function topUpCredit(data: {
  studentId: number
  enrollmentId: number
  amount: number
  paymentMethod: 'cash' | 'transfer' | 'check'
  paymentDate: string
  reference?: string | null
  notes?: string | null
}): Promise<Payment> {
  const session = requireSession()
  const db = getDb()

  if (data.amount <= 0) throw new AppError(ErrorCode.NEGATIVE_AMOUNT, 'Amount must be positive')

  const receiptNumber = await generateReceiptNumber()
  const now = new Date().toISOString()

  const result = await db.insert(schema.payments).values({
    receiptNumber,
    studentId: data.studentId,
    enrollmentId: data.enrollmentId,
    billingPeriod: data.paymentDate.slice(0, 7),
    amount: data.amount,
    paymentType: 'credit',
    paymentMethod: data.paymentMethod,
    paymentDate: data.paymentDate,
    reference: data.reference ?? null,
    notes: data.notes ?? null,
    receivedBy: session.adminId,
    status: 'paid',
    updatedAt: now,
  }).returning()

  const row = result[0]!
  log.info(`Credit top-up: ${receiptNumber}, amount: ${data.amount}, enrollment: ${data.enrollmentId}`)

  await db.insert(schema.auditLogs).values({
    administratorId: session.adminId,
    action: 'payment.topup',
    entityType: 'payment',
    entityId: row.id,
    sanitizedDetailsJson: JSON.stringify({ receiptNumber, amount: data.amount }),
  })

  return mapPaymentRow(row)
}

// ─── Deduct one session from enrollment credit ────────────────────────────────
// Requirement 9, 10, 13: Deterministic & idempotent session deduction

export async function deductSession(data: {
  studentId: number
  enrollmentId: number
  sessionId: number
  sessionDate: string
  sessionPrice: number
}): Promise<{ deducted: boolean; newBalance: number; wasInDebt: boolean }> {
  const session = requireSession()
  const sqlite = getSqlite()

  // Idempotency: don't deduct twice for same session+enrollment
  const existing = sqlite.prepare(`
    SELECT id FROM payments
    WHERE enrollment_id = ? AND session_id = ?
      AND payment_type IN ('deduction', 'session_charge')
      AND status = 'paid'
    LIMIT 1
  `).get(data.enrollmentId, data.sessionId)

  if (existing) {
    const bal = await getEnrollmentBalance(data.enrollmentId)
    return { deducted: false, newBalance: bal.balance, wasInDebt: bal.balance < 0 }
  }

  const bal = await getEnrollmentBalance(data.enrollmentId)
  const wasInDebt = bal.balance < data.sessionPrice

  const receiptNumber = await generateReceiptNumber()
  const now = new Date().toISOString()

  sqlite.prepare(`
    INSERT INTO payments (
      receipt_number, student_id, enrollment_id, billing_period, amount,
      payment_type, session_id, payment_method, payment_date, notes,
      received_by, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'session_charge', ?, 'cash', ?, ?, ?, 'paid', datetime('now'), datetime('now'))
  `).run(
    receiptNumber, data.studentId, data.enrollmentId,
    data.sessionDate.slice(0, 7), data.sessionPrice,
    data.sessionId, data.sessionDate,
    wasInDebt ? 'DEBT: insufficient credit' : null,
    session.adminId
  )

  const newBal = await getEnrollmentBalance(data.enrollmentId)
  log.info(`Session deduction: ${receiptNumber}, session: ${data.sessionId}, price: ${data.sessionPrice}`)
  return { deducted: true, newBalance: newBal.balance, wasInDebt }
}

// ─── Refund session charge when session becomes INACTIVE ──────────────────────
// Requirement 20 & 21: Only refund if an effective charge existed; net effect = 0

export async function refundSessionCharge(
  enrollmentId: number,
  sessionId: number,
  studentId: number,
  adminId: number
): Promise<{ refunded: boolean; refundAmount: number }> {
  const sqlite = getSqlite()

  // Ensure any existing refund rows for this session are cancelled to prevent double-crediting
  sqlite.prepare(`
    UPDATE payments SET status = 'cancelled', updated_at = datetime('now')
    WHERE enrollment_id = ? AND session_id = ?
      AND payment_type IN ('refund', 'session_refund')
      AND status = 'paid'
  `).run(enrollmentId, sessionId)

  // Check if a paid deduction exists
  const deduction = sqlite.prepare(`
    SELECT id, amount, billing_period FROM payments
    WHERE enrollment_id = ? AND session_id = ?
      AND payment_type IN ('deduction', 'session_charge')
      AND status = 'paid'
    LIMIT 1
  `).get(enrollmentId, sessionId) as { id: number; amount: number; billing_period: string } | undefined

  if (!deduction) {
    // Critical rule: If never charged, do not refund
    return { refunded: false, refundAmount: 0 }
  }

  // Cancelling the session deduction restores the exact session fee back to the student's credit balance.
  // Note: We do NOT insert an additional 'session_refund' payment row here, because that would double-count
  // the refund (+1000 credit AND -1000 debit cancelled = +2000 DA net change).
  sqlite.prepare(`
    UPDATE payments SET status = 'cancelled', updated_at = datetime('now')
    WHERE id = ?
  `).run(deduction.id)

  return { refunded: true, refundAmount: deduction.amount }
}

// ─── Re-charge session when reversing INACTIVE → ATTENDED/ABSENT ──────────────
// Requirement 22: Restore session charge if it was previously refunded

export async function rechargeSessionCharge(
  enrollmentId: number,
  sessionId: number,
  studentId: number,
  sessionDate: string,
  sessionPrice: number,
  adminId: number
): Promise<{ charged: boolean; amount: number }> {
  const sqlite = getSqlite()

  // Check if an active charge already exists
  const activeCharge = sqlite.prepare(`
    SELECT id FROM payments
    WHERE enrollment_id = ? AND session_id = ?
      AND payment_type IN ('deduction', 'session_charge')
      AND status = 'paid'
    LIMIT 1
  `).get(enrollmentId, sessionId) as { id: number } | undefined

  if (activeCharge) {
    // Already actively charged — no new charge
    return { charged: false, amount: 0 }
  }

  // Cancel any stale refund records for this session
  sqlite.prepare(`
    UPDATE payments SET status = 'cancelled', updated_at = datetime('now')
    WHERE enrollment_id = ? AND session_id = ?
      AND payment_type IN ('refund', 'session_refund')
      AND status = 'paid'
  `).run(enrollmentId, sessionId)

  const receiptNumber = await generateReceiptNumber()

  sqlite.prepare(`
    INSERT INTO payments (
      receipt_number, student_id, enrollment_id, billing_period, amount,
      payment_type, session_id, payment_method, payment_date, notes,
      received_by, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'session_charge', ?, 'cash', ?, 'Session restored from inactive', ?, 'paid', datetime('now'), datetime('now'))
  `).run(receiptNumber, studentId, enrollmentId, sessionDate.slice(0, 7), sessionPrice, sessionId, sessionDate, adminId)

  return { charged: true, amount: sessionPrice }
}

// ─── Transfer remaining balance between enrollments ───────────────────────────
// Requirement 31-37: 100% positive transferable balance, atomic SQLite transaction

export async function transferBalance(data: {
  fromEnrollmentId: number
  toEnrollmentId: number
  studentId: number
  amount?: number
}): Promise<{ transferred: number; newFromBalance: number; newToBalance: number }> {
  const session = requireSession()
  const sqlite = getSqlite()

  return sqlite.transaction(() => {
    const fromBal = sqlite.prepare(`
      SELECT payment_type, session_id, SUM(amount) as total
      FROM payments
      WHERE enrollment_id = ? AND status = 'paid'
      GROUP BY payment_type, (session_id IS NOT NULL)
    `).all(data.fromEnrollmentId) as any[]

    let totalCredit = 0
    let totalDebit = 0
    for (const r of fromBal) {
      const amt = r.total ?? 0
      if (['credit', 'payment', 'transfer_in', 'credit_transfer_in', 'session_refund'].includes(r.payment_type) ||
          (r.payment_type === 'refund' && r.session_id != null)) {
        totalCredit += amt
      } else if (['deduction', 'session_charge', 'transfer_out', 'credit_transfer_out', 'enrollment_refund'].includes(r.payment_type) ||
                 (r.payment_type === 'refund' && r.session_id == null)) {
        totalDebit += amt
      }
    }
    const currentFromBalance = Math.round((totalCredit - totalDebit) * 100) / 100
    // Requirement 34: Transfer positive remaining credit only; debt stays on source enrollment
    const transferAmount = Math.max(0, currentFromBalance)

    const now = new Date().toISOString()
    const nowDate = now.slice(0, 10)
    const receiptOut = `TR-OUT-${Date.now()}`
    const receiptIn = `TR-IN-${Date.now()}`

    if (transferAmount > 0) {
      sqlite.prepare(`
        INSERT INTO payments (receipt_number, student_id, enrollment_id, billing_period, amount,
          payment_type, payment_method, payment_date, notes, received_by, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'transfer_out', 'transfer', ?, ?, ?, 'paid', datetime('now'), datetime('now'))
      `).run(receiptOut, data.studentId, data.fromEnrollmentId, nowDate.slice(0, 7), transferAmount, nowDate,
        `تحويل الرصيد إلى التسجيل ${data.toEnrollmentId}`, session.adminId)

      sqlite.prepare(`
        INSERT INTO payments (receipt_number, student_id, enrollment_id, billing_period, amount,
          payment_type, payment_method, payment_date, notes, received_by, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'transfer_in', 'transfer', ?, ?, ?, 'paid', datetime('now'), datetime('now'))
      `).run(receiptIn, data.studentId, data.toEnrollmentId, nowDate.slice(0, 7), transferAmount, nowDate,
        `تحويل الرصيد من التسجيل ${data.fromEnrollmentId}`, session.adminId)
    }

    // Mark source enrollment as transferred
    sqlite.prepare(`
      UPDATE enrollments SET status = 'completed', updated_at = datetime('now')
      WHERE id = ?
    `).run(data.fromEnrollmentId)

    // Ensure target enrollment is active
    sqlite.prepare(`
      UPDATE enrollments SET status = 'active', updated_at = datetime('now')
      WHERE id = ?
    `).run(data.toEnrollmentId)

    // Audit log
    sqlite.prepare(`
      INSERT INTO audit_logs (administrator_id, action, entity_type, entity_id, sanitized_details_json, created_at)
      VALUES (?, 'enrollment.transfer', 'enrollment', ?, ?, datetime('now'))
    `).run(session.adminId, data.fromEnrollmentId, JSON.stringify({
      fromEnrollmentId: data.fromEnrollmentId,
      toEnrollmentId: data.toEnrollmentId,
      transferredAmount: transferAmount,
    }))

    return {
      transferred: transferAmount,
      newFromBalance: currentFromBalance > 0 ? 0 : currentFromBalance,
      newToBalance: transferAmount,
    }
  })()
}

// ─── Cancel enrollment: refund remaining balance + mark completed ─────────────
// Requirement 39-42: Auditable enrollment refund, close enrollment, SQLite transaction

export async function cancelEnrollment(data: {
  enrollmentId: number
  studentId: number
  reason?: string
}): Promise<{ refunded: number }> {
  const session = requireSession()
  const sqlite = getSqlite()

  return sqlite.transaction(() => {
    const enroll = sqlite.prepare(`
      SELECT status, cancelled_at FROM enrollments WHERE id = ?
    `).get(data.enrollmentId) as any

    if (!enroll) throw new AppError(ErrorCode.NOT_FOUND, 'Enrollment not found')
    if (enroll.cancelled_at) {
      // Already cancelled, do not refund again (Requirement 41)
      return { refunded: 0 }
    }

    const fromBal = sqlite.prepare(`
      SELECT payment_type, session_id, SUM(amount) as total
      FROM payments
      WHERE enrollment_id = ? AND status = 'paid'
      GROUP BY payment_type, (session_id IS NOT NULL)
    `).all(data.enrollmentId) as any[]

    let totalCredit = 0
    let totalDebit = 0
    for (const r of fromBal) {
      const amt = r.total ?? 0
      if (['credit', 'payment', 'transfer_in', 'credit_transfer_in', 'session_refund'].includes(r.payment_type) ||
          (r.payment_type === 'refund' && r.session_id != null)) {
        totalCredit += amt
      } else if (['deduction', 'session_charge', 'transfer_out', 'credit_transfer_out', 'enrollment_refund'].includes(r.payment_type) ||
                 (r.payment_type === 'refund' && r.session_id == null)) {
        totalDebit += amt
      }
    }
    const currentBal = Math.round((totalCredit - totalDebit) * 100) / 100
    const refundAmount = Math.max(0, currentBal)

    const now = new Date().toISOString()
    const nowDate = now.slice(0, 10)

    if (refundAmount > 0) {
      const receiptNumber = `REF-${Date.now()}`
      sqlite.prepare(`
        INSERT INTO payments (receipt_number, student_id, enrollment_id, billing_period, amount,
          payment_type, payment_method, payment_date, notes, received_by, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'enrollment_refund', 'cash', ?, ?, ?, 'paid', datetime('now'), datetime('now'))
      `).run(receiptNumber, data.studentId, data.enrollmentId, nowDate.slice(0, 7),
        refundAmount, nowDate, data.reason ?? 'إلغاء التسجيل — استرداد الرصيد المتبقي', session.adminId)
    }

    sqlite.prepare(`
      UPDATE enrollments
      SET status = 'completed', cancelled_at = ?, cancel_reason = ?, refund_amount = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(now, data.reason ?? 'cancelled_by_admin', refundAmount, data.enrollmentId)

    sqlite.prepare(`
      INSERT INTO audit_logs (administrator_id, action, entity_type, entity_id, sanitized_details_json, created_at)
      VALUES (?, 'enrollment.cancel', 'enrollment', ?, ?, datetime('now'))
    `).run(session.adminId, data.enrollmentId, JSON.stringify({
      enrollmentId: data.enrollmentId,
      refundedAmount: refundAmount,
    }))

    log.info(`Enrollment ${data.enrollmentId} cancelled, refunded ${refundAmount} DA`)
    return { refunded: refundAmount }
  })()
}

// ─── Cancel payment (reversal without hard-deleting) ──────────────────────────
// Requirement 50: Never delete financial transactions

export async function cancelPayment(paymentId: number, reason?: string | null): Promise<{ success: boolean }> {
  const session = requireSession()
  const sqlite = getSqlite()

  return sqlite.transaction(() => {
    const original = sqlite.prepare(`SELECT * FROM payments WHERE id = ?`).get(paymentId) as any
    if (!original) throw new AppError(ErrorCode.PAYMENT_NOT_FOUND, 'Payment not found')
    if (original.status === 'cancelled') throw new AppError(ErrorCode.PAYMENT_ALREADY_CANCELLED, 'Already cancelled')

    sqlite.prepare(`
      UPDATE payments SET status = 'cancelled', notes = COALESCE(notes || ' | ', '') || ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(`Cancelled: ${reason ?? 'Cancelled by admin'}`, paymentId)

    sqlite.prepare(`
      INSERT INTO audit_logs (administrator_id, action, entity_type, entity_id, sanitized_details_json, created_at)
      VALUES (?, 'payment.cancel', 'payment', ?, ?, datetime('now'))
    `).run(session.adminId, paymentId, JSON.stringify({ receiptNumber: original.receipt_number, amount: original.amount, reason }))

    return { success: true }
  })()
}

// ─── Refund remaining balance (cancel enrollment) ────────────────────────────

export async function refundEnrollment(data: {
  enrollmentId: number
  studentId: number
  notes?: string
}): Promise<{ refunded: number }> {
  const session = requireSession()
  const sqlite = getSqlite()

  const bal = await getEnrollmentBalance(data.enrollmentId)
  if (bal.balance <= 0) return { refunded: 0 }

  const receiptNumber = await generateReceiptNumber()
  const now = new Date().toISOString().slice(0, 10)

  sqlite.prepare(`
    INSERT INTO payments (receipt_number, student_id, enrollment_id, billing_period, amount,
      payment_type, payment_method, payment_date, notes, received_by, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'refund', 'cash', ?, ?, ?, 'paid', datetime('now'), datetime('now'))
  `).run(receiptNumber, data.studentId, data.enrollmentId, now.slice(0,7), bal.balance, now,
    data.notes ?? 'Enrollment cancelled — balance refunded', session.adminId)

  log.info(`Refund: ${bal.balance} DA for enrollment ${data.enrollmentId}`)
  return { refunded: bal.balance }
}

// ─── List payments (top-ups only for receipt listing) ─────────────────────────

export async function listPayments(opts: {
  page?: number
  pageSize?: number
  search?: string
  studentId?: number
  type?: string
  allTypes?: boolean
}): Promise<PaginatedResult<any>> {
  const sqlite = getSqlite()
  const page = Math.max(1, opts.page ?? 1)
  const pageSize = Math.min(500, Math.max(1, opts.pageSize ?? 50))
  const offset = (page - 1) * pageSize

  let where = "WHERE 1=1"
  const params: any[] = []

  if (opts.studentId) {
    where += " AND p.student_id = ?"
    params.push(opts.studentId)
  }

  if (opts.search && opts.search.trim()) {
    const q = `%${opts.search.trim()}%`
    where += ` AND (
      p.receipt_number LIKE ?
      OR s.last_name_ar LIKE ?
      OR s.first_name_ar LIKE ?
      OR s.last_name_fr LIKE ?
      OR s.first_name_fr LIKE ?
      OR s.student_number LIKE ?
      OR g.name LIKE ?
      OR c.name_fr LIKE ?
      OR c.name_ar LIKE ?
      OR p.reference LIKE ?
      OR p.notes LIKE ?
      OR p.billing_period LIKE ?
    )`
    params.push(q, q, q, q, q, q, q, q, q, q, q, q)
  }

  if (opts.type && opts.type !== 'all') {
    where += " AND p.payment_type = ?"
    params.push(opts.type)
  } else if (!opts.allTypes && opts.type !== 'all') {
    where += " AND p.payment_type = 'credit'" // Default: only show top-ups in main list
  }

  const rows = sqlite.prepare(`
    SELECT p.*, s.last_name_ar, s.first_name_ar, s.last_name_fr, s.first_name_fr, s.student_number,
           g.name as group_name, c.name_ar as course_name_ar, c.name_fr as course_name_fr
    FROM payments p
    LEFT JOIN students s ON p.student_id = s.id
    LEFT JOIN enrollments e ON p.enrollment_id = e.id
    LEFT JOIN groups g ON e.group_id = g.id
    LEFT JOIN courses c ON g.course_id = c.id
    ${where}
    ORDER BY p.payment_date DESC, p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset) as any[]

  const total = (sqlite.prepare(`
    SELECT COUNT(*) as cnt FROM payments p
    LEFT JOIN students s ON p.student_id = s.id
    LEFT JOIN enrollments e ON p.enrollment_id = e.id
    LEFT JOIN groups g ON e.group_id = g.id
    LEFT JOIN courses c ON g.course_id = c.id
    ${where}
  `).get(...params) as any)?.cnt ?? 0

  return {
    items: rows.map(mapRawRow),
    total,
    page,
    pageSize,
  }
}

// ─── Legacy createPayment → now maps to topUpCredit ──────────────────────────

export async function createPayment(data: {
  studentId: number
  enrollmentId: number
  billingPeriod?: string
  amount: number
  paymentMethod: 'cash' | 'transfer' | 'check'
  paymentDate: string
  reference?: string | null
  notes?: string | null
}): Promise<Payment> {
  return topUpCredit({
    studentId: data.studentId,
    enrollmentId: data.enrollmentId,
    amount: data.amount,
    paymentMethod: data.paymentMethod,
    paymentDate: data.paymentDate,
    reference: data.reference,
    notes: data.notes,
  }) as any
}



// ─── Get all payments for a student ──────────────────────────────────────────

export async function getPaymentsByStudent(studentId: number): Promise<any[]> {
  const sqlite = getSqlite()
  const rows = sqlite.prepare(`
    SELECT p.*, s.last_name_fr, s.first_name_fr, s.last_name_ar, s.first_name_ar, s.student_number,
           g.name as group_name, c.name_ar as course_name_ar, c.name_fr as course_name_fr
    FROM payments p
    LEFT JOIN students s ON p.student_id = s.id
    LEFT JOIN enrollments e ON p.enrollment_id = e.id
    LEFT JOIN groups g ON e.group_id = g.id
    LEFT JOIN courses c ON g.course_id = c.id
    WHERE p.student_id = ?
    ORDER BY p.payment_date DESC, p.created_at DESC
  `).all(studentId) as any[]
  return rows.map(mapRawRow)
}

// ─── Calendar Month Prepaid Tuition & Debt Calculation ────────────────────────

export function calculateMonthsElapsed(startDateStr: string, endDateStr?: string | null): number {
  if (!startDateStr) return 1
  const start = new Date(startDateStr.slice(0, 10) + 'T00:00:00Z')
  const now = new Date()
  const currentMonthDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))

  let targetDate = currentMonthDate
  if (endDateStr) {
    const end = new Date(endDateStr.slice(0, 10) + 'T00:00:00Z')
    const endMonthDate = new Date(Date.UTC(end.getFullYear(), end.getMonth(), 1))
    if (endMonthDate < targetDate) {
      targetDate = endMonthDate
    }
  }

  const startYear = start.getUTCFullYear()
  const startMonth = start.getUTCMonth()
  const targetYear = targetDate.getUTCFullYear()
  const targetMonth = targetDate.getUTCMonth()

  const diff = (targetYear - startYear) * 12 + (targetMonth - startMonth) + 1
  return Math.max(1, diff)
}

export async function calculateStudentTuitionDebt(studentId: number): Promise<{
  studentId: number
  totalDebt: number
  totalPaid: number
  totalDue: number
  monthsOverdue: number
  status: 'up_to_date' | 'overdue' | 'advance'
  enrollments: any[]
}> {
  const sqlite = getSqlite()

  const enrollments = sqlite.prepare(`
    SELECT e.*, g.name as group_name, g.start_date as group_start_date, g.end_date as group_end_date,
           c.name_fr as course_name_fr, c.name_ar as course_name_ar
    FROM enrollments e
    JOIN groups g ON e.group_id = g.id
    JOIN courses c ON g.course_id = c.id
    WHERE e.student_id = ? AND e.status = 'active'
  `).all(studentId) as any[]

  let totalStudentDue = 0
  let totalStudentPaid = 0
  const enrollmentDetails: any[] = []

  for (const en of enrollments) {
    const start = en.enrollment_date || en.group_start_date
    const months = calculateMonthsElapsed(start, en.group_end_date)
    const agreedPrice = Number(en.agreed_price) || 0
    const totalDue = months * agreedPrice

    const paidRow = sqlite.prepare(`
      SELECT COALESCE(SUM(amount), 0) as paid
      FROM payments
      WHERE enrollment_id = ? AND payment_type = 'credit' AND status = 'paid'
    `).get(en.id) as any

    const totalPaid = Number(paidRow?.paid ?? 0)
    const balance = totalPaid - totalDue
    const debt = balance < 0 ? Math.abs(balance) : 0
    const monthsOverdue = agreedPrice > 0 ? Math.ceil(debt / agreedPrice) : 0
    const status = debt > 0 ? 'overdue' : (balance > 0 ? 'advance' : 'up_to_date')

    totalStudentDue += totalDue
    totalStudentPaid += totalPaid

    enrollmentDetails.push({
      enrollmentId: en.id,
      groupId: en.group_id,
      groupName: en.group_name,
      courseName: en.course_name_fr || en.course_name_ar,
      agreedPrice,
      enrollmentDate: en.enrollment_date,
      monthsBilled: months,
      totalDue,
      totalPaid,
      balance,
      debt,
      monthsOverdue,
      status,
    })
  }

  const netBalance = totalStudentPaid - totalStudentDue
  const totalDebt = netBalance < 0 ? Math.abs(netBalance) : 0
  const overallStatus = totalDebt > 0 ? 'overdue' : (netBalance > 0 ? 'advance' : 'up_to_date')
  const maxMonthsOverdue = enrollmentDetails.reduce((max, e) => Math.max(max, e.monthsOverdue), 0)

  return {
    studentId,
    totalDebt,
    totalPaid: totalStudentPaid,
    totalDue: totalStudentDue,
    monthsOverdue: maxMonthsOverdue,
    status: overallStatus,
    enrollments: enrollmentDetails,
  }
}

export async function getStudentsDebtReport(): Promise<any[]> {
  const sqlite = getSqlite()

  const students = sqlite.prepare(`
    SELECT s.id, s.student_number, s.first_name_fr, s.last_name_fr,
           s.first_name_ar, s.last_name_ar, s.phone, s.status
    FROM students s
    WHERE s.status = 'active'
    ORDER BY s.last_name_fr ASC, s.first_name_fr ASC
  `).all() as any[]

  const report: any[] = []

  for (const s of students) {
    const debtInfo = await calculateStudentTuitionDebt(s.id)
    if (debtInfo.enrollments.length === 0) continue

    const lastPayment = sqlite.prepare(`
      SELECT payment_date, amount FROM payments
      WHERE student_id = ? AND payment_type = 'credit' AND status = 'paid'
      ORDER BY payment_date DESC, created_at DESC
      LIMIT 1
    `).get(s.id) as any

    report.push({
      studentId: s.id,
      studentNumber: s.student_number,
      firstNameFr: s.first_name_fr,
      lastNameFr: s.last_name_fr,
      firstNameAr: s.first_name_ar,
      lastNameAr: s.last_name_ar,
      phone: s.phone,
      totalDebt: debtInfo.totalDebt,
      totalPaid: debtInfo.totalPaid,
      totalDue: debtInfo.totalDue,
      monthsOverdue: debtInfo.monthsOverdue,
      status: debtInfo.status,
      enrollments: debtInfo.enrollments,
      lastPaymentDate: lastPayment?.payment_date,
      lastPaymentAmount: lastPayment?.amount,
    })
  }

  return report
}

// ─── Payment summary for dashboard (using calendar month debt engine) ────────

export async function getPaymentsSummary(): Promise<{
  monthRevenue: number
  todayCollected: number
  outstanding: number
  overdue: number
}> {
  const sqlite = getSqlite()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'

  const monthCredit = (sqlite.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM payments
    WHERE payment_type='credit' AND status='paid' AND payment_date >= ?
  `).get(monthStart) as any)?.total ?? 0

  const todayCredit = (sqlite.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM payments
    WHERE payment_type='credit' AND status='paid' AND payment_date = ?
  `).get(today) as any)?.total ?? 0

  // Calculate real outstanding tuition debt across all active students
  const debtReport = await getStudentsDebtReport()
  const totalOutstandingDebt = debtReport.reduce((acc, item) => acc + item.totalDebt, 0)
  const totalOverdueStudentsCount = debtReport.filter(item => item.totalDebt > 0).length

  return {
    monthRevenue: monthCredit,
    todayCollected: todayCredit,
    outstanding: totalOutstandingDebt,
    overdue: totalOverdueStudentsCount,
  }
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function mapPaymentRow(r: any): any {
  return {
    id: r.id,
    receiptNumber: r.receiptNumber ?? r.receipt_number,
    studentId: r.studentId ?? r.student_id,
    enrollmentId: r.enrollmentId ?? r.enrollment_id,
    billingPeriod: r.billingPeriod ?? r.billing_period ?? '',
    amount: r.amount,
    paymentType: r.paymentType ?? r.payment_type ?? 'credit',
    paymentMethod: r.paymentMethod ?? r.payment_method ?? '',
    paymentDate: r.paymentDate ?? r.payment_date,
    reference: r.reference ?? null,
    notes: r.notes ?? null,
    receivedBy: r.receivedBy ?? r.received_by,
    status: r.status,
    createdAt: r.createdAt ?? r.created_at,
    updatedAt: r.updatedAt ?? r.updated_at,
  }
}

function mapRawRow(r: any): any {
  return {
    ...mapPaymentRow(r),
    studentName: r.last_name_ar ? `${r.last_name_ar} ${r.first_name_ar}` : undefined,
    studentNumber: r.student_number,
    groupName: r.group_name,
    courseNameAr: r.course_name_ar,
    courseNameFr: r.course_name_fr,
    courseName: r.course_name_ar ? `${r.course_name_ar} (${r.course_name_fr})` : r.course_name_fr,
  }
}
