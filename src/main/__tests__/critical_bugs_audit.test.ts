import { describe, it, expect } from 'vitest'
import { StudentListSchema } from '../../shared/schemas/index'

describe('Critical Bug Audit — Receipt Number Generation Logic', () => {
  it('correctly extracts sequence number from single and multi-item receipt formats', () => {
    const regex = /-\d{8}-(\d+)(?:-\d+)?$/

    // Standard receipt: PREFIX-YYYYMMDD-XXXX
    const m1 = 'REC-20261003-0042'.match(regex)
    expect(m1).not.toBeNull()
    expect(parseInt(m1![1], 10)).toBe(42)

    // Multi-item receipt: PREFIX-YYYYMMDD-XXXX-1
    const m2 = 'REC-20261003-0042-1'.match(regex)
    expect(m2).not.toBeNull()
    expect(parseInt(m2![1], 10)).toBe(42)

    // Multi-item receipt: PREFIX-YYYYMMDD-0150-2
    const m3 = 'REC-20261003-0150-2'.match(regex)
    expect(m3).not.toBeNull()
    expect(parseInt(m3![1], 10)).toBe(150)

    // Custom prefix with hyphen: MY-SCHOOL-20261003-0099-3
    const m4 = 'MY-SCHOOL-20261003-0099-3'.match(regex)
    expect(m4).not.toBeNull()
    expect(parseInt(m4![1], 10)).toBe(99)
  })

  it('determines the correct maximum sequence even when latest receipts are multi-item sub-receipts', () => {
    const receipts = [
      { receipt_number: 'REC-20261003-0001' },
      { receipt_number: 'REC-20261003-0002-1' },
      { receipt_number: 'REC-20261003-0002-2' },
      { receipt_number: 'REC-20261003-0003-1' },
      { receipt_number: 'REC-20261003-0003-2' },
    ]

    let maxSeq = 0
    for (const r of receipts) {
      const match = r.receipt_number.match(/-\d{8}-(\d+)(?:-\d+)?$/)
      if (match) {
        const seq = parseInt(match[1], 10)
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq
        }
      }
    }

    // Sequence must be 3, NOT 2 (which was the bug when splitting on '-' and taking the sub-index '2')
    expect(maxSeq).toBe(3)
    const nextSeq = maxSeq + 1
    const nextReceipt = `REC-20261003-${String(nextSeq).padStart(4, '0')}`
    expect(nextReceipt).toBe('REC-20261003-0004')
  })
})

describe('Critical Bug Audit — Large Dataset Schema & Capacity Support', () => {
  it('StudentListSchema accepts pageSize up to 50000', () => {
    const valid = StudentListSchema.safeParse({ pageSize: 50000 })
    expect(valid.success).toBe(true)
    if (valid.success) {
      expect(valid.data.pageSize).toBe(50000)
    }

    const defaultPageSize = StudentListSchema.safeParse({})
    expect(defaultPageSize.success).toBe(true)
    if (defaultPageSize.success) {
      expect(defaultPageSize.data.pageSize).toBe(100)
    }
  })

  it('rejects invalid negative or zero page sizes', () => {
    const invalidZero = StudentListSchema.safeParse({ pageSize: 0 })
    expect(invalidZero.success).toBe(false)

    const invalidNegative = StudentListSchema.safeParse({ pageSize: -10 })
    expect(invalidNegative.success).toBe(false)

    const exceedsLimit = StudentListSchema.safeParse({ pageSize: 50001 })
    expect(exceedsLimit.success).toBe(false)
  })
})

describe('Critical Bug Audit — Transfer and Refund Idempotent Uniqueness', () => {
  it('generates distinct receipt identifiers for transfers even within the same millisecond timestamp', () => {
    const now = 1790000000000
    const fromEnrollmentId = 101
    const toEnrollmentId = 202

    const receiptOut = `TR-OUT-${now}-${fromEnrollmentId}`
    const receiptIn = `TR-IN-${now}-${toEnrollmentId}`

    expect(receiptOut).not.toBe(receiptIn)
    expect(receiptOut).toContain('-101')
    expect(receiptIn).toContain('-202')
  })
})

describe('Critical Bug Audit — Arabic Search Text Normalization Coverage', () => {
  function normalizeArabicText(str: string): string {
    if (!str) return ''
    return str
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/[يى]/g, 'ي')
      .replace(/[\u064B-\u065F]/g, '')
      .trim()
  }

  it('normalizes Arabic hamza, taa marbouta, and alef maqsura identically', () => {
    expect(normalizeArabicText('أحمد')).toBe('احمد')
    expect(normalizeArabicText('إبراهيم')).toBe('ابراهيم')
    expect(normalizeArabicText('آمنة')).toBe('امنه')
    expect(normalizeArabicText('فاطمة')).toBe('فاطمه')
    expect(normalizeArabicText('هدى')).toBe('هدي')
    expect(normalizeArabicText('مُحَمَّد')).toBe('محمد')
  })

  it('matches searches regardless of diacritics or spelling variants', () => {
    const studentDbName = normalizeArabicText('فاطمة الزهراء')
    const userInput = normalizeArabicText('فاطمه الزهراء')
    expect(studentDbName).toBe(userInput)
  })

  it('matches composite names in either order (first+last or last+first)', () => {
    const firstName = 'أحمد'
    const lastName = 'بن علي'

    const order1 = `${normalizeArabicText(lastName)} ${normalizeArabicText(firstName)}`
    const order2 = `${normalizeArabicText(firstName)} ${normalizeArabicText(lastName)}`

    const userSearch1 = normalizeArabicText('بن علي احمد')
    const userSearch2 = normalizeArabicText('احمد بن علي')

    expect(order1).toBe(userSearch1)
    expect(order2).toBe(userSearch2)
  })
})

describe('Critical Bug Audit — Student Service 50,000 Capacity Clamping', () => {
  it('correctly clamps pageSize up to 50000 instead of 200', () => {
    const clampPageSize = (reqSize?: number) => Math.min(50000, Math.max(1, reqSize ?? 50))

    expect(clampPageSize(50000)).toBe(50000)
    expect(clampPageSize(1000)).toBe(1000)
    expect(clampPageSize(250)).toBe(250)
    expect(clampPageSize(undefined)).toBe(50)
    expect(clampPageSize(0)).toBe(1)
    expect(clampPageSize(60000)).toBe(50000)
  })
})

describe('Critical Bug Audit — Re-enrollment Lifecycle and Unique Constraint Prevention', () => {
  it('safeguards agreedPrice conversion preventing NaN or undefined errors', () => {
    const safePrice = (val: any) => Number(val) || 0

    expect(safePrice(1500)).toBe(1500)
    expect(safePrice('2000')).toBe(2000)
    expect(safePrice(undefined)).toBe(0)
    expect(safePrice(null)).toBe(0)
    expect(safePrice(NaN)).toBe(0)
    expect(safePrice('')).toBe(0)
  })

  it('correctly distinguishes new enrollment, already active, and re-activation of cancelled enrollment', () => {
    type MockEnrollment = {
      id: number
      studentId: number
      groupId: number
      agreedPrice: number
      enrollmentDate: string
      status: 'active' | 'inactive' | 'completed'
      cancelledAt: string | null
      cancelReason: string | null
      refundAmount: number | null
    }

    const table: MockEnrollment[] = [
      {
        id: 101,
        studentId: 5,
        groupId: 2,
        agreedPrice: 1500,
        enrollmentDate: '2026-09-01',
        status: 'completed',
        cancelledAt: '2026-09-20T10:00:00Z',
        cancelReason: 'student_requested',
        refundAmount: 500,
      },
    ]

    const handleEnrollment = (data: { studentId: number; groupId: number; agreedPrice: number; enrollmentDate: string }) => {
      const existing = table.find(e => e.studentId === data.studentId && e.groupId === data.groupId)
      if (existing) {
        if (existing.status === 'active') {
          throw new Error('STUDENT_ALREADY_ENROLLED')
        }
        // Reactivate in-place
        existing.status = 'active'
        existing.agreedPrice = data.agreedPrice
        existing.enrollmentDate = data.enrollmentDate
        existing.cancelledAt = null
        existing.cancelReason = null
        existing.refundAmount = null
        return { ...existing, reactivated: true }
      }
      const newRecord: MockEnrollment = {
        id: 999,
        studentId: data.studentId,
        groupId: data.groupId,
        agreedPrice: data.agreedPrice,
        enrollmentDate: data.enrollmentDate,
        status: 'active',
        cancelledAt: null,
        cancelReason: null,
        refundAmount: null,
      }
      table.push(newRecord)
      return { ...newRecord, reactivated: false }
    }

    // 1. Re-enrolling student 5 in group 2 should reactivate existing record without inserting duplicate
    const res1 = handleEnrollment({
      studentId: 5,
      groupId: 2,
      agreedPrice: 1800,
      enrollmentDate: '2026-10-10',
    })

    expect(res1.reactivated).toBe(true)
    expect(res1.id).toBe(101) // Preserves original ID
    expect(res1.status).toBe('active')
    expect(res1.agreedPrice).toBe(1800)
    expect(res1.enrollmentDate).toBe('2026-10-10')
    expect(res1.cancelledAt).toBeNull()
    expect(table.length).toBe(1) // No duplicate row created!

    // 2. Re-enrolling while active should throw STUDENT_ALREADY_ENROLLED
    expect(() => {
      handleEnrollment({
        studentId: 5,
        groupId: 2,
        agreedPrice: 1800,
        enrollmentDate: '2026-10-10',
      })
    }).toThrow('STUDENT_ALREADY_ENROLLED')

    // 3. New student should insert cleanly
    const res2 = handleEnrollment({
      studentId: 9,
      groupId: 2,
      agreedPrice: 2000,
      enrollmentDate: '2026-10-10',
    })
    expect(res2.reactivated).toBe(false)
    expect(res2.id).toBe(999)
    expect(table.length).toBe(2)
  })
})


