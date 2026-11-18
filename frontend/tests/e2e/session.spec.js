
import { test, expect } from '@playwright/test'
import { login } from './helpers/auth.js'

test('protected resources require login', async ({ page }) => {
    await page.goto('/resources')

    await expect(
        page.getByRole('heading', { name: 'Sign in' })
    ).toBeVisible()

    await expect(page).toHaveURL(/\/login/)
})

test('protected bookings require login', async ({ page }) => {
    await page.goto('/bookings')

    await expect(
        page.getByRole('heading', { name: 'Sign in' })
    ).toBeVisible()
})

test('user can sign out', async ({ page }) => {
    await login(page)

    await page.getByRole('button', {
        name: 'Sign out',
    }).click()

    await expect(
        page.getByRole('heading', { name: 'Sign in' })
    ).toBeVisible()

    await page.goto('/bookings')

    await expect(page).toHaveURL(/\/login/)
})
