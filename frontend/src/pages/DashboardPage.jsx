import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

function DashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  async function handleSignOut() {
    setError('')

    const { error: signOutError } = await signOut()

    if (signOutError) {
      setError(signOutError.message)
      return
    }

    navigate('/login', { replace: true })
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

        <p className="mt-4 text-muted-foreground">
          Signed in as {user?.email}
        </p>

        {error && (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        )}

        <Button
          className="mt-8 bg-violet-600 text-white hover:bg-violet-700"
          onClick={handleSignOut}
        >
          Sign out
        </Button>
      </section>
    </main>
  )
}

export default DashboardPage