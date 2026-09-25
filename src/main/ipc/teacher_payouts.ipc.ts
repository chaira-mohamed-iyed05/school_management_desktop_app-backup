import { handle } from './_handler'
import { z } from 'zod'
import {
  getTeacherPayoutMatrix,
  executeTeacherPayout,
  listTeacherPayouts,
  getPayoutReceiptDetails,
} from '../services/teacher_payout.service'

export function registerTeacherPayoutHandlers(): void {
  handle('teachers:payoutMatrix', async (payload) => {
    const { groupId } = z.object({
      groupId: z.number().int().positive(),
    }).parse(payload)
    return getTeacherPayoutMatrix(groupId)
  })

  handle('teachers:executePayout', async (payload) => {
    const data = z.object({
      groupId: z.number().int().positive(),
      sessionIds: z.array(z.number().int().positive()).optional(),
      percentage: z.number().min(1).max(100),
      paymentMethod: z.enum(['cash', 'transfer', 'check']).optional(),
      notes: z.string().nullable().optional(),
    }).parse(payload)
    return executeTeacherPayout(data)
  })

  handle('teachers:listPayouts', async (payload) => {
    const filters = z.object({
      teacherId: z.number().int().positive().optional(),
      groupId: z.number().int().positive().optional(),
    }).optional().parse(payload ?? {})
    return listTeacherPayouts(filters)
  })

  handle('teachers:getPayoutReceipt', async (payload) => {
    const { payoutId } = z.object({
      payoutId: z.number().int().positive(),
    }).parse(payload)
    return getPayoutReceiptDetails(payoutId)
  })
}
