import test from 'node:test'
import assert from 'node:assert/strict'
import QRCode from 'qrcode'
import { safeBookingReturn, bookingDestination, buildBookingLink, bookingQr } from '../src/lib/booking-link.js'

test('room-specific return is preserved', () => {
  assert.equal(safeBookingReturn('/resources/7/slots'), '/resources/7/slots')
  assert.equal(bookingDestination(7), '/resources/7/slots')
})
for (const value of [null, {}, 'https://evil.test', '//evil.test', '/\\evil.test',
  '/resources/7/slots?next=https://evil.test', '/resources/7/slots#secret',
  '/resources/0/slots', '/resources/9007199254740992/slots', '/resources/%37/slots',
  '/resources/7/slots/../admin', '/admin']) {
  test('reject unsafe return '+JSON.stringify(value), () => assert.equal(safeBookingReturn(value), null))
}
test('network origin QR contains only room URL, not tokens or login state', () => {
  assert.equal(buildBookingLink('7', '', 'http://192.168.1.5:5173').url, 'http://192.168.1.5:5173/resources/7/slots')
  assert.equal(buildBookingLink('7', 'https://booking.example.edu', 'http://localhost:5173').url,
    'https://booking.example.edu/resources/7/slots')
})
for (const base of ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173',
  'javascript:alert(1)', 'https://user:password@example.edu', 'https://example.edu/path',
  'https://example.edu?token=secret', 'not a url']) {
  test('do not publish unusable/unsafe phone QR '+base, () => assert.equal(buildBookingLink(7, base, '').url, null))
}
test('invalid IDs do not produce booking URLs', () => {
  assert.equal(buildBookingLink('bad', '', 'https://example.edu').url, null)
})
test('QR geometry exactly matches encoder modules and quiet zone', () => {
  const url = 'https://booking.example.edu/resources/7/slots'
  const qr = bookingQr(url)
  const { modules } = QRCode.create(url, { errorCorrectionLevel: 'M' })
  const points = [...qr.path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map(m => `${m[1]},${m[2]}`)
  const expected = []
  for (let y=0; y<modules.size; y++) for (let x=0; x<modules.size; x++) {
    if (modules.data[y*modules.size+x]) expected.push(`${x+4},${y+4}`)
  }
  assert.equal(qr.size, modules.size+8)
  assert.deepEqual(points, expected)
})
