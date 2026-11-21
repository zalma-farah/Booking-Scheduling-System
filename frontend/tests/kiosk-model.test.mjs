import test from 'node:test'
import assert from 'node:assert/strict'
import { KIOSK_STALE_MS, projectKioskSnapshot, readKioskSnapshot } from '../src/lib/kiosk-model.js'

function payload() {
  return { status: 'ok', timezone: 'America/Los_Angeles', state: 'in_use',
    checked_at: '2026-11-21T18:30:00Z', day_start: '2026-11-21T08:00:00Z', day_end: '2026-11-22T08:00:00Z',
    resource: { id: 7, name: 'Study room', location: { id: 1, name: 'Library' } },
    slots: [{ id: 1, start_time: '2026-11-21T18:00:00Z', end_time: '2026-11-21T19:00:00Z', is_booked: true },
      { id: 2, start_time: '2026-11-21T20:00:00Z', end_time: '2026-11-21T21:00:00Z', is_booked: true }] }
}
test('active reservation and next booking are projected', () => {
  const view = projectKioskSnapshot(readKioskSnapshot(payload(), '7'), 0)
  assert.equal(view.state, 'in_use')
  assert.equal(view.current.id, 1)
  assert.equal(view.next.id, 2)
})
test('cancellation immediately replaces booked snapshot with available snapshot', () => {
  const data = payload()
  data.slots[0].is_booked = false
  data.state = 'available'
  assert.equal(projectKioskSnapshot(readKioskSnapshot(data, '7'), 0).state, 'available')
})
test('empty schedule is valid, not an invalid/missing room', () => {
  const data = payload(); data.slots = []; data.state = 'available'
  assert.equal(projectKioskSnapshot(readKioskSnapshot(data, '7'), 0).slots.length, 0)
})
for (const age of [KIOSK_STALE_MS, KIOSK_STALE_MS + 1, -1, NaN]) {
  test('stale/invalid age cannot display green: ' + age, () => {
    assert.equal(projectKioskSnapshot(readKioskSnapshot(payload(), '7'), age).state, 'stale')
  })
}
test('midnight invalidates the prior day even before 30 seconds elapse', () => {
  const data = payload(); data.state = 'available'; data.slots = []; data.checked_at = '2026-11-22T07:59:59Z'
  assert.equal(projectKioskSnapshot(readKioskSnapshot(data, '7'), 1000).state, 'stale')
})
test('the exact end of a booking is not still booked', () => {
  const data = payload(); data.checked_at = '2026-11-21T18:59:59Z'
  assert.equal(projectKioskSnapshot(readKioskSnapshot(data, '7'), 1000).state, 'available')
})
test('unknown/loading snapshot never displays available', () => {
  assert.equal(projectKioskSnapshot(null, 0).state, 'stale')
})
for (const [name, change] of [
  ['wrong room', v => { v.resource.id = 8 }],
  ['invalid timezone', v => { v.timezone = 'UTC' }],
  ['missing schedule', v => { v.slots = null }],
  ['bad timestamp', v => { v.slots[0].start_time = 'bad' }],
  ['timezone missing', v => { v.slots[0].start_time = '2026-11-21T18:00:00' }],
  ['incorrect green state', v => { v.state = 'available' }],
  ['invalid boolean', v => { v.slots[0].is_booked = 'false' }],
  ['duplicate id', v => { v.slots[1].id = 1 }],
  ['overlap', v => { v.slots[1].start_time = '2026-11-21T18:45:00Z' }],
  ['oversized schedule', v => { v.slots = Array(501).fill(v.slots[0]) }],
  ['out of day slot', v => { v.slots[1].start_time = '2026-11-23T01:00:00Z'; v.slots[1].end_time = '2026-11-23T02:00:00Z' }],
]) {
  test('rejects ' + name, () => { const data = payload(); change(data); assert.throws(() => readKioskSnapshot(data, '7')) })
}
test('private extra fields are discarded', () => {
  const data = payload(); data.email = 'private'; data.slots[0].user_id = 'private'
  assert.equal(JSON.stringify(readKioskSnapshot(data, '7')).includes('private'), false)
})
