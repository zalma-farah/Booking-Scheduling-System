
import { test, expect } from '@playwright/test'
import { login } from './helpers/auth.js'

test.beforeEach(async ({ page }) => {
    await login(page)
})

test('resources page loads', async ({ page }) => {
    await page.goto('/resources')

    await expect(
        page.getByRole('heading', { name: 'Browse resources' })
    ).toBeVisible()
})

test('empty resource list displays a message', async ({ page }) => {
    await page.route('**/api/resources', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                status: 'ok',
                resources: [],
            }),
        })
    })

    await page.goto('/resources')

    await expect(
        page.getByText('No active resources are available yet.')
    ).toBeVisible()
})

test('API failure displays an error', async ({ page }) => {
    await page.route('**/api/resources', async (route) => {
        await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({
                status: 'error',
                message: 'Service temporarily unavailable.',
            }),
        })
    })

    await page.goto('/resources')

    await expect(
        page.getByRole('alert')
    ).toBeVisible()
})

test('network failure does not crash the page', async ({ page }) => {
    await page.route('**/api/resources', async (route) => {
        await route.abort('failed')
    })

    await page.goto('/resources')

    await expect(page.getByRole('alert')).toBeVisible()

    await expect(
        page.getByRole('heading', { name: 'Browse resources' })
    ).toBeVisible()
})

test('resource card opens its time slots', async ({ page }) => {
    await page.route('**/api/resources', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                status: 'ok',
                resources: [
                    {
                        id: 5,
                        name: 'Study Room',
                        description: 'Quiet study area',
                        location: {
                            id: 2,
                            name: 'Library',
                            address: 'Campus',
                        },
                    },
                ],
            }),
        })
    })

    await page.route('**/api/resources/5/slots', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                status: 'ok',
                slots: [],
            }),
        })
    })

    await page.goto('/resources')

    await expect(
        page.getByRole('heading', { name: 'Study Room' })
    ).toBeVisible()

    await page.getByRole('link', {
        name: 'View time slots',
    }).click()

    await expect(page).toHaveURL(/\/resources\/5\/slots/)

    await expect(
        page.getByRole('heading', { name: 'Time slots' })
    ).toBeVisible()
})
