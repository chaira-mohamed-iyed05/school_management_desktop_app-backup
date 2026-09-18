import { handle } from './_handler'
import { IPC_CHANNELS } from '../../shared/constants/index'
import { getSqlite } from '../database/connection'
import { z } from 'zod'
import log from 'electron-log'
import { endAttendanceSession } from '../services/attendance.service'

const CreateExtraSessionSchema = z.object({
  groupId: z.number().int().positive(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string().optional(),
  teacherId: z.number().int().positive().optional(),
  price: z.number().nullable().optional(),
})

const GenerateSessionsSchema = z.object({
  groupId: z.number().int().positive(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const CancelSessionSchema = z.object({
  sessionId: z.number().int().positive(),
  reason: z.string().optional(),
})

function getWeekdayFromDate(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00Z')
  const day = date.getUTCDay()
  // Convert JS (0=Sunday) to our format (0=Monday ... 6=Sunday)
  return day === 0 ? 6 : day - 1
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().split('T')[0]
}

function getDayInfo(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00Z')
  const day = date.getUTCDay()
  const daysFr = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  const daysAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
  return {
    dayOfWeek: day,
    dayNameFr: daysFr[day] || 'Inconnu',
    dayNameAr: daysAr[day] || '',
  }
}

export function registerSessionsHandlers(): void {
  handle(IPC_CHANNELS.SESSIONS_GENERATE, async (payload) => {
    const { groupId, startDate, endDate } = GenerateSessionsSchema.parse(payload)
    const sqlite = getSqlite()

    try {
      const slots = sqlite.prepare(`
        SELECT * FROM group_schedule_slots
        WHERE group_id = ? AND is_active = 1
        ORDER BY weekday ASC, start_time ASC
      `).all(groupId) as any[]

      if (slots.length === 0) {
        return { generated: 0, message: 'Aucun créneau horaire configuré pour ce groupe' }
      }

      const group = sqlite.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as any
      if (!group) throw new Error('Groupe introuvable')

      let generated = 0
      let currentDate = startDate

      while (currentDate <= endDate) {
        const weekday = getWeekdayFromDate(currentDate)
        const matchingSlots = slots.filter((s) => s.weekday === weekday)

        for (const slot of matchingSlots) {
          // Check if session already exists on this date and time
          const existing = sqlite.prepare(`
            SELECT id FROM attendance_sessions
            WHERE group_id = ? AND session_date = ? AND COALESCE(planned_start_time, '') = ?
          `).get(groupId, currentDate, slot.start_time)

          if (!existing) {
            const result = sqlite.prepare(`
              INSERT INTO attendance_sessions (
                group_id, session_date, planned_start_time, end_time,
                room, late_threshold_minutes, status, session_type,
                schedule_slot_id, created_by, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, 10, 'open', 'regular', ?, 1, datetime('now'), datetime('now'))
            `).run(
              groupId, currentDate, slot.start_time, slot.end_time,
              slot.room || group.room, slot.id
            )
            if (result.changes > 0) generated++
          }
        }

        currentDate = addDays(currentDate, 1)
      }

      log.info(`Generated ${generated} sessions for group ${groupId}`)
      return { generated, message: `${generated} séances générées avec succès (${startDate} au ${endDate})` }
    } catch (err) {
      log.error('Failed to generate sessions:', err)
      throw new Error(`Erreur génération séances: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  // ─── Auto-generate sessions for full year when group+slots are created ────

  handle('sessions:generateForGroup', async (payload) => {
    const { groupId } = z.object({ groupId: z.number().int().positive() }).parse(payload)
    const sqlite = getSqlite()

    try {
      const group = sqlite.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as any
      if (!group) throw new Error('Group not found')

      const slots = sqlite.prepare(`
        SELECT * FROM group_schedule_slots WHERE group_id = ? AND is_active = 1
      `).all(groupId) as any[]

      if (slots.length === 0) return { generated: 0, message: 'Aucun créneau' }

      const startDate = group.start_date || new Date().toISOString().slice(0, 10)
      let endDate = group.end_date
      if (!endDate) {
        const d = new Date(startDate + 'T00:00:00Z')
        d.setUTCFullYear(d.getUTCFullYear() + 1)
        endDate = d.toISOString().slice(0, 10)
      }

      let generated = 0
      let currentDate = startDate

      while (currentDate <= endDate) {
        const weekday = getWeekdayFromDate(currentDate)
        const matchingSlots = slots.filter((s: any) => s.weekday === weekday)

        for (const slot of matchingSlots) {
          const existing = sqlite.prepare(`
            SELECT id FROM attendance_sessions
            WHERE group_id = ? AND session_date = ? AND COALESCE(planned_start_time, '') = ?
          `).get(groupId, currentDate, slot.start_time)

          if (!existing) {
            const result = sqlite.prepare(`
              INSERT INTO attendance_sessions (
                group_id, session_date, planned_start_time, end_time,
                room, late_threshold_minutes, status, session_type,
                schedule_slot_id, created_by, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, 10, 'open', 'regular', ?, 1, datetime('now'), datetime('now'))
            `).run(groupId, currentDate, slot.start_time, slot.end_time, slot.room || group.room, slot.id)
            if (result.changes > 0) generated++
          }
        }

        currentDate = addDays(currentDate, 1)
      }

      log.info(`Auto-generated ${generated} sessions for group ${groupId} (${startDate} → ${endDate})`)
      return { generated, message: `${generated} séances générées jusqu'au ${endDate}` }
    } catch (err) {
      log.error('Failed to auto-generate sessions for group:', err)
      throw new Error(`Erreur génération automatique: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  // ─── Trim sessions after a new end date ───────────────────────────────────

  handle('sessions:trimAfterDate', async (payload) => {
    const { groupId, afterDate } = z.object({
      groupId: z.number().int().positive(),
      afterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(payload)
    const sqlite = getSqlite()

    const result = sqlite.prepare(`
      DELETE FROM attendance_sessions
      WHERE group_id = ? AND session_date > ?
        AND session_type = 'regular'
        AND id NOT IN (SELECT DISTINCT session_id FROM attendance_records)
    `).run(groupId, afterDate)

    log.info(`Trimmed ${result.changes} future sessions for group ${groupId} after ${afterDate}`)
    return { removed: result.changes }
  })

  handle(IPC_CHANNELS.SESSIONS_CREATE_EXTRA, async (payload) => {
    const data = CreateExtraSessionSchema.parse(payload)
    const sqlite = getSqlite()

    try {
      if (data.startTime >= data.endTime) {
        throw new Error('L\'heure de début doit précéder l\'heure de fin')
      }

      const group = sqlite.prepare('SELECT * FROM groups WHERE id = ?').get(data.groupId) as any
      if (!group) throw new Error('Groupe introuvable')

      const stmt = sqlite.prepare(`
        INSERT INTO attendance_sessions (
          group_id, session_date, planned_start_time, end_time,
          room, status, session_type, price, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'open', 'extra', ?, 1, datetime('now'), datetime('now'))
      `)

      const result = stmt.run(
        data.groupId,
        data.sessionDate,
        data.startTime,
        data.endTime,
        data.room || group.room,
        data.price !== undefined ? data.price : null
      )

      const session = sqlite.prepare('SELECT * FROM attendance_sessions WHERE id = ?').get(result.lastInsertRowid) as any
      const dayInfo = getDayInfo(session.session_date)

      return {
        id: session.id,
        groupId: session.group_id,
        sessionDate: session.session_date,
        plannedStartTime: session.planned_start_time,
        startTime: session.planned_start_time,
        endTime: session.end_time,
        room: session.room,
        sessionType: session.session_type,
        price: session.price,
        status: session.status,
        dayNameFr: dayInfo.dayNameFr,
        dayNameAr: dayInfo.dayNameAr,
        createdAt: session.created_at,
      }
    } catch (err) {
      log.error('Failed to create extra session:', err)
      throw new Error(`Impossible de créer la séance supplémentaire: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  handle(IPC_CHANNELS.SESSIONS_CANCEL, async (payload) => {
    const { sessionId, reason } = CancelSessionSchema.parse(payload)
    const sqlite = getSqlite()

    try {
      return sqlite.transaction(() => {
        // Revert financial deductions for this session (both 'session_charge' and 'deduction', plus any session refund)
        sqlite.prepare(`
          DELETE FROM payments
          WHERE session_id = ? AND payment_type IN ('deduction', 'session_charge', 'refund', 'session_refund')
        `).run(sessionId)

        // Delete attendance records for this session
        sqlite.prepare(`DELETE FROM attendance_records WHERE session_id = ?`).run(sessionId)

        // Mark session as cancelled
        sqlite.prepare(`
          UPDATE attendance_sessions
          SET session_type = 'cancelled', status = 'closed', cancelled_reason = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(reason || 'Séance annulée', sessionId)

        // Audit log entry
        try {
          sqlite.prepare(`
            INSERT INTO audit_logs (administrator_id, action, entity_type, entity_id, sanitized_details_json, created_at)
            VALUES (1, 'session.cancel', 'attendance_session', ?, ?, datetime('now'))
          `).run(sessionId, JSON.stringify({ sessionId, reason: reason || 'Séance annulée' }))
        } catch {}

        log.info(`Cancelled session ${sessionId}, reason: ${reason}`)
        return true
      })()
    } catch (err) {
      log.error('Failed to cancel session:', err)
      throw new Error(`Erreur lors de l'annulation: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  handle(IPC_CHANNELS.SESSIONS_COMPLETE, async (payload) => {
    const { sessionId } = z.object({ sessionId: z.number().int().positive() }).parse(payload)

    try {
      await endAttendanceSession(sessionId)
      return true
    } catch (err) {
      log.error('Failed to complete session:', err)
      throw new Error(`Unable to complete session: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  handle(IPC_CHANNELS.SESSIONS_DELETE, async (payload) => {
    const { sessionId } = z.object({ sessionId: z.number().int().positive() }).parse(payload)
    const sqlite = getSqlite()

    try {
      return sqlite.transaction(() => {
        // Revert financial deductions for this session
        sqlite.prepare(`
          DELETE FROM payments
          WHERE session_id = ? AND payment_type IN ('deduction', 'session_charge', 'refund', 'session_refund')
        `).run(sessionId)
        // Delete attendance records for this session
        sqlite.prepare(`DELETE FROM attendance_records WHERE session_id = ?`).run(sessionId)
        // Delete attendance session
        sqlite.prepare(`DELETE FROM attendance_sessions WHERE id = ?`).run(sessionId)
        return true
      })()
    } catch (err) {
      log.error('Failed to delete session:', err)
      throw new Error(`Unable to delete session: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  handle(IPC_CHANNELS.SESSIONS_LIST, async (payload) => {
    const opts = z.object({
      groupId: z.number().int().positive().optional(),
      status: z.enum(['open', 'closed']).optional(),
      sessionType: z.enum(['regular', 'extra', 'makeup', 'cancelled']).optional(),
      limit: z.number().int().min(1).max(1000).optional(),
    }).parse(payload ?? {})

    const sqlite = getSqlite()

    try {
      let sql = `
        SELECT s.*, g.name as group_name, g.monthly_price as monthly_price,
               c.name_ar as course_name_ar, c.name_fr as course_name_fr,
               t.first_name as teacher_first_name, t.last_name as teacher_last_name,
               (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.attendance_status IN ('present','late')) as present_count,
               (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.attendance_status = 'absent') as absent_count,
               (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.attendance_status = 'late') as late_count,
               CASE WHEN s.status = 'closed'
                 THEN (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND (ar.was_enrolled = 1 OR ar.attendance_status IS NOT NULL))
                 ELSE (SELECT COUNT(*) FROM enrollments e WHERE e.group_id = s.group_id AND e.status = 'active' AND e.enrollment_date <= s.session_date)
               END as enrolled_count
        FROM attendance_sessions s
        LEFT JOIN groups g ON s.group_id = g.id
        LEFT JOIN courses c ON g.course_id = c.id
        LEFT JOIN teachers t ON g.teacher_id = t.id
        WHERE 1=1
      `
      const params: any[] = []

      if (opts.groupId) {
        sql += ' AND s.group_id = ?'
        params.push(opts.groupId)
      }

      if (opts.status) {
        sql += ' AND s.status = ?'
        params.push(opts.status)
      }

      if (opts.sessionType) {
        sql += ' AND s.session_type = ?'
        params.push(opts.sessionType)
      }

      sql += ' ORDER BY s.session_date DESC, s.planned_start_time DESC'

      if (opts.limit) {
        sql += ` LIMIT ${opts.limit}`
      }

      const stmt = sqlite.prepare(sql)
      const rows = stmt.all(...params) as any[]

      return rows.map((row) => {
        const dayInfo = getDayInfo(row.session_date)
        return {
          id: row.id,
          groupId: row.group_id,
          groupName: row.group_name || `Groupe #${row.group_id}`,
          courseName: row.course_name_fr || row.course_name_ar || '',
          courseNameFr: row.course_name_fr,
          courseNameAr: row.course_name_ar,
          teacherName: row.teacher_first_name ? `${row.teacher_first_name} ${row.teacher_last_name}` : undefined,
          sessionDate: row.session_date,
          dayNameFr: dayInfo.dayNameFr,
          dayNameAr: dayInfo.dayNameAr,
          plannedStartTime: row.planned_start_time,
          startTime: row.planned_start_time || row.actual_start_time || '08:00',
          actualStartTime: row.actual_start_time,
          endTime: row.end_time || '',
          room: row.room,
          sessionType: row.session_type,
          price: row.price !== undefined ? row.price : null,
          monthlyPrice: row.monthly_price ?? null,
          status: row.status,
          cancelledReason: row.cancelled_reason,
          lateThresholdMinutes: row.late_threshold_minutes,
          presentCount: row.present_count ?? 0,
          absentCount: row.absent_count ?? 0,
          lateCount: row.late_count ?? 0,
          enrolledCount: row.enrolled_count ?? 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }
      })
    } catch (err) {
      log.error('Failed to list sessions:', err)
      throw new Error(`Unable to list sessions: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  handle(IPC_CHANNELS.SESSIONS_GET, async (payload) => {
    const { id } = z.object({ id: z.number().int().positive() }).parse(payload)
    const sqlite = getSqlite()

    try {
      const session = sqlite.prepare(`
        SELECT s.*, g.name as group_name, g.monthly_price as monthly_price,
               c.name_ar as course_name_ar, c.name_fr as course_name_fr
        FROM attendance_sessions s
        LEFT JOIN groups g ON s.group_id = g.id
        LEFT JOIN courses c ON g.course_id = c.id
        WHERE s.id = ?
      `).get(id) as any

      if (!session) throw new Error('Session not found')
      const dayInfo = getDayInfo(session.session_date)

      return {
        id: session.id,
        groupId: session.group_id,
        groupName: session.group_name,
        courseName: session.course_name_fr || session.course_name_ar,
        sessionDate: session.session_date,
        dayNameFr: dayInfo.dayNameFr,
        dayNameAr: dayInfo.dayNameAr,
        plannedStartTime: session.planned_start_time,
        startTime: session.planned_start_time || session.actual_start_time || '08:00',
        actualStartTime: session.actual_start_time,
        endTime: session.end_time,
        room: session.room,
        sessionType: session.session_type,
        price: session.price !== undefined ? session.price : null,
        monthlyPrice: session.monthly_price ?? null,
        status: session.status,
        cancelledReason: session.cancelled_reason,
        lateThresholdMinutes: session.late_threshold_minutes,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      }
    } catch (err) {
      log.error('Failed to get session:', err)
      throw new Error(`Unable to get session: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  handle(IPC_CHANNELS.SESSIONS_UPCOMING, async (payload) => {
    const opts = z.object({
      groupId: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      todayOnly: z.boolean().optional(),
    }).parse(payload ?? {})

    const sqlite = getSqlite()

    try {
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      // Automatic cleanup: past days open sessions with no attendance -> close or clean
      const eligibleSessions = sqlite.prepare(`
        SELECT id FROM attendance_sessions
        WHERE session_date < ?
          AND status = 'open'
          AND id NOT IN (SELECT DISTINCT session_id FROM attendance_records WHERE attendance_status IN ('present', 'late'))
          AND id NOT IN (SELECT DISTINCT session_id FROM payments WHERE session_id IS NOT NULL)
      `).all(today) as { id: number }[]

      if (eligibleSessions.length > 0) {
        const ids = eligibleSessions.map(s => s.id)
        const placeholders = ids.map(() => '?').join(',')
        sqlite.prepare(`DELETE FROM attendance_records WHERE session_id IN (${placeholders})`).run(...ids)
        sqlite.prepare(`DELETE FROM attendance_sessions WHERE id IN (${placeholders})`).run(...ids)
      }

      sqlite.prepare(`
        UPDATE attendance_sessions
        SET status = 'closed', updated_at = datetime('now')
        WHERE session_date < ? AND status = 'open'
      `).run(today)

      let sql = `
        SELECT s.*, g.name as group_name, g.monthly_price, c.name_ar as course_name_ar, c.name_fr as course_name_fr
        FROM attendance_sessions s
        LEFT JOIN groups g ON s.group_id = g.id
        LEFT JOIN courses c ON g.course_id = c.id
        WHERE ${opts.todayOnly ? 's.session_date = ?' : 's.session_date >= ?'} AND s.session_type != 'cancelled'
        ORDER BY s.session_date ASC, s.planned_start_time ASC
      `
      const params: any[] = [today]

      if (opts.groupId) {
        sql = sql.replace('WHERE', 'WHERE s.group_id = ? AND')
        params.unshift(opts.groupId)
      }

      sql += ` LIMIT ${Math.min(opts.limit || 50, 100)}`

      const stmt = sqlite.prepare(sql)
      const rows = stmt.all(...params) as any[]

      return rows.map((row) => {
        const dayInfo = getDayInfo(row.session_date)
        return {
          id: row.id,
          groupId: row.group_id,
          groupName: row.group_name || (row.course_name_fr || row.course_name_ar ? `${row.course_name_fr || row.course_name_ar}` : undefined),
          courseName: row.course_name_fr || row.course_name_ar,
          sessionDate: row.session_date,
          dayNameFr: dayInfo.dayNameFr,
          dayNameAr: dayInfo.dayNameAr,
          plannedStartTime: row.planned_start_time,
          startTime: row.planned_start_time || row.actual_start_time || '08:00',
          endTime: row.end_time || '',
          room: row.room,
          sessionType: row.session_type,
          price: row.price !== undefined ? row.price : null,
          monthlyPrice: row.monthly_price ?? null,
          status: row.status,
        }
      })
    } catch (err) {
      log.error('Failed to get upcoming sessions:', err)
      throw new Error(`Unable to get upcoming sessions: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  // ─── Get all sessions for a date range (calendar view) ───────────────────

  handle(IPC_CHANNELS.SESSIONS_BY_DATE, async (payload) => {
    const { startDate, endDate } = z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(payload)

    const sqlite = getSqlite()

    try {
      const { autoInstantiateSessionsForRange } = await import('../services/attendance.service')
      await autoInstantiateSessionsForRange(startDate, endDate)

      const rows = sqlite.prepare(`
        SELECT s.id, s.group_id, s.session_date, s.planned_start_time, s.end_time,
               s.room, s.status, s.session_type, s.cancelled_reason, s.price,
               g.name as group_name, g.monthly_price,
               c.name_ar as course_name_ar, c.name_fr as course_name_fr,
               (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.attendance_status IN ('present','late')) as present_count,
               CASE WHEN s.status = 'closed'
                 THEN (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND (ar.was_enrolled = 1 OR ar.attendance_status IS NOT NULL))
                 ELSE (SELECT COUNT(*) FROM enrollments e WHERE e.group_id = s.group_id AND e.status = 'active' AND e.enrollment_date <= s.session_date)
               END as enrolled_count
        FROM attendance_sessions s
        LEFT JOIN groups g ON s.group_id = g.id
        LEFT JOIN courses c ON g.course_id = c.id
        WHERE s.session_date >= ? AND s.session_date <= ?
        ORDER BY s.session_date ASC, s.planned_start_time ASC
      `).all(startDate, endDate) as any[]

      return rows.map(row => {
        const dayInfo = getDayInfo(row.session_date)
        return {
          id: row.id,
          groupId: row.group_id,
          groupName: row.group_name,
          courseNameAr: row.course_name_ar,
          courseNameFr: row.course_name_fr,
          sessionDate: row.session_date,
          dayNameFr: dayInfo.dayNameFr,
          dayNameAr: dayInfo.dayNameAr,
          plannedStartTime: row.planned_start_time,
          startTime: row.planned_start_time || '08:00',
          endTime: row.end_time,
          room: row.room,
          status: row.status,
          sessionType: row.session_type,
          price: row.price !== undefined ? row.price : null,
          monthlyPrice: row.monthly_price ?? null,
          cancelledReason: row.cancelled_reason,
          presentCount: row.present_count ?? 0,
          enrolledCount: row.enrolled_count ?? 0,
        }
      })
    } catch (err) {
      log.error('Failed to get sessions by date:', err)
      throw new Error(`Unable to get sessions by date: ${err instanceof Error ? err.message : String(err)}`)
    }
  })
}
