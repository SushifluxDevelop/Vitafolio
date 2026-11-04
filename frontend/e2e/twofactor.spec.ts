import { expect, test } from '@playwright/test'
import { field, OWNER, signIn, signInComplete, SIGNED_OUT, signOut, totp } from './support'

// Its own browser: it signs out, which ends only its own session and leaves the saved one alone.
test.use({ storageState: SIGNED_OUT })

// The whole two-factor flow on the real server: set up in the settings, sign in with the code, turn it off again. The
// account is left exactly as it was found.
test('two-factor: set up with QR code and recovery codes, sign in with the code, turn off', async ({ page }) => {
  await signInComplete(page)
  await page.goto('/settings?tab=security')

  await page.getByTestId('totp-start').click()
  const secret = (await page.getByTestId('totp-secret').innerText()).trim()
  expect(secret.length).toBeGreaterThanOrEqual(16)
  await expect(page.getByRole('img', { name: /QR/ })).toBeVisible()

  // Enabling asks for the current password as well (the server checks it).
  // The page has a second "current password" field (password change) - use the one in the 2FA form.
  const totpForm = page.locator('form', { has: page.locator('input[name="code"]') })
  await totpForm.locator('input[name="currentPassword"]').fill(OWNER.password)

  // A half code is not sent; a wrong full code is answered at the field.
  await field(page, 'code').pressSequentially('123')
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0)
  await field(page, 'code').fill('000000')
  await page.getByRole('button', { name: 'Aktivieren' }).click()
  await expect(page.getByText('Der Code ist falsch').first()).toBeVisible()

  await field(page, 'code').fill(totp(secret))
  await page.getByRole('button', { name: 'Aktivieren' }).click()
  const codes = page.getByTestId('recovery-codes')
  await expect(codes).toBeVisible()
  await expect(codes.locator('li')).toHaveCount(10)
  const recoveryCode = (await codes.locator('li').first().innerText()).trim()
  await page.getByTestId('totp-done').click()
  await expect(page.getByTestId('disable-2fa-form')).toBeVisible()

  // Sign in again: the password alone is not enough any more.
  await signOut(page)
  await signIn(page)
  await expect(field(page, 'code')).toBeVisible()
  await field(page, 'code').fill('999999')
  await page.locator('button[type="submit"]').click()
  await expect(page.getByTestId('error-notice')).toBeVisible()
  // The same time step cannot be used twice, so the next one is taken (the server allows one step of drift).
  await field(page, 'code').fill(totp(secret, 1))
  await page.locator('button[type="submit"]').click()
  await expect(page.getByTestId('current-user')).toContainText(OWNER.displayName)

  // Turn it off again.
  await page.goto('/settings?tab=security')
  const form = page.getByTestId('disable-2fa-form')
  await form.locator('input[name="password"]').fill(OWNER.password)
  // A used time step cannot be used again and only the current window is valid: a recovery code (single use) does the job.
  await form.locator('input[name="code"]').fill(recoveryCode)
  await page.getByTestId('disable-2fa').click()
  await expect(page.getByTestId('totp-start')).toBeVisible()
})
