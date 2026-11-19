
import { test, expect } from '@playwright/test'
import { login } from './helpers/auth.js'

test.beforeEach(async ({ page }) => {
    await login(page)
})

test('dashboard works on mobile', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile test only')

    await page.goto('/dashboard')

    await expect(
        page.getByRole('link', { name: /Browse resources/i })
    ).toBeVisible()

    const dimensions = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
    }))

    expect(dimensions.documentWidth).toBeLessThanOrEqual(
        dimensions.viewportWidth + 1
    )
})

test('resources page fits a mobile screen', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile test only')

    await page.goto('/resources')

    await expect(
        page.getByRole('heading', { name: 'Browse resources' })
    ).toBeVisible()

    const dimensions = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
    }))

    expect(dimensions.documentWidth).toBeLessThanOrEqual(
        dimensions.viewportWidth + 1
    )
})
