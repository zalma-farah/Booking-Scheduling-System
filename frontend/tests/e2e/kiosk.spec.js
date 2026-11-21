import { test, expect } from '@playwright/test'
import { login } from './helpers/auth.js'

function status(booked = true) {
  return { status: 'ok', timezone: 'America/Los_Angeles', state: booked ? 'in_use' : 'available',
    checked_at: '2026-11-21T18:30:00Z', day_start: '2026-11-21T08:00:00Z', day_end: '2026-11-22T08:00:00Z',
    resource: { id: 7, name: 'Kiosk test room', location: { id: 1, name: 'Test library' } },
    slots: [{ id: 1, start_time: '2026-11-21T18:00:00Z', end_time: '2026-11-21T19:00:00Z', is_booked: booked }] }
}

test('kiosk route requires sign-in', async ({ page }) => {
  await page.goto('/resources/7/kiosk')
  await expect(page).toHaveURL(/\/login/)
})

test('booking cancellation updates the display without revealing identity', async ({ page }) => {
  await login(page)
  let booked = true
  await page.route('**/api/resources/7/status', route => route.fulfill({ json: status(booked) }))
  await page.goto('/resources/7/kiosk')
  await expect(page.getByRole('heading', { name: 'BOOKED NOW', exact: true })).toBeVisible()
  booked = false
  await page.getByRole('button', { name: 'Refresh room status' }).click()
  await expect(page.getByRole('heading', { name: 'AVAILABLE', exact: true })).toBeVisible()
  await expect(page.getByText('Booking schedule only.', { exact: false })).toBeVisible()
  await page.getByRole('link', { name: 'Exit kiosk' }).click()
  await expect(page).toHaveURL(/\/resources$/)
})

test('archived or missing room is not displayed as available', async ({ page }) => {
  await login(page)
  await page.route('**/api/resources/7/status', route => route.fulfill({ status: 404, json: { status: 'error', message: 'Room unavailable or not found.' } }))
  await page.goto('/resources/7/kiosk')
  await expect(page.getByRole('heading', { name: 'ROOM UNAVAILABLE', exact: true })).toBeVisible()
  await expect(page.locator('main')).not.toHaveClass(/is-available/)
})

test('lost connection clears availability and reconnecting refreshes it', async ({ page, context }) => {
  await login(page)
  await page.route('**/api/resources/7/status', route => route.fulfill({ json: status(false) }))
  await page.goto('/resources/7/kiosk')
  await expect(page.getByRole('heading', { name: 'AVAILABLE', exact: true })).toBeVisible()
  await context.setOffline(true)
  await expect(page.getByRole('heading', { name: 'STATUS UNAVAILABLE', exact: true })).toBeVisible()
  await expect(page.locator('main')).not.toHaveClass(/is-available/)
  await context.setOffline(false)
  await expect(page.getByRole('heading', { name: 'AVAILABLE', exact: true })).toBeVisible()
})

test('kiosk fits the configured desktop or mobile viewport', async ({ page }) => {
  await login(page)
  await page.route('**/api/resources/7/status', route => route.fulfill({ json: status(false) }))
  await page.goto('/resources/7/kiosk')
  await expect(page.getByRole('heading', { name: 'AVAILABLE', exact: true })).toBeVisible()
  const dimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }))
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1)
})
