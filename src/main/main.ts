import { app, BrowserWindow } from 'electron'
import os from 'node:os'
import path from 'node:path'
import log from 'electron-log'
import { initializeDatabase } from './database/connection'
import { runMigrations } from './database/migrator'
import { registerAllIpcHandlers } from './ipc/index'
import { createMainWindow } from './windows/mainWindow'

log.initialize({ preload: true })
log.transports.file.level = 'info'
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'warn'

// Use a separate development userData path so development data never reuses production data.
if (process.env.NODE_ENV !== 'production') {
  const devDataDir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Edupilot-DZ-Dev')
  app.setPath('userData', devDataDir)
}

// Single instance lock
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  log.warn('Another instance is already running — quitting')
  app.quit()
}

// Global exception and rejection diagnostics (Requirement 3)
process.on('uncaughtException', (error: Error) => {
  log.error(`[CRASH:uncaughtException] [${new Date().toISOString()}] [main]`, {
    name: error.name,
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  })
})

process.on('unhandledRejection', (reason: unknown) => {
  log.error(`[CRASH:unhandledRejection] [${new Date().toISOString()}] [main]`, {
    reason: reason instanceof Error ? { name: reason.name, message: reason.message } : String(reason),
  })
})

let mainWindow: BrowserWindow | null = null

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('child-process-gone', (_event, details) => {
  log.error(`[CRASH:child-process-gone] [${new Date().toISOString()}] [${details.type}]`, {
    reason: details.reason,
    exitCode: details.exitCode,
    name: details.name,
  })
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow()
  }
})

app.on('before-quit', () => {
  log.info('App quitting — closing database')
  try {
    const { closeDatabase } = require('./database/connection')
    closeDatabase()
  } catch { /* ignore */ }
})

async function bootstrap(): Promise<void> {
  await app.whenReady()

  log.info(`Edupilot DZ v${app.getVersion()} starting...`)
  log.info(`Electron: ${process.versions.electron}, Node: ${process.versions.node}`)
  log.info(`userData: ${app.getPath('userData')}`)

  try {
    // 1. Initialize database connection
    await initializeDatabase()

    // 2. Apply any pending migrations
    await runMigrations()

    // 3. Register all IPC handlers
    registerAllIpcHandlers()

    // 4. Create main window
    mainWindow = createMainWindow()

    // WebContents crash and failure monitoring (Requirement 3)
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      log.error(`[CRASH:render-process-gone] [${new Date().toISOString()}] [renderer]`, {
        reason: details.reason,
        exitCode: details.exitCode,
      })
    })

    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      log.warn(`[WARN:did-fail-load] [${new Date().toISOString()}] [${errorCode}]`, {
        description: errorDescription,
        url: validatedURL,
      })
    })

    // 5. Run offline attendance reconciliation on startup (Requirement 16)
    try {
      const { reconcilePastSessionsAttendance } = await import('./services/attendance.service')
      await reconcilePastSessionsAttendance()
      log.info('Offline attendance reconciliation completed on startup')
    } catch (e) {
      log.warn('Attendance reconciliation startup error:', e)
    }

    // 6. Trigger daily auto-backup asynchronously (Requirement 53)
    try {
      const { runDailyAutoBackup } = await import('./services/backup.service')
      runDailyAutoBackup().catch(e => log.warn('Auto backup background error:', e))
    } catch (e) {
      log.warn('Auto backup init error:', e)
    }

    log.info('Bootstrap complete')
  } catch (err) {
    log.error('Bootstrap failed:', err)
    // Show error dialog before quitting
    const { dialog } = require('electron')
    dialog.showErrorBox(
      'Startup Error',
      `Failed to initialize the application:\n\n${err instanceof Error ? err.message : String(err)}\n\nPlease check the logs.`
    )
    app.quit()
  }
}

bootstrap()
