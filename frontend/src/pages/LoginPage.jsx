import { useState } from 'react'
import { CalendarDays, LoaderCircle } from 'lucide-react'
import { Link, Navigate } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function LoginPage() {
  const { user, loading: authLoading, isAdmin } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    setError('')
    setLoading(true)

    try {
      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

      if (signInError) {
        setError(signInError.message)
      }
    } catch {
      setError('Unable to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eef3ec]">
        <div role="status" className="flex items-center gap-3">
          <LoaderCircle className="size-5 animate-spin" />
          <p>Checking your account...</p>
        </div>
      </main>
    )
  }

  if (user) {
    return (
      <Navigate
        to={isAdmin ? '/admin' : '/dashboard'}
        replace
      />
    )
  }

  return (
    <main className="min-h-screen bg-[#eef3ec] p-4 sm:p-8">
      <section className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl sm:min-h-[calc(100vh-4rem)] md:grid-cols-[1.05fr_0.95fr]">
        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#4f3d78] via-[#6d55a3] to-[#8b72b8] p-8 text-white md:flex md:flex-col md:justify-between lg:p-12">
          <div className="absolute -right-24 -top-24 size-72 rounded-full border border-white/20" />

          <div className="absolute -bottom-32 -left-20 size-96 rounded-full bg-[#a8bfa3]/30" />

          <div className="absolute bottom-20 right-16 size-32 rounded-full border border-white/20" />

          <div className="relative z-10 flex items-center gap-3">
            <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
              <CalendarDays className="size-7" />
            </div>

            <span className="text-lg font-semibold">
              Booking & Scheduling
            </span>
          </div>

          <div className="relative z-10 max-w-md">
            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-purple-100">
              Welcome back
            </p>

            <h2 className="text-4xl font-bold leading-tight lg:text-5xl">
              Your reservations, all in one place.
            </h2>

            <p className="mt-6 text-base leading-relaxed text-purple-100 lg:text-lg">
              Find available locations and resources, select a time, and
              manage your bookings with ease.
            </p>
          </div>

          <p className="relative z-10 text-sm text-purple-100">
            Simple. Fast. Organized.
          </p>
        </aside>

        <section className="flex items-center justify-center bg-white px-6 py-12 sm:px-12 md:px-10 lg:px-16">
          <div className="w-full max-w-sm">
            <div className="mb-10 flex items-center gap-3 md:hidden">
              <div className="rounded-xl bg-[#e2ebe0] p-3 text-[#4e684f]">
                <CalendarDays className="size-6" />
              </div>

              <span className="font-semibold">
                Booking & Scheduling
              </span>
            </div>

            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight">
                Sign in
              </h1>

              <p className="mt-2 text-sm text-muted-foreground">
                Enter your account information to continue.
              </p>
            </div>

            {error && (
              <Alert
                className="mb-5 border-red-200 bg-red-50"
                variant="destructive"
              >
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>

                <Input
                  className="h-11"
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>

                <Input
                  className="h-11"
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <Button
                className="h-11 w-full bg-violet-600 text-white hover:bg-violet-700"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <LoaderCircle className="animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              New to the system?{' '}
              <Link
                className="font-semibold text-violet-700 hover:underline"
                to="/register"
              >
                Create an account
              </Link>
            </p>
          </div>
        </section>
      </section>
    </main>
  )
}

export default LoginPage