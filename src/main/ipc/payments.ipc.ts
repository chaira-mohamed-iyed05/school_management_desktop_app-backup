import { handle } from './_handler'
import { IPC_CHANNELS } from '../../shared/constants/index'
import {
  listPayments, createPayment, cancelPayment, getPaymentsByStudent,
  topUpCredit, deductSession, transferBalance, refundEnrollment,
  cancelEnrollment,
  getEnrollmentBalance, getStudentBalance, getPaymentsSummary,
  getStudentsDebtReport, calculateStudentTuitionDebt,
} from '../services/payment.service'
import { z } from 'zod'

export function registerPaymentHandlers(): void {
  handle(IPC_CHANNELS.PAYMENTS_LIST, async (payload) => {
    const opts = z.object({
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(1000).optional(),
      search: z.string().max(200).optional(),
      studentId: z.number().int().positive().optional(),
      type: z.string().optional(),
    }).parse(payload ?? {})
    return listPayments(opts)
  })

  handle(IPC_CHANNELS.PAYMENTS_CREATE, async (payload) => {
    const data = z.object({
      studentId: z.number().int().positive(),
      enrollmentId: z.number().int().positive(),
      billingPeriod: z.string().optional(),
      amount: z.number().min(0),
      paymentMethod: z.enum(['cash', 'transfer', 'check']),
      paymentDate: z.string(),
      reference: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }).parse(payload)
    return createPayment(data as any)
  })

  handle(IPC_CHANNELS.PAYMENTS_CANCEL, async (payload) => {
    const { id, reason } = z.object({
      id: z.number().int().positive(),
      reason: z.string().nullable().optional(),
    }).parse(payload)
    await cancelPayment(id, reason)
    return true
  })

  handle(IPC_CHANNELS.PAYMENTS_BY_STUDENT, async (payload) => {
    const { studentId } = z.object({ studentId: z.number().int().positive() }).parse(payload)
    return getPaymentsByStudent(studentId)
  })

  handle('payments:debtReport', async () => {
    return getStudentsDebtReport()
  })

  handle('payments:studentDebt', async (payload) => {
    const { studentId } = z.object({ studentId: z.number().int().positive() }).parse(payload)
    return calculateStudentTuitionDebt(studentId)
  })

  handle('payments:studentBalance', async (payload) => {
    const { studentId } = z.object({ studentId: z.number().int().positive() }).parse(payload)
    return getStudentBalance(studentId)
  })

  // ─── Credit ledger endpoints ────────────────────────────────────────────────

  handle('payments:topUp', async (payload) => {
    const data = z.object({
      studentId: z.number().int().positive(),
      enrollmentId: z.number().int().positive(),
      amount: z.number().positive(),
      paymentMethod: z.enum(['cash', 'transfer', 'check']),
      paymentDate: z.string(),
      reference: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }).parse(payload)
    return topUpCredit(data)
  })

  handle('payments:deductSession', async (payload) => {
    const data = z.object({
      studentId: z.number().int().positive(),
      enrollmentId: z.number().int().positive(),
      sessionId: z.number().int().positive(),
      sessionDate: z.string(),
      sessionPrice: z.number().min(0),
    }).parse(payload)
    return deductSession(data)
  })

  handle('payments:transfer', async (payload) => {
    const data = z.object({
      fromEnrollmentId: z.number().int().positive(),
      toEnrollmentId: z.number().int().positive(),
      studentId: z.number().int().positive(),
      amount: z.number().positive().optional(),
    }).parse(payload)
    return transferBalance(data)
  })

  handle('payments:refund', async (payload) => {
    const data = z.object({
      enrollmentId: z.number().int().positive(),
      studentId: z.number().int().positive(),
      notes: z.string().optional(),
    }).parse(payload)
    return refundEnrollment(data)
  })

  handle('payments:balance', async (payload) => {
    const { enrollmentId } = z.object({ enrollmentId: z.number().int().positive() }).parse(payload)
    return getEnrollmentBalance(enrollmentId)
  })

  handle('payments:summary', async () => {
    return getPaymentsSummary()
  })

  // Cancel enrollment — refund remaining balance + mark completed
  handle('payments:cancelEnrollment', async (payload) => {
    const data = z.object({
      enrollmentId: z.number().int().positive(),
      studentId: z.number().int().positive(),
      reason: z.string().optional(),
    }).parse(payload)
    return cancelEnrollment(data)
  })

  // All payment types listing (for reports / transaction log)
  handle('payments:listAll', async (payload) => {
    const opts = z.object({
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(2000).optional(),
      studentId: z.number().int().positive().optional(),
    }).parse(payload ?? {})
    return listPayments({ ...opts, allTypes: true })
  })
}
