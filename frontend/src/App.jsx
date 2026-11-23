import { Navigate, Route, Routes } from 'react-router'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminPage from '@/pages/AdminPage'
import DashboardPage from '@/pages/DashboardPage'
import LoginPage from '@/pages/LoginPage'
import BookingsPage from '@/pages/BookingsPage'
import RegisterPage from '@/pages/RegisterPage'
import ResourcesPage from '@/pages/ResourcesPage'
import RoomKioskPage from '@/pages/RoomKioskPage'
import TimeSlotsPage from '@/pages/TimeSlotsPage'
import WalkInRoomsPage from '@/pages/WalkInRoomsPage'

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to="/login" replace />}
      />

      <Route
        path="/login"
        element={<LoginPage />}
      />

      <Route
        path="/register"
        element={<RegisterPage />}
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <AdminPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/bookings"
        element={
          <ProtectedRoute>
            <BookingsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/resources"
        element={
          <ProtectedRoute>
            <ResourcesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/resources/:resourceId/slots"
        element={
          <ProtectedRoute>
            <TimeSlotsPage />
          </ProtectedRoute>
        }
      />

      <Route path="/resources/:resourceId/kiosk" element={<RoomKioskPage />} />
      <Route path="/walk-in" element={<WalkInRoomsPage />} />

      <Route
        path="*"
        element={<Navigate to="/login" replace />}
      />
    </Routes>
  )
}

export default App
