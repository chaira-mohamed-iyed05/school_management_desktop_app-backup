const fs = require('fs')
const path = require('path')
const os = require('os')

if (process.env.NODE_ENV === 'production') {
  console.error('ERROR: dev:reset-data cannot be run in production!')
  process.exit(1)
}

const appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
const devUserDataDir = path.join(appDataDir, 'Edupilot-DZ-Dev')

console.log(`[dev:reset-data] User data directory: ${devUserDataDir}`)

if (!fs.existsSync(devUserDataDir)) {
  console.log('[dev:reset-data] Directory does not exist. Database is already clean.')
  process.exit(0)
}

try {
  const files = fs.readdirSync(devUserDataDir)
  let removedCount = 0
  for (const file of files) {
    if (file.endsWith('.sqlite') || file.endsWith('.sqlite-wal') || file.endsWith('.sqlite-shm')) {
      const fullPath = path.join(devUserDataDir, file)
      fs.unlinkSync(fullPath)
      console.log(`[dev:reset-data] Removed: ${file}`)
      removedCount++
    }
  }
  console.log(`[dev:reset-data] Reset complete! Removed ${removedCount} database files. Launch app with 'pnpm dev' to view 3-Step Setup Wizard.`)
} catch (err) {
  console.error('[dev:reset-data] Failed to remove database files:', err.message)
  process.exit(1)
}
