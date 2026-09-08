/**
 * Generate app icons from online-education.png using sharp.
 * Run: node scripts/generate-icons.js
 *
 * Outputs:
 *   build/icons/icon.png     (512×512 — macOS/Linux)
 *   build/icons/icon.ico     (multi-size ICO — Windows)
 *   src/renderer/assets/icon.png (256×256 — in-app display)
 */

const sharp = require('sharp')
const pngToIco = require('png-to-ico')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SOURCE = path.join(ROOT, 'public', 'online-education.png')
  // fallback locations
const SOURCES = [
  path.join(ROOT, 'public', 'online-education.png'),
  path.join(ROOT, 'src', 'renderer', 'assets', 'online-education.png'),
  path.join(ROOT, 'online-education.png'),
]

const BUILD_ICONS_DIR = path.join(ROOT, 'build', 'icons')
const RENDERER_ASSETS_DIR = path.join(ROOT, 'src', 'renderer', 'assets')
const FONTS_DIR = path.join(ROOT, 'src', 'renderer', 'assets', 'fonts')
const SOUNDS_DIR = path.join(ROOT, 'src', 'renderer', 'assets', 'sounds')

// Ensure directories exist
for (const dir of [BUILD_ICONS_DIR, RENDERER_ASSETS_DIR, FONTS_DIR, SOUNDS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    console.log('Created:', dir)
  }
}

// Find source image
let sourceFile = null
for (const s of SOURCES) {
  if (fs.existsSync(s)) { sourceFile = s; break }
}

if (!sourceFile) {
  console.error('Source icon not found. Checked:')
  SOURCES.forEach(s => console.error(' -', s))
  console.error('\nPlace online-education.png in /public and re-run.')
  process.exit(1)
}

console.log('Using source:', sourceFile)

async function main() {
  // 1. 512×512 PNG for macOS/Linux
  const png512 = path.join(BUILD_ICONS_DIR, 'icon.png')
  await sharp(sourceFile).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(png512)
  console.log('✓ build/icons/icon.png (512x512)')

  // 2. 256×256 PNG for renderer display
  const png256renderer = path.join(RENDERER_ASSETS_DIR, 'icon.png')
  await sharp(sourceFile).resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(png256renderer)
  console.log('✓ src/renderer/assets/icon.png (256x256)')

  // 3. ICO with multiple sizes for Windows
  const sizes = [16, 24, 32, 48, 64, 128, 256]
  const tmpBuffers = []
  for (const size of sizes) {
    const buf = await sharp(sourceFile)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    tmpBuffers.push(buf)
  }

  const icoBuffer = await pngToIco(tmpBuffers)
  fs.writeFileSync(path.join(BUILD_ICONS_DIR, 'icon.ico'), icoBuffer)
  console.log('✓ build/icons/icon.ico (multi-size)')

  console.log('\nAll icons generated successfully!')
}

main().catch(err => {
  console.error('Icon generation failed:', err.message)
  process.exit(1)
})
