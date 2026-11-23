import { useEffect, useRef, useState } from 'react'
import { walkInRequest } from '@/lib/api'
import { confirmationId, durationOptions, readPending, readWalkInQuote, readWalkInReceipt } from '@/lib/walk-in'
import { ArrowRight, Check, CheckCircle2, Clock3, Info, ShieldCheck } from 'lucide-react'

const time = value => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }).format(new Date(value))

const styles = `
.walk-in-panel{box-sizing:border-box;width:100%;max-width:1000px;margin:0 auto;border-radius:20px;border:1px solid #e2e9dd;background:#fff;color:#293d2d;text-align:left;box-shadow:0 8px 28px #102a1512;overflow:hidden;font-size:15px;line-height:1.7}
.walk-in-panel *{box-sizing:border-box}.walk-in-panel .wi-inner{padding:clamp(22px,3vw,36px)}
.walk-in-panel .wi-heading{display:flex;align-items:flex-start;gap:14px;margin-bottom:24px}.walk-in-panel .wi-icon-box{display:grid;place-items:center;flex-shrink:0;width:44px;height:44px;border-radius:12px;background:#edf3e8;color:#547548}
.walk-in-panel .wi-icon-box svg{width:22px;height:22px}.walk-in-panel .wi-eyebrow{font-size:10px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:#7d9074;margin-bottom:4px}
.walk-in-panel .wi-title{font-size:clamp(20px,2.4vw,26px);font-weight:700;line-height:1.35;letter-spacing:-.025em;color:#293d2d}
.walk-in-panel .wi-description{margin-top:8px;font-size:13px;line-height:1.8;color:#7b8974;max-width:660px}.walk-in-panel .wi-until{display:inline-flex;align-items:center;gap:7px;font-size:13px;color:#527146;background:#f0f5ec;border:1px solid #e0e9d9;border-radius:8px;padding:7px 11px;margin-bottom:16px}.walk-in-panel .wi-until svg{width:16px;height:16px}
.walk-in-panel .wi-label{font-size:13px;font-weight:650;color:#52694a;margin-bottom:10px}.walk-in-panel .wi-durations{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:12px;margin-bottom:20px}
.room-kiosk .walk-in-panel .wi-duration{position:relative;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:4px;min-height:82px;min-width:0;padding:16px 18px;border:1px solid #dde6d7;border-radius:12px;background:#fff;color:#385332;font-size:14px;font-weight:650;text-align:left;line-height:1.5;transition:background .15s,border-color .15s;overflow-wrap:anywhere}
.room-kiosk .walk-in-panel .wi-duration:hover{background:#f5f8f1;border-color:#9cb490}.room-kiosk .walk-in-panel .wi-duration[aria-pressed="true"]{background:#eef5e8;border:2px solid #65865a;padding:15px 17px;color:#385332}.walk-in-panel .wi-duration small{font-size:12px;font-weight:400;color:#7c8d72}.walk-in-panel .wi-selected{position:absolute;right:10px;top:10px;width:15px;height:15px;color:#547b46}
.walk-in-panel .wi-summary{padding:14px 16px;border:1px solid #e1e9da;border-radius:10px;background:#f7faf3;color:#5c7551;font-size:13px;margin-bottom:16px}
.walk-in-panel .wi-info{display:flex;gap:12px;align-items:flex-start;padding:18px;border:1px solid #e8e5d4;background:#fbfaf3;border-radius:12px;color:#83774d;margin-bottom:20px}.walk-in-panel .wi-info>svg{width:19px;height:19px;flex-shrink:0;margin-top:3px}.walk-in-panel .wi-info strong{display:block;font-size:14px;font-weight:650;color:#72683f}.walk-in-panel .wi-info p{font-size:13px;line-height:1.8;margin-top:4px}
.walk-in-panel .wi-actions{display:flex;align-items:center;gap:16px;justify-content:space-between;flex-wrap:wrap}.walk-in-panel .wi-safe{display:flex;align-items:center;gap:7px;color:#8a9881;font-size:12px}.walk-in-panel .wi-safe svg{width:15px;height:15px;flex-shrink:0}
.room-kiosk .walk-in-panel .wi-confirm{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;max-width:100%;padding:12px 20px;border:1px solid #41664c;border-radius:10px;background:#41664c;color:#fff;font-size:14px;font-weight:650;line-height:1.5;white-space:normal}
.room-kiosk .walk-in-panel .wi-confirm:hover{background:#34563e;border-color:#34563e}.room-kiosk .walk-in-panel .wi-confirm:disabled{background:#edf0e9;border-color:#e3e8dd;color:#99a48f;opacity:1;cursor:not-allowed}.walk-in-panel .wi-confirm svg{width:17px;height:17px;flex-shrink:0}
.room-kiosk .walk-in-panel button:focus-visible{outline:3px solid #688b5b;outline-offset:4px}.walk-in-panel .wi-error{font-size:13px;line-height:1.8;color:#a04f34;background:#fff7f2;border:1px solid #eed5c9;border-radius:10px;padding:12px 16px;margin-top:16px}
.walk-in-panel .wi-success{display:flex;align-items:flex-start;gap:14px;background:#f0f6e9;border:1px solid #dce9d0;border-radius:14px;padding:22px;color:#49683a}.walk-in-panel .wi-success>svg{width:26px;height:26px;flex-shrink:0;margin-top:3px}.walk-in-panel .wi-success strong{font-size:17px;line-height:1.5}.walk-in-panel .wi-success p{font-size:13px;line-height:1.8;margin-top:6px}
.walk-in-panel .wi-footer{padding:12px clamp(22px,3vw,36px);border-top:1px solid #edf0e7;background:#fafbf7;font-size:11px;color:#97a28d}
@media(max-width:560px){.walk-in-panel .wi-actions{align-items:stretch;flex-direction:column}.room-kiosk .walk-in-panel .wi-confirm{width:100%}.walk-in-panel .wi-heading{gap:10px}.walk-in-panel .wi-icon-box{width:36px;height:36px;border-radius:10px}.walk-in-panel .wi-title{font-size:20px}}
`

export default function WalkInBooking({ resourceId, onBooked, enabled }) {
  const storageKey = `walk-in-pending:${resourceId}`
  const [quote, setQuote] = useState(null)
  const [clock, setClock] = useState(() => ({ wall: Date.now(), monotonic: performance.now() }))
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [pending, setPending] = useState(() => {
    try { return readPending(sessionStorage.getItem(storageKey)) } catch { return null }
  })
  const [version, setVersion] = useState(0)
  const writing = useRef(false)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  useEffect(() => {
    let active = true, timer
    async function load() {
      try {
        const data = readWalkInQuote(await walkInRequest(resourceId), resourceId)
        if (active) {
          setQuote({ ...data, received: Date.now(), monotonic: performance.now() })
          setClock({ wall: Date.now(), monotonic: performance.now() })
        }
      } catch {
        if (active) setQuote(null)
      } finally {
        if (active) timer = setTimeout(load, 10000)
      }
    }
    load()
    const tick = setInterval(() => setClock({ wall: Date.now(), monotonic: performance.now() }), 1000)
    return () => { active = false; clearTimeout(timer); clearInterval(tick) }
  }, [resourceId, version])
  useEffect(() => {
    if (!receipt) return
    const timer = setTimeout(() => { setReceipt(null); setSelected(''); setMessage(''); setVersion(v => v + 1) }, 20000)
    return () => clearTimeout(timer)
  }, [receipt])

  // Wall and monotonic clocks stop old quotes surviving clock changes or sleep.
  const age = quote ? Math.max(0, clock.wall - quote.received, clock.monotonic - quote.monotonic) : Infinity
  const options = enabled ? durationOptions(quote, age) : []
  const selectedOption = options.find(option => option.key === selected)
  const selectedValid = Boolean(selectedOption)

  async function confirm() {
    if (writing.current || (!pending && (!enabled || !selectedValid || receipt))) return
    writing.current = true
    setBusy(true)
    let body = pending
    let durable = Boolean(pending)
    try {
      if (!body) {
        body = { end_time: selectedOption.end, request_id: confirmationId() }
        // Save BEFORE the write: refresh/retry must reuse the same confirmation ID.
        sessionStorage.setItem(storageKey, JSON.stringify(body))
        durable = true
        setPending(body)
      }
      const confirmed = readWalkInReceipt(await walkInRequest(resourceId, body), body, resourceId)
      try { sessionStorage.removeItem(storageKey) } catch { /* A saved retry remains idempotent. */ }
      if (!mounted.current) return
      setPending(null)
      setReceipt(confirmed)
      setQuote(null)
      setMessage('')
      onBooked()
    } catch (error) {
      if (!mounted.current) return
      if ([400, 404, 409].includes(error?.status)) {
        try { sessionStorage.removeItem(storageKey) } catch { /* No new reservation is sent here. */ }
        setPending(null)
        setSelected('')
        setQuote(null)
        setVersion(v => v + 1)
        setMessage(error.message || 'Availability changed. Choose again.')
      } else {
        setMessage(durable ? 'Confirmation is not verified. Use “Check confirmation” to safely retry the same request. Do not start another reservation.'
          : 'This browser cannot store a safe confirmation. No reservation was sent.')
      }
    } finally {
      writing.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return <section className="walk-in-panel" aria-label="Guest walk-in booking">
    <style>{styles}</style>
    <div className="wi-inner">
      <div className="wi-heading"><span className="wi-icon-box"><Clock3 aria-hidden="true" /></span><div>
        <p className="wi-eyebrow">Guest reservation</p>
        <h2 className="wi-title">Reserve now — no account needed</h2>
        <p className="wi-description">Starts now. Up to two hours, within enabled hours and before the next reservation.</p>
      </div></div>
      {receipt ? <div role="status" className="wi-success"><CheckCircle2 aria-hidden="true" /><div>
        <strong>{receipt.status === 'active' ? `Walk-in reservation confirmed until ${time(receipt.end)}.` : 'This reservation was cancelled by an administrator.'}</strong>
        <p>This screen resets in 20 seconds. Contact an administrator if you need to cancel.</p>
      </div></div> : <>
        {pending ? <div role="status" className="wi-info"><Info aria-hidden="true" /><div><strong>Let’s check your reservation</strong><p>A reservation needs confirmation. Check it before starting another. We’ll use the same request so you won’t book twice.</p></div></div>
          : options.length ? <>
            <p className="wi-until"><Clock3 aria-hidden="true" />Available to reserve until {time(quote.until)}</p>
            <p className="wi-label">How long do you need?</p>
            <div role="group" aria-label="Reservation duration" className="wi-durations">
              {options.map(option => <button type="button" className="wi-duration" key={option.key} disabled={busy} aria-pressed={selected === option.key}
                onClick={() => { setSelected(option.key); setMessage('') }}>{option.label}<small>Until {time(option.end)}</small>
                {selected === option.key && <Check className="wi-selected" aria-hidden="true" />}
              </button>)}
            </div>
            {selectedValid && <p className="wi-summary">Your reservation: <strong>now → {time(selectedOption.end)}</strong>. Confirm below to save this time.</p>}
          </> : <div role="status" className="wi-info"><Info aria-hidden="true" /><div>
            <strong>{enabled ? 'No walk-in period is verified right now' : 'Checking the room’s live status'}</strong>
            <p>{enabled ? 'Duration choices appear during active, unbooked booking hours, with at least five minutes remaining. Check back later or ask an administrator for help.' : 'Please wait for verified availability before reserving.'}</p>
          </div></div>}
        <div className="wi-actions"><p className="wi-safe"><ShieldCheck aria-hidden="true" />No sign-in or personal details needed</p>
          <button type="button" className="wi-confirm" aria-label={pending ? 'Check confirmation' : 'Confirm guest reservation'} disabled={busy || (!pending && !selectedValid)} onClick={confirm}>
            {busy ? 'Checking reservation…' : pending ? 'Check confirmation' : 'Confirm guest reservation'}<ArrowRight aria-hidden="true" />
          </button>
        </div>
        {message && <p className="wi-error" role="alert">{message}</p>}
      </>}
    </div>
    <p className="wi-footer">San Diego time · Availability is checked again when you confirm · Cancellations are handled by an administrator</p>
  </section>
}
