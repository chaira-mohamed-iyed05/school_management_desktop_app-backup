import { handle } from './_handler'
import { IPC_CHANNELS } from '../../shared/constants/index'
import {
  CreateTeacherSchema, UpdateTeacherSchema,
  CreateCourseSchema, UpdateCourseSchema,
  CreateGroupSchema, UpdateGroupSchema,
  CreateEnrollmentSchema,
} from '../../shared/schemas/index'
import {
  listTeachers, createTeacher, updateTeacher, archiveTeacher,
  listCourses, createCourse, updateCourse, deleteCourse,
  listGroups, createGroup, updateGroup, deleteGroup,
  createEnrollment, updateEnrollment, listEnrollmentsByStudent, listEnrollmentsByGroup,
} from '../services/entities.service'
import { z } from 'zod'

export function registerEntityHandlers(): void {
  // Teachers
  handle(IPC_CHANNELS.TEACHERS_LIST, async (payload) => {
    const opts = z.object({ status: z.string().optional(), courseId: z.number().int().positive().optional() }).parse(payload ?? {})
    return listTeachers(opts)
  })
  handle(IPC_CHANNELS.TEACHERS_CREATE, async (payload) => {
    const data = CreateTeacherSchema.parse(payload)
    return createTeacher(data)
  })
  handle(IPC_CHANNELS.TEACHERS_UPDATE, async (payload) => {
    const data = UpdateTeacherSchema.parse(payload)
    const { id, ...rest } = data
    return updateTeacher(id, rest)
  })
  handle(IPC_CHANNELS.TEACHERS_ARCHIVE, async (payload) => {
    const { id } = z.object({ id: z.number().int().positive() }).parse(payload)
    await archiveTeacher(id)
    return true
  })

  // Courses
  handle(IPC_CHANNELS.COURSES_LIST, async (payload) => {
    const opts = z.object({ status: z.string().optional() }).parse(payload ?? {})
    return listCourses(opts)
  })
  handle(IPC_CHANNELS.COURSES_CREATE, async (payload) => {
    const data = CreateCourseSchema.parse(payload)
    return createCourse(data)
  })
  handle(IPC_CHANNELS.COURSES_UPDATE, async (payload) => {
    const data = UpdateCourseSchema.parse(payload)
    const { id, ...rest } = data
    return updateCourse(id, rest)
  })
  handle(IPC_CHANNELS.COURSES_DELETE, async (payload) => {
    const { id } = z.object({ id: z.number().int().positive() }).parse(payload)
    return deleteCourse(id)
  })

  // Groups
  handle(IPC_CHANNELS.GROUPS_LIST, async (payload) => {
    const opts = z.object({
      courseId: z.number().int().positive().optional(),
      status: z.string().optional(),
    }).parse(payload ?? {})
    return listGroups(opts)
  })
  handle(IPC_CHANNELS.GROUPS_BY_COURSE, async (payload) => {
    const { courseId } = z.object({ courseId: z.number().int().positive() }).parse(payload)
    return listGroups({ courseId })
  })
  handle(IPC_CHANNELS.GROUPS_CREATE, async (payload) => {
    const data = CreateGroupSchema.parse(payload)
    return createGroup(data)
  })
  handle(IPC_CHANNELS.GROUPS_UPDATE, async (payload) => {
    const data = UpdateGroupSchema.parse(payload)
    const { id, ...rest } = data
    return updateGroup(id, rest)
  })
  handle(IPC_CHANNELS.GROUPS_DELETE, async (payload) => {
    const { id } = z.object({ id: z.number().int().positive() }).parse(payload)
    return deleteGroup(id)
  })

  // Enrollments
  handle(IPC_CHANNELS.ENROLLMENTS_CREATE, async (payload) => {
    const data = CreateEnrollmentSchema.parse(payload)
    return createEnrollment(data)
  })
  handle(IPC_CHANNELS.ENROLLMENTS_BY_STUDENT, async (payload) => {
    const { studentId } = z.object({ studentId: z.number().int().positive() }).parse(payload)
    return listEnrollmentsByStudent(studentId)
  })
  handle(IPC_CHANNELS.ENROLLMENTS_BY_GROUP, async (payload) => {
    const { groupId } = z.object({ groupId: z.number().int().positive() }).parse(payload)
    return listEnrollmentsByGroup(groupId)
  })
  handle(IPC_CHANNELS.ENROLLMENTS_UPDATE, async (payload) => {
    const { id, ...data } = z.object({
      id: z.number().int().positive(),
      status: z.enum(['active', 'inactive', 'completed']).optional(),
      agreedPrice: z.number().min(0).optional(),
    }).parse(payload)
    return updateEnrollment(id, data)
  })
}

