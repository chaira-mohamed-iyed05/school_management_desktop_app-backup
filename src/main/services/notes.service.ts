import { eq, desc } from 'drizzle-orm'
import { getDb, getSqlite, schema } from '../database/connection'
import { AppError, ErrorCode } from '../../shared/errors/index'
import { requireSession } from './auth.service'
import type { StudentNote } from '../../shared/types/index'
import log from 'electron-log'

export async function listStudentNotes(studentId: number): Promise<StudentNote[]> {
  const sqlite = getSqlite()
  const rows = sqlite.prepare(`
    SELECT
      n.id,
      n.student_id,
      n.note_text,
      n.created_by,
      n.created_at,
      n.updated_at,
      a.full_name as created_by_name
    FROM student_notes n
    LEFT JOIN administrators a ON n.created_by = a.id
    WHERE n.student_id = ?
    ORDER BY n.created_at DESC
  `).all(studentId) as any[]

  return rows.map(r => ({
    id: r.id,
    studentId: r.student_id,
    noteText: r.note_text,
    createdBy: r.created_by,
    createdByName: r.created_by_name ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}

export async function createStudentNote(data: {
  studentId: number
  noteText: string
}): Promise<StudentNote> {
  const session = requireSession()
  const sqlite = getSqlite()

  if (!data.noteText || !data.noteText.trim()) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Note text cannot be empty')
  }

  const now = new Date().toISOString()
  const stmt = sqlite.prepare(`
    INSERT INTO student_notes (student_id, note_text, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `)

  const res = stmt.run(data.studentId, data.noteText.trim(), session.adminId, now, now)
  const id = Number(res.lastInsertRowid)

  log.info(`Created student note: id=${id}, studentId=${data.studentId}`)

  return {
    id,
    studentId: data.studentId,
    noteText: data.noteText.trim(),
    createdBy: session.adminId,
    createdByName: session.fullName,
    createdAt: now,
    updatedAt: now,
  }
}

export async function updateStudentNote(
  id: number,
  noteText: string
): Promise<StudentNote> {
  const session = requireSession()
  const sqlite = getSqlite()

  if (!noteText || !noteText.trim()) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Note text cannot be empty')
  }

  const existing = sqlite.prepare('SELECT * FROM student_notes WHERE id = ?').get(id) as any
  if (!existing) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Note not found')
  }

  const now = new Date().toISOString()
  sqlite.prepare(`
    UPDATE student_notes
    SET note_text = ?, updated_at = ?
    WHERE id = ?
  `).run(noteText.trim(), now, id)

  const admin = sqlite.prepare('SELECT full_name FROM administrators WHERE id = ?').get(existing.created_by) as any

  log.info(`Updated student note: id=${id}`)

  return {
    id,
    studentId: existing.student_id,
    noteText: noteText.trim(),
    createdBy: existing.created_by,
    createdByName: admin?.full_name,
    createdAt: existing.created_at,
    updatedAt: now,
  }
}

export async function deleteStudentNote(id: number): Promise<boolean> {
  requireSession()
  const sqlite = getSqlite()

  const existing = sqlite.prepare('SELECT id FROM student_notes WHERE id = ?').get(id)
  if (!existing) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Note not found')
  }

  sqlite.prepare('DELETE FROM student_notes WHERE id = ?').run(id)
  log.info(`Deleted student note: id=${id}`)
  return true
}
