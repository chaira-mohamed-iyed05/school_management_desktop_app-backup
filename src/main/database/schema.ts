import { sqliteTable, integer, text, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ─── Administrators ───────────────────────────────────────────────────────────

export const administrators = sqliteTable('administrators', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role', { enum: ['superadmin', 'admin'] }).notNull().default('admin'),
  preferredLanguage: text('preferred_language', { enum: ['ar', 'fr', 'en'] }).notNull().default('ar'),
  photoPath: text('photo_path'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: text('locked_until'),
  lastLoginAt: text('last_login_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ─── Students ────────────────────────────────────────────────────────────────

export const students = sqliteTable('students', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentNumber: text('student_number').notNull().unique(),
  firstNameAr: text('first_name_ar').notNull(),
  lastNameAr: text('last_name_ar').notNull(),
  firstNameFr: text('first_name_fr').notNull(),
  lastNameFr: text('last_name_fr').notNull(),
  dateOfBirth: text('date_of_birth'),
  gender: text('gender', { enum: ['male', 'female'] }).notNull(),
  phone: text('phone'),
  guardianName: text('guardian_name'),
  guardianRelationship: text('guardian_relationship'),
  guardianPhone: text('guardian_phone'),
  secondaryPhone: text('secondary_phone'),
  address: text('address'),
  photoPath: text('photo_path'),
  registrationDate: text('registration_date').notNull().default(sql`(date('now'))`),
  status: text('status', { enum: ['active', 'inactive', 'archived'] }).notNull().default('active'),
  qrToken: text('qr_token').notNull().unique(),
  qrTokenActive: integer('qr_token_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  archivedAt: text('archived_at'),
}, (table) => ({
  studentNumberIdx: uniqueIndex('idx_students_number').on(table.studentNumber),
  qrTokenIdx: uniqueIndex('idx_students_qr').on(table.qrToken),
  nameArIdx: index('idx_students_name_ar').on(table.lastNameAr),
  nameFrIdx: index('idx_students_name_fr').on(table.lastNameFr),
  statusIdx: index('idx_students_status').on(table.status),
}))

// ─── Teachers ────────────────────────────────────────────────────────────────

export const teachers = sqliteTable('teachers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  courseId: integer('course_id').references((): any => courses.id),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  photoPath: text('photo_path'),
  status: text('status', { enum: ['active', 'inactive', 'archived'] }).notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  archivedAt: text('archived_at'),
}, (table) => ({
  nameIdx: index('idx_teachers_name').on(table.lastName),
  statusIdx: index('idx_teachers_status').on(table.status),
  courseIdx: index('idx_teachers_course').on(table.courseId),
}))

// ─── Courses ─────────────────────────────────────────────────────────────────

export const courses = sqliteTable('courses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nameAr: text('name_ar').notNull(),
  nameFr: text('name_fr').notNull(),
  nameEn: text('name_en').notNull().default(''),
  descriptionAr: text('description_ar'),
  descriptionFr: text('description_fr'),
  descriptionEn: text('description_en'),
  defaultPrice: real('default_price').notNull().default(0),
  defaultTeacherId: integer('default_teacher_id').references((): any => teachers.id),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ─── Groups ───────────────────────────────────────────────────────────────────

export const groups = sqliteTable('groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  courseId: integer('course_id').notNull().references(() => courses.id),
  teacherId: integer('teacher_id').notNull().references(() => teachers.id),
  name: text('name').notNull(),
  room: text('room'),
  scheduleJson: text('schedule_json'),
  capacity: integer('capacity').notNull().default(30),
  monthlyPrice: real('monthly_price').notNull().default(0),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  status: text('status', { enum: ['active', 'inactive', 'completed'] }).notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  courseIdx: index('idx_groups_course').on(table.courseId),
  teacherIdx: index('idx_groups_teacher').on(table.teacherId),
  statusIdx: index('idx_groups_status').on(table.status),
}))

// ─── Enrollments ──────────────────────────────────────────────────────────────

export const enrollments = sqliteTable('enrollments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => students.id),
  groupId: integer('group_id').notNull().references(() => groups.id),
  agreedPrice: real('agreed_price').notNull(),
  enrollmentDate: text('enrollment_date').notNull().default(sql`(date('now'))`),
  status: text('status', { enum: ['active', 'inactive', 'completed'] }).notNull().default('active'),
  cancelledAt: text('cancelled_at'),
  cancelReason: text('cancel_reason'),
  refundAmount: real('refund_amount'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  studentGroupIdx: uniqueIndex('idx_enrollments_student_group').on(table.studentId, table.groupId),
  studentIdx: index('idx_enrollments_student').on(table.studentId),
  groupIdx: index('idx_enrollments_group').on(table.groupId),
}))

// ─── Group Schedule Slots (must be before attendance_sessions) ────────────────

export const groupScheduleSlots = sqliteTable('group_schedule_slots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id').notNull().references(() => groups.id),
  weekday: integer('weekday').notNull(), // 0=Monday, 6=Sunday
  startTime: text('start_time').notNull(), // HH:MM
  endTime: text('end_time').notNull(), // HH:MM
  room: text('room'),
  effectiveFrom: text('effective_from').notNull().default(sql`(date('now'))`),
  effectiveUntil: text('effective_until'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  createdBy: integer('created_by').references(() => administrators.id),
}, (table) => ({
  groupIdx: index('idx_schedule_group').on(table.groupId),
  weekdayIdx: index('idx_schedule_weekday').on(table.weekday),
  activeIdx: index('idx_schedule_active').on(table.isActive),
  uniqueSlot: uniqueIndex('idx_schedule_unique').on(table.groupId, table.weekday, table.startTime),
}))

// ─── Student Notes ────────────────────────────────────────────────────────────

export const studentNotes = sqliteTable('student_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => students.id),
  noteText: text('note_text').notNull(),
  createdBy: integer('created_by').notNull().references(() => administrators.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  studentIdx: index('idx_notes_student').on(table.studentId),
}))

// ─── Attendance Sessions ──────────────────────────────────────────────────────

export const attendanceSessions = sqliteTable('attendance_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id').notNull().references(() => groups.id),
  sessionDate: text('session_date').notNull(),
  plannedStartTime: text('planned_start_time'),
  actualStartTime: text('actual_start_time'),
  endTime: text('end_time'),
  room: text('room'),
  lateThresholdMinutes: integer('late_threshold_minutes').notNull().default(10),
  status: text('status', { enum: ['open', 'closed'] }).notNull().default('open'),
  sessionType: text('session_type', { enum: ['regular', 'extra', 'makeup', 'cancelled'] }).notNull().default('regular'),
  price: integer('price'), // null = default group session price (monthly/4), 0 = free, >0 = custom DA
  scheduleSlotId: integer('schedule_slot_id').references(() => groupScheduleSlots.id),
  cancelledReason: text('cancelled_reason'),
  createdBy: integer('created_by').notNull().references(() => administrators.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  groupDateIdx: index('idx_sessions_group_date').on(table.groupId, table.sessionDate),
  dateIdx: index('idx_sessions_date').on(table.sessionDate),
  typeIdx: index('idx_sessions_type').on(table.sessionType),
  scheduleSlotIdx: index('idx_sessions_schedule_slot').on(table.scheduleSlotId),
}))

// ─── Attendance Records ───────────────────────────────────────────────────────

export const attendanceRecords = sqliteTable('attendance_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => attendanceSessions.id),
  studentId: integer('student_id').notNull().references(() => students.id),
  scannedAt: text('scanned_at'),
  attendanceStatus: text('attendance_status', { enum: ['present', 'absent', 'inactive', 'not_active'] }).notNull(),
  isInactive: integer('is_inactive', { mode: 'boolean' }).notNull().default(false),
  source: text('source', { enum: ['qr', 'manual'] }).notNull().default('qr'),
  wasEnrolled: integer('was_enrolled', { mode: 'boolean' }).notNull().default(true),
  notes: text('notes'),
  createdBy: integer('created_by').references(() => administrators.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  // Critical: prevents duplicate attendance in same session
  uniqueSessionStudent: uniqueIndex('idx_attendance_session_student').on(table.sessionId, table.studentId),
  sessionIdx: index('idx_attendance_session').on(table.sessionId),
  studentIdx: index('idx_attendance_student').on(table.studentId),
}))

// ─── Payments ────────────────────────────────────────────────────────────────

export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  receiptNumber: text('receipt_number').notNull().unique(),
  studentId: integer('student_id').notNull().references(() => students.id),
  enrollmentId: integer('enrollment_id').notNull().references(() => enrollments.id),
  billingPeriod: text('billing_period').notNull().default(''),
  amount: real('amount').notNull(),
  paymentType: text('payment_type', {
    enum: [
      'credit', 'deduction', 'transfer_in', 'transfer_out', 'refund',
      'payment', 'session_charge', 'session_refund', 'enrollment_refund',
      'payment_cancellation', 'manual_adjustment'
    ]
  }).notNull().default('credit'),
  sessionId: integer('session_id').references(() => attendanceSessions.id),
  paymentMethod: text('payment_method', { enum: ['cash', 'transfer', 'check'] }),
  paymentDate: text('payment_date').notNull(),
  reference: text('reference'),
  notes: text('notes'),
  receivedBy: integer('received_by').notNull().references(() => administrators.id),
  status: text('status', { enum: ['paid', 'cancelled'] }).notNull().default('paid'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  receiptIdx: uniqueIndex('idx_payments_receipt').on(table.receiptNumber),
  studentIdx: index('idx_payments_student').on(table.studentId),
  dateIdx: index('idx_payments_date').on(table.paymentDate),
  periodIdx: index('idx_payments_period').on(table.billingPeriod),
}))

// ─── School Settings ──────────────────────────────────────────────────────────

export const schoolSettings = sqliteTable('school_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  schoolNameAr: text('school_name_ar').notNull().default(''),
  schoolNameFr: text('school_name_fr').notNull().default(''),
  schoolNameEn: text('school_name_en').notNull().default(''),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  academicYear: text('academic_year').notNull().default('2025-2026'),
  currency: text('currency').notNull().default('DZD'),
  studentNumberPrefix: text('student_number_prefix').notNull().default('ETU'),
  receiptPrefix: text('receipt_prefix').notNull().default('REC'),
  defaultLanguage: text('default_language', { enum: ['ar', 'fr', 'en'] }).notNull().default('ar'),
  backupDirectory: text('backup_directory'),
  automaticBackupEnabled: integer('automatic_backup_enabled', { mode: 'boolean' }).notNull().default(false),
  backupsToRetain: integer('backups_to_retain').notNull().default(30),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  administratorId: integer('administrator_id').references(() => administrators.id),
  action: text('action').notNull(), // e.g. 'student.archive', 'payment.create'
  entityType: text('entity_type'), // e.g. 'student', 'payment'
  entityId: integer('entity_id'),
  sanitizedDetailsJson: text('sanitized_details_json'), // NO passwords or sensitive data
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  adminIdx: index('idx_audit_admin').on(table.administratorId),
  actionIdx: index('idx_audit_action').on(table.action),
  entityIdx: index('idx_audit_entity').on(table.entityType, table.entityId),
}))

// ─── App Metadata ─────────────────────────────────────────────────────────────

export const appMetadata = sqliteTable('app_metadata', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ─── Type exports for ORM queries ─────────────────────────────────────────────

export type InsertAdministrator = typeof administrators.$inferInsert
export type SelectAdministrator = typeof administrators.$inferSelect

export type InsertStudent = typeof students.$inferInsert
export type SelectStudent = typeof students.$inferSelect

export type InsertTeacher = typeof teachers.$inferInsert
export type SelectTeacher = typeof teachers.$inferSelect

export type InsertCourse = typeof courses.$inferInsert
export type SelectCourse = typeof courses.$inferSelect

export type InsertGroup = typeof groups.$inferInsert
export type SelectGroup = typeof groups.$inferSelect

export type InsertEnrollment = typeof enrollments.$inferInsert
export type SelectEnrollment = typeof enrollments.$inferSelect

export type InsertAttendanceSession = typeof attendanceSessions.$inferInsert
export type SelectAttendanceSession = typeof attendanceSessions.$inferSelect

export type InsertAttendanceRecord = typeof attendanceRecords.$inferInsert
export type SelectAttendanceRecord = typeof attendanceRecords.$inferSelect

export type InsertPayment = typeof payments.$inferInsert
export type SelectPayment = typeof payments.$inferSelect

export type InsertGroupScheduleSlot = typeof groupScheduleSlots.$inferInsert
export type SelectGroupScheduleSlot = typeof groupScheduleSlots.$inferSelect

export type InsertStudentNote = typeof studentNotes.$inferInsert
export type SelectStudentNote = typeof studentNotes.$inferSelect
