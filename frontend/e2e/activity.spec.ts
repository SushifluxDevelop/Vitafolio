import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { apiCall, apiOk, createUser, MEMBER_PASSWORD, newBrowserContext, openApp, removeUsers } from './support'

// The activity log against the real server: the actions of the user tests are written down, the filter finds them, and
// nobody can edit or delete an entry. Actions are caused through the API (same code as the UI), the log is read in the UI.
const NAME = 'e2e-activity'

test.beforeEach(async ({ page }) => {
  await removeUsers(page, NAME, 'e2e-activity-idle')
})
test.afterEach(async ({ page }) => {
  await removeUsers(page, NAME, 'e2e-activity-idle')
})

const rowsOf = (page: Page, text: string) => page.getByTestId('activity-table').locator('tbody tr', { hasText: text })

test('account actions appear in the log and the action filter finds them', async ({ page, browser }) => {
  const user = await createUser(page, NAME, { displayName: 'Anke Aktiv' })
  await apiOk(page, 'PATCH', `/api/admin/users/${user.id}`, { role: 'admin' })
  await apiOk(page, 'PATCH', `/api/admin/users/${user.id}`, { disabled: true })
  await apiOk(page, 'PATCH', `/api/admin/users/${user.id}`, { disabled: false })
  await apiOk(page, 'POST', `/api/admin/users/${user.id}/password`, { newPassword: 'another long passphrase for anke' })
  // A failed sign-in of that account is logged as well.
  const guest = await newBrowserContext(browser)
  expect((await apiCall(guest, 'POST', '/api/auth/login', { username: NAME, password: MEMBER_PASSWORD })).status).toBe(401)
  await guest.close()
  await apiOk(page, 'DELETE', `/api/admin/users/${user.id}`)

  await openApp(page, '/admin?tab=activity')
  const action = page.getByTestId('activity-action')
  const table = page.getByTestId('activity-table')
  await expect(table).toBeVisible()

  const expectations: Array<[code: string, label: string]> = [
    ['user.created', 'Konto angelegt'],
    ['user.role_changed', 'Rolle geändert'],
    ['user.disabled', 'Konto gesperrt'],
    ['user.enabled', 'Konto entsperrt'],
    ['user.password_set', 'Passwort gesetzt'],
    ['auth.login_failed', 'Anmeldung fehlgeschlagen'],
    ['user.deleted', 'Konto gelöscht'],
  ]
  for (const [code, label] of expectations) {
    await action.selectOption(code)
    // Every row is of the chosen kind, and ours is among them.
    await expect(rowsOf(page, NAME).first()).toContainText(label)
    const rows = table.locator('tbody tr')
    await expect
      .poll(async () => (await rows.allInnerTexts()).every((text) => text.includes(label)), { message: `only "${label}" rows for ${code}` })
      .toBe(true)
  }

  // The role change keeps its details (from / to), readable in the row.
  await action.selectOption('user.role_changed')
  const change = rowsOf(page, NAME).first()
  await change.getByText('Anzeigen').click()
  await expect(change.locator('pre')).toContainText('"from": "user"')
  await expect(change.locator('pre')).toContainText('"to": "admin"')

  // "Alle" shows the mixed log again, newest first, with the total.
  await action.selectOption('')
  await expect(page.getByText(/\d+ Einträge/)).toBeVisible()
  await expect(table.locator('tbody tr').first()).toContainText('Konto gelöscht')
})

test('the user filter narrows the log to what one account did', async ({ page }) => {
  await createUser(page, NAME, { displayName: 'Anke Aktiv' })
  await openApp(page, '/admin?tab=activity')
  const table = page.getByTestId('activity-table')
  await expect(rowsOf(page, NAME).first()).toContainText('Konto angelegt')
  // Pick the account that did it (the owner) together with the action.
  await page.getByLabel('Benutzer').selectOption({ label: 'E2E Owner (e2e-owner)' })
  await page.getByTestId('activity-action').selectOption('user.created')
  await expect(rowsOf(page, NAME).first()).toContainText('Konto angelegt')
  // An account that never did anything has no entries.
  await page.getByLabel('Benutzer').selectOption({ label: 'Anke Aktiv (e2e-activity)' })
  await expect(table).toContainText('Keine Einträge.')
})

test('the log cannot be changed: there is no way to edit or delete an entry through the API', async ({ page }) => {
  const log = await apiOk<{ items: Array<{ id: string }>; total: number }>(page, 'GET', '/api/admin/activity?page=1&pageSize=5')
  expect(log.total).toBeGreaterThan(0)
  const id = log.items[0]!.id
  for (const method of ['DELETE', 'PUT', 'PATCH'] as const) {
    const answer = await apiCall(page, method, `/api/admin/activity/${id}`, method === 'DELETE' ? undefined : { action: 'x' })
    expect([404, 405], `${method} on an entry`).toContain(answer.status)
  }
  const after = await apiOk<{ total: number }>(page, 'GET', '/api/admin/activity?page=1&pageSize=5')
  expect(after.total).toBeGreaterThanOrEqual(log.total)
})
