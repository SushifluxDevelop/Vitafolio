import { expect, test } from '@playwright/test'
import { field, openApp, OWNER, signIn, signInComplete, SIGNED_OUT, signOut } from './support'

test.describe('signing in and out (own browser, the saved session stays untouched)', () => {
  test.use({ storageState: SIGNED_OUT })

  test('sign in, see the version, sign out, and the app is closed again', async ({ page }) => {
    await signInComplete(page)
    // The running version is shown in the readable form, e.g. "v2026.11.12 (13.557-dev)".
    await expect(page.getByTestId('version').first()).toHaveText(/^v\d+\.\d+\.\d+/)
    await signOut(page)
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('a wrong password is answered specifically, in a copyable notice, and keeps the form', async ({ page }) => {
    await signIn(page, 'definitely not the password')
    const notice = page.getByTestId('error-notice')
    await expect(notice).toContainText('Benutzername oder Passwort ist falsch')
    await expect(notice.getByTestId('copy-button')).toBeVisible()
    await expect(field(page, 'username')).toHaveValue(OWNER.username)
  })

  test('somebody who is not signed in is sent to the sign-in and back afterwards', async ({ page }) => {
    await page.goto('/settings?tab=appearance')
    await expect(page).toHaveURL(/\/login$/)
    await field(page, 'username').fill(OWNER.username)
    await field(page, 'password').fill(OWNER.password)
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/\/settings\?tab=appearance$/)
  })
})

test('the status screens exist: an unknown address is a 404, /error/503 shows the unavailable screen', async ({ page }) => {
  await page.goto('/this/does/not/exist')
  await expect(page.getByTestId('error-screen-404')).toBeVisible()
  await page.goto('/error/503')
  await expect(page.getByTestId('error-screen-503')).toBeVisible()
})

test('the theme switch applies at once and survives a reload', async ({ page }) => {
  await openApp(page)
  await page.getByRole('radio', { name: 'Dunkel' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('radio', { name: 'System' }).click()
})
