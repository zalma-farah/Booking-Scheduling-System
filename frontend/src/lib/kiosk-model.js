export const KIOSK_REFRESH_MS = 10000
export const KIOSK_STALE_MS = 30000
export const KIOSK_TIMEZONE = 'America/Los_Angeles'

function instant(value) {
  if (typeof value !== 'string' || !/[T].*(Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error('Invalid room status timestamp.')
  const result = Date.parse(value)
  if (!Number.isFinite(result)) throw new Error('Invalid room status timestamp.')
  return result
}

export function readKioskSnapshot(data, resourceId) {
  if (!data || data.status !== 'ok' || data.timezone !== KIOSK_TIMEZONE ||
      !['in_use', 'available'].includes(data.state) ||
      !Number.isSafeInteger(data.resource?.id) || data.resource.id < 1 || data.resource.id !== Number(resourceId) ||
      typeof data.resource.name !== 'string' || !data.resource.name.trim() ||
      !Number.isSafeInteger(data.resource.location?.id) || data.resource.location.id < 1 ||
      typeof data.resource.location.name !== 'string' || !data.resource.location.name.trim()) {
    throw new Error('The server returned an invalid room status.')
  }
  const checkedAt = instant(data.checked_at)
  const dayStart = instant(data.day_start)
  const dayEnd = instant(data.day_end)
  if (checkedAt < dayStart || checkedAt >= dayEnd || dayEnd - dayStart < 23 * 3600000 ||
      dayEnd - dayStart > 25 * 3600000 || !Array.isArray(data.slots) || data.slots.length > 500) {
    throw new Error('The server returned an invalid room schedule.')
  }
  const ids = new Set()
  const slots = data.slots.map(slot => {
    if (!slot || !Number.isSafeInteger(slot.id) || slot.id < 1 || ids.has(slot.id) || typeof slot.is_booked !== 'boolean') {
      throw new Error('The server returned an invalid room schedule.')
    }
    const start = instant(slot.start_time)
    const end = instant(slot.end_time)
    if (start >= end || start >= dayEnd || end <= dayStart) throw new Error('The server returned an invalid room schedule.')
    ids.add(slot.id)
    return { id: slot.id, start, end, is_booked: slot.is_booked }
  }).sort((a, b) => a.start - b.start || a.id - b.id)
  if (slots.some((slot, index) => index && slot.start < slots[index - 1].end)) throw new Error('The server returned overlapping time slots.')
  const current = slots.find(slot => slot.is_booked && slot.start <= checkedAt && checkedAt < slot.end)
  if ((data.state === 'in_use') !== Boolean(current)) throw new Error('The room status could not be confirmed.')
  return { resource: { id: data.resource.id, name: data.resource.name,
    location: { id: data.resource.location.id, name: data.resource.location.name } },
  checkedAt, dayStart, dayEnd, slots }
}

export function projectKioskSnapshot(snapshot, elapsedMs) {
  if (!snapshot || !Number.isFinite(elapsedMs) || elapsedMs < 0 ||
      elapsedMs >= KIOSK_STALE_MS || snapshot.checkedAt + elapsedMs >= snapshot.dayEnd) {
    return { state: 'stale', current: null, next: null, slots: [] }
  }
  const now = snapshot.checkedAt + elapsedMs
  const current = snapshot.slots.find(slot => slot.is_booked && slot.start <= now && now < slot.end) || null
  const next = snapshot.slots.find(slot => slot.is_booked && slot.start > now) || null
  return { state: current ? 'in_use' : 'available', current, next, now,
    slots: snapshot.slots.map(slot => ({ ...slot, is_now: slot.start <= now && now < slot.end })) }
}
