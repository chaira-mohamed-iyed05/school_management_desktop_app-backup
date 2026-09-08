// Shared TypeScript types used by both main process and renderer
// DO NOT import Node.js or Electron APIs here — this file is used in the renderer

export type StudentStatus = 'active' | 'inactive' | 'archived'
export type PaymentStatus = 'paid' | 'unpaid' | 'partial' | 'overdue'
export type PaymentMethodType = 'cash' | 'transfer' | 'check'
export type AttendanceStatusType = 'present' | 'absent' | 'inactive' | 'not_active'
export type AttendanceSource = 'qr' | 'manual'
export type TeacherStatus = 'active' | 'inactive' | 'archived'
export type CourseStatus = 'active' | 'inactive'
export type GroupStatus = 'active' | 'inactive' | 'completed'
export type EnrollmentStatus = 'active' | 'inactive' | 'completed'
export type SessionStatus = 'open' | 'closed'
export type AdminRole = 'superadmin' | 'admin'
export type Language = 'ar' | 'fr' | 'en'
export type Gender = 'male' | 'female'

// ─── Entity types (subset of DB columns safe for renderer) ───────────────────

export interface Administrator {
  id: number
  username: string
  fullName: string
  role: AdminRole
  preferredLanguage: Language
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface Student {
  id: number
  studentNumber: string
  firstNameAr: string
  lastNameAr: string
  firstNameFr: string
  lastNameFr: string
  dateOfBirth: string | null
  gender: Gender
  phone: string | null
  guardianName: string | null
  guardianRelationship: string | null
  guardianPhone: string | null
  secondaryPhone: string | null
  address: string | null
  photoPath: string | null
  registrationDate: string
  status: StudentStatus
  qrToken: string
  qrTokenActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Teacher {
  id: number
  firstName: string
  lastName: string
  courseId?: number | null
  courseNameAr?: string | null
  courseNameFr?: string | null
  phone: string | null
  email: string | null
  address: string | null
  photoPath: string | null
  status: TeacherStatus
  createdAt: string
  updatedAt: string
}

export interface Course {
  id: number
  nameAr: string
  nameFr: string
  nameEn: string
  descriptionAr: string | null
  descriptionFr: string | null
  descriptionEn: string | null
  defaultPrice: number
  status: CourseStatus
  createdAt: string
  updatedAt: string
}

export interface Group {
  id: number
  courseId: number
  teacherId: number
  name: string
  room: string | null
  scheduleJson: string | null
  capacity: number
  monthlyPrice: number
  startDate: string
  endDate: string | null
  status: GroupStatus
  createdAt: string
  updatedAt: string
  // Joined fields
  courseName?: string
  teacherName?: string
  enrolledCount?: number
}

export interface Enrollment {
  id: number
  studentId: number
  groupId: number
  agreedPrice: number
  enrollmentDate: string
  status: EnrollmentStatus
  createdAt: string
  updatedAt: string
  // Joined fields
  studentName?: string
  groupName?: string
  courseName?: string
  courseNameAr?: string
  courseNameFr?: string
  teacherId?: number
  teacherName?: string
}

export interface AttendanceSession {
  id: number
  groupId: number
  sessionDate: string
  plannedStartTime: string | null
  actualStartTime: string | null
  endTime: string | null
  lateThresholdMinutes: number
  status: SessionStatus
  createdBy: number
  createdAt: string
  updatedAt: string
  // Joined
  groupName?: string
  courseName?: string
}

export interface AttendanceRecord {
  id: number
  sessionId: number
  studentId: number
  scannedAt: string | null
  attendanceStatus: AttendanceStatusType
  isInactive?: boolean
  source: AttendanceSource
  notes: string | null
  createdBy: number | null
  createdAt: string
  updatedAt: string
  // Joined
  studentName?: string
  studentNumber?: string
}

export interface Payment {
  id: number
  receiptNumber: string
  studentId: number
  enrollmentId: number
  billingPeriod: string
  amount: number
  paymentType?: string
  sessionId?: number | null
  paymentMethod: PaymentMethodType
  paymentDate: string
  reference: string | null
  notes: string | null
  receivedBy: number
  status: 'paid' | 'cancelled'
  createdAt: string
  updatedAt: string
  // Joined
  studentName?: string
  studentNumber?: string
  courseName?: string
  groupName?: string
  receivedByName?: string
}

export interface StudentNote {
  id: number
  studentId: number
  noteText: string
  createdBy: number
  createdByName?: string
  createdAt: string
  updatedAt: string
}

export interface SchoolSettings {
  id: number
  schoolNameAr: string
  schoolNameFr: string
  schoolNameEn: string
  phone: string | null
  email: string | null
  address: string | null
  academicYear: string
  currency: string
  studentNumberPrefix: string
  receiptPrefix: string
  defaultLanguage: Language
  backupDirectory: string | null
  automaticBackupEnabled: boolean
  backupsToRetain: number
  updatedAt: string
}

export interface BackupInfo {
  filename: string
  path: string
  createdAt: string
  sizeBytes: number
  verified: boolean
}

// ─── API result types ─────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true
  data: T
}

export interface ApiError {
  success: false
  error: string
  code?: string
}

export type ApiResult<T> = ApiSuccess<T> | ApiError

// ─── Auth session (in-memory only, never stored on disk as plaintext) ─────────

export interface AuthSession {
  adminId: number
  username: string
  fullName: string
  role: AdminRole
  preferredLanguage: Language
  loggedInAt: string
}

// ─── QR scan result ───────────────────────────────────────────────────────────

export type QRScanResultCode =
  | 'recorded'
  | 'already_scanned'
  | 'unknown_card'
  | 'disabled_card'
  | 'student_inactive'
  | 'not_enrolled'
  | 'session_closed'
  | 'db_error'

export interface QRScanResult {
  code: QRScanResultCode
  studentId?: number
  studentNumber?: string
  studentName?: string
  phone?: string | null
  creditBalance?: number | null
  sessionPrice?: number | null
  remainingSessions?: number | null
  wasInDebt?: boolean
  scannedAt?: string
  attendanceStatus?: AttendanceStatusType
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ListQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}
