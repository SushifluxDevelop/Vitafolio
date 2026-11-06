import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { expectNothingMoves, field, OWNER, settledLayout } from './support'

// Runs first (project "setup") on a fresh instance: creates the first account, which becomes the administrator.
test.use({ viewport: { width: 1024, height: 768 } })

/** The one-time setup code from the server's log; the e2e runner hands it over in CV_SETUP_TOKEN. */
const SETUP_TOKEN = process.env.CV_SETUP_TOKEN

/** True when the server asks for the setup code (then the field is on the page). */
async function asksForSetupToken(page: Page): Promise<boolean> {
  const bootstrap = await (await page.request.get('/api/bootstrap')).json()
  return bootstrap.setupTokenRequired === true
}

// German is longer than English: the setup (with the setup-code field) is measured in both, at the narrowest supported width.
for (const language of ['de', 'en'] as const) {
  test(`the first start leads to the setup, and typing into it moves nothing (${language})`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('cv.language', value), language)
    const bootstrap = await (await page.request.get('/api/bootstrap')).json()
    expect(bootstrap.setupRequired, 'the E2E instance must start with an empty database').toBe(true)

    await page.goto('/')
    await expect(page).toHaveURL(/\/setup$/)
    await expect(field(page, 'username')).toBeVisible()
    const before = await settledLayout(page)

    if (bootstrap.setupTokenRequired) {
      await expectNothingMoves(page, 'a wrong character in the setup code', () => field(page, 'setupToken').fill('ab!d'), before)
      await expectNothingMoves(page, 'a setup code that is too long', () => field(page, 'setupToken').fill('ABCD-EFGH-JKMN-PQRS-TUVW-XYZ2-3456-7'), before)
      await expectNothingMoves(page, 'the setup code emptied again', () => field(page, 'setupToken').fill(''), before)
    }
    await expectNothingMoves(page, 'forbidden character in the username', () => field(page, 'username').fill('bad name!'), before)
    await expectNothingMoves(page, 'username too short', () => field(page, 'username').fill('ab'), before)
    await expectNothingMoves(page, 'too short password', () => field(page, 'password').fill('short'), before)
    await expectNothingMoves(page, 'a repeat that does not match', () => field(page, 'repeat').fill('shx'), before)
    await expectNothingMoves(
      page,
      'everything emptied again',
      async () => {
        for (const name of ['username', 'password', 'repeat']) await field(page, name).fill('')
      },
      before,
    )
  })
}

test('a problem shows while typing, before any blur or click', async ({ page }) => {
  await page.goto('/setup')
  await field(page, 'password').pressSequentially('abcde')
  await expect(page.getByText(/5 von mindestens/)).toBeVisible()
  if (await asksForSetupToken(page)) {
    await field(page, 'setupToken').pressSequentially('ab!')
    await expect(page.getByText(/Der Einrichtungscode besteht nur aus Buchstaben und Ziffern/)).toBeVisible()
  }
})

test('a wrong setup code is answered at its field and moves nothing', async ({ page }) => {
  test.skip(!(await asksForSetupToken(page)), 'the server does not ask for a setup code')
  await page.goto('/setup')
  await field(page, 'setupToken').fill('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGGG')
  await field(page, 'username').fill(OWNER.username)
  await field(page, 'displayName').fill(OWNER.displayName)
  await field(page, 'password').fill(OWNER.password)
  await field(page, 'repeat').fill(OWNER.password)
  const before = await settledLayout(page)
  await expectNothingMoves(
    page,
    'the server refusing the setup code',
    async () => {
      await page.locator('button[type="submit"]').click()
      await expect(page.getByText(/Einrichtungscode stimmt nicht/)).toBeVisible()
    },
    before,
  )
  await expect(field(page, 'setupToken')).toHaveAttribute('aria-invalid', 'true')
  await expect(page).toHaveURL(/\/setup$/)
})

test('setup creates the first account, signs in and lands on the overview', async ({ page }) => {
  await page.goto('/setup')
  if (await asksForSetupToken(page)) {
    expect(SETUP_TOKEN, 'CV_SETUP_TOKEN (the setup code from the server log) must be set for the e2e run').toBeTruthy()
    // Typed the way a person pastes it: lower case, without dashes.
    await field(page, 'setupToken').fill(SETUP_TOKEN!.replaceAll('-', '').toLowerCase())
  }
  await field(page, 'username').fill(OWNER.username)
  await field(page, 'displayName').fill(OWNER.displayName)
  await field(page, 'password').fill(OWNER.password)
  await field(page, 'repeat').fill(OWNER.password)
  await page.locator('button[type="submit"]').click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('current-user')).toContainText(OWNER.displayName)
  // The first account is the administrator: the administration area is in the navigation.
  await expect(page.locator('nav a[href="/admin"]')).toBeVisible()
  // The other tests reuse this session instead of signing in again.
  await page.context().storageState({ path: 'e2e/.auth/owner.json' })
})

test('setup is not possible a second time', async ({ page }) => {
  await page.goto('/setup')
  await expect(page).not.toHaveURL(/\/setup$/)
})
