export type StudentStatus = 'active' | 'inactive' | 'archived'
export type PaymentStatus = 'paid' | 'unpaid' | 'partial' | 'overdue'
export type AttendanceStatus = 'present' | 'absent' | 'late'
export type PaymentMethod = 'cash' | 'transfer' | 'check'
export type TeacherStatus = 'active' | 'inactive'
export type CourseStatus = 'active' | 'inactive'

export interface Student {
  id: string
  studentNumber: string
  token: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: 'male' | 'female'
  photo: string
  phone: string
  address: string
  guardianName: string
  guardianRelationship: string
  guardianPhone: string
  guardianPhone2?: string
  courseId: string
  groupId: string
  registrationDate: string
  monthlyFee: number
  status: StudentStatus
  paymentStatus: PaymentStatus
}

export interface Teacher {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string
  photo: string
  status: TeacherStatus
  courseIds: string[]
}

export interface Course {
  id: string
  name: string
  description: string
  defaultMonthlyFee: number
  status: CourseStatus
}

export interface Group {
  id: string
  courseId: string
  name: string
  teacherId: string
  room: string
  schedule: string
  capacity: number
  enrolledCount: number
  monthlyFee: number
  startDate: string
  endDate: string
}

export interface AttendanceSession {
  id: string
  groupId: string
  courseId: string
  date: string
  startTime: string
  records: AttendanceRecord[]
}

export interface AttendanceRecord {
  id: string
  sessionId: string
  studentId: string
  status: AttendanceStatus
  scanTime?: string
}

export interface Payment {
  id: string
  receiptNumber: string
  studentId: string
  groupId: string
  courseId: string
  billingPeriod: string
  amount: number
  method: PaymentMethod
  reference?: string
  notes?: string
  date: string
  receivedBy: string
  status: 'paid' | 'cancelled'
}

export interface Notification {
  id: string
  title: string
  message: string
  time: string
  read: boolean
}
