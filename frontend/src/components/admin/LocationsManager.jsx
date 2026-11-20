import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, MapPin, Plus, RefreshCw, X } from 'lucide-react'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import EditPanel from '@/components/admin/EditPanel'
import RecordAction from '@/components/admin/RecordAction'


function isLocation(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    Number.isInteger(value.id) &&
    value.id > 0 &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    (value.address == null || typeof value.address === 'string') &&
    typeof value.is_active === 'boolean'
  )
}

function LocationsManager({ onCreated } = {}) {
  const [form, setForm] = useState({ name: '', address: '' })
  const [reloadCount, setReloadCount] = useState(0)
  const [visibility, setVisibility] = useState('active')
  const [result, setResult] = useState({ key: -1, locations: [], error: '' })
  const [creating, setCreating] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [requiresRefresh, setRequiresRefresh] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editingBusy, setEditingBusy] = useState(false)
  const pending = useRef(false)
  const mounted = useRef(false)
  const requestKey = `${visibility}:${reloadCount}`
  const loading = result.key !== requestKey
  const formDisabled = creating || editingBusy || loading || requiresRefresh || Boolean(result.error)

  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    let active = true

    apiRequest(`/api/admin/locations?state=${visibility}`)
      .then((data) => {
        if (!Array.isArray(data.locations) || !data.locations.every(isLocation)) {
          throw new Error('The server returned an invalid location list.')
        }

        if (active) {
          setResult({ key: requestKey, locations: data.locations, error: '' })
          setRequiresRefresh(false)
        }
      })
      .catch((requestError) => {
        if (active) {
          setResult({
            key: requestKey,
            locations: [],
            error: requestError?.message || 'Unable to load locations.',
          })
        }
      })

    return () => {
      active = false
    }
  }, [reloadCount, visibility, requestKey])

  function refreshLocations() {
    if (pending.current || loading || editingBusy) return
    setEditing(null)
    setReloadCount((count) => count + 1)
  }

  function changed() {
    setEditing(null)
    setReloadCount(count => count + 1)
    onCreated?.()
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (pending.current || loading || requiresRefresh || result.error) return

    const name = form.name.trim()
    const address = form.address.trim()

    if (name.length < 1 || name.length > 120 || address.length > 250) {
      setFeedback({
        kind: 'error',
        message: 'Enter a name of 1–120 characters and an address of at most 250 characters.',
      })
      return
    }

    // Block repeat clicks before React renders the pending button.
    pending.current = true
    setCreating(true)
    setFeedback(null)
    let refreshAfterCreate = true

    try {
      const data = await apiRequest('/api/admin/locations', {
        method: 'POST',
        body: { name, address },
      })

      if (
        !isLocation(data.location) ||
        data.location.name !== name ||
        (data.location.address ?? null) !== (address || null) ||
        data.location.is_active !== true
      ) {
        const confirmationError = new Error(
          'The new location could not be confirmed. Refresh the location list before trying again.'
        )
        confirmationError.status = 502
        throw confirmationError
      }

      if (!mounted.current) return

      setFeedback({
        kind: 'success',
        message: `Location "${data.location.name}" created successfully (#${data.location.id}).`,
      })
      setForm({ name: '', address: '' })

      if (typeof onCreated === 'function') {
        onCreated(data.location)
      }
    } catch (requestError) {
      if (!mounted.current) return

      const uncertain =
        !Number.isInteger(requestError?.status) || requestError.status >= 500

      // A lost response does not prove the write failed. Never retry it here.
      refreshAfterCreate = !uncertain
      setRequiresRefresh(uncertain)
      setFeedback({
        kind: 'error',
        message: requestError?.message || 'Unable to confirm the new location.',
      })
    } finally {
      pending.current = false

      if (mounted.current) {
        setCreating(false)

        if (refreshAfterCreate) {
          setReloadCount((count) => count + 1)
        }
      }
    }
  }

  return (
    <section aria-labelledby="locations-heading" className="admin-manager">
      <div className="admin-manager-toolbar">
        <div>
          <h2 id="locations-heading">Location directory</h2>
          <p>{loading ? 'Loading your locations…' : result.error ? 'Refresh to load your locations.' : result.locations.length + ' saved location' + (result.locations.length === 1 ? '' : 's')}</p>
        </div>
        <div className="admin-toolbar-actions">
          <Button type="button" variant="outline" className="admin-btn admin-btn-outline"
            disabled={loading || creating || editingBusy} onClick={refreshLocations}>
            <RefreshCw aria-hidden="true" />Refresh
          </Button>
          <Button type="button"
            className={'admin-btn ' + (createOpen ? 'admin-btn-outline' : 'admin-btn-primary')}
            variant={createOpen ? 'outline' : 'default'}
            disabled={editingBusy || creating || (!createOpen && formDisabled)}
            aria-expanded={createOpen} aria-controls="location-create-panel"
            onClick={() => {setEditing(null); setCreateOpen((open) => !open)}}>
            {createOpen ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
            {createOpen ? 'Close form' : 'New location'}
          </Button>
        </div>
      </div>

      <div className="admin-inventory-filters" role="group" aria-label="Location visibility">
        {['active', 'archived'].map(state => <Button key={state} type="button" variant="outline" className="admin-filter-button"
          aria-pressed={visibility === state} disabled={loading || creating || editingBusy}
          onClick={() => { setEditing(null); setCreateOpen(false); setFeedback(null); setVisibility(state) }}>{state === 'active' ? 'Active' : 'Archived'}</Button>)}
      </div>

      {feedback && (
        <div role={feedback.kind === 'success' ? 'status' : 'alert'}
          className={'admin-notice ' + (feedback.kind === 'success' ? 'is-success' : 'is-error')}>
          {feedback.message}
        </div>
      )}
      {requiresRefresh && (
        <p role="status" className="admin-recovery-note">
          Click Refresh and check whether the location was added before creating
          it again. A timeout can happen after the location has been saved.
        </p>
      )}

      <div className={'admin-directory-layout' + (createOpen || editing ? ' is-editing' : '')}>
        <div className="admin-directory-card">
          {loading ? (
            <div role="status" className="admin-loading">
              <LoaderCircle className="admin-spinner" aria-hidden="true" />Loading locations…
            </div>
          ) : result.error ? (
            <div role="alert" className="admin-table-message is-error">{result.error}</div>
          ) : result.locations.length === 0 ? (
            <div className="admin-empty">
              <span className="admin-empty-icon"><MapPin aria-hidden="true" /></span>
              <h3>{visibility === 'active' ? 'No active locations' : 'No archived locations'}</h3>
              <p>{visibility === 'active' ? 'Add a location or switch to Archived to restore one.' : 'Archived locations appear here. History remains saved.'}</p>
            </div>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-directory-table">
                <caption className="admin-sr-only">Saved locations</caption>
                <thead>
                  <tr><th scope="col">Location</th><th scope="col">Address</th><th scope="col" className="admin-status-column">Status</th><th scope="col">Actions</th></tr>
                </thead>
                <tbody>
                  {result.locations.map((location) => (
                    <tr key={location.id}>
                      <td>
                        <div className="admin-record">
                          <span className="admin-record-icon"><MapPin aria-hidden="true" /></span>
                          <div><strong>{location.name}</strong><small>Location #{location.id}</small></div>
                        </div>
                      </td>
                      <td><span className="admin-address">{location.address || 'No address provided.'}</span></td>
                      <td>
                        <span className={'admin-status ' + (location.is_active ? 'is-active' : 'is-inactive')}>
                          {location.is_active ? 'Active' : 'Archived'}
                        </span>
                      </td>
                      <td className="admin-actions-cell"><div className="admin-row-actions">
                        <Button type="button" disabled={editingBusy || creating || requiresRefresh} variant="outline" className="admin-btn admin-btn-outline" onClick={() => {setCreateOpen(false); setFeedback(null); setEditing(location)}}
                        >
                        Edit
                        </Button>
                        <RecordAction key={`${location.id}:${reloadCount}`} label={location.is_active ? 'Archive location' : 'Restore location'}
                          endpoint={`/api/admin/locations/${location.id}/${location.is_active ? 'archive' : 'restore'}`}
                          responseKey="location" recordId={location.id} expected={!location.is_active}
                          description="This changes visibility for this location and its rooms. History is preserved; current/upcoming reservations must be cancelled first. Restoring makes active child rooms visible again."
                          disabled={Boolean(editing) || editingBusy || creating || requiresRefresh} onBusyChange={setEditingBusy} onChanged={changed} />
                        {!location.is_active && <RecordAction key={`delete:${location.id}:${requestKey}`} label="Delete permanently" deleting recordType="locations"
                          endpoint={`/api/admin/locations/${location.id}`} recordId={location.id}
                          description={`Permanently delete location "${location.name}"? This cannot be undone. Deletion is allowed only when it has no rooms. Anything with rooms/history must stay archived.`}
                          disabled={Boolean(editing) || editingBusy || creating || requiresRefresh} onBusyChange={setEditingBusy} onChanged={changed} />}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {editing && <EditPanel key={editing.id} title="Edit Location" record={editing} detailField="address" detailLabel="Address" endpoint="/api/admin/locations" responseKey="location" onBusyChange={setEditingBusy} onReload={refreshLocations} onExit={() => setEditing(null)} onSave={(updated)=> {
          setEditing(null)
          setFeedback({kind:"success", message:"Location " + updated.name + " updated"})
          changed()
        }} />}
        <aside id="location-create-panel" className="admin-create-panel" hidden={!createOpen}
          aria-labelledby="location-form-title">
          <div className="admin-editor-heading">
            <span className="admin-record-icon"><MapPin aria-hidden="true" /></span>
            <div><h3 id="location-form-title">New location</h3><p>Start with the building or site.</p></div>
          </div>
          <form aria-label="Create location" className="admin-create-form" onSubmit={handleSubmit}>
            <div className="admin-field">
              <Label htmlFor="location-name">Location name <span className="admin-required">*</span></Label>
              <Input id="location-name" name="name" type="text" className="admin-input"
                placeholder="Engineering Building" maxLength={120} value={form.name}
                onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                disabled={formDisabled} required />
              <p>A building or site name, rather than an individual room.</p>
            </div>
            <div className="admin-field">
              <Label htmlFor="location-address">Address <span className="admin-optional">Optional</span></Label>
              <Input id="location-address" name="address" type="text" className="admin-input"
                autoComplete="street-address" placeholder="123 Campus Way" maxLength={250} value={form.address}
                onChange={(event) => setForm((previous) => ({ ...previous, address: event.target.value }))}
                disabled={formDisabled} />
            </div>
            <div className="admin-form-actions">
              <Button type="button" variant="outline" className="admin-btn admin-btn-outline"
                disabled={creating} onClick={() => setCreateOpen(false)}>Close</Button>
              <Button type="submit" className="admin-btn admin-btn-primary"
                disabled={formDisabled || !form.name.trim()}>
                {creating ? <><LoaderCircle className="admin-spinner" aria-hidden="true" />Creating...</> : 'Create location'}
              </Button>
            </div>
          </form>
        </aside>
      </div>

      {result.locations.length === 100 && !loading && (
        <p className="admin-limit-note">Showing the 100 most recently created locations.</p>
      )}
    </section>
  )
}

export default LocationsManager
