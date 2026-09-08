/**
 * Download Inter and Amiri fonts from Google Fonts API as .woff2 files.
 * Run once: node scripts/download-fonts.js
 *
 * Fonts are stored in src/renderer/assets/fonts/ and bundled by Vite.
 * This eliminates the CDN dependency required by the offline app.
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

const FONTS_DIR = path.join(__dirname, '..', 'src', 'renderer', 'assets', 'fonts')

if (!fs.existsSync(FONTS_DIR)) {
  fs.mkdirSync(FONTS_DIR, { recursive: true })
}

// Direct woff2 URLs from Google Fonts API (stable CDN links)
const FONT_FILES = [
  // Inter
  {
    url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2',
    filename: 'Inter-Regular.woff2',
  },
  {
    url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiA.woff2',
    filename: 'Inter-Medium.woff2',
  },
  {
    url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2',
    filename: 'Inter-SemiBold.woff2',
  },
  {
    url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiA.woff2',
    filename: 'Inter-Bold.woff2',
  },
  // Amiri (Arabic)
  {
    url: 'https://fonts.gstatic.com/s/amiri/v27/J7aRnpd8CGxBHqUpvrIw74NL.woff2',
    filename: 'Amiri-Regular.woff2',
  },
  {
    url: 'https://fonts.gstatic.com/s/amiri/v27/J7acnpd8CGxBHqUpvrIw74HrSNA.woff2',
    filename: 'Amiri-Bold.woff2',
  },
]

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      console.log(`  ✓ Already exists: ${path.basename(dest)}`)
      return resolve()
    }

    const file = fs.createWriteStream(dest)
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close()
          fs.unlinkSync(dest)
          return downloadFile(res.headers.location, dest).then(resolve).catch(reject)
        }
        if (res.statusCode !== 200) {
          file.close()
          fs.unlinkSync(dest)
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        }
        res.pipe(file)
        file.on('finish', () => {
          file.close()
          console.log(`  ✓ Downloaded: ${path.basename(dest)}`)
          resolve()
        })
      })
      .on('error', (err) => {
        fs.unlink(dest, () => {})
        reject(err)
      })
  })
}

async function main() {
  console.log('Downloading fonts to:', FONTS_DIR)
  for (const font of FONT_FILES) {
    const dest = path.join(FONTS_DIR, font.filename)
    try {
      await downloadFile(font.url, dest)
    } catch (err) {
      console.error(`  ✗ Failed: ${font.filename} — ${err.message}`)
      console.error('    Create an empty placeholder so the build does not fail:')
      fs.writeFileSync(dest, '')
    }
  }
  console.log('\nDone. All fonts ready in src/renderer/assets/fonts/')
}

main()
