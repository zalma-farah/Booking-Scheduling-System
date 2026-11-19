import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import RecordAction from '@/components/admin/RecordAction'

const dateTime = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short' })
function format(value) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? dateTime.format(date) : 'Time unavailable'
}
export default function ReservationsManager() {
  const [status, setStatus] = useState('all')
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState({ key: '', rows: [], error: '' })
  const key = `${status}:${version}`
  const loading = result.key !== key
  useEffect(() => {
    let active = true
    apiRequest(`/api/admin/bookings?status=${encodeURIComponent(status)}`)
      .then(data => {
        if (!Array.isArray(data.bookings) || data.bookings.some(b => !b || !Number.isInteger(b.id) || !['active', 'cancelled'].includes(b.status))) {
          throw new Error('Invalid reservation response.')
        }
        if (active) setResult({ key, rows: data.bookings, error: '' })
      }).catch(err => { if (active) setResult({ key, rows: [], error: err.message || 'Unable to load reservations.' }) })
    return () => { active = false }
  }, [key, status])
  return <section className="admin-manager" aria-label="Managed reservations">
    <div className="admin-manager-toolbar">
      <div><h2>University reservations</h2><p>Only your assigned university. Personal bookings remain under My bookings.</p></div>
      <Button variant="outline" disabled={busy || loading} onClick={() => setVersion(v => v + 1)}>Refresh</Button>
    </div>
    <label>Status <select className="admin-select" value={status} disabled={busy} onChange={e => setStatus(e.target.value)}>
      <option value="all">All</option><option value="active">Active</option><option value="cancelled">Cancelled</option>
    </select></label>
    {loading ? <p role="status">Loading reservations...</p> : result.error ? <p role="alert">{result.error}</p> :
      <div className="admin-directory-card">
        {result.rows.length === 0 ? <p className="admin-empty">No matching reservations.</p> :
          <div className="admin-table-scroll"><table className="admin-directory-table">
            <caption>Latest {result.rows.length} reservations - San Diego time (maximum 100)</caption>
            <thead><tr><th>Booking</th><th>Room</th><th>Time</th><th>Status / actions</th></tr></thead>
            <tbody>{result.rows.map(b => <tr key={b.id}>
              <td>#{b.id}</td><td>{b.slot?.resource?.name || 'Room unavailable'}<small>{b.slot?.resource?.location?.name}</small></td>
              <td>{format(b.slot?.start_time)}<br />{format(b.slot?.end_time)}</td>
              <td>{b.status}{b.status === 'active' && <RecordAction key={`${b.id}:${key}`} responseKey="booking" recordId={b.id}
                endpoint={`/api/admin/bookings/${b.id}/cancel`} label="Cancel reservation"
                description={`Cancel reservation #${b.id}? History remains saved and the slot is released.`}
                disabled={busy} onBusyChange={setBusy} onChanged={() => setVersion(v => v + 1)} />}</td>
            </tr>)}</tbody>
          </table></div>}
      </div>}
  </section>
}
