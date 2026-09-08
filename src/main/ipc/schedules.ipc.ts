import { handle } from './_handler'
import { IPC_CHANNELS } from '../../shared/constants/index'
import { getSqlite } from '../database/connection'
import { groupScheduleSlots } from '../database/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import log from 'electron-log'

const CreateScheduleSchema = z.object({
  groupId: z.number().int().positive(),
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string().optional(),
})

const UpdateScheduleSchema = z.object({
  id: z.number().int().positive(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  room: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

const ListScheduleSchema = z.object({
  groupId: z.number().int().positive().optional(),
  active: z.boolean().optional(),
})

export function registerSchedulesHandlers(): void {
  handle(IPC_CHANNELS.SCHEDULES_LIST, async (payload) => {
    const opts = ListScheduleSchema.parse(payload ?? {})
    const sqlite = getSqlite()

    try {
      let sql = 'SELECT * FROM group_schedule_slots WHERE 1=1'
      const params: any[] = []

      if (opts.groupId) {
        sql += ' AND group_id = ?'
        params.push(opts.groupId)
      }

      if (opts.active !== undefined) {
        sql += ' AND is_active = ?'
        params.push(opts.active ? 1 : 0)
      }

      sql += ' ORDER BY weekday ASC, start_time ASC'

      const stmt = sqlite.prepare(sql)
      const rows = stmt.all(...params) as any[]

      return rows.map((row) => ({
        id: row.id,
        groupId: row.group_id,
        weekday: row.weekday,
        startTime: row.start_time,
        endTime: row.end_time,
        room: row.room,
        effectiveFrom: row.effective_from,
        effectiveUntil: row.effective_until,
        isActive: Boolean(row.is_active),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
    } catch (err) {
      log.error('Failed to list schedules:', err)
      throw new Error(`Unable to list schedules: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  handle(IPC_CHANNELS.SCHEDULES_CREATE, async (payload) => {
    const data = CreateScheduleSchema.parse(payload)
    const sqlite = getSqlite()

    try {
      // Validate times are in correct order
      if (data.startTime >= data.endTime) {
        throw new Error('Start time must be before end time')
      }

      const stmt = sqlite.prepare(`
        INSERT INTO group_schedule_slots (group_id, weekday, start_time, end_time, room, effective_from, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), 1, datetime('now'), datetime('now'))
      `)

      const result = stmt.run(data.groupId, data.weekday, data.startTime, data.endTime, data.room || null)

      const newSlot = sqlite.prepare('SELECT * FROM group_schedule_slots WHERE id = ?').get(result.lastInsertRowid) as any

      const slotResult = {
        id: newSlot.id,
        groupId: newSlot.group_id,
        weekday: newSlot.weekday,
        startTime: newSlot.start_time,
        endTime: newSlot.end_time,
        room: newSlot.room,
        effectiveFrom: newSlot.effective_from,
        effectiveUntil: newSlot.effective_until,
        isActive: Boolean(newSlot.is_active),
        createdAt: newSlot.created_at,
        updatedAt: newSlot.updated_at,
      }

      // Auto-generate full-year sessions for this group after slot creation
      try {
        const group = sqlite.prepare('SELECT * FROM groups WHERE id = ?').get(data.groupId) as any
        if (group) {
          let endDate = group.end_date
          if (!endDate) {
            const d = new Date(); d.setFullYear(d.getFullYear() + 1)
            endDate = d.toISOString().slice(0, 10)
          }
          let currentDate = group.start_date as string
          while (currentDate <= endDate) {
            const dayOfWeek = new Date(currentDate + 'T00:00:00Z').getUTCDay()
            const wd = dayOfWeek === 0 ? 6 : dayOfWeek - 1
            if (wd === data.weekday) {
              sqlite.prepare(`
                INSERT OR IGNORE INTO attendance_sessions (
                  group_id, session_date, planned_start_time, end_time,
                  room, late_threshold_minutes, status, session_type,
                  schedule_slot_id, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 10, 'open', 'regular', ?, 1, datetime('now'), datetime('now'))
              `).run(data.groupId, currentDate, data.startTime, data.endTime, data.room || group.room, newSlot.id)
            }
            const d2 = new Date(currentDate + 'T00:00:00Z'); d2.setUTCDate(d2.getUTCDate() + 1)
            currentDate = d2.toISOString().slice(0, 10)
          }
        }
      } catch (genErr) {
        log.warn('Auto-session generation after slot create failed (non-fatal):', genErr)
      }

      return slotResult
    } catch (err) {
      log.error('Failed to create schedule:', err)
      throw new Error(`Unable to create schedule: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  handle(IPC_CHANNELS.SCHEDULES_UPDATE, async (payload) => {
    const data = UpdateScheduleSchema.parse(payload)
    const sqlite = getSqlite()

    try {
      const updates: string[] = []
      const params: any[] = []

      if (data.startTime !== undefined) {
        updates.push('start_time = ?')
        params.push(data.startTime)
      }

      if (data.endTime !== undefined) {
        updates.push('end_time = ?')
        params.push(data.endTime)
      }

      if (data.room !== undefined) {
        updates.push('room = ?')
        params.push(data.room)
      }

      if (data.isActive !== undefined) {
        updates.push('is_active = ?')
        params.push(data.isActive ? 1 : 0)
      }

      updates.push('updated_at = datetime(\'now\')')

      if (updates.length === 1) {
        // Only updated_at, fetch and return
        const slot = sqlite.prepare('SELECT * FROM group_schedule_slots WHERE id = ?').get(data.id)
        if (!slot) throw new Error('Schedule not found')
        return slot
      }

      params.push(data.id)

      const stmt = sqlite.prepare(`
        UPDATE group_schedule_slots
        SET ${updates.join(', ')}
        WHERE id = ?
      `)

      stmt.run(...params)

      const updated = sqlite.prepare('SELECT * FROM group_schedule_slots WHERE id = ?').get(data.id) as any

      return {
        id: updated.id,
        groupId: updated.group_id,
        weekday: updated.weekday,
        startTime: updated.start_time,
        endTime: updated.end_time,
        room: updated.room,
        effectiveFrom: updated.effective_from,
        effectiveUntil: updated.effective_until,
        isActive: Boolean(updated.is_active),
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      }
    } catch (err) {
      log.error('Failed to update schedule:', err)
      throw new Error(`Unable to update schedule: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  handle(IPC_CHANNELS.SCHEDULES_DELETE, async (payload) => {
    const { id } = z.object({ id: z.number().int().positive() }).parse(payload)
    const sqlite = getSqlite()

    try {
      sqlite.transaction(() => {
        // 1. Delete future or empty attendance sessions linked to this slot that have no records and no payments
        sqlite.prepare(`
          DELETE FROM attendance_sessions
          WHERE schedule_slot_id = ?
            AND id NOT IN (SELECT DISTINCT session_id FROM attendance_records WHERE session_id IS NOT NULL)
            AND id NOT IN (SELECT DISTINCT session_id FROM payments WHERE session_id IS NOT NULL)
        `).run(id)

        // 2. For any remaining sessions that DO have records/payments, safely unlink or merge
        const remaining = sqlite.prepare(`
          SELECT id, group_id, session_date FROM attendance_sessions WHERE schedule_slot_id = ?
        `).all(id) as any[]

        for (const sess of remaining) {
          const conflicting = sqlite.prepare(`
            SELECT id FROM attendance_sessions
            WHERE group_id = ? AND session_date = ? AND (schedule_slot_id IS NULL OR schedule_slot_id = 0) AND id != ?
          `).get(sess.group_id, sess.session_date, sess.id) as any

          if (conflicting) {
            sqlite.prepare(`UPDATE OR IGNORE attendance_records SET session_id = ? WHERE session_id = ?`).run(conflicting.id, sess.id)
            sqlite.prepare(`DELETE FROM attendance_records WHERE session_id = ?`).run(sess.id)
            sqlite.prepare(`UPDATE payments SET session_id = ? WHERE session_id = ?`).run(conflicting.id, sess.id)
            sqlite.prepare(`DELETE FROM attendance_sessions WHERE id = ?`).run(sess.id)
          } else {
            sqlite.prepare(`UPDATE attendance_sessions SET schedule_slot_id = NULL WHERE id = ?`).run(sess.id)
          }
        }

        // 3. Delete the schedule slot itself
        sqlite.prepare('DELETE FROM group_schedule_slots WHERE id = ?').run(id)
      })()

      return true
    } catch (err) {
      log.error('Failed to delete schedule:', err)
      throw new Error(`Unable to delete schedule: ${err instanceof Error ? err.message : String(err)}`)
    }
  })
  // ─── List ALL slots with group/course info (for dashboard weekly view) ──────

  handle('schedules:listAll', async () => {
    const sqlite = getSqlite()
    try {
      const rows = sqlite.prepare(`
        SELECT s.*, g.name as group_name, g.course_id, g.teacher_id,
               c.name_ar as course_name_ar, c.name_fr as course_name_fr,
               t.first_name as teacher_first_name, t.last_name as teacher_last_name
        FROM group_schedule_slots s
        JOIN groups g ON s.group_id = g.id
        JOIN courses c ON g.course_id = c.id
        LEFT JOIN teachers t ON g.teacher_id = t.id
        WHERE s.is_active = 1 AND g.status = 'active'
        ORDER BY s.weekday ASC, s.start_time ASC
      `).all() as any[]

      return rows.map(r => ({
        groupId: r.group_id,
        groupName: r.group_name,
        courseNameAr: r.course_name_ar,
        courseNameFr: r.course_name_fr,
        teacherId: r.teacher_id,
        teacherNameAr: r.teacher_last_name ? `${r.teacher_last_name} ${r.teacher_first_name || ''}`.trim() : null,
        teacherNameFr: r.teacher_last_name ? `${r.teacher_last_name} ${r.teacher_first_name || ''}`.trim() : null,
        weekday: r.weekday,
        startTime: r.start_time,
        endTime: r.end_time,
        room: r.room,
      }))
    } catch (err) {
      log.error('Failed to list all schedules:', err)
      return []
    }
  })
}
