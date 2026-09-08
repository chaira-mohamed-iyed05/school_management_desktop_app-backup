import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/constants/index'
import type {
  ApiResult, AuthSession, Student, Teacher, Course, Group,
  Enrollment, AttendanceSession, AttendanceRecord, Payment,
  SchoolSettings, BackupInfo, QRScanResult, PaginatedResult,
  StudentNote
} from '../shared/types/index'

// ─── Safe invoke helper — wraps every call ───────────────────────────────────
async function invoke<T>(channel: string, payload?: unknown): Promise<ApiResult<T>> {
  return ipcRenderer.invoke(channel, payload)
}

// ─── The narrow, typed API exposed to the renderer ──────────────────────────
const api = {
  health: {
    check: () =>
      invoke<{
        preloadLoaded: boolean
        mainReachable: boolean
        ipcWorking: boolean
        sqliteOpen: boolean
        migrationsApplied: boolean
      }>(IPC_CHANNELS.HEALTH_CHECK),
  },

  auth: {
    login: (username: string, password: string) =>
      invoke<AuthSession>(IPC_CHANNELS.AUTH_LOGIN, { username, password }),
    logout: () => invoke<boolean>(IPC_CHANNELS.AUTH_LOGOUT),
    changePassword: (currentPassword: string, newPassword: string) =>
      invoke<boolean>(IPC_CHANNELS.AUTH_CHANGE_PASSWORD, { currentPassword, newPassword }),
    getSession: () => invoke<AuthSession | null>(IPC_CHANNELS.AUTH_GET_SESSION),
    checkFirstRun: () => invoke<{ firstRun: boolean }>(IPC_CHANNELS.AUTH_CHECK_FIRST_RUN),
    completeSetup: (data: {
      schoolNameAr: string; schoolNameFr: string; schoolNameEn?: string
      phone?: string; email?: string; address?: string; academicYear: string
      adminFullName: string; adminUsername: string; adminPassword: string
      preferredLanguage: 'ar' | 'fr' | 'en'
    }) => invoke<AuthSession>(IPC_CHANNELS.AUTH_COMPLETE_SETUP, data),
  },

  setup: {
    getStatus: () => invoke<{ firstRun: boolean }>(IPC_CHANNELS.AUTH_CHECK_FIRST_RUN),
    complete: (data: {
      schoolNameAr: string; schoolNameFr: string; schoolNameEn?: string
      phone?: string; email?: string; address?: string; academicYear: string
      adminFullName: string; adminUsername: string; adminPassword: string
      preferredLanguage: 'ar' | 'fr' | 'en'
    }) => invoke<AuthSession>(IPC_CHANNELS.AUTH_COMPLETE_SETUP, data),
  },

  students: {
    list: (opts?: { page?: number; pageSize?: number; search?: string; status?: string; courseId?: number; teacherId?: number; groupId?: number }) =>
      invoke<PaginatedResult<Student & { paymentStatus?: string; netBalance?: number; groupNames?: string }>>(IPC_CHANNELS.STUDENTS_LIST, opts),
    getById: (id: number) =>
      invoke<Student>(IPC_CHANNELS.STUDENTS_GET, { id }),
    create: (data: {
      firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string
      gender: 'male' | 'female'; dateOfBirth?: string | null; phone?: string | null
      guardianName?: string | null; guardianRelationship?: string | null
      guardianPhone?: string | null; secondaryPhone?: string | null; address?: string | null
    }) => invoke<Student>(IPC_CHANNELS.STUDENTS_CREATE, data),
    update: (id: number, data: Partial<{
      firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string
      gender: 'male' | 'female'; dateOfBirth: string | null; phone: string | null
      guardianName: string | null; status: string; photoPath: string | null
    }>) => invoke<Student>(IPC_CHANNELS.STUDENTS_UPDATE, { id, ...data }),
    archive: (id: number) =>
      invoke<boolean>(IPC_CHANNELS.STUDENTS_ARCHIVE, { id }),
    regenQR: (id: number) =>
      invoke<{ token: string }>(IPC_CHANNELS.STUDENTS_REGEN_QR, { id }),
    getPhotoUrl: (filename: string, entityType: 'student' | 'teacher') =>
      invoke<{ dataUrl: string | null }>(IPC_CHANNELS.STUDENTS_GET_PHOTO_URL, { filename, entityType }),
    searchByName: (query: string) =>
      invoke<any[]>(IPC_CHANNELS.STUDENTS_SEARCH_NAME, { query }),
    getAttendanceHistory: (studentId: number) =>
      invoke<any[]>('students:attendanceHistory', { studentId }),
  },

  teachers: {
    list: (opts?: { status?: string; courseId?: number }) =>
      invoke<Teacher[]>(IPC_CHANNELS.TEACHERS_LIST, opts),
    create: (data: { firstName: string; lastName: string; phone?: string | null; email?: string | null; address?: string | null; photoPath?: string | null }) =>
      invoke<Teacher>(IPC_CHANNELS.TEACHERS_CREATE, data),
    update: (id: number, data: Partial<{ firstName: string; lastName: string; phone: string | null; email: string | null; address: string | null; status: string; photoPath: string | null }>) =>
      invoke<Teacher>(IPC_CHANNELS.TEACHERS_UPDATE, { id, ...data }),
    archive: (id: number) =>
      invoke<boolean>(IPC_CHANNELS.TEACHERS_ARCHIVE, { id }),
  },

  courses: {
    list: (opts?: { status?: string }) =>
      invoke<Course[]>(IPC_CHANNELS.COURSES_LIST, opts),
    create: (data: { nameAr: string; nameFr: string; nameEn?: string; defaultPrice: number; descriptionAr?: string | null; descriptionFr?: string | null }) =>
      invoke<Course>(IPC_CHANNELS.COURSES_CREATE, data),
    update: (id: number, data: Partial<{ nameAr: string; nameFr: string; defaultPrice: number; status: string }>) =>
      invoke<Course>(IPC_CHANNELS.COURSES_UPDATE, { id, ...data }),
    delete: (id: number) =>
      invoke<boolean>(IPC_CHANNELS.COURSES_DELETE, { id }),
  },

  groups: {
    list: (opts?: { courseId?: number; status?: string }) =>
      invoke<Group[]>(IPC_CHANNELS.GROUPS_LIST, opts),
    byCourse: (courseId: number) =>
      invoke<Group[]>(IPC_CHANNELS.GROUPS_BY_COURSE, { courseId }),
    create: (data: { courseId: number; teacherId: number; name: string; capacity: number; monthlyPrice: number; startDate: string; endDate?: string | null; room?: string | null; scheduleJson?: string | null }) =>
      invoke<Group>(IPC_CHANNELS.GROUPS_CREATE, data),
    update: (id: number, data: Partial<{ name: string; room: string | null; capacity: number; monthlyPrice: number; status: string }>) =>
      invoke<Group>(IPC_CHANNELS.GROUPS_UPDATE, { id, ...data }),
    delete: (id: number) =>
      invoke<boolean>(IPC_CHANNELS.GROUPS_DELETE, { id }),
  },

  enrollments: {
    create: (data: { studentId: number; groupId: number; agreedPrice: number; enrollmentDate: string }) =>
      invoke<Enrollment>(IPC_CHANNELS.ENROLLMENTS_CREATE, data),
    update: (id: number, data: Partial<{ status: 'active' | 'inactive' | 'completed'; agreedPrice: number }>) =>
      invoke<Enrollment>(IPC_CHANNELS.ENROLLMENTS_UPDATE, { id, ...data }),
    byStudent: (studentId: number) =>
      invoke<Enrollment[]>(IPC_CHANNELS.ENROLLMENTS_BY_STUDENT, { studentId }),
    byGroup: (groupId: number) =>
      invoke<Enrollment[]>(IPC_CHANNELS.ENROLLMENTS_BY_GROUP, { groupId }),
    cancel: (enrollmentId: number, studentId: number, reason?: string) =>
      invoke<{ refunded: number }>('payments:cancelEnrollment', { enrollmentId, studentId, reason }),
  },

  attendance: {
    startSession: (data: { groupId: number; sessionDate: string; plannedStartTime?: string | null; lateThresholdMinutes?: number }) =>
      invoke<AttendanceSession>(IPC_CHANNELS.ATTENDANCE_START_SESSION, data),
    scan: (sessionId: number, token: string) =>
      invoke<QRScanResult>(IPC_CHANNELS.ATTENDANCE_SCAN, { sessionId, token }),
    markManually: (data: { sessionId: number; studentId: number; attendanceStatus: 'present' | 'absent' | 'late'; notes?: string | null }) =>
      invoke<AttendanceRecord>(IPC_CHANNELS.ATTENDANCE_MARK_MANUAL, data),
    endSession: (sessionId: number) =>
      invoke<boolean>(IPC_CHANNELS.ATTENDANCE_END_SESSION, { sessionId }),
    getSession: (id: number) =>
      invoke<AttendanceSession & { records: AttendanceRecord[] }>(IPC_CHANNELS.ATTENDANCE_GET_SESSION, { id }),
    listSessions: (opts?: { groupId?: number; status?: 'open' | 'closed'; limit?: number }) =>
      invoke<AttendanceSession[]>(IPC_CHANNELS.ATTENDANCE_SESSIONS_LIST, opts),
    lookup: (token: string) =>
      invoke<any>(IPC_CHANNELS.ATTENDANCE_LOOKUP, { token }),
    getStudentSummary: (studentId: number, sessionId?: number) =>
      invoke<any>(IPC_CHANNELS.ATTENDANCE_STUDENT_SUMMARY, { studentId, sessionId }),
    getRemainingSessionsCount: (enrollmentId: number) =>
      invoke<{ count: number }>(IPC_CHANNELS.ATTENDANCE_REMAINING_SESSIONS, { enrollmentId }),
    resolveStudent: (token: string, date: string) =>
      invoke<any>(IPC_CHANNELS.ATTENDANCE_RESOLVE_STUDENT, { token, date }),
    markSession: (sessionId: number, studentId: number, status: 'present' | 'absent' | 'late' | 'not_active' | 'inactive') =>
      invoke<any>(IPC_CHANNELS.ATTENDANCE_MARK_SESSION, { sessionId, studentId, status }),
    markAttended: (sessionId: number, studentId: number, source?: 'qr' | 'manual') =>
      invoke<QRScanResult>('attendance:markAttended', { sessionId, studentId, source }),
    reconcile: () =>
      invoke<{ reconciledCount: number }>('attendance:reconcile'),
    markNextNotActive: (studentId: number, groupId: number) =>
      invoke<any>(IPC_CHANNELS.ATTENDANCE_MARK_NEXT_NOT_ACTIVE, { studentId, groupId }),
    getSessionHistory: (studentId: number) =>
      invoke<any[]>('attendance:studentSessionHistory', { studentId }),
    withRoster: (sessionId: number) =>
      invoke<any>(IPC_CHANNELS.SESSIONS_WITH_ROSTER, { sessionId }),
  },

  schedules: {
    list: (opts?: { groupId?: number; active?: boolean }) =>
      invoke<any[]>(IPC_CHANNELS.SCHEDULES_LIST, opts),
    create: (data: { groupId: number; weekday: number; startTime: string; endTime: string; room?: string }) =>
      invoke<any>(IPC_CHANNELS.SCHEDULES_CREATE, data),
    update: (id: number, data: Partial<{ startTime: string; endTime: string; room: string | null; isActive: boolean }>) =>
      invoke<any>(IPC_CHANNELS.SCHEDULES_UPDATE, { id, ...data }),
    delete: (id: number) =>
      invoke<boolean>(IPC_CHANNELS.SCHEDULES_DELETE, { id }),
    listAll: () =>
      invoke<any[]>('schedules:listAll'),
  },

  sessions: {
    list: (opts?: { groupId?: number; status?: 'open' | 'closed'; sessionType?: string }) =>
      invoke<any[]>(IPC_CHANNELS.SESSIONS_LIST, opts),
    get: (id: number) =>
      invoke<any>(IPC_CHANNELS.SESSIONS_GET, { id }),
    createExtra: (data: { groupId: number; sessionDate: string; startTime: string; endTime: string; room?: string; teacherId?: number; price?: number }) =>
      invoke<any>(IPC_CHANNELS.SESSIONS_CREATE_EXTRA, data),
    generate: (groupId: number, startDate: string, endDate: string) =>
      invoke<{ generated: number; message: string }>(IPC_CHANNELS.SESSIONS_GENERATE, { groupId, startDate, endDate }),
    cancel: (sessionId: number, reason?: string) =>
      invoke<boolean>(IPC_CHANNELS.SESSIONS_CANCEL, { sessionId, reason }),
    complete: (sessionId: number) =>
      invoke<boolean>(IPC_CHANNELS.SESSIONS_COMPLETE, { sessionId }),
    delete: (sessionId: number) =>
      invoke<boolean>(IPC_CHANNELS.SESSIONS_DELETE, { sessionId }),
    upcoming: (opts?: { groupId?: number; limit?: number; todayOnly?: boolean }) =>
      invoke<any[]>(IPC_CHANNELS.SESSIONS_UPCOMING, opts),
    byDate: (startDate: string, endDate: string) =>
      invoke<any[]>(IPC_CHANNELS.SESSIONS_BY_DATE, { startDate, endDate }),
    generateForGroup: (groupId: number) =>
      invoke<{ generated: number; message: string }>('sessions:generateForGroup', { groupId }),
    trimAfterDate: (groupId: number, afterDate: string) =>
      invoke<{ removed: number }>('sessions:trimAfterDate', { groupId, afterDate }),
  },

  payments: {
    list: (opts?: { page?: number; pageSize?: number; search?: string; studentId?: number; type?: string }) =>
      invoke<any>(IPC_CHANNELS.PAYMENTS_LIST, opts),
    create: (data: { studentId: number; enrollmentId: number; billingPeriod?: string; amount: number; paymentMethod: 'cash' | 'transfer' | 'check'; paymentDate: string; reference?: string | null; notes?: string | null }) =>
      invoke<any>(IPC_CHANNELS.PAYMENTS_CREATE, data),
    cancel: (id: number, reason?: string | null) =>
      invoke<boolean>(IPC_CHANNELS.PAYMENTS_CANCEL, { id, reason }),
    byStudent: (studentId: number) =>
      invoke<any[]>(IPC_CHANNELS.PAYMENTS_BY_STUDENT, { studentId }),
    summary: () =>
      invoke<{ monthRevenue: number; todayCollected: number; outstanding: number; overdue: number }>('payments:summary'),
    debtReport: () =>
      invoke<any[]>('payments:debtReport'),
    studentDebt: (studentId: number) =>
      invoke<any>('payments:studentDebt', { studentId }),
    topUp: (data: { studentId: number; enrollmentId: number; amount: number; paymentMethod: 'cash' | 'transfer' | 'check'; paymentDate: string; reference?: string | null; notes?: string | null }) =>
      invoke<any>('payments:topUp', data),
    deductSession: (data: { studentId: number; enrollmentId: number; sessionId: number; sessionDate: string; sessionPrice: number }) =>
      invoke<{ deducted: boolean; newBalance: number; wasInDebt: boolean }>('payments:deductSession', data),
    // transfer always moves 100% of remaining balance — no amount param
    transfer: (data: { fromEnrollmentId: number; toEnrollmentId: number; studentId: number }) =>
      invoke<{ transferred: number; newFromBalance: number; newToBalance: number }>('payments:transfer', data),
    refund: (data: { enrollmentId: number; studentId: number; notes?: string }) =>
      invoke<{ refunded: number }>('payments:refund', data),
    balance: (enrollmentId: number) =>
      invoke<{ balance: number; totalCharged: number; totalDeducted: number; sessionsUsed: number }>('payments:balance', { enrollmentId }),
    cancelEnrollment: (enrollmentId: number, studentId: number, reason?: string) =>
      invoke<{ refunded: number }>('payments:cancelEnrollment', { enrollmentId, studentId, reason }),
    studentBalance: (studentId: number) =>
      invoke<{
        studentId: number
        totalBalance: number
        isDebt: boolean
        enrollmentBalances: Array<{
          enrollmentId: number
          groupId: number
          groupName: string
          courseNameAr: string
          courseNameFr: string
          balance: number
          isDebt: boolean
          status: string
        }>
      }>('payments:studentBalance', { studentId }),
    listAll: (opts?: { page?: number; pageSize?: number; studentId?: number }) =>
      invoke<any>('payments:listAll', opts),
  },

  notes: {
    list: (studentId: number) =>
      invoke<StudentNote[]>(IPC_CHANNELS.NOTES_LIST, { studentId }),
    create: (data: { studentId: number; noteText: string }) =>
      invoke<StudentNote>(IPC_CHANNELS.NOTES_CREATE, data),
    update: (id: number, noteText: string) =>
      invoke<StudentNote>(IPC_CHANNELS.NOTES_UPDATE, { id, noteText }),
    delete: (id: number) =>
      invoke<boolean>(IPC_CHANNELS.NOTES_DELETE, { id }),
  },

  settings: {
    get: () => invoke<SchoolSettings | null>(IPC_CHANNELS.SETTINGS_GET),
    update: (data: Partial<{
      schoolNameAr: string; schoolNameFr: string; schoolNameEn: string
      phone: string | null; email: string | null; address: string | null
      academicYear: string; currency: string; defaultLanguage: 'ar' | 'fr' | 'en'
      backupDirectory: string | null; automaticBackupEnabled: boolean; backupsToRetain: number
    }>) => invoke<SchoolSettings>(IPC_CHANNELS.SETTINGS_UPDATE, data),
    getAdmin: () =>
      invoke<{ id: number; username: string; fullName: string; role: string; preferredLanguage: string; photoPath: string | null }>(IPC_CHANNELS.SETTINGS_GET_ADMIN),
    updateAdmin: (data: { fullName?: string; preferredLanguage?: 'ar' | 'fr' | 'en'; photoPath?: string | null }) =>
      invoke<{ id: number; fullName: string; preferredLanguage: string; photoPath: string | null }>(IPC_CHANNELS.SETTINGS_UPDATE_ADMIN, data),
    listAuditLogs: (opts?: { limit?: number; offset?: number; action?: string }) =>
      invoke<any[]>(IPC_CHANNELS.SETTINGS_LIST_AUDIT_LOGS, opts),
    setAutoLock: (minutes: number) =>
      invoke<{ minutes: number }>(IPC_CHANNELS.SETTINGS_AUTO_LOCK_SET, { minutes }),
    getAutoLock: () =>
      invoke<{ minutes: number }>(IPC_CHANNELS.SETTINGS_AUTO_LOCK_GET),
  },

  backups: {
    create: (destinationDir?: string) =>
      invoke<BackupInfo>(IPC_CHANNELS.BACKUPS_CREATE, { destinationDir }),
    list: () => invoke<BackupInfo[]>(IPC_CHANNELS.BACKUPS_LIST),
    verify: (backupPath: string) =>
      invoke<{ verified: boolean }>(IPC_CHANNELS.BACKUPS_VERIFY, { backupPath }),
    restore: (backupPath: string, confirmPassword: string) =>
      invoke<boolean>(IPC_CHANNELS.BACKUPS_RESTORE, { backupPath, confirmPassword }),
  },

  media: {
    selectImage: (type: 'admin' | 'student' | 'teacher', recordId: string) =>
      invoke<{ success: boolean; path: string | null; error: string | null }>(IPC_CHANNELS.MEDIA_SELECT_IMAGE, { type, recordId }),
    deleteImage: (relativePath: string) =>
      invoke<{ success: boolean; error: string | null }>(IPC_CHANNELS.MEDIA_DELETE_IMAGE, { relativePath }),
    getImageUrl: (relativePath?: string) =>
      invoke<{ url: string | null; error?: string | null }>(IPC_CHANNELS.MEDIA_GET_IMAGE_URL, { relativePath }),
    uploadPhoto: (sourcePath: string, entityType: 'student' | 'teacher', entityId: number) =>
      invoke<{ filename: string }>(IPC_CHANNELS.MEDIA_UPLOAD_PHOTO, { sourcePath, entityType, entityId }),
  },

  app: {
    getVersion: () => invoke<{ version: string; name: string }>(IPC_CHANNELS.APP_GET_VERSION),
    getPaths: () => invoke<{ userData: string; documents: string }>(IPC_CHANNELS.APP_GET_PATHS),
    openBackupDialog: () => invoke<{ canceled: boolean; path: string | null }>(IPC_CHANNELS.APP_OPEN_BACKUP_DIALOG),
    openSaveDialog: () => invoke<{ canceled: boolean; path: string | null }>(IPC_CHANNELS.APP_SHOW_SAVE_DIALOG),
    print: () => invoke<boolean>(IPC_CHANNELS.APP_PRINT),
    printToPdf: (opts?: { pageSize?: 'A4' | 'Letter'; marginsType?: 0 | 1 | 2; filename?: string }) => invoke<{ path: string }>(IPC_CHANNELS.APP_PRINT_TO_PDF, opts),
    logError: (details: { category?: string; message?: string; componentStack?: string }) =>
      invoke<boolean>(IPC_CHANNELS.APP_LOG_ERROR, details),
  },
} as const

console.log('[Preload] started')

// ─── Expose via contextBridge (the ONLY bridge to Node.js) ───────────────────────────────────
contextBridge.exposeInMainWorld('schoolApp', api)

console.log('[Preload] schoolApp exposed')

// ─── TypeScript declaration for renderer ─────────────────────────────────────
export type SchoolAppAPI = typeof api
