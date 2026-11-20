import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Building2, CalendarDays, LayoutDashboard, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'

import '@/styles/admin.css'

const workspaceStyles = "\n.personal-workspace .workspace-body { display: grid; gap: 22px; min-width: 0; }\n.personal-workspace .workspace-body > .mt-8 { margin-top: 0; }\n.personal-workspace .workspace-body > .mt-6 { margin-top: 0; }\n.personal-workspace .workspace-body article { min-width: 0; border: 1px solid #e2e7e0; border-radius: 12px; background: #fff; box-shadow: none; padding: 25px; overflow-wrap: anywhere; }\n.personal-workspace .workspace-body article h3 { font-size: 18px; letter-spacing: -.02em; }\n.personal-workspace .workspace-body article p { margin-top: 8px; color: #606f63; }\n.personal-workspace .workspace-body h2 { font-size: 16px; font-weight: 650; }\n.personal-workspace .workspace-body :is(button, a[data-slot=\"button\"]) { min-height: 38px; height: auto; border-radius: 7px; padding: 8px 14px; font-size: 12px; white-space: normal; text-align: center; }\n.personal-workspace .workspace-body :is(.rounded-2xl, .rounded-3xl) { border-radius: 12px; }\n.personal-workspace .workspace-body > div[class*=\"bg-white\"] { border: 1px solid #e2e7e0; }\n.personal-workspace .workspace-account-state { padding: 5px 10px; border: 1px solid #dce7d8; border-radius: 6px; background: #eff5eb; color: #45674e; font-size: 12px; font-weight: 600; flex-shrink: 0; }\n.personal-workspace .workspace-empty-help { margin-top: 10px; color: #606f63; font-size: 13px; }\n.personal-workspace .workspace-signout-error { margin-top: 16px; }\n@media (max-width: 800px) {\n .personal-workspace .admin-section-nav { grid-template-columns: repeat(3, minmax(0, 1fr)); }\n .personal-workspace .admin-utility-nav { justify-content: flex-end; align-items: center; }\n}\n@media (max-width: 600px) {\n .personal-workspace .admin-nav-link { gap: 5px; font-size: 11px; }\n .personal-workspace .workspace-body article { padding: 20px; }\n .personal-workspace .workspace-body :is(button, a[data-slot=\"button\"]), .personal-workspace .admin-utility-nav button { min-height: 40px; font-size: 12px; }\n}\n"

function PersonalWorkspace({ section, title, description, children }) {
  const { user, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')

  async function leave() {
    setSignOutError('')
    setSigningOut(true)
    try {
      const { error } = await signOut()
      if (error) {
        setSignOutError(error.message || 'Unable to sign out. Please try again.')
        return
      }
      navigate('/login', { replace: true })
    } catch {
      setSignOutError('Unable to sign out. Please try again.')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="admin-shell personal-workspace">
      <style>{workspaceStyles}</style>
      <a className="admin-skip-link" href="#workspace-content">Skip to content</a>
      <aside className="admin-sidebar" aria-label="Personal workspace sidebar">
        <Link className="admin-brand" to="/dashboard">
          <span className="admin-brand-mark"><CalendarDays aria-hidden="true" /></span>
          <span><strong>Booking & Scheduling</strong><span className="admin-brand-subtitle">Personal workspace</span></span>
        </Link>
        <div className="admin-nav-group">
          <p className="admin-nav-caption">Your workspace</p>
          <nav className="admin-section-nav" aria-label="Personal workspace">
            <Link className="admin-nav-link" to="/dashboard"><LayoutDashboard aria-hidden="true" />Dashboard</Link>
            <Link className={'admin-nav-link' + (section === 'resources' ? ' is-selected' : '')} to="/resources" aria-current={section === 'resources' ? 'page' : undefined}><Building2 aria-hidden="true" />Resource tab</Link>
            <Link className={'admin-nav-link' + (section === 'bookings' ? ' is-selected' : '')} to="/bookings" aria-current={section === 'bookings' ? 'page' : undefined}><CalendarDays aria-hidden="true" />My bookings</Link>
          </nav>
        </div>
        <div className="admin-setup-guide">
          <p className="admin-nav-caption">Make a reservation</p>
          <ol>
            <li><span>1</span><div><strong>Find a room</strong><small>Explore available resources</small></div></li>
            <li><span>2</span><div><strong>Choose a time</strong><small>Select an available future slot</small></div></li>
            <li><span>3</span><div><strong>Manage your booking</strong><small>Review or cancel in My bookings</small></div></li>
          </ol>
        </div>
        <nav className="admin-utility-nav" aria-label="Account actions">
          {isAdmin && <Link to="/admin"><ShieldCheck aria-hidden="true" />Administration</Link>}
          <Button className="admin-btn admin-btn-outline" variant="outline" type="button" onClick={leave} disabled={signingOut}>{signingOut ? 'Signing out...' : 'Sign out'}</Button>
        </nav>
        <div className="admin-profile">
          <span className="admin-avatar" aria-hidden="true">{user?.email?.slice(0, 1).toUpperCase() || 'U'}</span>
          <div><strong>{isAdmin ? 'Personal booking area' : 'Your account'}</strong><span title={user?.email}>{user?.email || 'Signed-in account'}</span></div>
        </div>
      </aside>
      <main id="workspace-content" className="admin-main" tabIndex={-1}>
        <header className="admin-topbar">
          <p className="admin-breadcrumb"><span>Personal workspace</span><span aria-hidden="true">/</span><strong>{section === 'resources' ? 'Resource tab' : 'My bookings'}</strong></p>
          <span className="workspace-account-state">Signed in</span>
        </header>
        <div className="admin-content">
          <header className="admin-page-heading">
            <p className="admin-eyebrow">Your workspace</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </header>
          {signOutError && <p role="alert" className="admin-notice is-error workspace-signout-error">{signOutError}</p>}
          <div className="workspace-body">{children}</div>
        </div>
      </main>
    </div>
  )
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  hour: 'numeric',
  minute: '2-digit',
})

function formatSlot(slot) {
  if (!slot?.start_time || !slot?.end_time) {
    return 'Time-slot details unavailable.'
  }

  const start = new Date(slot.start_time)
  const end = new Date(slot.end_time)

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return 'Time-slot details unavailable.'
  }

  const startDate = dateFormatter.format(start)
  const endDate = dateFormatter.format(end)
  const endLabel = startDate === endDate ? '' : `${endDate}, `

  return `${startDate} · ${timeFormatter.format(start)} – ${endLabel}${timeFormatter.format(end)}`
}

function AccountBookings() {
  const [reloadCount, setReloadCount] = useState(0)
  const [result, setResult] = useState({ key: -1, bookings: [], error: '' })
  const [confirmingBookingId, setConfirmingBookingId] = useState(null)
  const [cancellingBookingId, setCancellingBookingId] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [requiresRefresh, setRequiresRefresh] = useState(false)
  const cancellationPending = useRef(false)
  const mounted = useRef(false)
  const loading = result.key !== reloadCount
  const isCancelling = cancellingBookingId !== null

  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    let active = true

    apiRequest('/api/bookings')
      .then((data) => {
        if (
          !Array.isArray(data.bookings) ||
          data.bookings.some(
            (booking) =>
              !booking ||
              booking.id == null ||
              !['active', 'cancelled'].includes(booking.status)
          )
        ) {
          throw new Error('The server returned an invalid booking list.')
        }

        if (active) {
          setResult({ key: reloadCount, bookings: data.bookings, error: '' })
          setRequiresRefresh(false)
        }
      })
      .catch((requestError) => {
        if (active) {
          setResult({
            key: reloadCount,
            bookings: [],
            error: requestError?.message || 'Unable to load your bookings.',
          })
        }
      })

    return () => {
      active = false
    }
  }, [reloadCount])

  function refreshBookings() {
    if (loading || cancellationPending.current) return
    setConfirmingBookingId(null)
    setReloadCount((count) => count + 1)
  }

  async function handleCancel(booking) {
    if (
      cancellationPending.current ||
      loading ||
      requiresRefresh ||
      booking.status !== 'active' ||
      confirmingBookingId !== booking.id
    ) {
      return
    }

    // Block rapid duplicate confirmations before React renders the spinner.
    cancellationPending.current = true
    setCancellingBookingId(booking.id)
    setConfirmingBookingId(null)
    setFeedback(null)
    let refreshAfterCancellation = true

    try {
      const data = await apiRequest(
        `/api/bookings/${encodeURIComponent(booking.id)}/cancel`,
        { method: 'POST' }
      )

      if (
        data.booking?.id !== booking.id ||
        data.booking?.status !== 'cancelled'
      ) {
        const confirmationError = new Error(
          'The cancellation result could not be confirmed. Refresh your bookings.'
        )
        confirmationError.status = 502
        throw confirmationError
      }

      if (!mounted.current) return

      setFeedback({
        kind: 'success',
        message: `Booking #${booking.id} cancelled successfully.`,
      })
      setResult((previous) => ({
        ...previous,
        bookings: previous.bookings.map((item) =>
          item.id === booking.id ? { ...item, status: 'cancelled' } : item
        ),
      }))
    } catch (requestError) {
      if (!mounted.current) return

      const uncertain =
        !Number.isInteger(requestError?.status) || requestError.status >= 500

      // The write may have succeeded. Check the list before another attempt.
      refreshAfterCancellation = !uncertain
      setRequiresRefresh(uncertain)
      setFeedback({
        kind: 'error',
        message: requestError?.message || 'Unable to confirm the cancellation.',
      })
    } finally {
      cancellationPending.current = false

      if (mounted.current) {
        setCancellingBookingId(null)

        if (refreshAfterCancellation) {
          setReloadCount((count) => count + 1)
        }
      }
    }
  }

  return (
    <PersonalWorkspace section="bookings" title="My bookings" description="Review your reservations and history. All times use San Diego time.">

        {feedback && (
          <div
            role={feedback.kind === 'success' ? 'status' : 'alert'}
            className={
              feedback.kind === 'success'
                ? 'mt-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-green-900'
                : 'mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800'
            }
          >
            {feedback.message}
          </div>
        )}

        {requiresRefresh && (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            Click Refresh to check your bookings before trying again.
            A timeout does not tell us whether cancellation was saved.
          </p>
        )}

        <div className="mt-8 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Your reservations</h2>
          <Button
            type="button"
            variant="outline"
            disabled={loading || isCancelling}
            onClick={refreshBookings}
          >
            Refresh
          </Button>
        </div>

        {loading ? (
          <div
            role="status"
            className="mt-6 flex items-center gap-3 rounded-2xl bg-white p-8"
          >
            <LoaderCircle className="size-5 animate-spin" />
            <p>Loading your bookings...</p>
          </div>
        ) : result.error ? (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700"
          >
            {result.error}
          </div>
        ) : result.bookings.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-white p-8">
            <p>You have no bookings yet. Browse resources to reserve a time slot.</p>
          </div>
        ) : (
          <>
            {result.bookings.length === 100 && (
              <p className="mt-4 text-sm text-muted-foreground">
                Showing your 100 most recently created bookings.
              </p>
            )}

            <section aria-label="My bookings" className="mt-6 space-y-4">
              {result.bookings.map((booking) => {
                const resource = booking.slot?.resource
                const cancelled = booking.status === 'cancelled'

                return (
                  <article
                    key={booking.id}
                    className="rounded-2xl bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="rounded-xl bg-[#e2ebe0] p-3 text-[#4e684f]">
                          <CalendarDays className="size-5" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Booking #{booking.id}
                          </p>
                          <h3 className="mt-1 text-lg font-semibold">
                            {resource?.name || 'Resource details unavailable'}
                          </h3>
                          {resource?.location?.name && (
                            <p className="mt-1 text-[#567058]">
                              {resource.location.name}
                            </p>
                          )}
                        </div>
                      </div>

                      <span
                        className={
                          cancelled
                            ? 'rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700'
                            : 'rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-800'
                        }
                      >
                        {cancelled ? 'Cancelled' : 'Active'}
                      </span>
                    </div>

                    <p className="mt-4 text-muted-foreground">
                      {formatSlot(booking.slot)}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3">
                      {resource?.id != null && (
                        <Button variant="outline" asChild>
                          <Link
                            to={`/resources/${encodeURIComponent(resource.id)}/slots`}
                          >
                            View time slots
                          </Link>
                        </Button>
                      )}

                      {!cancelled && (
                        <Button
                          type="button"
                          variant="outline"
                          className="text-red-700 hover:bg-red-50"
                          disabled={
                            isCancelling ||
                            requiresRefresh ||
                            confirmingBookingId === booking.id
                          }
                          onClick={() => setConfirmingBookingId(booking.id)}
                        >
                          {cancellingBookingId === booking.id ? (
                            <>
                              <LoaderCircle className="size-4 animate-spin" />
                              Cancelling...
                            </>
                          ) : (
                            'Cancel booking'
                          )}
                        </Button>
                      )}
                    </div>

                    {!cancelled && confirmingBookingId === booking.id && (
                      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <p className="text-sm text-red-900">
                          Cancel booking #{booking.id}? The history will stay
                          saved, and the slot will be released.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3">
                          <Button
                            type="button"
                            variant="destructive"
                            className="border-destructive/40"
                            disabled={isCancelling || requiresRefresh}
                            onClick={() => handleCancel(booking)}
                          >
                            Confirm cancellation
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isCancelling}
                            onClick={() => setConfirmingBookingId(null)}
                          >
                            Keep booking
                          </Button>
                        </div>
                      </div>
                    )}

                    {!resource && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        This booking is still saved, but its room details may no
                        longer be visible to your account.
                      </p>
                    )}
                  </article>
                )
              })}
            </section>
          </>
        )}
    </PersonalWorkspace>
  )
}

function BookingsPage() {
  const { user } = useAuth()

  if (!user) return null

  // Do not carry one account's loaded bookings into another account's view.
  return <AccountBookings key={user.id} />
}

export default BookingsPage
