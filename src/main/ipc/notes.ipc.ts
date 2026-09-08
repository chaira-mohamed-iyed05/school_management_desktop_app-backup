import { handle } from './_handler'
import { IPC_CHANNELS } from '../../shared/constants/index'
import {
  listStudentNotes,
  createStudentNote,
  updateStudentNote,
  deleteStudentNote,
} from '../services/notes.service'
import { z } from 'zod'

export function registerNotesHandlers(): void {
  handle(IPC_CHANNELS.NOTES_LIST, async (payload) => {
    const { studentId } = z.object({ studentId: z.number().int().positive() }).parse(payload)
    return listStudentNotes(studentId)
  })

  handle(IPC_CHANNELS.NOTES_CREATE, async (payload) => {
    const data = z.object({
      studentId: z.number().int().positive(),
      noteText: z.string().min(1).max(5000),
    }).parse(payload)
    return createStudentNote(data)
  })

  handle(IPC_CHANNELS.NOTES_UPDATE, async (payload) => {
    const { id, noteText } = z.object({
      id: z.number().int().positive(),
      noteText: z.string().min(1).max(5000),
    }).parse(payload)
    return updateStudentNote(id, noteText)
  })

  handle(IPC_CHANNELS.NOTES_DELETE, async (payload) => {
    const { id } = z.object({ id: z.number().int().positive() }).parse(payload)
    return deleteStudentNote(id)
  })
}
