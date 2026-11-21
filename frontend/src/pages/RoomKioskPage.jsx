import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Maximize, X } from 'lucide-react'
import { apiRequest } from '@/lib/api'

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  hour: 'numeric',
  minute: '2-digit',
})

const formatTime = (value) => timeFormatter.format(new Date(value))

// How often the kiosk asks the server for the latest status (milliseconds).
const REFRESH_MS = 10000

function RoomKiosk({ resourceId }) {
  const [room, setRoom] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [clock, setClock] = useState(() => new Date())

  // Load the room's name and location once.
  useEffect(() => {
    let active = true

    apiRequest('/api/resources')
      .then((data) => {
        const match = Array.isArray(data.resources)
          ? data.resources.find((item) => String(item.id) === String(resourceId))
          : null

        if (active) setRoom(match || null)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [resourceId])

  // Ask the server for the room's status now, then every REFRESH_MS.
  useEffect(() => {
    let active = true

    function loadStatus() {
      apiRequest(`/api/resources/${encodeURIComponent(resourceId)}/status`)
        .then((data) => {
          if (!Array.isArray(data.slots)) {
            throw new Error('The server returned an invalid room status.')
          }

          if (active) {
            setStatus(data)
            setError('')
          }
        })
        .catch((requestError) => {
          if (active) {
            setError(requestError?.message || 'Unable to reach the server.')
          }
        })
    }

    loadStatus()
    const timer = setInterval(loadStatus, REFRESH_MS)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [resourceId])

  // Keep the on-screen clock ticking.
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  function enterFullScreen() {
    document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const inUse = status?.state === 'in_use'
  const offline = Boolean(error) || !status

  let background = 'bg-gray-600'
  let headline = 'LOADING...'
  let detail = ''

  if (error) {
    headline = 'OFFLINE'
    detail = error
  } else if (inUse) {
    background = 'bg-red-700'
    headline = 'IN USE'
    detail = `Booked until ${formatTime(status.current_slot.end_time)}`
  } else if (status) {
    background = 'bg-green-700'
    headline = 'AVAILABLE'
    detail = status.next_booked_slot
      ? `Next booking at ${formatTime(status.next_booked_slot.start_time)}`
      : 'Free for the rest of today'
  }

  return (
    <main
      className={`fixed inset-0 flex flex-col text-white transition-colors duration-500 ${background}`}
    >
      <header className="flex items-start justify-between gap-4 p-6 sm:p-10">
        <div>
          <p className="text-2xl font-semibold sm:text-3xl">
            {room?.name || 'Room'}
          </p>
          {room?.location?.name && (
            <p className="mt-1 text-lg opacity-80">{room.location.name}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <p className="text-2xl font-semibold tabular-nums sm:text-3xl">
            {formatTime(clock)}
          </p>

          <button
            type="button"
            onClick={enterFullScreen}
            className="rounded-full bg-white/15 p-3 hover:bg-white/25"
            aria-label="Enter full screen"
            title="Full screen"
          >
            <Maximize className="size-5" />
          </button>

          <Link
            to="/resources"
            className="rounded-full bg-white/15 p-3 hover:bg-white/25"
            aria-label="Exit kiosk"
            title="Exit kiosk"
          >
            <X className="size-5" />
          </Link>
        </div>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="text-7xl font-extrabold tracking-wide sm:text-9xl">
          {headline}
        </h1>
        <p className="mt-6 text-2xl sm:text-4xl">{detail}</p>
      </section>

      {!offline && (
        <footer className="p-6 sm:p-10">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider opacity-80">
            Today
          </p>

          {status.slots.length === 0 ? (
            <p className="opacity-80">No time slots scheduled today.</p>
          ) : (
            <ul className="flex gap-3 overflow-x-auto pb-1">
              {status.slots.map((slot) => (
                <li
                  key={slot.id}
                  className={
                    slot.is_now
                      ? 'shrink-0 rounded-xl bg-white px-4 py-3 text-gray-900'
                      : 'shrink-0 rounded-xl bg-white/15 px-4 py-3'
                  }
                >
                  <p className="font-semibold">
                    {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                  </p>
                  <p className="text-sm">
                    {slot.is_booked ? 'Booked' : 'Open'}
                    {slot.is_now && ' · now'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </footer>
      )}
    </main>
  )
}

function RoomKioskPage() {
  const { resourceId } = useParams()

  return <RoomKiosk key={resourceId} resourceId={resourceId} />
}

export default RoomKioskPage