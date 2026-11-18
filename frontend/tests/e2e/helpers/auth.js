
import { expect } from '@playwright/test'

export async function login(page) {
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD

    if (!email || !password) {
        throw new Error(
            'Set E2E_EMAIL and E2E_PASSWORD in frontend/.env.e2e'
        )
    }

    await page.goto('/login')

    await page.getByRole('textbox', {
        name: 'Email address',
    }).fill(email)

    await page.getByRole('textbox', {
        name: 'Password',
    }).fill(password)

    await page.getByRole('button', {
        name: 'Sign in',
    }).click()

    await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/)
}
