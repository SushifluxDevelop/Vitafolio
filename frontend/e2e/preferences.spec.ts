import { expect, test } from '@playwright/test'
import { apiCall, createUser, MEMBER_PASSWORD, newBrowserContext, openAs, removeUsers, signedInContext, signIn } from './support'

// Language (de/en) and theme (system/light/dark) against the real server: applied at once, kept after a reload, and saved to
// the account, so another browser that signs in gets them too. A made-up account, so the owner's settings stay untouched.
test.describe.configure({ mode: 'serial' })

const NAME = 'e2e-prefs'

test.beforeEach(async ({ page }) => {
  await removeUsers(page, NAME)
  await createUser(page, NAME, { displayName: 'Paula Präferenz' })
})
test.afterEach(async ({ page }) => {
  await removeUsers(page, NAME)
})

test('theme: light, dark and system apply at once and survive a reload and a sign-in in another browser', async ({ browser }) => {
  const { context, page } = await signedInContext(browser, NAME)
  try {
    await openAs(page, 'Paula Präferenz', '/settings?tab=appearance')
    const html = page.locator('html')
    for (const [label, theme] of [
      ['Hell', 'light'],
      ['Dunkel', 'dark'],
    ] as const) {
      await page.getByRole('radio', { name: label, exact: true }).first().click()
      await expect(html).toHaveAttribute('data-theme', theme)
      await page.reload()
      await expect(html).toHaveAttribute('data-theme', theme)
      await expect(page.getByRole('radio', { name: label, exact: true }).first()).toHaveAttribute('aria-checked', 'true')
    }

    // "Dark" is on the account now: another browser (whose system says light) shows it after signing in.
    await page.getByRole('radio', { name: 'Dunkel', exact: true }).first().click()
    await expect.poll(async () => (await apiCall<{ user: { theme: string } }>(context, 'GET', '/api/auth/me')).body.user.theme).toBe('dark')
    const other = await newBrowserContext(browser)
    const otherPage = await other.newPage()
    await otherPage.emulateMedia({ colorScheme: 'light' })
    await signIn(otherPage, MEMBER_PASSWORD, NAME)
    await expect(otherPage.getByTestId('current-user')).toContainText('Paula Präferenz')
    await expect(otherPage.locator('html')).toHaveAttribute('data-theme', 'dark')
    await other.close()

    // "System" follows the system's setting, live.
    await page.getByRole('radio', { name: 'System', exact: true }).first().click()
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(html).toHaveAttribute('data-theme', 'light')
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await expect(page.getByRole('radio', { name: 'System', exact: true }).first()).toHaveAttribute('aria-checked', 'true')
    await expect(html).toHaveAttribute('data-theme', 'dark')
  } finally {
    await context.close()
  }
})

test('language: English and German switch at once, survive a reload and follow the account to another browser', async ({ browser }) => {
  const { context, page } = await signedInContext(browser, NAME)
  try {
    await openAs(page, 'Paula Präferenz', '/settings?tab=appearance')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(page.getByRole('heading', { name: 'Einstellungen', level: 1 })).toBeVisible()

    await page.getByRole('radio', { name: 'English' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true')

    // Saved to the account: a browser that is German by itself shows English after signing in.
    await expect.poll(async () => (await apiCall<{ user: { language: string } }>(context, 'GET', '/api/auth/me')).body.user.language).toBe('en')
    const other = await newBrowserContext(browser)
    const otherPage = await other.newPage()
    await signIn(otherPage, MEMBER_PASSWORD, NAME)
    await expect(otherPage.getByRole('link', { name: 'Overview' })).toBeVisible()
    await expect(otherPage.locator('html')).toHaveAttribute('lang', 'en')
    await other.close()

    // And back to German.
    await page.getByRole('radio', { name: 'Deutsch' }).click()
    await expect(page.getByRole('heading', { name: 'Einstellungen', level: 1 })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Einstellungen', level: 1 })).toBeVisible()
    await expect.poll(async () => (await apiCall<{ user: { language: string } }>(context, 'GET', '/api/auth/me')).body.user.language).toBe('de')
  } finally {
    await context.close()
  }
})
