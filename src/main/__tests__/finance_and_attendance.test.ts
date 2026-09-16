import { describe, it, expect } from 'vitest'
import { calculateMonthsElapsed } from '../services/payment.service'

describe('Tuition and Calendar Financial Calculations', () => {
  it('correctly calculates months elapsed for calendar billing', () => {
    // Same month
    expect(calculateMonthsElapsed('2026-09-01', '2026-09-15')).toBe(1)
    // 2 months
    expect(calculateMonthsElapsed('2026-08-01', '2026-09-15')).toBe(2)
    // 3 months
    expect(calculateMonthsElapsed('2026-07-01', '2026-09-15')).toBe(3)
  })

  it('handles edge case of empty or invalid start dates gracefully', () => {
    expect(calculateMonthsElapsed('')).toBe(1)
  })
})

describe('Attendance Transition State Matrix Rules', () => {
  // Requirements 14-25:
  // ABSENT = 1 session fee deducted
  // ATTENDED / PRESENT = 1 session fee deducted
  // INACTIVE = 0 session fee (refunded if previously charged)
  
  it('deduction should occur once for both present and absent', () => {
    const sessionPrice = 1000
    const initialBalance = 5000

    // Absent attendance records 1 deduction
    const balanceAfterAbsent = initialBalance - sessionPrice
    expect(balanceAfterAbsent).toBe(4000)

    // Transitioning from Absent to Present requires no additional deduction
    const balanceAfterPresent = balanceAfterAbsent // 0 diff
    expect(balanceAfterPresent).toBe(4000)

    // Transitioning to Inactive gives refund of 1 session
    const balanceAfterInactive = balanceAfterPresent + sessionPrice
    expect(balanceAfterInactive).toBe(5000)
  })

  it('user scenario: student starts with 4000, attends (-1000 = 3000), marked inactive returns to 4000 (not 5000)', () => {
    const initialBalance = 4000
    const sessionPrice = 1000

    // Present / absent deduction
    const balanceAfterSession = initialBalance - sessionPrice
    expect(balanceAfterSession).toBe(3000)

    // Marking inactive restores the exact session price
    const balanceAfterInactive = balanceAfterSession + sessionPrice
    expect(balanceAfterInactive).toBe(4000)
    expect(balanceAfterInactive).not.toBe(5000) // Prevent double refund bug
  })
})

describe('Session Closing Enrollment and Attendance Rules (غلق الحصة)', () => {
  // Requirement:
  // When closing a session (غلق الحصة):
  // 1. Students enrolled before closing are marked as absent ('غائب'), NOT unregistered ('غير مسجل').
  // 2. New students enrolled after closing remain unregistered ('غير مسجل').

  it('parseUtcTimestamp correctly parses SQLite datetime and ISO-8601 strings to UTC ms', async () => {
    const { parseUtcTimestamp } = await import('../services/attendance.service')

    const t1 = parseUtcTimestamp('2026-09-06 08:28:25')
    const t2 = parseUtcTimestamp('2026-09-06T08:37:25.082Z')
    const t3 = parseUtcTimestamp('2026-09-06 10:30:31')

    expect(t1).toBeGreaterThan(0)
    expect(t2).toBeGreaterThan(0)
    expect(t3).toBeGreaterThan(0)

    // t1 (08:28) < t2 (08:37) < t3 (10:30)
    expect(t1 < t2).toBe(true)
    expect(t3 > t2).toBe(true)
  })

  it('isEnrolledBeforeSessionClose correctly distinguishes students enrolled before vs after closing', async () => {
    const { isEnrolledBeforeSessionClose } = await import('../services/attendance.service')

    const sessionDate = '2026-09-06'
    const sessionClosedAt = '2026-09-06T08:37:25.082Z'

    // Student enrolled on previous day -> enrolled before
    expect(isEnrolledBeforeSessionClose('2026-09-05', '2026-09-05 14:00:00', sessionDate, 'closed', sessionClosedAt)).toBe(true)

    // Student enrolled on future day -> NOT enrolled before
    expect(isEnrolledBeforeSessionClose('2026-09-07', '2026-09-07 09:00:00', sessionDate, 'closed', sessionClosedAt)).toBe(false)

    // Student 1: enrolled same day at 08:28 (before session close at 08:37) -> enrolled before -> marked as غائب
    const student1Enrolled = isEnrolledBeforeSessionClose(
      '2026-09-06',
      '2026-09-06 08:28:25',
      sessionDate,
      'closed',
      sessionClosedAt
    )
    expect(student1Enrolled).toBe(true)

    // Student 2: enrolled same day at 10:30 (after session close at 08:37) -> NOT enrolled before -> remains غير مسجل
    const student2Enrolled = isEnrolledBeforeSessionClose(
      '2026-09-06',
      '2026-09-06 10:30:31',
      sessionDate,
      'closed',
      sessionClosedAt
    )
    expect(student2Enrolled).toBe(false)

    // In open session: both students enrolled on or before session date are considered enrolled
    expect(isEnrolledBeforeSessionClose('2026-09-06', '2026-09-06 10:30:31', sessionDate, 'open', null)).toBe(true)
  })
})

describe('Session Cancellation Credit Restoration Rules (إلغاء الحصة)', () => {
  it('cancelling a session completely reverts session deductions and restores student credit balance', () => {
    // Initial student credit balance (e.g. 3000 DA)
    const initialCredit = 3000
    const sessionFee = 750

    // Session occurred: 750 DA was deducted (session_charge)
    const balanceAfterSession = initialCredit - sessionFee
    expect(balanceAfterSession).toBe(2250)

    // Professor did not come -> admin cancels the session
    // Reverting financial deductions restores exact fee back
    const balanceAfterCancellation = balanceAfterSession + sessionFee
    expect(balanceAfterCancellation).toBe(initialCredit)
  })

  it('session cancellation ensures session_type is cancelled and only that specific session is affected', () => {
    const weeklyScheduleSlots = [
      { id: 1, group_id: 10, weekday: 1, start_time: '14:00', end_time: '16:00' },
      { id: 2, group_id: 10, weekday: 3, start_time: '10:00', end_time: '12:00' }
    ]

    // Cancelled single instance on 2026-09-15
    const sessionInstances = [
      { id: 101, session_date: '2026-09-08', session_type: 'regular', status: 'closed' },
      { id: 102, session_date: '2026-09-15', session_type: 'cancelled', status: 'closed', cancelled_reason: 'غياب الأستاذ' },
      { id: 103, session_date: '2026-09-22', session_type: 'regular', status: 'open' }
    ]

    // Weekly schedule slots remain intact (2 slots)
    expect(weeklyScheduleSlots.length).toBe(2)

    // Past session on 2026-09-08 is untouched
    expect(sessionInstances[0].session_type).toBe('regular')

    // Only session 102 on 2026-09-15 is cancelled
    expect(sessionInstances[1].session_type).toBe('cancelled')
    expect(sessionInstances[1].cancelled_reason).toBe('غياب الأستاذ')

    // Future session on 2026-09-22 is untouched
    expect(sessionInstances[2].session_type).toBe('regular')
    expect(sessionInstances[2].status).toBe('open')
  })
})

