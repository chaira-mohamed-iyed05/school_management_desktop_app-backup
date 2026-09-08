import { eq } from 'drizzle-orm'
import { getDb, schema } from '../database/connection'
import { requireSession } from './auth.service'
import type { SchoolSettings } from '../../shared/types/index'

function mapRow(r: typeof schema.schoolSettings.$inferSelect): SchoolSettings {
  return {
    id: r.id,
    schoolNameAr: r.schoolNameAr,
    schoolNameFr: r.schoolNameFr,
    schoolNameEn: r.schoolNameEn,
    phone: r.phone ?? null,
    email: r.email ?? null,
    address: r.address ?? null,
    academicYear: r.academicYear,
    currency: r.currency,
    studentNumberPrefix: r.studentNumberPrefix,
    receiptPrefix: r.receiptPrefix,
    defaultLanguage: r.defaultLanguage as SchoolSettings['defaultLanguage'],
    backupDirectory: r.backupDirectory ?? null,
    automaticBackupEnabled: r.automaticBackupEnabled,
    backupsToRetain: r.backupsToRetain,
    updatedAt: r.updatedAt,
  }
}

export async function getSettings(): Promise<SchoolSettings | null> {
  const db = getDb()
  const row = await db.query.schoolSettings.findFirst()
  return row ? mapRow(row) : null
}

export async function updateSettings(data: Partial<{
  schoolNameAr: string
  schoolNameFr: string
  schoolNameEn: string
  phone: string | null
  email: string | null
  address: string | null
  academicYear: string
  currency: string
  defaultLanguage: 'ar' | 'fr' | 'en'
  backupDirectory: string | null
  automaticBackupEnabled: boolean
  backupsToRetain: number
}>): Promise<SchoolSettings> {
  requireSession()
  const db = getDb()

  const existing = await db.query.schoolSettings.findFirst()
  const now = new Date().toISOString()

  if (existing) {
    const result = await db.update(schema.schoolSettings)
      .set({ ...data, updatedAt: now })
      .where(eq(schema.schoolSettings.id, existing.id))
      .returning()
    return mapRow(result[0]!)
  } else {
    const result = await db.insert(schema.schoolSettings).values({
      schoolNameAr: data.schoolNameAr ?? '',
      schoolNameFr: data.schoolNameFr ?? '',
      schoolNameEn: data.schoolNameEn ?? '',
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      academicYear: data.academicYear ?? '2025-2026',
      currency: data.currency ?? 'DZD',
      defaultLanguage: data.defaultLanguage ?? 'ar',
      backupDirectory: data.backupDirectory ?? null,
      automaticBackupEnabled: data.automaticBackupEnabled ?? false,
      backupsToRetain: data.backupsToRetain ?? 30,
      updatedAt: now,
    }).returning()
    return mapRow(result[0]!)
  }
}
