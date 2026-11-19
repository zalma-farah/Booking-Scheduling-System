
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { login } from './helpers/auth.js'

test('login page has no detectable accessibility violations', async ({ page }) => {
    await page.goto('/login')

    await expect(
        page.getByRole('heading', { name: 'Sign in' })
    ).toBeVisible()

    const results = await new AxeBuilder({ page }).analyze()

    expect(results.violations).toEqual([])
})

test('resources page has no detectable accessibility violations', async ({ page }) => {
    await login(page)

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

    const results = await new AxeBuilder({ page }).analyze()

    expect(results.violations).toEqual([])
})
