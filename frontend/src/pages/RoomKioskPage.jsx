// Integrates Marie's room-availability kiosk with current main.
// BOOKED NOW means a reservation, not physical occupancy. Guest writes use a bounded RPC.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Maximize, RefreshCw, X } from 'lucide-react'
import { publicKioskRequest } from '@/lib/api'
import WalkInBooking from '@/components/WalkInBooking'
import { bookingQr, buildBookingLink } from '@/lib/booking-link'
import { KIOSK_REFRESH_MS, KIOSK_TIMEZONE, projectKioskSnapshot, readKioskSnapshot } from '@/lib/kiosk-model'

const timeFormatter = new Intl.DateTimeFormat('en-US', { timeZone: KIOSK_TIMEZONE, hour: 'numeric', minute: '2-digit' })
const dateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: KIOSK_TIMEZONE, weekday: 'long', month: 'short', day: 'numeric' })
const time = value => timeFormatter.format(new Date(value))
const styles = `
.room-kiosk{box-sizing:border-box;min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;gap:24px;padding:clamp(20px,4vw,48px);background:#374151;color:#fff;font-family:inherit}
.room-kiosk *{box-sizing:border-box}.room-kiosk.is-available{background:#166534}.room-kiosk.is-booked{background:#991b1b}
.room-kiosk h1,.room-kiosk h2,.room-kiosk p{margin:0}.room-kiosk header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
.room-kiosk .kiosk-room{min-width:0}.room-kiosk .kiosk-room h2{font-size:clamp(22px,3vw,36px);overflow-wrap:anywhere;font-weight:650}
.room-kiosk .kiosk-location{margin-top:6px;font-size:18px;color:#fff}.room-kiosk .kiosk-tools{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:10px}
.room-kiosk .kiosk-clock{font-size:clamp(20px,3vw,32px);font-variant-numeric:tabular-nums;white-space:nowrap}
.room-kiosk button,.room-kiosk .kiosk-exit{display:inline-flex;justify-content:center;align-items:center;gap:8px;min-width:44px;min-height:44px;padding:10px;border:1px solid #ffffff70;border-radius:9px;color:white;background:#ffffff18;font:inherit;cursor:pointer;text-decoration:none}
.room-kiosk button:hover,.room-kiosk .kiosk-exit:hover{background:#ffffff30}.room-kiosk button:disabled{opacity:.6;cursor:default}.room-kiosk svg{width:21px;height:21px}
.room-kiosk button[aria-pressed="true"]{background:#fff;color:#166534;border-color:#fff}
.room-kiosk :is(button,a):focus-visible{outline:3px solid white;outline-offset:4px}
.room-kiosk .kiosk-center{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:35px 0;text-align:center}
.room-kiosk h1{font-size:clamp(42px,9vw,120px);line-height:1.08;font-weight:800;letter-spacing:-.025em;overflow-wrap:anywhere}
.room-kiosk .kiosk-detail{font-size:clamp(20px,3vw,34px);max-width:900px;overflow-wrap:anywhere}
.room-kiosk .kiosk-disclaimer{max-width:720px;font-size:15px;line-height:1.6;color:#fff}.room-kiosk .kiosk-updated{font-size:13px;line-height:1.6}
.room-kiosk .kiosk-notice{padding:12px;border:1px solid #ffffff80;border-radius:9px;font-size:14px}
.room-kiosk footer{min-width:0}.room-kiosk footer h2{font-size:16px;margin-bottom:12px}.room-kiosk .kiosk-slots{display:flex;gap:12px;overflow-x:auto;padding:0 0 12px;margin:0;list-style:none;max-width:100%}
.room-kiosk .kiosk-slots li{flex-shrink:0;padding:14px 18px;border:1px solid #ffffff70;border-radius:10px;background:#ffffff15;font-size:16px}
.room-kiosk .kiosk-slots li.is-current{background:#fff;color:#1f2937}.room-kiosk .kiosk-slots p+p{margin-top:5px;font-size:14px}
.room-kiosk .kiosk-footer-note{font-size:13px;margin-top:8px;line-height:1.6}
.room-kiosk .kiosk-booking{display:flex;align-items:center;justify-content:center;gap:20px;padding:18px;border:1px solid #ffffff80;border-radius:12px;flex-wrap:wrap;text-align:left}
.room-kiosk .kiosk-booking svg{display:block;width:180px;height:180px;max-width:100%;background:white;border-radius:4px}.room-kiosk .kiosk-booking div{max-width:460px;min-width:0}
.room-kiosk .kiosk-booking h2{font-size:22px;margin-bottom:8px}.room-kiosk .kiosk-booking p{font-size:15px;line-height:1.6}.room-kiosk .kiosk-booking .kiosk-booking-url{overflow-wrap:anywhere;font-size:13px}
@media(max-width:560px){.room-kiosk header{flex-direction:column}.room-kiosk .kiosk-tools{width:100%;justify-content:flex-start}.room-kiosk .kiosk-clock{margin-right:auto}.room-kiosk .kiosk-center{padding:24px 0}.room-kiosk{gap:18px}}
`

function RoomKiosk({ resourceId }) {
  const [reading, setReading] = useState({ snapshot: null, receivedAt: 0, wallAt: 0, error: null })
  const [fetching, setFetching] = useState(true)
  const [notice, setNotice] = useState('')
  const [clock, setClock] = useState(() => ({ monotonic: performance.now(), wall: Date.now() }))
  const retry = useRef(null)
  const validId = /^\d+$/.test(resourceId || '') && Number.isSafeInteger(Number(resourceId)) && Number(resourceId) > 0
  const booking = useMemo(() => buildBookingLink(resourceId,
    import.meta.env.VITE_PUBLIC_BOOKING_URL, window.location.origin), [resourceId])
  const qr = useMemo(() => booking.url ? bookingQr(booking.url) : null, [booking.url])

  useEffect(() => {
    if (!validId) return
    let active = true
    let inFlight = false
    let refreshQueued = false
    let revision = 0
    let timer
    async function loadStatus() {
      if (!active) return
      if (inFlight) { refreshQueued = true; return }
      clearTimeout(timer)
      inFlight = true
      const requestRevision = revision
      setFetching(true)
      try {
        const data = await publicKioskRequest(resourceId)
        if (navigator.onLine === false) throw new Error('This device is offline. Waiting for a connection.')
        const snapshot = readKioskSnapshot(data, resourceId)
        if (active && requestRevision === revision) {
          const monotonic = performance.now()
          const wall = Date.now()
          setReading({ snapshot, receivedAt: monotonic, wallAt: wall, error: null })
          setClock({ monotonic, wall })
        }
      } catch (error) {
        if (active && requestRevision === revision) setReading({ snapshot: null, receivedAt: 0, wallAt: 0,
          error: { status: error?.status, message: error?.message || 'Unable to reach the server.' } })
      } finally {
        inFlight = false
        if (active) {
          setFetching(false)
          const delay = refreshQueued ? 0 : KIOSK_REFRESH_MS
          refreshQueued = false
          timer = setTimeout(loadStatus, delay)
        }
      }
    }
    function resume() {
      if (document.visibilityState !== 'visible') return
      revision++
      // Never keep a green display from before the iPad slept or changed tabs.
      setReading(previous => ({ ...previous, snapshot: null }))
      loadStatus()
    }
    function offline() {
      revision++
      setReading({ snapshot: null, receivedAt: 0, wallAt: 0,
        error: { message: 'This device is offline. Waiting for a connection.' } })
    }
    retry.current = () => {
      // A pre-booking request must not repaint green after a confirmed write.
      revision++
      setReading(previous => ({ ...previous, snapshot: null }))
      loadStatus()
    }
    loadStatus()
    const ticker = setInterval(() => setClock({ monotonic: performance.now(), wall: Date.now() }), 1000)
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('pageshow', resume)
    window.addEventListener('online', resume)
    window.addEventListener('offline', offline)
    return () => {
      active = false
      retry.current = null
      clearTimeout(timer)
      clearInterval(ticker)
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('pageshow', resume)
      window.removeEventListener('online', resume)
      window.removeEventListener('offline', offline)
    }
  }, [resourceId, validId])

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen?.()
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen()
      else setNotice('Full screen is not supported here. On iPad, use Safari’s Add to Home Screen for a standalone display.')
    } catch {
      setNotice('Full screen could not start. The room display still works in this browser window.')
    }
  }
  async function exitFullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen?.() } catch { /* Navigation is still available. */ }
  }

  const elapsed = Math.max(0, clock.monotonic - reading.receivedAt, clock.wall - reading.wallAt)
  const view = projectKioskSnapshot(reading.snapshot, elapsed)
  const fresh = !reading.error && view.state !== 'stale' && validId
  const booked = fresh && view.state === 'in_use'
  let headline = 'CHECKING STATUS'
  let detail = 'Waiting for a verified room schedule.'
  if (!validId || reading.error?.status === 404) {
    headline = 'ROOM UNAVAILABLE'
    detail = 'This room does not exist or is no longer active.'
  } else if (reading.error) {
    headline = reading.error.status === 401 || reading.error.status === 403 ? 'SIGN IN REQUIRED' : 'STATUS UNAVAILABLE'
    detail = reading.error.message
  } else if (fresh) {
    headline = booked ? 'BOOKED NOW' : 'AVAILABLE'
    detail = booked ? 'Reserved until ' + time(view.current.end)
      : view.next ? 'Next booking at ' + time(view.next.start) : 'No more bookings scheduled today.'
  } else if (reading.snapshot) {
    headline = 'STATUS UNAVAILABLE'
    detail = 'The last update is stale. Waiting for fresh server data.'
  }

  return (
    <main className={'room-kiosk' + (fresh ? booked ? ' is-booked' : ' is-available' : '')}>
      <style>{styles}</style>
      <header>
        <div className="kiosk-room"><h2>{reading.snapshot?.resource.name || 'Room availability'}</h2>
          {reading.snapshot && <p className="kiosk-location">{reading.snapshot.resource.location.name}</p>}</div>
        <div className="kiosk-tools">
          <p className="kiosk-clock" aria-label="San Diego time">{time(view.now || clock.wall)}</p>
          <button type="button" disabled={fetching || !validId} onClick={() => retry.current?.()} aria-label="Refresh room status"><RefreshCw aria-hidden="true" /></button>
          <button type="button" onClick={fullscreen} aria-label="Toggle full screen"><Maximize aria-hidden="true" /></button>
          <Link className="kiosk-exit" to="/walk-in" onClick={exitFullscreen} aria-label="Exit kiosk"><X aria-hidden="true" /></Link>
        </div>
      </header>
      {notice && <p className="kiosk-notice" role="status">{notice}</p>}
      <section className="kiosk-center">
        <h1 aria-live="polite">{headline}</h1>
        <p className="kiosk-detail" role={reading.error ? 'alert' : undefined}>{detail}</p>
        <p className="kiosk-disclaimer">Booking schedule only. Physical occupancy and card check-in are not verified.</p>
        {fresh && <p className="kiosk-updated">Verified at {time(reading.snapshot.checkedAt)} · Updates about every 10 seconds · San Diego time</p>}
      </section>
      {validId && <WalkInBooking resourceId={resourceId} enabled={fresh} onBooked={() => retry.current?.()} />}
      {fresh && qr && <section className="kiosk-booking" aria-label="Reserve this room on your phone">
        {qr && <svg viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label="QR code to book this room" shapeRendering="crispEdges">
          <rect width={qr.size} height={qr.size} fill="white" /><path d={qr.path} fill="black" />
        </svg>}
        <div><h2>Prefer to use your account?</h2>
          <p>Scan with your phone to choose an available time. Sign in on your own phone—not on this shared display.</p>
          <p>Scanning does not reserve a slot. Availability is checked again when you book.</p>
          {booking.url ? <p className="kiosk-booking-url">{booking.url}</p>
            : <p role="status">{booking.message}</p>}
        </div>
      </section>}
      {fresh && <footer aria-label="Today's room schedule">
        <h2>{dateFormatter.format(new Date(view.now))} · San Diego time</h2>
        {view.slots.length === 0 ? <p>No active time slots scheduled today.</p> :
          <ul className="kiosk-slots">{view.slots.map(slot =>
            <li key={slot.id} className={slot.is_now ? 'is-current' : ''}>
              <p>{time(slot.start)} – {time(slot.end)}</p>
              <p>{slot.end <= view.now ? 'Finished' : slot.is_booked ? 'Booked'
                : slot.start <= view.now ? 'Started · not reservable' : 'Open'}{slot.is_now && ' · now'}</p>
            </li>)}</ul>}
        <p className="kiosk-footer-note">Only active rooms and slots are shown. No reservation names or emails are displayed.</p>
      </footer>}
    </main>
  )
}

export default function RoomKioskPage() {
  const { resourceId } = useParams()
  return <RoomKiosk key={resourceId} resourceId={resourceId} />
}
