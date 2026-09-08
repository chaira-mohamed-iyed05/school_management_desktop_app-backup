import { registerAuthHandlers } from './auth.ipc'
import { registerStudentHandlers } from './students.ipc'
import { registerAttendanceHandlers } from './attendance.ipc'
import { registerEntityHandlers } from './entities.ipc'
import { registerPaymentHandlers } from './payments.ipc'
import { registerUtilityHandlers } from './utility.ipc'
import { registerSchedulesHandlers } from './schedules.ipc'
import { registerSessionsHandlers } from './sessions.ipc'
import { registerMediaHandlers } from './media.ipc'
import { registerNotesHandlers } from './notes.ipc'
import log from 'electron-log'

export function registerAllIpcHandlers(): void {
  registerAuthHandlers()
  registerStudentHandlers()
  registerEntityHandlers()
  registerAttendanceHandlers()
  registerPaymentHandlers()
  registerUtilityHandlers()
  registerSchedulesHandlers()
  registerSessionsHandlers()
  registerMediaHandlers()
  registerNotesHandlers()
  log.info('All IPC handlers registered')
}
