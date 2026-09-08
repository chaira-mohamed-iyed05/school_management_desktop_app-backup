// Zod validation schemas for IPC inputs
// These run in the MAIN PROCESS to validate all renderer inputs
// Using zod v3 (compatible with both main and renderer)
import { z } from 'zod'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  username: z.string().min(1).max(50).trim(),
  password: z.string().min(1).max(200),
})

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
})

// ─── First-launch setup ───────────────────────────────────────────────────────

export const SetupSchema = z.object({
  schoolNameAr: z.string().min(1).max(200).trim(),
  schoolNameFr: z.string().min(1).max(200).trim(),
  schoolNameEn: z.string().max(200).trim().optional().nullable(),
  phone: z.string().max(50).trim().optional().nullable(),
  email: z.string().max(200).trim().optional().nullable().or(z.literal('')),
  address: z.string().max(500).trim().optional().nullable(),
  academicYear: z.string().max(50).default('2025-2026'),
  adminFullName: z.string().min(1).max(200).trim(),
  adminUsername: z.string().min(1).max(50).trim(),
  adminPassword: z.string().min(4).max(200),
  preferredLanguage: z.enum(['ar', 'fr', 'en']).default('ar'),
})

// ─── Students ────────────────────────────────────────────────────────────────

export const CreateStudentSchema = z.object({
  firstNameAr: z.string().min(1).max(100).trim(),
  lastNameAr: z.string().min(1).max(100).trim(),
  firstNameFr: z.string().min(1).max(100).trim(),
  lastNameFr: z.string().min(1).max(100).trim(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  gender: z.enum(['male', 'female']),
  phone: z.string().max(30).trim().optional().nullable(),
  guardianName: z.string().max(200).trim().optional().nullable(),
  guardianRelationship: z.string().max(100).trim().optional().nullable(),
  guardianPhone: z.string().max(30).trim().optional().nullable(),
  secondaryPhone: z.string().max(30).trim().optional().nullable(),
  address: z.string().max(500).trim().optional().nullable(),
  photoPath: z.string().max(500).optional().nullable(),
})

export const UpdateStudentSchema = CreateStudentSchema.partial().extend({
  id: z.number().int().positive(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
})

export const StudentIdSchema = z.object({
  id: z.number().int().positive(),
})

export const StudentListSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(1000).default(100),
  search: z.string().max(200).trim().optional(),
  status: z.enum(['active', 'inactive', 'archived', 'all', 'paid', 'in_debt']).default('all'),
  courseId: z.number().int().positive().optional(),
  teacherId: z.number().int().positive().optional(),
  groupId: z.number().int().positive().optional(),
})

// ─── Teachers ────────────────────────────────────────────────────────────────
 
export const CreateTeacherSchema = z.object({
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  courseId: z.number().int().positive().optional().nullable(),
  phone: z.string().max(30).trim().optional().nullable(),
  email: z.string().email().max(200).trim().optional().nullable().or(z.literal('')),
  address: z.string().max(500).trim().optional().nullable(),
  photoPath: z.string().max(500).optional().nullable(),
})

export const UpdateTeacherSchema = CreateTeacherSchema.partial().extend({
  id: z.number().int().positive(),
  courseId: z.number().int().positive().optional().nullable(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  photoPath: z.string().max(500).optional().nullable(),
})

// ─── Courses ─────────────────────────────────────────────────────────────────

export const CreateCourseSchema = z.object({
  nameAr: z.string().min(1).max(200).trim(),
  nameFr: z.string().min(1).max(200).trim(),
  nameEn: z.string().max(200).trim().optional().default(''),
  descriptionAr: z.string().max(1000).trim().optional().nullable(),
  descriptionFr: z.string().max(1000).trim().optional().nullable(),
  descriptionEn: z.string().max(1000).trim().optional().nullable(),
  defaultPrice: z.number().min(0).max(1_000_000),
})

export const UpdateCourseSchema = CreateCourseSchema.partial().extend({
  id: z.number().int().positive(),
})

// ─── Groups ───────────────────────────────────────────────────────────────────

export const CreateGroupSchema = z.object({
  courseId: z.number().int().positive(),
  teacherId: z.number().int().positive(),
  name: z.string().min(1).max(200).trim(),
  room: z.string().max(100).trim().optional().nullable(),
  scheduleJson: z.string().max(2000).optional().nullable(),
  capacity: z.number().int().min(1).max(500),
  monthlyPrice: z.number().min(0).max(1_000_000),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
})

export const UpdateGroupSchema = CreateGroupSchema.partial().extend({
  id: z.number().int().positive(),
})

// ─── Enrollments ──────────────────────────────────────────────────────────────

export const CreateEnrollmentSchema = z.object({
  studentId: z.number().int().positive(),
  groupId: z.number().int().positive(),
  agreedPrice: z.number().min(0).max(1_000_000),
  enrollmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

// ─── Attendance ───────────────────────────────────────────────────────────────

export const StartSessionSchema = z.object({
  groupId: z.number().int().positive(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plannedStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  lateThresholdMinutes: z.number().int().min(0).max(120).default(10),
})

export const ScanQRSchema = z.object({
  sessionId: z.number().int().positive(),
  token: z.string().min(1).max(200).trim(),
})

export const ManualAttendanceSchema = z.object({
  sessionId: z.number().int().positive(),
  studentId: z.number().int().positive(),
  attendanceStatus: z.enum(['present', 'absent', 'inactive', 'not_active']),
  notes: z.string().max(500).trim().optional().nullable(),
})

export const EndSessionSchema = z.object({
  sessionId: z.number().int().positive(),
})

// ─── Payments ────────────────────────────────────────────────────────────────

export const CreatePaymentSchema = z.object({
  studentId: z.number().int().positive(),
  enrollmentId: z.number().int().positive(),
  billingPeriod: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().min(0).max(10_000_000),
  paymentMethod: z.enum(['cash', 'transfer', 'check']),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().max(200).trim().optional().nullable(),
  notes: z.string().max(500).trim().optional().nullable(),
})

export const CancelPaymentSchema = z.object({
  id: z.number().int().positive(),
  reason: z.string().max(500).trim().optional().nullable(),
})

// ─── Settings ────────────────────────────────────────────────────────────────

export const UpdateSettingsSchema = z.object({
  schoolNameAr: z.string().min(1).max(200).trim().optional(),
  schoolNameFr: z.string().min(1).max(200).trim().optional(),
  schoolNameEn: z.string().max(200).trim().optional(),
  phone: z.string().max(30).trim().optional().nullable(),
  email: z.string().email().max(200).trim().optional().nullable().or(z.literal('')),
  address: z.string().max(500).trim().optional().nullable(),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/).optional(),
  currency: z.string().max(10).optional(),
  defaultLanguage: z.enum(['ar', 'fr', 'en']).optional(),
  backupDirectory: z.string().max(500).optional().nullable(),
  automaticBackupEnabled: z.boolean().optional(),
  backupsToRetain: z.number().int().min(1).max(365).optional(),
})

// ─── Media ────────────────────────────────────────────────────────────────────

export const UploadPhotoSchema = z.object({
  sourcePath: z.string().min(1).max(1000),
  entityType: z.enum(['student', 'teacher']),
  entityId: z.number().int().positive(),
})

// ─── Backup ───────────────────────────────────────────────────────────────────

export const RestoreBackupSchema = z.object({
  backupPath: z.string().min(1).max(1000),
  confirmPassword: z.string().min(1).max(200),
})

// ─── Reports ─────────────────────────────────────────────────────────────────

export const GenerateReportSchema = z.object({
  type: z.enum(['attendance', 'payments', 'students', 'revenue']),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  groupId: z.number().int().positive().optional(),
  courseId: z.number().int().positive().optional(),
})
