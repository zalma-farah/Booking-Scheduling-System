
import { test, expect } from '@playwright/test'
import { login } from './helpers/auth.js'

test.beforeEach(async ({ page }) => {
    await login(page)
})

test('empty bookings display a helpful message', async ({ page }) => {
    await page.route('**/api/bookings', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                status: 'ok',
                bookings: [],
            }),
        })
    })

    await page.goto('/bookings')

    await expect(
        page.getByText(/You have no bookings yet/)
    ).toBeVisible()
})

test('double-clicking does not create duplicate bookings', async ({ page }) => {
    const slot = {
        id: 25,
        is_available: true,
        start_time: '2026-12-10T18:00:00Z',
        end_time: '2026-12-10T19:00:00Z',
    }

    let bookingRequests = 0

    await page.route('**/api/resources/5/slots', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                status: 'ok',
                slots: [slot],
            }),
        })
    })

    await page.route('**/api/bookings', async (route) => {
        if (route.request().method() !== 'POST') {
            return route.continue()
        }

        bookingRequests += 1

        // Keep the request pending briefly so a second click
        // would expose a duplicate-submission bug.
        await new Promise((resolve) => setTimeout(resolve, 500))

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                status: 'ok',
                booking: {
                    id: 101,
                    time_slot_id: 25,
                    status: 'active',
                },
            }),
        })
    })

    await page.goto('/resources/5/slots')

    const bookButton = page.getByRole('button', {
        name: 'Book this slot',
    })

    await expect(bookButton).toBeVisible()

    await bookButton.dblclick({ delay: 20 })

    await expect(
        page.getByText('Booking #101 created successfully.')
    ).toBeVisible()

    expect(bookingRequests).toBe(1)
})
