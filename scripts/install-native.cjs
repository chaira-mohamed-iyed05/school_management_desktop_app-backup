/**
 * install-native.cjs
 * Downloads prebuilt better-sqlite3 binary for the installed Electron version.
 * Run: node scripts/install-native.cjs
 *
 * This avoids the need for Visual Studio Build Tools / node-gyp.
 */

'use strict'

const https = require('https')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const zlib = require('zlib')

const ROOT = path.join(__dirname, '..')

// ── Resolve versions ──────────────────────────────────────────────────────────
const electronPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', 'electron', 'package.json'), 'utf8'))
const electronVersion = electronPkg.version
console.log(`Electron version : ${electronVersion}`)

// Map Electron major → Node.js modules ABI
// https://www.electronjs.org/docs/latest/tutorial/electron-versioning
const ABI_MAP = {
  36: 137,  // Node 24
  35: 137,  // Node 24
  34: 137,  // Node 24
  33: 131,
  32: 131,
  31: 127,
  30: 125,
  29: 125,
  28: 115,
}

const electronMajor = parseInt(electronVersion.split('.')[0], 10)
const abi = ABI_MAP[electronMajor]
if (!abi) {
  console.error(`Unknown Electron major: ${electronMajor}. Update ABI_MAP.`)
  process.exit(1)
}
console.log(`Electron ABI     : ${abi}`)

// ── Resolve better-sqlite3 location ───────────────────────────────────────────
const bs3Pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', 'better-sqlite3', 'package.json'), 'utf8'))
const bs3Version = bs3Pkg.version
console.log(`better-sqlite3   : v${bs3Version}`)

const bs3Dir = path.join(ROOT, 'node_modules', 'better-sqlite3')
const buildDir = path.join(bs3Dir, 'build', 'Release')

if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true })

// ── Download URL ───────────────────────────────────────────────────────────────
// better-sqlite3 GitHub releases host prebuilts as:
// better-sqlite3-v{version}-electron-v{abi}-{platform}-{arch}.tar.gz
const platform = 'win32'
const arch = 'x64'
const filename = `better-sqlite3-v${bs3Version}-electron-v${abi}-${platform}-${arch}.tar.gz`
const downloadUrl = `https://github.com/WiseLibs/better-sqlite3/releases/download/v${bs3Version}/${filename}`

const tarPath = path.join(ROOT, 'node_modules', '.cache', filename)
if (!fs.existsSync(path.dirname(tarPath))) fs.mkdirSync(path.dirname(tarPath), { recursive: true })

console.log(`\nDownloading prebuilt binary...`)
console.log(`URL: ${downloadUrl}`)

function download(url, dest, redirects = 5) {
  return new Promise((resolve, reject) => {
    if (redirects === 0) return reject(new Error('Too many redirects'))
    const file = fs.createWriteStream(dest)
    https.get(url, { headers: { 'User-Agent': 'install-native.cjs' } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close()
        fs.unlinkSync(dest)
        return download(res.headers.location, dest, redirects - 1).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        file.close()
        fs.unlinkSync(dest)
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
    }).on('error', (err) => { fs.unlinkSync(dest); reject(err) })
  })
}

async function main() {
  // Download
  await download(downloadUrl, tarPath)
  console.log(`✓ Downloaded to ${tarPath}`)

  // Extract using tar (available on Windows 10+)
  const nodeFile = path.join(buildDir, 'better_sqlite3.node')
  execSync(`tar -xzf "${tarPath}" -C "${buildDir}" --strip-components=2`, { stdio: 'inherit' })
  
  // Verify
  if (fs.existsSync(nodeFile)) {
    const size = fs.statSync(nodeFile).size
    console.log(`✓ Extracted: better_sqlite3.node (${(size / 1024).toFixed(0)} KB)`)
  } else {
    // The tar structure may differ — find the .node file
    execSync(`tar -xzf "${tarPath}" -C "${buildDir}"`, { stdio: 'inherit' })
    const nodeFiles = fs.readdirSync(buildDir).filter(f => f.endsWith('.node'))
    if (nodeFiles.length > 0) {
      console.log(`✓ Node files found: ${nodeFiles.join(', ')}`)
    } else {
      console.error('✗ No .node file found after extraction')
      process.exit(1)
    }
  }

  console.log('\n✅ better-sqlite3 prebuilt binary ready for Electron!')
}

main().catch((err) => {
  console.error('\n✗ Failed:', err.message)
  console.error('\nFallback: Install VS Build Tools 2022 with C++ workload then run:')
  console.error('  pnpm install')
  process.exit(1)
})
