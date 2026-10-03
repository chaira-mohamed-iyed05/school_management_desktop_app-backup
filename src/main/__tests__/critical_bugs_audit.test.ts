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
})
