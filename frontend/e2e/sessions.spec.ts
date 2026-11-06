import { expect, test } from '@playwright/test'
import { apiCall, createUser, MEMBER_PASSWORD, newBrowserContext, openAs, removeUsers, signedInContext, signIn } from './support'

// "Angemeldete Geräte": a second browser signs in, shows up in the first one's list, is ended from there, and its next
// request lands on the sign-in page. Own made-up account, so the owner's saved session is never touched.
const NAME = 'e2e-sessions'

test.beforeEach(async ({ page }) => {
  await removeUsers(page, NAME)
  await createUser(page, NAME, { displayName: 'Sven Sitzung' })
})
test.afterEach(async ({ page }) => {
  await removeUsers(page, NAME)
})

test('a second browser appears in the list, is ended from the first one and is signed out at its next request', async ({ browser }) => {
  const first = await signedInContext(browser, NAME)
  try {
    await openAs(first.page, 'Sven Sitzung', '/settings?tab=security')
    const rows = first.page.getByTestId('sessions-table').locator('tbody tr')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('Dieses Gerät')
    // The own session cannot be ended from here (that is signing out).
    await expect(rows.first().getByRole('button', { name: 'Beenden' })).toHaveCount(0)

    // A second browser signs in through the sign-in page like a person would.
    const secondContext = await newBrowserContext(browser)
    const second = await secondContext.newPage()
    await signIn(second, MEMBER_PASSWORD, NAME)
    await expect(second.getByTestId('current-user')).toContainText('Sven Sitzung')

    await first.page.reload()
    await expect(rows).toHaveCount(2)
    const others = rows.filter({ hasNot: first.page.getByText('Dieses Gerät') })
    await expect(others).toHaveCount(1)
    await others.getByRole('button', { name: 'Beenden' }).click()
    const confirm = first.page.getByRole('alertdialog')
    await expect(confirm).toContainText('wird abgemeldet und muss sich neu anmelden')
    // Cancel keeps it.
    await confirm.getByRole('button', { name: 'Abbrechen' }).click()
    await expect(rows).toHaveCount(2)
    await others.getByRole('button', { name: 'Beenden' }).click()
    await confirm.getByRole('button', { name: 'Beenden' }).click()
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('Dieses Gerät')

    // The ended browser is out: its next request is refused and the page lands on the sign-in.
    expect((await apiCall(secondContext, 'GET', '/api/auth/me')).status).toBe(401)
    await second.goto('/settings')
    await expect(second).toHaveURL(/\/login$/)
    await secondContext.close()

    // The first browser is still signed in.
    await first.page.reload()
    await expect(first.page.getByTestId('current-user')).toContainText('Sven Sitzung')
  } finally {
    await first.context.close()
  }
})
