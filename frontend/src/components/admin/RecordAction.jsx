import { useRef, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'

export default function RecordAction({ endpoint, label, description, responseKey, recordId, expected, disabled, onChanged, onBusyChange }) {
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const pending = useRef(false)
  async function confirm() {
    if (pending.current || disabled || uncertain) return
    pending.current = true
    setSaving(true)
    onBusyChange?.(true)
    setError('')
    try {
      const opts = responseKey === 'slot' ? { method: 'PATCH', body: { is_active: expected } } : { method: 'POST' }
      const data = await apiRequest(endpoint, opts)
      const record = data[responseKey]
      if (!record || record.id !== recordId ||
          (responseKey === 'booking' ? record.status !== 'cancelled' : record.is_active !== expected)) {
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
  return <div>
    {!confirming ? <Button type="button" variant="outline" disabled={disabled || uncertain} onClick={() => setConfirming(true)}>{label}</Button> :
      <div className="admin-notice is-info">
        <p>{description}</p>
        <div className="admin-form-actions">
          <Button type="button" disabled={saving || disabled || uncertain} onClick={confirm}>{saving ? 'Saving...' : `Confirm ${label.toLowerCase()}`}</Button>
          <Button type="button" variant="outline" disabled={saving} onClick={() => setConfirming(false)}>Keep unchanged</Button>
        </div>
      </div>}
    {error && <p role="alert">{error}{uncertain && ' Use Refresh before another attempt.'}</p>}
  </div>
}
