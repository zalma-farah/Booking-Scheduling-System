import { test, expect } from '@playwright/test'
import { login } from './helpers/auth.js'

test('booking, cancellation history and rebooking remain consistent in the UI', async ({ page }) => {
  await login(page)
  const slot = { id: 25, is_available: true, start_time: '2026-12-10T18:00:00Z', end_time: '2026-12-10T19:00:00Z' }
  const resource = { id: 5, name: 'Workflow test room', location: { name: 'Test location' } }
  const bookings = []
  let nextId = 201
  await page.route('**/api/resources/5/slots', route => route.fulfill({ json: { status: 'ok', slots: [{ ...slot, is_available: !bookings.some(b => b.status === 'active') }] } }))
  await page.route('**/api/bookings', async route => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ time_slot_id: 25 })
      const booking = { id: nextId++, time_slot_id: 25, status: 'active', slot: { ...slot, resource } }
      bookings.unshift(booking)
      return route.fulfill({ status: 201, json: { status: 'ok', booking } })
    }
    return route.fulfill({ json: { status: 'ok', bookings } })
  })
  await page.route('**/api/bookings/201/cancel', route => {
    bookings.find(b => b.id === 201).status = 'cancelled'
    return route.fulfill({ json: { status: 'ok', booking: { id: 201, status: 'cancelled' } } })
  })
  await page.goto('/resources/5/slots')
  await page.getByRole('button', { name: 'Book this slot' }).click()
  await expect(page.getByText('Booking #201 created successfully.')).toBeVisible()
  await page.goto('/bookings')
  const first = page.getByRole('article').filter({ hasText: 'Booking #201' })
  await expect(first.getByRole('heading', { name: 'Workflow test room' })).toBeVisible()
  await first.getByRole('button', { name: 'Cancel booking', exact: true }).click()
  await first.getByRole('button', { name: 'Confirm cancellation' }).click()
  await expect(first.getByText('Cancelled', { exact: true })).toBeVisible()
  await page.goto('/resources/5/slots')
  await page.getByRole('button', { name: 'Book this slot' }).click()
  await expect(page.getByText('Booking #202 created successfully.')).toBeVisible()
  await page.goto('/bookings')
  await expect(page.getByRole('article')).toHaveCount(2)
  expect(bookings.filter(b => b.status === 'active')).toHaveLength(1)
})
