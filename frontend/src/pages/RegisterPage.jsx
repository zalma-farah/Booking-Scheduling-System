import { useState } from 'react'
import { LoaderCircle, UserPlus } from 'lucide-react'
import { Link } from 'react-router'
import { supabase } from '@/lib/supabase'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    setErrorMessage('')
    setSuccessMessage('')

    if (password !== confirmPassword) {
      setErrorMessage('The passwords do not match.')
      return
    }

    if (password.length < 6) {
      setErrorMessage('Password must contain at least 6 characters.')
      return
    }

    setIsLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })

      if (error) {
        throw error
      }

      if (data.session) {
        setSuccessMessage(
          'Your account was created and you are signed in.'
        )
      } else {
        setSuccessMessage(
          'Account created. Check your email to confirm your account.'
        )
      }

      setPassword('')
      setConfirmPassword('')
    } catch (error) {
      setErrorMessage(
        error.message || 'The account could not be created.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#eef3ec] p-4 sm:p-8">
      <section className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl sm:min-h-[calc(100vh-4rem)] md:grid-cols-[0.95fr_1.05fr]">
        <section className="flex items-center justify-center bg-white px-6 py-12 sm:px-12 md:px-10 lg:px-16">
          <div className="w-full max-w-sm">
            <div className="mb-10 flex items-center gap-3 md:hidden">
              <div className="rounded-xl bg-[#e2ebe0] p-3 text-[#4e684f]">
                <UserPlus className="size-6" />
              </div>

              <span className="font-semibold">Booking & Scheduling</span>
            </div>

            <div className="mb-8">
              <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#58725c]">
                New account
              </p>

              <h1 className="text-3xl font-bold tracking-tight">
                Create your account
              </h1>

              <p className="mt-2 text-sm text-muted-foreground">
                Enter your information to begin making reservations.
              </p>
            </div>

            {errorMessage && (
              <Alert className="mb-5" variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {successMessage && (
              <Alert className="mb-5 border-green-200 bg-green-50 text-green-900">
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="register-email">Email address</Label>

                <Input
                  className="h-11"
                  id="register-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password">Password</Label>

                <Input
                  className="h-11"
                  id="register-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isLoading}
                  minLength={6}
                  required
                />

                <p className="text-xs text-muted-foreground">
                  Password must contain at least 6 characters.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>

                <Input
                  className="h-11"
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  disabled={isLoading}
                  minLength={6}
                  required
                />
              </div>

              <Button
                className="h-11 w-full bg-[#4f654d] text-white hover:bg-[#3f523e]"
                type="submit"
                disabled={isLoading}
              >
                {isLoading && (
                  <LoaderCircle className="animate-spin" />
                )}

                {isLoading ? 'Creating account...' : 'Create account'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                className="font-semibold text-violet-700 hover:underline"
                to="/login"
              >
                Sign in
              </Link>
            </p>
          </div>
        </section>

        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#3f5b46] via-[#58725c] to-[#82947d] p-8 text-white md:flex md:flex-col md:justify-between lg:p-12">
          <div className="absolute -left-24 -top-24 size-72 rounded-full border border-white/20" />

          <div className="absolute -bottom-32 -right-20 size-96 rounded-full bg-[#72579b]/35" />

          <div className="absolute bottom-20 left-16 size-32 rounded-full border border-white/20" />

          <div className="relative z-10 flex items-center gap-3">
            <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
              <UserPlus className="size-7" />
            </div>

            <span className="text-lg font-semibold">
              Booking & Scheduling
            </span>
          </div>

          <div className="relative z-10 max-w-md">
            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-green-100">
              Join the system
            </p>

            <h2 className="text-4xl font-bold leading-tight lg:text-5xl">
              Start booking smarter.
            </h2>

            <p className="mt-6 text-base leading-relaxed text-green-50 lg:text-lg">
              Browse available resources, choose the time that works for
              you, and keep track of every reservation.
            </p>
          </div>

          <p className="relative z-10 text-sm text-green-50">
            Your schedule. Your reservations.
          </p>
        </aside>
      </section>
    </main>
  )
}

export default RegisterPage