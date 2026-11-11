import { useEffect, useRef, useState } from 'react'
import { Building2, LoaderCircle, Plus, RefreshCw, X } from 'lucide-react'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function isLocation(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    Number.isInteger(value.id) &&
    value.id > 0 &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof value.is_active === 'boolean'
  )
}

function isResource(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    Number.isInteger(value.id) &&
    value.id > 0 &&
    Number.isInteger(value.location_id) &&
    value.location_id > 0 &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    (value.description == null || typeof value.description === 'string') &&
    typeof value.is_active === 'boolean' &&
    (value.location == null ||
      (isLocation(value.location) && value.location.id === value.location_id))
  )
}

function ResourcesManager({ locationVersion = 0, onCreated } = {}) {
  const [form, setForm] = useState({ locationId: '', name: '', description: '' })
  const [reloadCount, setReloadCount] = useState(0)
  const [result, setResult] = useState({ key: '', locations: [], resources: [], error: '' })
  const [creating, setCreating] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [requiresRefresh, setRequiresRefresh] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const pending = useRef(false)
  const mounted = useRef(false)
  const requestKey = `${locationVersion}:${reloadCount}`
  const loading = result.key !== requestKey
  const activeLocations = result.locations.filter((location) => location.is_active)
  const selectedLocation = activeLocations.find(
    (location) => String(location.id) === form.locationId
  )
  const formDisabled =
    creating || loading || requiresRefresh || Boolean(result.error) || activeLocations.length === 0

  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    let active = true

    Promise.all([
      apiRequest('/api/admin/locations'),
      apiRequest('/api/admin/resources'),
    ])
      .then(([locationData, resourceData]) => {
        if (
          !Array.isArray(locationData.locations) ||
          !locationData.locations.every(isLocation) ||
          !Array.isArray(resourceData.resources) ||
          !resourceData.resources.every(isResource)
        ) {
          throw new Error('The server returned invalid location or resource data.')
        }

        if (active) {
          setResult({
            key: requestKey,
            locations: locationData.locations,
            resources: resourceData.resources,
            error: '',
          })
          setRequiresRefresh(false)
        }
      })
      .catch((requestError) => {
        if (active) {
          setResult({
            key: requestKey,
            locations: [],
            resources: [],
            error: requestError?.message || 'Unable to load rooms and locations.',
          })
        }
      })

    return () => {
      active = false
    }
  }, [requestKey])

  function refreshResources() {
    if (pending.current || loading) return
    setReloadCount((count) => count + 1)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (pending.current || formDisabled) return

    const name = form.name.trim()
    const description = form.description.trim()

    if (!selectedLocation || name.length < 1 || name.length > 120 || description.length > 1000) {
      setFeedback({
        kind: 'error',
        message: 'Choose an active location, enter a name of 1–120 characters, and keep the description to at most 1,000 characters.',
      })
      return
    }

    pending.current = true
    setCreating(true)
    setFeedback(null)
    let refreshAfterCreate = true

    try {
      const data = await apiRequest('/api/admin/resources', {
        method: 'POST',
        body: { location_id: selectedLocation.id, name, description },
      })

      if (
        !isResource(data.resource) ||
        data.resource.location_id !== selectedLocation.id ||
        data.resource.name !== name ||
        (data.resource.description ?? null) !== (description || null) ||
        data.resource.is_active !== true
      ) {
        const confirmationError = new Error(
          'The new resource could not be confirmed. Refresh the resource list before trying again.'
        )
        confirmationError.status = 502
        throw confirmationError
      }

      if (!mounted.current) return

      setFeedback({
        kind: 'success',
        message: `Resource "${data.resource.name}" created successfully (#${data.resource.id}).`,
      })
      setForm((previous) => ({ ...previous, name: '', description: '' }))

      if (typeof onCreated === 'function') {
        onCreated(data.resource)
      }
    } catch (requestError) {
      if (!mounted.current) return

      const uncertain =
        !Number.isInteger(requestError?.status) || requestError.status >= 500

      refreshAfterCreate = !uncertain
      setRequiresRefresh(uncertain)
      setFeedback({
        kind: 'error',
        message: requestError?.message || 'Unable to confirm the new resource.',
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
    <section aria-labelledby="resources-heading" className="admin-manager">
      <div className="admin-manager-toolbar">
        <div>
          <h2 id="resources-heading">Room directory</h2>
          <p>{loading ? 'Loading your rooms…' : result.error ? 'Refresh to load your rooms.' : result.resources.length + ' saved resource' + (result.resources.length === 1 ? '' : 's')}</p>
        </div>
        <div className="admin-toolbar-actions">
          <Button type="button" variant="outline" className="admin-btn admin-btn-outline"
            disabled={loading || creating} onClick={refreshResources}>
            <RefreshCw aria-hidden="true" />Refresh
          </Button>
          <Button type="button"
            className={'admin-btn ' + (createOpen ? 'admin-btn-outline' : 'admin-btn-primary')}
            variant={createOpen ? 'outline' : 'default'}
            disabled={creating || (!createOpen && formDisabled)}
            aria-expanded={createOpen} aria-controls="resource-create-panel"
            onClick={() => setCreateOpen((open) => !open)}>
            {createOpen ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
            {createOpen ? 'Close form' : 'New room'}
          </Button>
        </div>
      </div>

      {feedback && (
        <div role={feedback.kind === 'success' ? 'status' : 'alert'}
          className={'admin-notice ' + (feedback.kind === 'success' ? 'is-success' : 'is-error')}>
          {feedback.message}
        </div>
      )}
      {requiresRefresh && (
        <p role="status" className="admin-recovery-note">
          Click Refresh and check whether the room was saved before creating it
          again. A timeout does not prove the request failed.
        </p>
      )}
      {!loading && !result.error && activeLocations.length === 0 && (
        <p role="status" className="admin-notice is-info">
          Create an active location first. Choose Locations from the menu, add a building,
          then return here. Only active locations can receive new rooms here.
        </p>
      )}

      <div className={'admin-directory-layout' + (createOpen ? ' is-editing' : '')}>
        <div className="admin-directory-card">
          {loading ? (
            <div role="status" className="admin-loading">
              <LoaderCircle className="admin-spinner" aria-hidden="true" />Loading rooms and locations…
            </div>
          ) : result.error ? (
            <div role="alert" className="admin-table-message is-error">{result.error}</div>
          ) : result.resources.length === 0 ? (
            <div className="admin-empty">
              <span className="admin-empty-icon"><Building2 aria-hidden="true" /></span>
              <h3>No rooms or resources yet</h3>
              <p>Use New room to add a bookable space to a location.</p>
            </div>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-directory-table">
                <caption className="admin-sr-only">Saved rooms and resources</caption>
                <thead>
                  <tr><th scope="col">Room / resource</th><th scope="col">Location</th><th scope="col" className="admin-status-column">Status</th></tr>
                </thead>
                <tbody>
                  {result.resources.map((resource) => (
                    <tr key={resource.id}>
                      <td>
                        <div className="admin-record">
                          <span className="admin-record-icon"><Building2 aria-hidden="true" /></span>
                          <div>
                            <strong>{resource.name}</strong><small>Resource #{resource.id}</small>
                            {resource.description && <p className="admin-resource-description" title={resource.description}>{resource.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="admin-address">{resource.location?.name || 'Location #' + resource.location_id}</span>
                        {resource.location?.is_active === false && (
                          <small className="admin-parent-warning">This location is inactive. Its rooms are hidden from browsing.</small>
                        )}
                      </td>
                      <td>
                        <span className={'admin-status ' + (resource.is_active ? 'is-active' : 'is-inactive')}>
                          {resource.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside id="resource-create-panel" className="admin-create-panel" hidden={!createOpen}
          aria-labelledby="resource-form-title">
          <div className="admin-editor-heading">
            <span className="admin-record-icon"><Building2 aria-hidden="true" /></span>
            <div><h3 id="resource-form-title">New room / resource</h3><p>Choose its location first.</p></div>
          </div>
          <form aria-label="Create resource" className="admin-create-form" onSubmit={handleSubmit}>
            <div className="admin-field">
              <Label htmlFor="resource-location">Location <span className="admin-required">*</span></Label>
              <select id="resource-location" name="location_id" className="admin-select"
                value={form.locationId}
                onChange={(event) => setForm((previous) => ({ ...previous, locationId: event.target.value }))}
                disabled={formDisabled} required>
                <option value="">Select a location</option>
                {activeLocations.map((location) => (
                  <option key={location.id} value={String(location.id)}>{location.name} (#{location.id})</option>
                ))}
              </select>
              <p>The building or site this room belongs to.</p>
            </div>
            <div className="admin-field">
              <Label htmlFor="resource-name">Room or resource name <span className="admin-required">*</span></Label>
              <Input id="resource-name" name="name" type="text" className="admin-input"
                placeholder="Study Room 1" maxLength={120} value={form.name}
                onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                disabled={formDisabled} required />
            </div>
            <div className="admin-field">
              <Label htmlFor="resource-description">Description <span className="admin-optional">Optional</span></Label>
              <textarea id="resource-description" name="description" rows={3} maxLength={1000}
                className="admin-textarea" placeholder="A quiet room for group study."
                value={form.description}
                onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                disabled={formDisabled} />
            </div>
            <div className="admin-form-actions">
              <Button type="button" variant="outline" className="admin-btn admin-btn-outline"
                disabled={creating} onClick={() => setCreateOpen(false)}>Close</Button>
              <Button type="submit" className="admin-btn admin-btn-primary"
                disabled={formDisabled || !selectedLocation || !form.name.trim()}>
                {creating ? <><LoaderCircle className="admin-spinner" aria-hidden="true" />Creating...</> : 'Create resource'}
              </Button>
            </div>
          </form>
        </aside>
      </div>

      {result.resources.length === 100 && !loading && (
        <p className="admin-limit-note">Showing the 100 most recently created resources.</p>
      )}
    </section>
  )
}

export default ResourcesManager
