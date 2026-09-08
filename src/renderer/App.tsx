import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './features/auth/AuthContext'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import Setup from './pages/Setup'
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
import Backups from './pages/Backups'
import ErrorBoundary from './components/ErrorBoundary'

// Protected route wrapper — redirects to /login if not authenticated
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { isFirstRun, isLoading, bridgeError, retryInit } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (bridgeError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-red-200 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">!</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Electron Bridge Unavailable</h2>
          <p className="text-sm text-slate-600 mb-6">{bridgeError}</p>
          <button
            onClick={retryInit}
            className="w-full py-2.5 px-4 bg-[#2563EB] hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Retry Initialization
          </button>
        </div>
      </div>
    )
  }

  // First launch — redirect to setup wizard
  if (isFirstRun) {
    return (
      <Routes>
        <Route path="*" element={<Setup />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
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
        <Route path="backups" element={<Backups />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      {/* HashRouter is required for Electron file:// protocol */}
      <HashRouter>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </HashRouter>
    </AuthProvider>
  )
}
