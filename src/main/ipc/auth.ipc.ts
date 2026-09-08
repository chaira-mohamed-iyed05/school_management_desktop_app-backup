import Database from 'better-sqlite3'
import { handle } from './_handler'
import { eq } from 'drizzle-orm'
import { IPC_CHANNELS } from '../../shared/constants/index'
import { LoginSchema, ChangePasswordSchema, SetupSchema } from '../../shared/schemas/index'
import {
  login, logout, changePassword, getCurrentSession,
  hashPassword
} from '../services/auth.service'
import { getDb, schema } from '../database/connection'
import { isFirstRun, markSetupComplete } from '../database/migrator'
import { updateSettings } from '../services/settings.service'
import { AppError, ErrorCode } from '../../shared/errors/index'

export function registerAuthHandlers(): void {
  handle(IPC_CHANNELS.AUTH_LOGIN, async (payload) => {
    const { username, password } = LoginSchema.parse(payload)
    return login(username, password)
  })

  handle(IPC_CHANNELS.AUTH_LOGOUT, async () => {
    await logout()
    return true
  })

  handle(IPC_CHANNELS.AUTH_CHANGE_PASSWORD, async (payload) => {
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(payload)
    await changePassword(currentPassword, newPassword)
    return true
  })

  handle(IPC_CHANNELS.AUTH_GET_SESSION, async () => {
    return getCurrentSession()
  })

  handle(IPC_CHANNELS.AUTH_CHECK_FIRST_RUN, async () => {
    return { firstRun: isFirstRun() }
  })

  handle(IPC_CHANNELS.AUTH_COMPLETE_SETUP, async (payload) => {
    const data = SetupSchema.parse(payload)
    const db = getDb()

    // Create or update admin with Argon2id hash
    const passwordHash = await hashPassword(data.adminPassword)
    const existingAdmin = (await db.query.administrators.findFirst({
      where: eq(schema.administrators.username, data.adminUsername),
    })) || (await db.query.administrators.findFirst())

    if (existingAdmin) {
      await db
        .update(schema.administrators)
        .set({
          username: data.adminUsername,
          passwordHash,
          fullName: data.adminFullName,
          role: 'superadmin',
          preferredLanguage: data.preferredLanguage,
          isActive: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.administrators.id, existingAdmin.id))
    } else {
      await db.insert(schema.administrators).values({
        username: data.adminUsername,
        passwordHash,
        fullName: data.adminFullName,
        role: 'superadmin',
        preferredLanguage: data.preferredLanguage,
        isActive: true,
      })
    }

    // Log in automatically so session is active
    const session = await login(data.adminUsername, data.adminPassword)

    // Upsert school settings
    const existingSettings = await db.query.schoolSettings.findFirst()
    const settingsPayload = {
      schoolNameAr: data.schoolNameAr,
      schoolNameFr: data.schoolNameFr,
      schoolNameEn: data.schoolNameEn ?? '',
      phone: data.phone ?? null,
      email: data.email || null,
      address: data.address ?? null,
      academicYear: data.academicYear,
      defaultLanguage: data.preferredLanguage,
      updatedAt: new Date().toISOString(),
    }

    if (existingSettings) {
      await db
        .update(schema.schoolSettings)
        .set(settingsPayload)
        .where(eq(schema.schoolSettings.id, existingSettings.id))
    } else {
      await db.insert(schema.schoolSettings).values(settingsPayload)
    }

    // Mark setup done
    markSetupComplete()

    return session
  })
}
