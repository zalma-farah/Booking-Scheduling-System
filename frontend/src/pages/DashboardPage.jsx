import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

function DashboardPage() {
  const { user, role, profileError, signOut } = useAuth()
  const navigate = useNavigate()

  const [error, setError] = useState('')
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setError('')
    setSigningOut(true)

    try {
      const { error: signOutError } = await signOut()

      if (signOutError) {
        setError(signOutError.message)
        return
      }

      navigate('/login', { replace: true })
    } catch {
      setError('Unable to sign out. Please try again.')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef3ec] p-6">
      <section className="w-full max-w-lg rounded-3xl bg-white p-10 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#567058]">
          Authentication successful
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          Welcome to your dashboard
        </h1>

        <p className="mt-4 break-words text-muted-foreground">
          Signed in as {user?.email}
        </p>

        <p className="mt-2 text-muted-foreground">
          Role: {role ?? 'Unavailable'}
        </p>

        {profileError && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {profileError}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}

        <Button
          className="mt-8 bg-violet-600 text-white hover:bg-violet-700"
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? 'Signing out...' : 'Sign out'}
        </Button>
      </section>
    </main>
  )
}

export default DashboardPage