import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { CalendarDays, LoaderCircle } from 'lucide-react'
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

function ResourceTimeSlots({ resourceId }) {
  const [reloadCount, setReloadCount] = useState(0)
  const [bookingSlotId, setBookingSlotId] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [requiresRefresh, setRequiresRefresh] = useState(false)
  const [result, setResult] = useState({ key: '', slots: [], error: '' })

  const bookingPending = useRef(false)
  const mounted = useRef(false)
  const requestKey = `${resourceId}:${reloadCount}`
  const loading = result.key !== requestKey
  const isBooking = bookingSlotId !== null

  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    let active = true

    apiRequest(`/api/resources/${encodeURIComponent(resourceId)}/slots`)
      .then((data) => {
        if (!Array.isArray(data.slots)) {
          throw new Error('The server returned an invalid slot list.')
        }

        if (active) {
          setResult({ key: requestKey, slots: data.slots, error: '' })
          setRequiresRefresh(false)
        }
      })
      .catch((requestError) => {
        if (active) {
          setResult({
            key: requestKey,
            slots: [],
            error: requestError?.message || 'Unable to load availability.',
          })
        }
      })

    return () => {
      active = false
    }
  }, [resourceId, requestKey])

  function refreshAvailability() {
    if (bookingPending.current || loading) return
    setReloadCount((count) => count + 1)
  }

  async function handleBook(slot) {
    if (
      bookingPending.current ||
      loading ||
      requiresRefresh ||
      !slot.is_available
    ) {
      return
    }

    // Block a second click before React has rendered the spinner.
    bookingPending.current = true
    setBookingSlotId(slot.id)
    setFeedback(null)
    let refreshAfterBooking = true

    try {
      const data = await apiRequest('/api/bookings', {
        method: 'POST',
        body: { time_slot_id: slot.id },
      })

      if (
        !data.booking ||
        data.booking.id == null ||
        data.booking.time_slot_id !== slot.id ||
        data.booking.status !== 'active'
      ) {
        const confirmationError = new Error(
          'The booking result could not be confirmed. Please refresh availability.'
        )
        confirmationError.status = 502
        throw confirmationError
      }

      if (!mounted.current) return

      setFeedback({
        kind: 'success',
        message: `Booking #${data.booking.id} created successfully.`,
      })

      setResult((previous) => ({
        ...previous,
        slots: previous.slots.map((item) =>
          item.id === slot.id ? { ...item, is_available: false } : item
        ),
      }))
    } catch (requestError) {
      if (!mounted.current) return

      const uncertain =
        !Number.isInteger(requestError?.status) || requestError.status >= 500

      // A timed-out write might have succeeded. Never retry it automatically.
      refreshAfterBooking = !uncertain
      setRequiresRefresh(uncertain)
      setFeedback({
        kind: 'error',
        message: requestError?.message || 'Unable to confirm the booking.',
      })
    } finally {
      bookingPending.current = false

      if (mounted.current) {
        setBookingSlotId(null)

        if (refreshAfterBooking) {
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
            <h1 className="mt-2 text-3xl font-bold">Time slots</h1>
            <p className="mt-3 text-muted-foreground">
              Upcoming slots for this resource. All times are shown in San Diego time.
            </p>
          </div>

          <Button variant="outline" asChild>
            <Link to="/resources">Back to resources</Link>
          </Button>
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
            Click Refresh to check availability before trying another booking.
            A timeout does not tell us whether the booking was saved.
          </p>
        )}

        <div className="mt-8 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Availability</h2>
          <Button
            type="button"
            variant="outline"
            disabled={loading || isBooking}
            onClick={refreshAvailability}
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
            <p>Loading time slots...</p>
          </div>
        ) : result.error ? (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700"
          >
            {result.error}
          </div>
        ) : result.slots.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-white p-8">
            <p>No upcoming active slots were found for this resource.</p>
          </div>
        ) : (
          <section aria-label="Time slots" className="mt-6 space-y-4">
            {result.slots.map((slot) => (
              <article
                key={slot.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-[#e2ebe0] p-3 text-[#4e684f]">
                    <CalendarDays className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      {dateFormatter.format(new Date(slot.start_time))}
                    </h3>
                    <p className="mt-1 text-muted-foreground">
                      {timeFormatter.format(new Date(slot.start_time))}
                      {' – '}
                      {timeFormatter.format(new Date(slot.end_time))}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={
                      slot.is_available
                        ? 'rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-800'
                        : 'rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700'
                    }
                  >
                    {slot.is_available ? 'Available' : 'Booked'}
                  </span>

                  {slot.is_available && (
                    <Button
                      className="bg-[#4f654d] text-white hover:bg-[#3f523e]"
                      type="button"
                      disabled={isBooking || requiresRefresh}
                      onClick={() => handleBook(slot)}
                    >
                      {bookingSlotId === slot.id ? (
                        <>
                          <LoaderCircle className="size-4 animate-spin" />
                          Booking...
                        </>
                      ) : (
                        'Book this slot'
                      )}
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}

function TimeSlotsPage() {
  const { resourceId } = useParams()

  // Reset feedback and pending state when navigating to a different resource.
  return <ResourceTimeSlots key={resourceId} resourceId={resourceId} />
}

export default TimeSlotsPage
