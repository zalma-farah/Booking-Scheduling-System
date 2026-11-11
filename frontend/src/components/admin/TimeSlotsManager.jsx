import { useEffect, useRef, useState } from 'react'
import { CalendarDays, LoaderCircle, Plus, RefreshCw, X } from 'lucide-react'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
})
const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
})
const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'your device time zone'

function isResource(value) {
  return (
    value !== null && typeof value === 'object' &&
    Number.isInteger(value.id) && value.id > 0 &&
    typeof value.name === 'string' &&
    typeof value.is_active === 'boolean' &&
    (value.location == null ||
      (typeof value.location.name === 'string' && typeof value.location.is_active === 'boolean'))
  )
}

function isSlot(value) {
  if (
    value === null || typeof value !== 'object' ||
    !Number.isInteger(value.id) || value.id < 1 ||
    !Number.isInteger(value.resource_id) || value.resource_id < 1 ||
    typeof value.is_active !== 'boolean' ||
    typeof value.start_time !== 'string' || typeof value.end_time !== 'string' ||
    (value.resource != null && (!isResource(value.resource) || value.resource.id !== value.resource_id))
  ) return false

  const start = new Date(value.start_time).getTime()
  const end = new Date(value.end_time).getTime()
  return Number.isFinite(start) && Number.isFinite(end) && end > start
}

function parseLocalInput(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null
  const value = new Date(date + 'T' + time + ':00')
  if (!Number.isFinite(value.getTime())) return null
  const pad = (part) => String(part).padStart(2, '0')
  const normalizedDate = String(value.getFullYear()).padStart(4, '0') + '-' + pad(value.getMonth() + 1) + '-' + pad(value.getDate())
  const normalizedTime = pad(value.getHours()) + ':' + pad(value.getMinutes())
  // Reject invalid dates and times normalized across a daylight-saving gap.
  return normalizedDate === date && normalizedTime === time ? value : null
}

function formatRange(start, end) {
  const startDay = dateFormatter.format(start)
  const endDay = dateFormatter.format(end)
  return timeFormatter.format(start) + ' – ' + (startDay === endDay ? '' : endDay + ', ') + timeFormatter.format(end)
}

// Runs only in response to form submission, never while React renders the page.
async function submitTimeSlot(event, context) {
  const {
    form, formDisabled, selectedResource, pending, mounted,
    setFeedback, setCreating, setRequiresRefresh, setForm, setReloadCount,
  } = context
  event.preventDefault()
  if (pending.current || formDisabled) return

  const start = parseLocalInput(form.date, form.startTime)
  const end = parseLocalInput(form.date, form.endTime)

  if (!selectedResource || !start || !end) {
    setFeedback({ kind: 'error', message: 'Choose an active room and valid date/start/end times for your device time zone.' })
    return
  }

  const now = Date.now()
  if (start.getTime() <= now) {
    setFeedback({ kind: 'error', message: 'The slot must start in the future.' })
    return
  }
  if (start.getTime() >= now + 30 * 24 * 60 * 60 * 1000) {
    setFeedback({ kind: 'error', message: 'Choose a start within the next 30 days.' })
    return
  }
  if (end <= start) {
    setFeedback({ kind: 'error', message: 'End time must be after start time on the selected date.' })
    return
  }

  pending.current = true
  setCreating(true)
  setFeedback(null)
  let refreshAfterCreate = true

  try {
    const data = await apiRequest('/api/admin/time-slots', {
      method: 'POST',
      body: { resource_id: selectedResource.id, start_time: start.toISOString(), end_time: end.toISOString() },
    })

    if (
      !isSlot(data.slot) || data.slot.resource_id !== selectedResource.id ||
      data.slot.is_active !== true ||
      new Date(data.slot.start_time).getTime() !== start.getTime() ||
      new Date(data.slot.end_time).getTime() !== end.getTime()
    ) {
      const confirmationError = new Error('The new slot could not be confirmed. Refresh the time-slot list before trying again.')
      confirmationError.status = 502
      throw confirmationError
    }

    if (!mounted.current) return
    setFeedback({ kind: 'success', message: `Time slot created successfully (#${data.slot.id}).` })
    setForm((previous) => ({ ...previous, startTime: '', endTime: '' }))
  } catch (requestError) {
    if (!mounted.current) return
    const uncertain = !Number.isInteger(requestError?.status) || requestError.status >= 500
    refreshAfterCreate = !uncertain
    setRequiresRefresh(uncertain)
    setFeedback({ kind: 'error', message: requestError?.message || 'Unable to confirm the new slot.' })
  } finally {
    pending.current = false
    if (mounted.current) {
      setCreating(false)
      if (refreshAfterCreate) setReloadCount((count) => count + 1)
    }
  }
}


function TimeSlotsManager({ resourceVersion = 0 } = {}) {
  const [form, setForm] = useState({ resourceId: '', date: '', startTime: '', endTime: '' })
  const [reloadCount, setReloadCount] = useState(0)
  const [result, setResult] = useState({ key: '', resources: [], slots: [], error: '' })
  const [creating, setCreating] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [requiresRefresh, setRequiresRefresh] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const pending = useRef(false)
  const mounted = useRef(false)
  const requestKey = `${resourceVersion}:${reloadCount}`
  const loading = result.key !== requestKey
  const activeResources = result.resources.filter(
    (resource) => resource.is_active && resource.location?.is_active === true
  )
  const selectedResource = activeResources.find((resource) => String(resource.id) === form.resourceId)
  const formDisabled = creating || loading || requiresRefresh || Boolean(result.error) || activeResources.length === 0
  const previewStart = parseLocalInput(form.date, form.startTime)
  const previewEnd = parseLocalInput(form.date, form.endTime)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    let active = true

    Promise.all([apiRequest('/api/admin/resources'), apiRequest('/api/admin/time-slots')])
      .then(([resourceData, slotData]) => {
        if (
          !Array.isArray(resourceData.resources) || !resourceData.resources.every(isResource) ||
          !Array.isArray(slotData.slots) ||
          !slotData.slots.every((slot) => isSlot(slot) && typeof slot.is_available === 'boolean')
        ) throw new Error('The server returned invalid room or time-slot data.')

        if (active) {
          setResult({ key: requestKey, resources: resourceData.resources, slots: slotData.slots, error: '' })
          setRequiresRefresh(false)
        }
      })
      .catch((requestError) => {
        if (active) {
          setResult({ key: requestKey, resources: [], slots: [], error: requestError?.message || 'Unable to load time slots.' })
        }
      })

    return () => { active = false }
  }, [requestKey])

  function refreshSlots() {
    if (pending.current || loading) return
    setReloadCount((count) => count + 1)
  }


  return (
    <section aria-labelledby="time-slots-heading" className="admin-manager">
      <div className="admin-manager-toolbar">
        <div>
          <h2 id="time-slots-heading">Upcoming time slots</h2>
          <p>{loading ? 'Loading slots…' : result.error ? 'Refresh to load time slots.' : result.slots.length + ' upcoming slot' + (result.slots.length === 1 ? '' : 's') + ' · San Diego time'}</p>
        </div>
        <div className="admin-toolbar-actions">
          <Button type="button" variant="outline" className="admin-btn admin-btn-outline"
            disabled={loading || creating} onClick={refreshSlots}>
            <RefreshCw aria-hidden="true" />Refresh
          </Button>
          <Button type="button" className={'admin-btn ' + (createOpen ? 'admin-btn-outline' : 'admin-btn-primary')}
            variant={createOpen ? 'outline' : 'default'} disabled={creating || (!createOpen && formDisabled)}
            aria-expanded={createOpen} aria-controls="slot-create-panel" onClick={() => setCreateOpen((open) => !open)}>
            {createOpen ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}{createOpen ? 'Close form' : 'New time slot'}
          </Button>
        </div>
      </div>

      {feedback && <div role={feedback.kind === 'success' ? 'status' : 'alert'}
        className={'admin-notice ' + (feedback.kind === 'success' ? 'is-success' : 'is-error')}>{feedback.message}</div>}
      {requiresRefresh && <p role="status" className="admin-recovery-note">Click Refresh and check whether the slot was saved before creating it again. A timeout does not prove the write failed.</p>}
      {!loading && !result.error && activeResources.length === 0 && <p role="status" className="admin-notice is-info">Create an active room at an active location first, then return to Time slots.</p>}

      <div className={'admin-directory-layout' + (createOpen ? ' is-editing' : '')}>
        <div className="admin-directory-card">
          {loading ? (
            <div role="status" className="admin-loading"><LoaderCircle className="admin-spinner" aria-hidden="true" />Loading time slots…</div>
          ) : result.error ? (
            <div role="alert" className="admin-table-message is-error">{result.error}</div>
          ) : result.slots.length === 0 ? (
            <div className="admin-empty"><span className="admin-empty-icon"><CalendarDays aria-hidden="true" /></span>
              <h3>No upcoming time slots</h3><p>Use New time slot to make a room available for booking.</p></div>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-directory-table admin-slot-table">
                <caption className="admin-sr-only">Upcoming time slots and availability</caption>
                <thead><tr><th scope="col">Room / resource</th><th scope="col">Date & time</th><th scope="col" className="admin-status-column">Availability</th></tr></thead>
                <tbody>{result.slots.map((slot) => {
                  const resource = slot.resource
                  const hidden = !resource || !resource.is_active || resource.location?.is_active !== true
                  const label = !slot.is_active ? 'Inactive' : hidden ? 'Hidden' : slot.is_available ? 'Available' : 'Booked'
                  const statusClass = label === 'Available' ? 'is-active' : label === 'Booked' ? 'is-booked' : 'is-inactive'
                  const start = new Date(slot.start_time)
                  const end = new Date(slot.end_time)
                  return (
                    <tr key={slot.id}>
                      <td><div className="admin-record"><span className="admin-record-icon"><CalendarDays aria-hidden="true" /></span>
                        <div><strong>{resource?.name || 'Resource #' + slot.resource_id}</strong><small>Slot #{slot.id}</small>
                          {resource?.location?.name && <p className="admin-resource-description">{resource.location.name}</p>}</div></div></td>
                      <td><strong className="admin-slot-date">{dateFormatter.format(start)}</strong><span className="admin-slot-time">{formatRange(start, end)}</span></td>
                      <td><span className={'admin-status ' + statusClass}>{label}</span></td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          )}
        </div>

        <aside id="slot-create-panel" className="admin-create-panel" hidden={!createOpen} aria-labelledby="slot-form-title">
          <div className="admin-editor-heading"><span className="admin-record-icon"><CalendarDays aria-hidden="true" /></span>
            <div><h3 id="slot-form-title">New time slot</h3><p>Choose a room and its available time.</p></div></div>
          <form
            aria-label="Create time slot"
            className="admin-create-form"
            onSubmit={(event) => submitTimeSlot(event, {
              form, formDisabled, selectedResource, pending, mounted,
              setFeedback, setCreating, setRequiresRefresh, setForm, setReloadCount,
            })}
          >
            <div className="admin-field"><Label htmlFor="slot-resource">Room / resource <span className="admin-required">*</span></Label>
              <select id="slot-resource" name="resource_id" className="admin-select" value={form.resourceId}
                onChange={(event) => setForm((previous) => ({ ...previous, resourceId: event.target.value }))} disabled={formDisabled} required>
                <option value="">Select a room</option>
                {activeResources.map((resource) => <option key={resource.id} value={String(resource.id)}>{resource.name} — {resource.location.name}</option>)}
              </select></div>
            <div className="admin-field"><Label htmlFor="slot-date">Date <span className="admin-required">*</span></Label>
              <Input id="slot-date" name="date" type="date" className="admin-input" value={form.date}
                onChange={(event) => setForm((previous) => ({ ...previous, date: event.target.value }))} disabled={formDisabled} required /></div>
            <div className="admin-time-fields">
              <div className="admin-field"><Label htmlFor="slot-start">Start time <span className="admin-required">*</span></Label>
                <Input id="slot-start" name="start_time" type="time" step={60} className="admin-input" value={form.startTime}
                  onChange={(event) => setForm((previous) => ({ ...previous, startTime: event.target.value }))} disabled={formDisabled} required /></div>
              <div className="admin-field"><Label htmlFor="slot-end">End time <span className="admin-required">*</span></Label>
                <Input id="slot-end" name="end_time" type="time" step={60} className="admin-input" value={form.endTime}
                  onChange={(event) => setForm((previous) => ({ ...previous, endTime: event.target.value }))} disabled={formDisabled} required /></div>
            </div>
            <p className="admin-timezone-note">Entry time zone: <strong>{deviceTimeZone}</strong>. Choose a start within the next 30 days. End time must be later on the same date.</p>
            {previewStart && previewEnd && previewEnd > previewStart && (
              <div className="admin-slot-preview"><strong>San Diego preview</strong>{dateFormatter.format(previewStart)}<br />{formatRange(previewStart, previewEnd)}</div>
            )}
            <div className="admin-form-actions"><Button type="button" variant="outline" className="admin-btn admin-btn-outline" disabled={creating} onClick={() => setCreateOpen(false)}>Close</Button>
              <Button type="submit" className="admin-btn admin-btn-primary" disabled={formDisabled || !selectedResource || !form.date || !form.startTime || !form.endTime}>
                {creating ? <><LoaderCircle className="admin-spinner" aria-hidden="true" />Creating...</> : 'Create time slot'}
              </Button></div>
          </form>
        </aside>
      </div>
      {result.slots.length === 100 && !loading && <p className="admin-limit-note">Showing the next 100 upcoming slots. Availability updates when you refresh.</p>}
    </section>
  )
}

export default TimeSlotsManager
