import QRCode from 'qrcode'

// Never redirect to arbitrary URLs supplied in ?next= or router state.
export function safeBookingReturn(value) {
  if (typeof value !== 'string' || !/^\/resources\/[1-9]\d*\/slots$/.test(value)) return null
  const id = value.split('/')[2]
  return Number.isSafeInteger(Number(id)) ? value : null
}

export function bookingDestination(resourceId) {
  return safeBookingReturn(`/resources/${resourceId}/slots`)
}

export function buildBookingLink(resourceId, configuredBase, currentOrigin) {
  const path = bookingDestination(resourceId)
  if (!path) return { url: null, message: 'Invalid room ID.' }
  try {
    const base = new URL(configuredBase || currentOrigin)
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password ||
        base.pathname !== '/' || base.search || base.hash) throw new Error('Invalid base')
    const host = base.hostname.toLowerCase()
    if (host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' ||
        host === '0.0.0.0' || /^127\./.test(host)) {
      return { url: null, message: 'Phone booking needs a network-accessible website address. localhost only works on this computer.' }
    }
    const url = new URL(path, base.origin).href
    if (url.length > 1024) throw new Error('Address too long')
    return { url, message: '' }
  } catch {
    return { url: null, message: 'Set VITE_PUBLIC_BOOKING_URL to the website origin, for example https://booking.example.edu (no path or credentials).' }
  }
}

// Render geometry, not HTML from a remote QR service. Include a four-module quiet zone.
export function bookingQr(value) {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' })
  const path = []
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (modules.data[y * modules.size + x]) path.push(`M${x + 4} ${y + 4}h1v1h-1z`)
    }
  }
  return { size: modules.size + 8, path: path.join('') }
}
