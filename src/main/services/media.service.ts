import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { app } from 'electron'
import { AppError, ErrorCode } from '../../shared/errors/index'
import { MAX_PHOTO_SIZE_BYTES, ALLOWED_PHOTO_EXTENSIONS, STUDENTS_PHOTO_DIR, TEACHERS_PHOTO_DIR } from '../../shared/constants/index'
import { requireSession } from './auth.service'
import log from 'electron-log'

function getSafeMediaDir(entityType: 'student' | 'teacher'): string {
  const userData = app.getPath('userData')
  const subdir = entityType === 'student' ? STUDENTS_PHOTO_DIR : TEACHERS_PHOTO_DIR
  const dir = path.join(userData, subdir)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function validateAndSanitizePath(sourcePath: string, mediaDir: string): void {
  // Prevent path traversal attacks
  const resolved = path.resolve(sourcePath)
  // Source can be anywhere (user selected via dialog), so we only restrict the destination
  const ext = path.extname(sourcePath).toLowerCase()
  if (!ALLOWED_PHOTO_EXTENSIONS.includes(ext)) {
    throw new AppError(ErrorCode.INVALID_FILE_TYPE, `File type ${ext} is not allowed`)
  }
}

export async function uploadPhoto(
  sourcePath: string,
  entityType: 'student' | 'teacher',
  entityId: number
): Promise<string> {
  requireSession()

  // Validate extension
  const ext = path.extname(sourcePath).toLowerCase()
  if (!ALLOWED_PHOTO_EXTENSIONS.includes(ext)) {
    throw new AppError(ErrorCode.INVALID_FILE_TYPE, `File type not allowed. Use: ${ALLOWED_PHOTO_EXTENSIONS.join(', ')}`)
  }

  // Check file exists and size
  if (!fs.existsSync(sourcePath)) {
    throw new AppError(ErrorCode.FILE_NOT_FOUND, 'Source file not found')
  }
  const stat = fs.statSync(sourcePath)
  if (stat.size > MAX_PHOTO_SIZE_BYTES) {
    throw new AppError(ErrorCode.FILE_TOO_LARGE, `File too large. Maximum size is ${MAX_PHOTO_SIZE_BYTES / 1024 / 1024}MB`)
  }

  // Generate a safe internal filename (never use original filename)
  const safeFilename = `${entityType}-${entityId}-${crypto.randomBytes(8).toString('hex')}${ext}`
  const mediaDir = getSafeMediaDir(entityType)
  const destPath = path.join(mediaDir, safeFilename)

  // Copy to managed directory
  fs.copyFileSync(sourcePath, destPath)
  log.info(`Photo uploaded: ${safeFilename} for ${entityType} ${entityId}`)

  // Return the relative path stored in DB
  return safeFilename
}

export function getPhotoLocalPath(filename: string, entityType: 'student' | 'teacher'): string | null {
  if (!filename) return null

  // Validate filename (no path traversal)
  const basename = path.basename(filename)
  if (basename !== filename) {
    log.warn('Path traversal attempt in getPhotoLocalPath:', filename)
    return null
  }

  const mediaDir = getSafeMediaDir(entityType)
  const fullPath = path.join(mediaDir, basename)

  if (!fs.existsSync(fullPath)) return null
  return fullPath
}

export function getPhotoAsDataUrl(filename: string, entityType: 'student' | 'teacher'): string | null {
  const fullPath = getPhotoLocalPath(filename, entityType)
  if (!fullPath) return null

  try {
    const buf = fs.readFileSync(fullPath)
    const ext = path.extname(fullPath).slice(1).toLowerCase()
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/webp'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}
