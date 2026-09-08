import { handle } from './_handler'
import { ipcMain, dialog, app, shell } from 'electron'
import path from 'path'
import log from 'electron-log'
import { IPC_CHANNELS } from '../../shared/constants/index'
import { UpdateSettingsSchema, RestoreBackupSchema, UploadPhotoSchema } from '../../shared/schemas/index'
import { getSettings, updateSettings } from '../services/settings.service'
import { createBackup, listBackups, verifyBackup, restoreBackup } from '../services/backup.service'
import { uploadPhoto } from '../services/media.service'
import { requireSession, verifyPassword } from '../services/auth.service'
import { getSqlite, getDb, schema } from '../database/connection'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

export function registerUtilityHandlers(): void {
  // Health check
  handle(IPC_CHANNELS.HEALTH_CHECK, async () => {
    let sqliteOpen = false
    let migrationsApplied = false
    try {
      const sqlite = getSqlite()
      const row = sqlite.prepare('SELECT 1 as alive').get() as { alive: number } | undefined
      sqliteOpen = row?.alive === 1

      const migRow = sqlite.prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'").get() as { cnt: number } | undefined
      migrationsApplied = (migRow?.cnt ?? 0) > 0
    } catch {
      sqliteOpen = false
      migrationsApplied = false
    }

    return {
      preloadLoaded: true,
      mainReachable: true,
      ipcWorking: true,
      sqliteOpen,
      migrationsApplied,
    }
  })

  // Settings
  handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    return getSettings()
  })
  handle(IPC_CHANNELS.SETTINGS_UPDATE, async (payload) => {
    const data = UpdateSettingsSchema.parse(payload)
    return updateSettings(data)
  })

  // ─── Admin profile (get/update current admin) ──────────────────────────────

  handle(IPC_CHANNELS.SETTINGS_GET_ADMIN, async () => {
    const session = requireSession()
    const sqlite = getSqlite()
    const admin = sqlite.prepare('SELECT id, username, full_name, role, preferred_language, photo_path, created_at FROM administrators WHERE id = ? LIMIT 1').get(session.adminId) as any
    if (!admin) throw new Error('Admin not found')
    return {
      id: admin.id,
      username: admin.username,
      fullName: admin.full_name,
      role: admin.role,
      preferredLanguage: admin.preferred_language,
      photoPath: admin.photo_path,
      createdAt: admin.created_at,
    }
  })

  handle(IPC_CHANNELS.SETTINGS_UPDATE_ADMIN, async (payload) => {
    const session = requireSession()
    const data = z.object({
      fullName: z.string().min(1).max(200).optional(),
      preferredLanguage: z.enum(['ar', 'fr', 'en']).optional(),
      photoPath: z.string().max(500).nullable().optional(),
    }).parse(payload)
    const sqlite = getSqlite()
    const updates: string[] = ["updated_at = datetime('now')"]
    const params: any[] = []
    if (data.fullName !== undefined) { updates.push('full_name = ?'); params.push(data.fullName) }
    if (data.preferredLanguage !== undefined) { updates.push('preferred_language = ?'); params.push(data.preferredLanguage) }
    if (data.photoPath !== undefined) { updates.push('photo_path = ?'); params.push(data.photoPath) }
    params.push(session.adminId)
    sqlite.prepare(`UPDATE administrators SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    const updated = sqlite.prepare('SELECT id, username, full_name, role, preferred_language, photo_path FROM administrators WHERE id = ?').get(session.adminId) as any
    return {
      id: updated.id,
      username: updated.username,
      fullName: updated.full_name,
      role: updated.role,
      preferredLanguage: updated.preferred_language,
      photoPath: updated.photo_path,
    }
  })

  // ─── Audit logs ────────────────────────────────────────────────────────────

  handle(IPC_CHANNELS.SETTINGS_LIST_AUDIT_LOGS, async (payload) => {
    requireSession()
    const opts = z.object({
      limit: z.number().int().min(1).max(500).optional(),
      offset: z.number().int().min(0).optional(),
      action: z.string().optional(),
    }).parse(payload ?? {})
    const sqlite = getSqlite()
    let sql = `
      SELECT al.*, a.full_name as admin_name
      FROM audit_logs al
      LEFT JOIN administrators a ON al.administrator_id = a.id
      WHERE 1=1
    `
    const params: any[] = []
    if (opts.action) { sql += ' AND al.action LIKE ?'; params.push(`%${opts.action}%`) }
    sql += ' ORDER BY al.created_at DESC'
    sql += ` LIMIT ${opts.limit ?? 100} OFFSET ${opts.offset ?? 0}`
    const rows = sqlite.prepare(sql).all(...params) as any[]
    return rows.map(r => ({
      id: r.id,
      administratorId: r.administrator_id,
      adminName: r.admin_name,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      details: r.sanitized_details_json ? JSON.parse(r.sanitized_details_json) : null,
      createdAt: r.created_at,
    }))
  })

  // ─── Auto-lock configuration ───────────────────────────────────────────────

  handle(IPC_CHANNELS.SETTINGS_AUTO_LOCK_SET, async (payload) => {
    requireSession()
    const { minutes } = z.object({ minutes: z.number().int().min(0).max(120) }).parse(payload)
    const sqlite = getSqlite()
    sqlite.prepare(`INSERT OR REPLACE INTO app_metadata(key, value, updated_at) VALUES('auto_lock_minutes', ?, datetime('now'))`).run(String(minutes))
    return { minutes }
  })

  handle(IPC_CHANNELS.SETTINGS_AUTO_LOCK_GET, async () => {
    const sqlite = getSqlite()
    const row = sqlite.prepare(`SELECT value FROM app_metadata WHERE key = 'auto_lock_minutes' LIMIT 1`).get() as any
    return { minutes: row ? parseInt(row.value, 10) : 0 }
  })


  // Backups
  handle(IPC_CHANNELS.BACKUPS_CREATE, async (payload) => {
    const opts = z.object({ destinationDir: z.string().max(500).optional() }).parse(payload ?? {})
    return createBackup(opts.destinationDir)
  })
  handle(IPC_CHANNELS.BACKUPS_LIST, async () => {
    return listBackups()
  })
  handle(IPC_CHANNELS.BACKUPS_VERIFY, async (payload) => {
    const { backupPath } = z.object({ backupPath: z.string().min(1).max(1000) }).parse(payload)
    const ok = await verifyBackup(backupPath)
    return { verified: ok }
  })
  handle(IPC_CHANNELS.BACKUPS_RESTORE, async (payload) => {
    const data = RestoreBackupSchema.parse(payload)
    // Verify admin password before restore
    const session = requireSession()
    const db = getDb()
    const admin = await db.query.administrators.findFirst({
      where: eq(schema.administrators.id, session.adminId),
    })
    if (!admin) throw new Error('Admin not found')
    const ok = await verifyPassword(admin.passwordHash, data.confirmPassword)
    if (!ok) throw new Error('Password confirmation incorrect')
    await restoreBackup(data.backupPath)
    return true
  })

  // Media
  handle(IPC_CHANNELS.MEDIA_UPLOAD_PHOTO, async (payload) => {
    const data = UploadPhotoSchema.parse(payload)
    const filename = await uploadPhoto(data.sourcePath, data.entityType, data.entityId)
    return { filename }
  })

  // App info
  handle(IPC_CHANNELS.APP_GET_VERSION, async () => {
    return { version: app.getVersion(), name: app.getName() }
  })

  handle(IPC_CHANNELS.APP_GET_PATHS, async () => {
    requireSession()
    return {
      userData: app.getPath('userData'),
      documents: app.getPath('documents'),
    }
  })

  // File dialogs (main process only — never let renderer specify arbitrary paths)
  handle(IPC_CHANNELS.APP_OPEN_BACKUP_DIALOG, async () => {
    // Pre-navigate to the backups folder so non-technical users can find their backups
    const settings = await getSettings()
    const defaultBackupDir = settings?.backupDirectory ?? path.join(app.getPath('userData'), 'backups')

    const result = await dialog.showOpenDialog({
      title: 'Sélectionner le fichier de sauvegarde',
      defaultPath: defaultBackupDir,
      filters: [{ name: 'Backup Files', extensions: ['zip'] }],
      properties: ['openFile'],
    })
    if (result.canceled) return { canceled: true, path: null }
    return { canceled: false, path: result.filePaths[0] ?? null }
  })

  handle(IPC_CHANNELS.APP_SHOW_SAVE_DIALOG, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Sélectionner le dossier de destination',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled) return { canceled: true, path: null }
    return { canceled: false, path: result.filePaths[0] ?? null }
  })

  // Print
  handle(IPC_CHANNELS.APP_PRINT, async () => {
    const { BrowserWindow } = await import('electron')
    const win = BrowserWindow.getFocusedWindow()
    if (win) {
      win.webContents.print({ silent: false, printBackground: true })
    }
    return true
  })

  // Print to PDF — opens save dialog so user picks destination
  handle(IPC_CHANNELS.APP_PRINT_TO_PDF, async (payload) => {
    const { BrowserWindow, dialog: dlg } = await import('electron')
    const fs = await import('fs/promises')
    const path = await import('path')
    const win = BrowserWindow.getFocusedWindow()
    if (!win) throw new Error('No focused window')

    const opts = (payload ?? {}) as { pageSize?: 'A4' | 'Letter'; marginsType?: 0 | 1 | 2; filename?: string }

    // Use Downloads directory or Desktop to avoid OneDrive Documents sync lock errors on Windows
    let baseDir = app.getPath('downloads')
    try {
      if (!fs.stat) await import('fs')
    } catch {
      baseDir = app.getPath('desktop')
    }

    const defaultFilename = opts.filename ?? `EdupilotDZ-${Date.now()}.pdf`
    const defaultPath = path.join(baseDir, defaultFilename)

    // Ask user where to save file
    const saveResult = await dlg.showSaveDialog(win, {
      title: 'Enregistrer le PDF',
      defaultPath,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    })

    if (saveResult.canceled || !saveResult.filePath) {
      return { path: null, canceled: true }
    }

    const pdfOptions = {
      printBackground: true,
      marginsType: opts.marginsType ?? 0,
      pageSize: opts.pageSize ?? 'A4',
    } as any

    const buffer = await win.webContents.printToPDF(pdfOptions)
    await fs.writeFile(saveResult.filePath, buffer)
    return { path: saveResult.filePath, canceled: false }
  })

  // Safe local diagnostic error logging from renderer (Requirement 3)
  handle(IPC_CHANNELS.APP_LOG_ERROR, async (payload) => {
    const data = (payload ?? {}) as { category?: string; message?: string; componentStack?: string }
    log.error(`[RENDERER_ERROR] [${data.category ?? 'uncaught'}]`, {
      message: data.message ?? 'Unknown renderer error',
      stack: data.componentStack,
    })
    return true
  })
}
