import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import log from 'electron-log'
import { DB_FILENAME } from '../../shared/constants/index'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null
let _sqlite: Database.Database | null = null

function getDatabasePath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, DB_FILENAME)
}

export async function initializeDatabase(): Promise<void> {
  const dbPath = getDatabasePath()
  const dbDir = path.dirname(dbPath)

  // Ensure directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  log.info('Opening database at:', dbPath)

  _sqlite = new Database(dbPath, {
    // verbose: process.env.NODE_ENV === 'development' ? log.debug : undefined,
  })

  // Apply security and performance PRAGMAs
  _sqlite.pragma('journal_mode = WAL')
  _sqlite.pragma('foreign_keys = ON')
  _sqlite.pragma('busy_timeout = 5000')
  _sqlite.pragma('synchronous = NORMAL')
  _sqlite.pragma('cache_size = -8000') // 8MB cache
  _sqlite.pragma('temp_store = MEMORY')

  _db = drizzle(_sqlite, { schema })

  log.info('Database connection established')
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.')
  }
  return _db
}

export function getSqlite(): Database.Database {
  if (!_sqlite) {
    throw new Error('SQLite not initialized. Call initializeDatabase() first.')
  }
  return _sqlite
}

export function closeDatabase(): void {
  try {
    _sqlite?.close()
    _sqlite = null
    _db = null
    log.info('Database connection closed')
  } catch (err) {
    log.error('Error closing database:', err)
  }
}

export function getDatabasePath_(): string {
  return getDatabasePath()
}

// Export schema for use in services
export { schema }
