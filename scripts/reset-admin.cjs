/**
 * reset-admin.cjs
 * Resets or creates the admin user with username 'admin' and password 'admin123'
 * Run: node scripts/reset-admin.cjs
 */

const Database = require('better-sqlite3')
const { hashSync } = require('@node-rs/argon2')
const path = require('path')
const fs = require('fs')

const ARGON2_OPTIONS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  outputLen: 32,
}

// Check common user data paths
const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share')
const possiblePaths = [
  path.join(appData, 'edupilot-dz', 'school-management.sqlite'),
  path.join(appData, 'Edupilot DZ', 'school-management.sqlite'),
  path.join(appData, 'Electron', 'school-management.sqlite'),
]

let dbPath = possiblePaths.find(p => fs.existsSync(p))

if (!dbPath) {
  console.log('No existing database file found in APPDATA.')
  console.log('Checking APPDATA folders...')
  possiblePaths.forEach(p => console.log(' Checked:', p))
  console.log('\nTo reset setup: delete the APPDATA folder and re-launch the app!')
  process.exit(0)
}

console.log('Found database at:', dbPath)
const db = new Database(dbPath)

const passwordHash = hashSync('admin123', ARGON2_OPTIONS)

// Reset admin password or insert superadmin
const existing = db.prepare("SELECT * FROM administrators WHERE username = 'admin'").get()

if (existing) {
  db.prepare("UPDATE administrators SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE username = 'admin'").run(passwordHash)
  console.log('✓ Admin password for "admin" reset to "admin123"')
} else {
  db.prepare(`
    INSERT INTO administrators (username, password_hash, full_name, role, preferred_language, is_active)
    VALUES ('admin', ?, 'Administrator', 'superadmin', 'ar', 1)
  `).run(passwordHash)
  console.log('✓ Admin user "admin" created with password "admin123"')
}

db.close()
