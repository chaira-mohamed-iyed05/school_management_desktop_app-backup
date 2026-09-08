import { hash, verify } from '@node-rs/argon2'
import { eq } from 'drizzle-orm'
import { getDb, schema } from '../database/connection'
import { getSqlite } from '../database/connection'
import { AppError, ErrorCode } from '../../shared/errors/index'
import { MAX_FAILED_LOGINS, LOCKOUT_DURATION_MINUTES } from '../../shared/constants/index'
import type { AuthSession, AdminRole, Language } from '../../shared/types/index'
import log from 'electron-log'

// ─── Argon2id parameters (OWASP recommended) ──────────────────────────────────

const ARGON2_OPTIONS = {
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
  outputLen: 32,
}

// ─── In-memory session store (cleared on app close) ──────────────────────────

let _currentSession: AuthSession | null = null

export function getCurrentSession(): AuthSession | null {
  return _currentSession
}

export function clearSession(): void {
  _currentSession = null
}

export function requireSession(): AuthSession {
  if (!_currentSession) {
    throw new AppError(ErrorCode.NOT_AUTHENTICATED, 'No active session')
  }
  return _currentSession
}

// ─── Password hashing ─────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS)
}

export async function verifyPassword(hash_: string, password: string): Promise<boolean> {
  try {
    return await verify(hash_, password, ARGON2_OPTIONS)
  } catch {
    return false
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<AuthSession> {
  const db = getDb()

  const admin = await db.query.administrators.findFirst({
    where: eq(schema.administrators.username, username),
  })

  if (!admin || !admin.isActive) {
    // Constant-time delay to prevent timing attacks
    await hashPassword('dummy-to-prevent-timing')
    throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Invalid credentials')
  }

  // Check lockout
  if (admin.lockedUntil) {
    const lockedUntil = new Date(admin.lockedUntil)
    if (lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000)
      throw new AppError(
        ErrorCode.ACCOUNT_LOCKED,
        `Account locked for ${minutesLeft} more minute(s)`
      )
    }
  }

  const passwordOk = await verifyPassword(admin.passwordHash, password)

  if (!passwordOk) {
    const newAttempts = admin.failedLoginAttempts + 1
    let lockedUntil: string | null = null

    if (newAttempts >= MAX_FAILED_LOGINS) {
      const lockTime = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
      lockedUntil = lockTime.toISOString()
      log.warn(`Account '${username}' locked until ${lockedUntil} after ${newAttempts} failed attempts`)
    }

    await db
      .update(schema.administrators)
      .set({
        failedLoginAttempts: newAttempts,
        lockedUntil,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.administrators.id, admin.id))

    await auditLogin(admin.id, false)
    throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Invalid credentials')
  }

  // Reset failed attempts on success
  const now = new Date().toISOString()
  await db
    .update(schema.administrators)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: now,
      updatedAt: now,
    })
    .where(eq(schema.administrators.id, admin.id))

  const session: AuthSession = {
    adminId: admin.id,
    username: admin.username,
    fullName: admin.fullName,
    role: admin.role as AdminRole,
    preferredLanguage: admin.preferredLanguage as Language,
    loggedInAt: now,
  }

  _currentSession = session
  await auditLogin(admin.id, true)

  log.info(`Admin '${username}' logged in successfully`)
  return session
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  if (_currentSession) {
    log.info(`Admin '${_currentSession.username}' logged out`)
    _currentSession = null
  }
}

// ─── Change password ──────────────────────────────────────────────────────────

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const session = requireSession()
  const db = getDb()

  const admin = await db.query.administrators.findFirst({
    where: eq(schema.administrators.id, session.adminId),
  })

  if (!admin) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Administrator not found')
  }

  const ok = await verifyPassword(admin.passwordHash, currentPassword)
  if (!ok) {
    throw new AppError(ErrorCode.WRONG_PASSWORD, 'Current password is incorrect')
  }

  const newHash = await hashPassword(newPassword)
  await db
    .update(schema.administrators)
    .set({ passwordHash: newHash, updatedAt: new Date().toISOString() })
    .where(eq(schema.administrators.id, session.adminId))

  log.info(`Admin '${session.username}' changed password`)
  await writeAudit(session.adminId, 'admin.changePassword', 'administrator', session.adminId, {})
}

// ─── Audit helpers ────────────────────────────────────────────────────────────

async function auditLogin(adminId: number, success: boolean): Promise<void> {
  await writeAudit(adminId, success ? 'auth.login' : 'auth.failedLogin', 'administrator', adminId, {
    success,
  })
}

async function writeAudit(
  adminId: number,
  action: string,
  entityType: string,
  entityId: number,
  details: Record<string, unknown>
): Promise<void> {
  try {
    const db = getDb()
    await db.insert(schema.auditLogs).values({
      administratorId: adminId,
      action,
      entityType,
      entityId,
      sanitizedDetailsJson: JSON.stringify(details),
    })
  } catch (err) {
    log.warn('Failed to write audit log:', err)
  }
}
