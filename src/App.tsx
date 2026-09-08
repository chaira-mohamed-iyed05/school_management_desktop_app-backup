import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import StudentForm from './pages/StudentForm'
import StudentProfile from './pages/StudentProfile'
import StudentCard from './pages/StudentCard'
import Teachers from './pages/Teachers'
import Courses from './pages/Courses'
import Attendance from './pages/Attendance'
import AttendanceHistory from './pages/AttendanceHistory'
import Payments from './pages/Payments'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="students" element={<Students />} />
          <Route path="students/new" element={<StudentForm />} />
          <Route path="students/:id" element={<StudentProfile />} />
          <Route path="students/:id/edit" element={<StudentForm />} />
          <Route path="students/:id/card" element={<StudentCard />} />
          <Route path="teachers" element={<Teachers />} />
          <Route path="courses" element={<Courses />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="attendance/history" element={<AttendanceHistory />} />
          <Route path="payments" element={<Payments />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
