import { useId, useRef, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'

export default function RecordAction({ endpoint, label, description, responseKey, recordId, expected, disabled, onChanged, onBusyChange, deleting = false, recordType }) {
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const pending = useRef(false)
  const [confirmation, setConfirmation] = useState('')
  const inputId = useId()
  async function confirm() {
    if (pending.current || disabled || uncertain || (deleting && confirmation !== 'DELETE')) return
    pending.current = true
    setSaving(true)
    onBusyChange?.(true)
    setError('')
    try {
      const opts = deleting ? { method: 'DELETE', body: { confirmation: 'DELETE' } }
        : responseKey === 'slot' ? { method: 'PATCH', body: { is_active: expected } } : { method: 'POST' }
      const data = await apiRequest(endpoint, opts)
      const record = deleting ? data.deleted : data[responseKey]
      if (!record || record.id !== recordId || (deleting
          ? record.deleted !== true || record.type !== recordType
          : responseKey === 'booking' ? record.status !== 'cancelled' : record.is_active !== expected)) {
        throw Object.assign(new Error('The change could not be confirmed. Refresh before retrying.'), { status: 502 })
      }
      setConfirming(false)
      onChanged?.()
    } catch (err) {
      setUncertain(!Number.isInteger(err.status) || err.status >= 500)
      setError(err.message || 'Unable to confirm the change.')
    } finally {
      pending.current = false
      setSaving(false)
      onBusyChange?.(false)
    }
  }
  return <div className="admin-record-action">
    {!confirming ? <Button type="button" className={'admin-btn admin-btn-outline' + (deleting ? ' admin-btn-danger' : '')} variant="outline" disabled={disabled || uncertain} onClick={() => { setConfirmation(''); setConfirming(true) }}>{label}</Button> :
      <div className={'admin-notice admin-action-confirm ' + (deleting ? 'is-error' : 'is-info')}>
        <p>{description}</p>
        {deleting && <div className="admin-delete-field"><label htmlFor={inputId}>Type DELETE to permanently remove this record.</label>
          <input id={inputId} className="admin-input" value={confirmation} autoComplete="off" spellCheck={false} disabled={saving || uncertain} onChange={event => setConfirmation(event.target.value)} /></div>}
        <div className="admin-form-actions">
          <Button type="button" className={'admin-btn ' + (deleting ? 'admin-btn-danger' : 'admin-btn-primary')} variant={deleting ? 'outline' : 'default'} disabled={saving || disabled || uncertain || (deleting && confirmation !== 'DELETE')} onClick={confirm}>{saving ? 'Saving...' : `Confirm ${label.toLowerCase()}`}</Button>
          <Button type="button" className="admin-btn admin-btn-outline" variant="outline" disabled={saving} onClick={() => setConfirming(false)}>Keep unchanged</Button>
        </div>
      </div>}
    {error && <p role="alert" className="admin-action-error">{error}{uncertain && ' Use Refresh before another attempt.'}</p>}
  </div>
}
