import { expect, test } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'
import { apiCall, apiOk, createUser, enableTotp, field, MEMBER_PASSWORD, newBrowserContext, openApp, openAs, removeUsers, setInstanceSettings, signedInContext, signInWithRecoveryCode, totp } from './support'
import type { InstanceSettings } from './support'

// App-Administration > Einstellungen against the real server: the two instance-wide switches and what they do to everybody
// else - a closed or open registration, and "two-factor for everybody" reaching people who are signed in already.
// The switches are put back to their defaults after every test, whatever the test did.
test.describe.configure({ mode: 'serial' })

const DEFAULTS: InstanceSettings = { registrationOpen: false, requireTwoFactor: false }
const NAMES = ['e2e-newcomer', 'e2e-forced', 'e2e-boss']

const registrationSwitch = (page: Page) => page.getByRole('switch', { name: 'Registrierung offen' })
const twoFactorSwitch = (page: Page) => page.getByRole('switch', { name: 'Zwei-Faktor für alle verlangen' })

test.beforeEach(async ({ page }) => {
  await setInstanceSettings(page, DEFAULTS)
  await removeUsers(page, ...NAMES)
})

/** A second administrator with two-factor (and a recovery code) who can switch the requirement off again whatever happened. */
interface Rescue {
  browser: Browser
  username: string
  recoveryCode: string
}

/** Cleanup that works in every state: the owner, who has no second factor, is locked out while the requirement is on. */
async function putBack(page: Page, rescue?: Rescue) {
  if (rescue) {
    const boss = await signInWithRecoveryCode(rescue.browser, rescue.username, rescue.recoveryCode)
    try {
      await setInstanceSettings(boss, DEFAULTS)
    } finally {
      await boss.close()
    }
  }
  await setInstanceSettings(page, DEFAULTS)
  await removeUsers(page, ...NAMES)
}

test('registration is closed by default: the register page leads to the sign-in and the API refuses', async ({ page, browser }) => {
  expect(await apiOk<InstanceSettings>(page, 'GET', '/api/admin/settings')).toEqual(DEFAULTS)
  const guest = await newBrowserContext(browser)
  const guestPage = await guest.newPage()
  await guestPage.goto('/register')
  await expect(guestPage).toHaveURL(/\/login$/)
  // No link to a registration the instance does not offer.
  await expect(guestPage.locator('a[href="/register"]')).toHaveCount(0)

  const answer = await apiCall(guest, 'POST', '/api/auth/register', { username: 'e2e-newcomer', displayName: 'Neu', password: MEMBER_PASSWORD })
  expect(answer.status).toBeGreaterThanOrEqual(400)
  expect(answer.body).toMatchObject({ code: 'registration.closed' })
  await guest.close()
  expect((await apiOk<Array<{ username: string }>>(page, 'GET', '/api/admin/users')).some((user) => user.username === 'e2e-newcomer')).toBe(false)
})

test('opening the registration lets a new account register - and closing it shuts the door again', async ({ page, browser }) => {
  const guest = await newBrowserContext(browser)
  const guestPage = await guest.newPage()
  try {
    await openApp(page, '/admin?tab=settings')
    await expect(registrationSwitch(page)).toHaveAttribute('aria-checked', 'false')
    await registrationSwitch(page).click()
    await expect(registrationSwitch(page)).toHaveAttribute('aria-checked', 'true')
    // The setting is stored in the database: it survives a reload.
    await page.reload()
    await expect(registrationSwitch(page)).toHaveAttribute('aria-checked', 'true')

    await guestPage.goto('/login')
    await expect(guestPage.locator('a[href="/register"]')).toBeVisible()
    await guestPage.goto('/register')
    await expect(guestPage).toHaveURL(/\/register$/)
    await field(guestPage, 'username').fill('e2e-newcomer')
    await field(guestPage, 'displayName').fill('Nora Neu')
    await field(guestPage, 'password').fill(MEMBER_PASSWORD)
    await field(guestPage, 'repeat').fill(MEMBER_PASSWORD)
    await guestPage.locator('button[type="submit"]').click()
    await expect(guestPage).toHaveURL(/\/$/)
    await expect(guestPage.getByTestId('current-user')).toContainText('Nora Neu')
    // A self-registered account is a normal user: no administration for her.
    await expect(guestPage.locator('nav a[href="/admin"]')).toHaveCount(0)
    await guestPage.goto('/admin')
    await expect(guestPage.getByTestId('error-screen-403')).toBeVisible()

    // The administrator sees her in the list.
    await openApp(page, '/admin?tab=users')
    await expect(page.getByTestId('users-table').locator('tbody tr', { hasText: 'e2e-newcomer' })).toContainText('Nora Neu')

    // Closed again: the page is gone for the next visitor.
    await page.goto('/admin?tab=settings')
    await registrationSwitch(page).click()
    await expect(registrationSwitch(page)).toHaveAttribute('aria-checked', 'false')
    const other = await newBrowserContext(browser)
    const otherPage = await other.newPage()
    await otherPage.goto('/register')
    await expect(otherPage).toHaveURL(/\/login$/)
    await other.close()
  } finally {
    await guest.close()
    await putBack(page)
  }
})

test('"two-factor for everybody" reaches signed-in people at once and leads them through the forced setup', async ({ page, browser }) => {
  await createUser(page, 'e2e-boss', { role: 'admin', displayName: 'Bea Boss' })
  await createUser(page, 'e2e-forced', { displayName: 'Fritz Forced' })
  // A second administrator who already has two-factor can always switch the requirement off again - the owner, who has none,
  // is locked out by it for as long as it is on.
  const { context: boss, page: bossPage } = await signedInContext(browser, 'e2e-boss')
  const { recoveryCodes } = await enableTotp(boss)
  const rescue: Rescue = { browser, username: 'e2e-boss', recoveryCode: recoveryCodes[0]! }
  const { context: member, page: memberPage } = await signedInContext(browser, 'e2e-forced')
  try {
    await openAs(memberPage, 'Fritz Forced')
    await openAs(bossPage, 'Bea Boss', '/admin?tab=settings')
    await expect(twoFactorSwitch(bossPage)).toHaveAttribute('aria-checked', 'false')

    // Switching it on asks first and says what happens; cancelling changes nothing.
    await twoFactorSwitch(bossPage).click()
    const confirm = bossPage.getByRole('alertdialog')
    await expect(confirm).toContainText('Alle Konten ohne zweiten Faktor müssen ihn beim nächsten Anmelden einrichten')
    await confirm.getByRole('button', { name: 'Abbrechen' }).click()
    await expect(twoFactorSwitch(bossPage)).toHaveAttribute('aria-checked', 'false')
    await twoFactorSwitch(bossPage).click()
    await confirm.getByRole('button', { name: 'Verlangen' }).click()
    await expect(twoFactorSwitch(bossPage)).toHaveAttribute('aria-checked', 'true')

    // The member is signed in and does nothing but click on in the app: the next thing she opens that talks to the server
    // leads to the forced setup (no reload).
    await memberPage.getByRole('link', { name: 'Einstellungen', exact: true }).click()
    await memberPage.getByRole('tab', { name: 'Sicherheit' }).click()
    await expect(memberPage).toHaveURL(/\/two-factor-setup$/)
    await expect(memberPage.getByRole('heading', { name: 'Zwei-Faktor-Anmeldung einrichten' })).toBeVisible()
    // Nothing else is reachable until it is done - also not by address.
    await memberPage.goto('/settings')
    await expect(memberPage).toHaveURL(/\/two-factor-setup$/)
    // The owner, who has no second factor, is held up too (the server tells it in the owner's own profile).
    expect((await apiOk<{ user: { mustSetupTwoFactor: boolean } }>(page, 'GET', '/api/auth/me')).user.mustSetupTwoFactor).toBe(true)

    // Through the setup (no password question right after sign-in) and on to the app.
    await memberPage.getByTestId('totp-start').click()
    const secret = (await memberPage.getByTestId('totp-secret').innerText()).trim()
    await field(memberPage, 'code').fill(totp(secret))
    await memberPage.getByRole('button', { name: 'Aktivieren' }).click()
    await expect(memberPage.getByTestId('recovery-codes').locator('li')).toHaveCount(10)
    await memberPage.getByTestId('totp-done').click()
    await expect(memberPage).toHaveURL(/\/$/)
    await expect(memberPage.getByTestId('current-user')).toContainText('Fritz Forced')

    // While the requirement is on, nobody can switch their own second factor off.
    const disable = await apiCall(member, 'POST', '/api/account/2fa/disable', { password: MEMBER_PASSWORD, code: totp(secret, 1) })
    expect(disable.status).toBeGreaterThanOrEqual(400)
    expect(disable.body).toMatchObject({ code: 'twofactor.required_by_admin' })

    // Switched off again: the owner is free again.
    await bossPage.reload()
    await twoFactorSwitch(bossPage).click()
    await expect(twoFactorSwitch(bossPage)).toHaveAttribute('aria-checked', 'false')
    expect((await apiOk<{ user: { mustSetupTwoFactor: boolean } }>(page, 'GET', '/api/auth/me')).user.mustSetupTwoFactor).toBe(false)
  } finally {
    await boss.close().catch(() => undefined)
    await member.close().catch(() => undefined)
    await putBack(page, rescue)
  }
})

test('the owner, who has no second factor, is refused by the server as soon as the requirement is on', async ({ page, browser }) => {
  await createUser(page, 'e2e-boss', { role: 'admin', displayName: 'Bea Boss' })
  const { context: boss, page: bossPage } = await signedInContext(browser, 'e2e-boss')
  const { recoveryCodes } = await enableTotp(boss)
  const rescue: Rescue = { browser, username: 'e2e-boss', recoveryCode: recoveryCodes[0]! }
  try {
    await openAs(bossPage, 'Bea Boss', '/admin?tab=settings')
    await twoFactorSwitch(bossPage).click()
    await bossPage.getByRole('alertdialog').getByRole('button', { name: 'Verlangen' }).click()
    await expect(twoFactorSwitch(bossPage)).toHaveAttribute('aria-checked', 'true')

    // The owner's saved session is open in `page`: any request is refused until the second factor exists.
    const answer = await apiCall(page, 'GET', '/api/admin/users')
    expect(answer.status).toBe(403)
    expect(answer.body).toMatchObject({ code: 'auth.twofactor_setup_required' })
  } finally {
    await boss.close().catch(() => undefined)
    await putBack(page, rescue)
  }
  expect((await apiCall(page, 'GET', '/api/admin/users')).status).toBe(200)
})
