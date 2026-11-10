import { useEffect, useState } from 'react'
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

function TimeSlotsPage() {
  const { resourceId } = useParams()
  const [reloadCount, setReloadCount] = useState(0)

  const [result, setResult] = useState({
    key: '',
    slots: [],
    error: '',
  })

  const requestKey = `${resourceId}:${reloadCount}`
  const loading = result.key !== requestKey

  useEffect(() => {
    let active = true

    apiRequest(
      `/api/resources/${encodeURIComponent(resourceId)}/slots`
    )
      .then((data) => {
        if (!Array.isArray(data.slots)) {
          throw new Error('The server returned an invalid slot list.')
        }

        if (active) {
          setResult({
            key: requestKey,
            slots: data.slots,
            error: '',
          })
        }
      })
      .catch((error) => {
        if (active) {
          setResult({
            key: requestKey,
            slots: [],
            error: error.message || 'Unable to load availability.',
          })
        }
      })

    return () => {
      active = false
    }
  }, [resourceId, requestKey])

  return (
    <main className="min-h-screen bg-[#eef3ec] p-6 sm:p-10">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-[#567058]">
              Booking & Scheduling
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Time slots
            </h1>

            <p className="mt-3 text-muted-foreground">
              Upcoming slots for this resource.
              All times are shown in San Diego time.
            </p>
          </div>

          <Button variant="outline" asChild>
            <Link to="/resources">Back to resources</Link>
          </Button>
        </header>

        <div className="mt-8 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">
            Availability
          </h2>

          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => setReloadCount((count) => count + 1)}
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
          <section
            aria-label="Time slots"
            className="mt-6 space-y-4"
          >
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

                <span
                  className={
                    slot.is_available
                      ? 'rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-800'
                      : 'rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700'
                  }
                >
                  {slot.is_available ? 'Available' : 'Booked'}
                </span>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}

export default TimeSlotsPage