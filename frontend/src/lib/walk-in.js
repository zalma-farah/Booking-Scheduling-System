export function confirmationId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const h = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function timestamp(value) {
  if (typeof value !== 'string' || !/T.*(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error('Invalid reservation time.')
  }
  return Date.parse(value)
}

export function readWalkInQuote(value, resourceId) {
  if (!value || value.status !== 'ok' || value.resource_id !== Number(resourceId) || value.max_minutes !== 120) {
    throw new Error('Walk-in availability could not be verified.')
  }
  const checked = timestamp(value.checked_at)
  const until = value.available_until === null ? null : timestamp(value.available_until)
  if (until !== null && (until < checked + 5 * 60000 || until > checked + 120 * 60000)) {
    throw new Error('Walk-in availability could not be verified.')
  }
  return { checked, until }
}

export function durationOptions(quote, age) {
  if (!quote || quote.until === null || !Number.isFinite(age) || age < 0 || age >= 30000 || quote.until < quote.checked + age + 5 * 60000) return []
  const choices = [30, 60].filter(n => quote.checked + n * 60000 < quote.until)
    .map(n => ({ key: String(n), end: new Date(quote.checked + n * 60000).toISOString(), label: `${n} minutes` }))
  choices.push({ key: 'until', end: new Date(quote.until).toISOString(), label: 'Until available period ends' })
  return choices
}

export function readWalkInReceipt(data, body, resourceId) {
  const value = data?.reservation
  if (data?.status !== 'ok' || value?.resource_id !== Number(resourceId) || value.request_id !== body.request_id ||
      !['active', 'cancelled'].includes(value.status)) throw new Error('Reservation confirmation could not be verified.')
  const start = timestamp(value.start_time), end = timestamp(value.end_time)
  if (end !== timestamp(body.end_time) || end <= start || end > start + 120 * 60000) {
    throw new Error('Reservation confirmation could not be verified.')
  }
  return { start, end, status: value.status }
}

export function readPending(value) {
  if (!value) return null
  const data = JSON.parse(value)
  if (!data || Object.keys(data).sort().join(',') !== 'end_time,request_id' ||
      typeof data.request_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(data.request_id)) {
    throw new Error('Invalid pending confirmation.')
  }
  timestamp(data.end_time)
  return data
}
