import { useRef, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function EditPanel({ title, record, detailField, detailLabel, endpoint, responseKey, onExit, onSave, onBusyChange, onReload }) {
  const [name, setName] = useState(record.name)
  const [detail, setDetail] = useState(record[detailField] || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [requiresRefresh, setRequiresRefresh] = useState(false)
  const pending = useRef(false)
  const maxDetail = detailField === 'address' ? 250 : 1000

  async function handleSave(event) {
    event.preventDefault()
    if (pending.current || requiresRefresh) return
    const newName = name.trim()
    const newDetail = detail.trim()
    if (!newName || newName.length > 120 || newDetail.length > maxDetail) {
      setError(`Use a name of 1-120 characters and ${detailLabel.toLowerCase()} of at most ${maxDetail} characters.`)
      return
    }
    const changes = {}
    if (newName !== record.name) changes.name = newName
    if (newDetail !== (record[detailField] || '')) changes[detailField] = newDetail
    if (!Object.keys(changes).length) { setError('No changes to save.'); return }
    pending.current = true
    setSaving(true)
    onBusyChange?.(true)
    setError('')
    try {
      const data = await apiRequest(`${endpoint}/${record.id}`, { method: 'PATCH', body: changes })
      const updated = data[responseKey]
      if (!updated || updated.id !== record.id || updated.name !== newName ||
          (updated[detailField] || '') !== newDetail || typeof updated.is_active !== 'boolean') {
        throw Object.assign(new Error('The update could not be confirmed. Refresh before retrying.'), { status: 502 })
      }
      onSave(updated)
    } catch (err) {
      setRequiresRefresh(!Number.isInteger(err.status) || err.status >= 500)
      setError(err.message || 'Unable to confirm the update.')
    } finally {
      pending.current = false
      setSaving(false)
      onBusyChange?.(false)
    }
  }

  return (
    <aside className="admin-create-panel" aria-label={title}>
      <h3>{title}</h3>
      <p>Editing {record.name}</p>
      <form className="admin-create-form" onSubmit={handleSave}>
        {error && <div role="alert" className="admin-notice is-error">{error}</div>}
        {requiresRefresh && <p role="status">The save may have succeeded. Refresh the list before another attempt.</p>}
        <div className="admin-field">
          <Label htmlFor={`edit-name-${responseKey}`}>Name *</Label>
          <Input id={`edit-name-${responseKey}`} className="admin-input" value={name} maxLength={120}
            disabled={saving || requiresRefresh} onChange={e => setName(e.target.value)} required />
        </div>
        <div className="admin-field">
          <Label htmlFor={`edit-detail-${responseKey}`}>{detailLabel} (optional)</Label>
          <textarea id={`edit-detail-${responseKey}`} className="admin-textarea" rows={3} value={detail}
            maxLength={maxDetail} disabled={saving || requiresRefresh} onChange={e => setDetail(e.target.value)} />
        </div>
        <div className="admin-form-actions">
          <Button type="button" variant="outline" onClick={onExit} disabled={saving}>Cancel</Button>
          {requiresRefresh ? <Button type="button" onClick={onReload}>Refresh list</Button> :
            <Button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</Button>}
        </div>
      </form>
    </aside>
  )
}
export default EditPanel
