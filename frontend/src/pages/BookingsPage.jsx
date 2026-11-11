import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { CalendarDays, LoaderCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'

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
    <main className="min-h-screen bg-[#eef3ec] p-6 sm:p-10">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-[#567058]">
              Booking & Scheduling
            </p>
            <h1 className="mt-2 text-3xl font-bold">My bookings</h1>
            <p className="mt-3 text-muted-foreground">
              Only your reservations are shown. All times use San Diego time.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
            <Button
              className="bg-[#4f654d] text-white hover:bg-[#3f523e]"
              asChild
            >
              <Link to="/resources">Browse resources</Link>
            </Button>
          </div>
        </header>

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
      </div>
    </main>
  )
}

function BookingsPage() {
  const { user } = useAuth()

  if (!user) return null

  // Do not carry one account's loaded bookings into another account's view.
  return <AccountBookings key={user.id} />
}

export default BookingsPage
