import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/hooks/useAuth'

function ProtectedRoute({ children, requireAdmin = false }) {
  const {
    user,
    loading,
    profileError,
    isActive,
    isAdmin,
    signOut,
  } = useAuth()

  const location = useLocation()

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>Checking your account...</p>
      </main>
    )
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  if (profileError || !isActive) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eef3ec] p-6">
        <section className="max-w-md rounded-3xl bg-white p-8 shadow-lg">
          <h1 className="text-2xl font-bold">Account unavailable</h1>

          <p role="alert" className="mt-4">
            {profileError || 'Your account is inactive. Contact an administrator.'}
          </p>

          <button
            className="mt-6 underline"
            type="button"
            onClick={() => {
              signOut().then(({ error }) => {
                if (error) {
                  window.alert('Unable to sign out. Please try again.')
                }
              }).catch(() => {
                window.alert('Unable to sign out. Please try again.')
              })
            }}
          >
            Sign out
          </button>
        </section>
      </main>
    )
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default ProtectedRoute