import { ipcMain, app, dialog, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import { z } from 'zod'
import log from 'electron-log'
import { IPC_CHANNELS } from '@shared/constants'

// Validation schemas
const SelectProfileImageSchema = z.object({
  type: z.enum(['admin', 'student', 'teacher']),
  recordId: z.string(),
})

// Maps API type param to the actual folder name under media/
const TYPE_TO_FOLDER: Record<string, string> = {
  admin: 'administrators',
  student: 'students',
  teacher: 'teachers',
}

/**
 * Ensure media folders exist under userData/media/
 */
function ensureMediaFolders(): string {
  const mediaDir = path.join(app.getPath('userData'), 'media')
  const folders = ['administrators', 'students', 'teachers']

  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true })
  }

  for (const folder of folders) {
    const typeDir = path.join(mediaDir, folder)
    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true })
    }
  }

  return mediaDir
}

/**
 * Validate image file — allowed: JPEG, PNG, WebP; max 5 MB
 */
function validateImage(filePath: string): { valid: boolean; error?: string } {
  if (!fs.existsSync(filePath)) return { valid: false, error: 'File does not exist' }

  const stat = fs.statSync(filePath)
  if (stat.size > 5 * 1024 * 1024) {
    return { valid: false, error: `Image exceeds 5MB limit (${Math.round(stat.size / 1024 / 1024)}MB)` }
  }

  const ext = path.extname(filePath).toLowerCase()
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    return { valid: false, error: `Invalid format. Allowed: JPEG, PNG, WebP (got ${ext})` }
  }

  return { valid: true }
}

/** Generate a unique timestamped filename */
function generateImageFilename(ext: string): string {
  const random = Math.random().toString(36).substring(2, 8)
  return `${Date.now()}-${random}${ext}`
}

/**
 * Resolve a stored relative path (e.g. "media/students/abc.jpg") to an absolute path.
 */
function resolveMediaPath(relativePath: string): string {
  const userData = app.getPath('userData')
  if (path.isAbsolute(relativePath)) return relativePath
  if (relativePath.startsWith('media')) return path.join(userData, relativePath)
  return path.join(userData, 'media', relativePath)
}

export function registerMediaHandlers() {

  /**
   * IPC Handler: Select and upload profile image
   * Opens native file picker, validates, stores in managed media folder.
   * Returns ApiResult<{ path: string }> — path is the relative DB path.
   */
  ipcMain.handle(IPC_CHANNELS.MEDIA_SELECT_IMAGE, async (_, input: unknown) => {
    try {
      const { type } = SelectProfileImageSchema.parse(input)
      const parentWindow = require('electron').BrowserWindow.getFocusedWindow()

      const result = await dialog.showOpenDialog(parentWindow, {
        title: 'Select Profile Image',
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
        properties: ['openFile'],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, data: null, error: 'Selection cancelled' }
      }

      const selectedFile = result.filePaths[0]

      const validation = validateImage(selectedFile)
      if (!validation.valid) {
        return { success: false, data: null, error: validation.error }
      }

      const mediaDir = ensureMediaFolders()
      const folderName = TYPE_TO_FOLDER[type] ?? `${type}s`
      const typeDir = path.join(mediaDir, folderName)
      const ext = path.extname(selectedFile)
      const filename = generateImageFilename(ext)
      const destPath = path.join(typeDir, filename)

      // Resize / copy via nativeImage (no external binary)
      try {
        const image = nativeImage.createFromPath(selectedFile)
        if (!image.isEmpty()) {
          const size = image.getSize()
          const maxDim = 1024
          let resized = image
          if (size.width > maxDim || size.height > maxDim) {
            const aspect = size.width / size.height
            const newWidth = size.width >= size.height ? maxDim : Math.round(maxDim * aspect)
            const newHeight = size.width >= size.height ? Math.round(maxDim / aspect) : maxDim
            resized = image.resize({ width: newWidth, height: newHeight, quality: 'better' })
          }
          await fs.promises.writeFile(destPath, resized.toJPEG(85))
        } else {
          await fs.promises.copyFile(selectedFile, destPath)
        }
      } catch {
        await fs.promises.copyFile(selectedFile, destPath)
      }

      // Relative path stored in DB: e.g. "media/students/1234-abc.jpg"
      const relativePath = `media/${folderName}/${filename}`
      log.info(`[MEDIA] Profile image stored: ${relativePath}`)

      // ── Return proper ApiResult shape so renderer can read res.data.path ──
      return { success: true, data: { path: relativePath }, error: null }

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log.error('[MEDIA] Error in MEDIA_SELECT_IMAGE:', msg)
      return { success: false, data: null, error: msg }
    }
  })

  /**
   * IPC Handler: Delete profile image from disk
   * Returns ApiResult<boolean>
   */
  ipcMain.handle(IPC_CHANNELS.MEDIA_DELETE_IMAGE, async (_, input: unknown) => {
    try {
      const { relativePath } = z.object({ relativePath: z.string() }).parse(input)

      const imagePath = resolveMediaPath(relativePath)

      // Security: must stay inside userData
      const resolvedPath = path.resolve(imagePath)
      const resolvedUserData = path.resolve(app.getPath('userData'))
      if (!resolvedPath.startsWith(resolvedUserData)) {
        return { success: false, data: null, error: 'Invalid path' }
      }

      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath)
        log.info(`[MEDIA] Profile image deleted: ${relativePath}`)
      }

      return { success: true, data: true, error: null }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log.error('[MEDIA] Error in MEDIA_DELETE_IMAGE:', msg)
      return { success: false, data: null, error: msg }
    }
  })

  /**
   * IPC Handler: Get image as Base64 Data URL
   * Returns ApiResult<{ url: string | null }> — bypasses Chromium file:// security blocks
   */
  ipcMain.handle(IPC_CHANNELS.MEDIA_GET_IMAGE_URL, async (_, input: unknown) => {
    try {
      const { relativePath } = z.object({
        relativePath: z.string().optional().nullable(),
      }).parse(input)

      if (!relativePath) {
        return { success: true, data: { url: null }, error: null }
      }

      const imagePath = resolveMediaPath(relativePath)

      if (!fs.existsSync(imagePath)) {
        log.warn(`[MEDIA] Image not found: ${imagePath}`)
        return { success: false, data: { url: null }, error: 'File not found' }
      }

      const buf = fs.readFileSync(imagePath)
      const ext = path.extname(imagePath).slice(1).toLowerCase()
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      const dataUrl = `data:${mime};base64,${buf.toString('base64')}`

      // ── Return proper ApiResult shape so renderer can read photoRes.data.url ──
      return { success: true, data: { url: dataUrl }, error: null }

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log.error('[MEDIA] Error in MEDIA_GET_IMAGE_URL:', msg)
      return { success: false, data: { url: null }, error: msg }
    }
  })
}
