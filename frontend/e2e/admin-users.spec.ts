import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { apiCall, apiOk, createUser, enableTotp, field, findUser, MEMBER_PASSWORD, newBrowserContext, openApp, OWNER, removeUsers, signIn } from './support'

// App-Administration > Benutzer against the real server: every account action through the UI, the server's refusals as
// specific, complete and copyable messages, and the list after a reload. Every test uses its own made-up accounts and
// removes them again (the owner is the instance's only administrator and stays untouched).
test.describe.configure({ mode: 'serial' })

const NAMES = ['e2e-anna', 'e2e-bernd', 'e2e-carla', 'e2e-dora', 'e2e-emil', 'e2e-frieda', 'e2e-gustav', 'e2e-admin2']

test.beforeEach(async ({ page }) => {
  await removeUsers(page, ...NAMES)
})
test.afterEach(async ({ page }) => {
  await removeUsers(page, ...NAMES)
})

const row = (page: Page, username: string) => page.getByTestId('users-table').locator('tbody tr', { hasText: username })

async function openUsers(page: Page) {
  await openApp(page, '/admin?tab=users')
  await expect(page.getByTestId('users-table')).toBeVisible()
}

test('create a user: live hints while typing, the new account in the list, a taken name answered at its field', async ({ page }) => {
  await openUsers(page)
  await page.getByTestId('create-user').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // Problems show while typing, before any blur or click.
  await field(page, 'username').pressSequentially('ab')
  await expect(dialog.getByText('Zu kurz: 2 von mindestens 3 Zeichen.')).toBeVisible()
  await field(page, 'password').pressSequentially('short')
  await expect(dialog.getByText('Zu kurz: 5 von mindestens 12 Zeichen.')).toBeVisible()
  await field(page, 'repeat').pressSequentially('shx')
  await expect(dialog.getByText('Die beiden Passwörter sind nicht gleich.')).toBeVisible()

  await field(page, 'username').fill('e2e-anna')
  await field(page, 'displayName').fill('Anna Beispiel')
  await field(page, 'password').fill(MEMBER_PASSWORD)
  await field(page, 'repeat').fill(MEMBER_PASSWORD)
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(dialog).toBeHidden()

  const created = row(page, 'e2e-anna')
  await expect(created).toContainText('Anna Beispiel')
  await expect(created).toContainText('Benutzer')
  await expect(created).toContainText('Aktiv')
  await expect(created).toContainText('Noch nie')

  // The same name again: the server's answer belongs to the username field and goes away when the name is edited.
  await page.getByTestId('create-user').click()
  await field(page, 'username').fill('e2e-anna')
  await field(page, 'displayName').fill('Zweite Anna')
  await field(page, 'password').fill(MEMBER_PASSWORD)
  await field(page, 'repeat').fill(MEMBER_PASSWORD)
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(dialog.getByText('Dieser Benutzername ist schon vergeben.')).toBeVisible()
  await expect(field(page, 'username')).toHaveAttribute('aria-invalid', 'true')
  await field(page, 'username').fill('e2e-anna2')
  await expect(dialog.getByText('Dieser Benutzername ist schon vergeben.')).toBeHidden()
  await dialog.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(dialog).toBeHidden()

  // The list is what the server holds, also after a reload.
  await page.reload()
  await expect(row(page, 'e2e-anna')).toContainText('Anna Beispiel')
  await expect(page.getByTestId('users-table').locator('tbody tr', { hasText: 'e2e-anna2' })).toHaveCount(0)
})

test('change the role and the display name; the role badge and the list follow, also after a reload', async ({ page }) => {
  await createUser(page, 'e2e-bernd', { displayName: 'Bernd Muster' })
  await openUsers(page)
  await page.getByTestId('edit-e2e-bernd').click()
  const dialog = page.getByRole('dialog')
  await field(page, 'displayName').fill('Bernd Neu')
  await dialog.getByRole('radio', { name: 'Administrator' }).click()
  await expect(dialog.getByText('Verwaltet Konten und die App.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(dialog).toBeHidden()
  await expect(row(page, 'e2e-bernd')).toContainText('Bernd Neu')
  await expect(row(page, 'e2e-bernd')).toContainText('Administrator')

  await page.reload()
  await expect(row(page, 'e2e-bernd')).toContainText('Administrator')
  expect((await findUser(page, 'e2e-bernd'))?.role).toBe('admin')

  // And back to a normal user.
  await page.getByTestId('edit-e2e-bernd').click()
  await dialog.getByRole('radio', { name: 'Benutzer' }).click()
  await dialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(dialog).toBeHidden()
  await expect(row(page, 'e2e-bernd')).toContainText('Benutzer')
})

test('disable and enable an account: a disabled account cannot sign in, an enabled one can', async ({ page, browser }) => {
  await createUser(page, 'e2e-carla', { displayName: 'Carla Test' })
  await openUsers(page)
  await page.getByTestId('edit-e2e-carla').click()
  const dialog = page.getByRole('dialog')
  const active = dialog.getByRole('switch')
  await expect(active).toHaveAttribute('aria-checked', 'true')
  await active.click()
  await expect(active).toHaveAttribute('aria-checked', 'false')
  await dialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(dialog).toBeHidden()
  await expect(row(page, 'e2e-carla')).toContainText('Gesperrt')

  const guest = await newBrowserContext(browser)
  const guestPage = await guest.newPage()
  await signIn(guestPage, MEMBER_PASSWORD, 'e2e-carla')
  await expect(guestPage.getByTestId('error-notice')).toContainText('Dieses Konto ist gesperrt')
  await expect(guestPage).toHaveURL(/\/login$/)

  await page.reload()
  await expect(row(page, 'e2e-carla')).toContainText('Gesperrt')
  await page.getByTestId('edit-e2e-carla').click()
  await dialog.getByRole('switch').click()
  await dialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(dialog).toBeHidden()
  await expect(row(page, 'e2e-carla')).toContainText('Aktiv')

  await signIn(guestPage, MEMBER_PASSWORD, 'e2e-carla')
  await expect(guestPage.getByTestId('current-user')).toContainText('Carla Test')
  await guest.close()
})

test('reset two-factor: the badge shows it, the confirmation says what happens, the account is without it afterwards', async ({ page, browser }) => {
  await createUser(page, 'e2e-dora', { displayName: 'Dora Test' })
  // Dora turns on two-factor in her own window (through the API with her own session).
  const guest = await newBrowserContext(browser)
  await apiOk(guest, 'POST', '/api/auth/login', { username: 'e2e-dora', password: MEMBER_PASSWORD })
  await enableTotp(guest)

  await openUsers(page)
  await expect(row(page, 'e2e-dora').getByText('Ein', { exact: true })).toBeVisible()
  await row(page, 'e2e-dora').getByRole('button', { name: 'Zwei-Faktor zurücksetzen' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Für Dora Test wird die Zwei-Faktor-Anmeldung ausgeschaltet.')
  // Cancel first: nothing changes.
  await confirm.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(confirm).toBeHidden()
  await expect(row(page, 'e2e-dora').getByText('Ein', { exact: true })).toBeVisible()

  await row(page, 'e2e-dora').getByRole('button', { name: 'Zwei-Faktor zurücksetzen' }).click()
  await confirm.getByRole('button', { name: 'Zwei-Faktor zurücksetzen' }).click()
  await expect(row(page, 'e2e-dora').getByText('Aus', { exact: true })).toBeVisible()
  // Nothing to reset any more: the action is disabled.
  await expect(row(page, 'e2e-dora').getByRole('button', { name: 'Zwei-Faktor zurücksetzen' })).toBeDisabled()
  expect((await findUser(page, 'e2e-dora'))?.twoFactorEnabled).toBe(false)

  // Her next sign-in needs the password only.
  const fresh = await newBrowserContext(browser)
  const answer = await apiCall(fresh, 'POST', '/api/auth/login', { username: 'e2e-dora', password: MEMBER_PASSWORD })
  expect(answer.status).toBe(200)
  expect(answer.body).not.toHaveProperty('twoFactorRequired')
  await guest.close()
  await fresh.close()
})

test('set a new password: live hints in the dialog, the new password works and the old one does not', async ({ page, browser }) => {
  await createUser(page, 'e2e-emil', { displayName: 'Emil Test' })
  await openUsers(page)
  await row(page, 'e2e-emil').getByRole('button', { name: 'Neues Passwort setzen' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Neues Passwort für Emil Test')
  await field(page, 'newPassword').pressSequentially('kurz')
  await expect(dialog.getByText('Zu kurz: 4 von mindestens 12 Zeichen.')).toBeVisible()
  await field(page, 'repeatPassword').pressSequentially('kra')
  await expect(dialog.getByText('Die beiden Passwörter sind nicht gleich.')).toBeVisible()

  const fresh = 'a brand new passphrase for emil'
  await field(page, 'newPassword').fill(fresh)
  await field(page, 'repeatPassword').fill(fresh)
  await dialog.getByRole('button', { name: 'Passwort setzen' }).click()
  await expect(dialog).toBeHidden()

  const guest = await newBrowserContext(browser)
  expect((await apiCall(guest, 'POST', '/api/auth/login', { username: 'e2e-emil', password: MEMBER_PASSWORD })).status).toBe(401)
  expect((await apiCall(guest, 'POST', '/api/auth/login', { username: 'e2e-emil', password: fresh })).status).toBe(200)
  await guest.close()
})

test('delete an account: the confirmation says it cannot be undone, cancelling keeps it, deleting removes it for good', async ({ page }) => {
  await createUser(page, 'e2e-frieda', { displayName: 'Frieda Test' })
  await openUsers(page)
  await page.getByTestId('delete-e2e-frieda').click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Das Konto Frieda Test (e2e-frieda) wird mit allen Daten gelöscht. Das lässt sich nicht rückgängig machen.')
  // A destructive confirmation starts on "Abbrechen".
  await expect(confirm.getByRole('button', { name: 'Abbrechen' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(confirm).toBeHidden()
  await expect(row(page, 'e2e-frieda')).toBeVisible()

  await page.getByTestId('delete-e2e-frieda').click()
  await confirm.getByRole('button', { name: 'Löschen' }).click()
  await expect(row(page, 'e2e-frieda')).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('users-table')).toBeVisible()
  await expect(row(page, 'e2e-frieda')).toHaveCount(0)
  expect(await findUser(page, 'e2e-frieda')).toBeUndefined()

  // The own account cannot be deleted: the action is disabled and says why.
  await expect(page.getByTestId(`delete-${OWNER.username}`)).toBeDisabled()
  await expect(page.getByTestId(`delete-${OWNER.username}`)).toHaveAttribute('title', 'Das eigene Konto kann nicht gelöscht werden')
})

test('the last administrator is protected: demoting or disabling yourself is answered with a specific, complete, copyable message', async ({ page }) => {
  await openUsers(page)
  await page.getByTestId(`edit-${OWNER.username}`).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Das ist Ihr eigenes Konto')

  await dialog.getByRole('radio', { name: 'Benutzer' }).click()
  await dialog.getByRole('button', { name: 'Speichern' }).click()
  const notice = dialog.getByTestId('error-notice')
  await expect(notice).toContainText('Das Konto konnte nicht gespeichert werden:')
  await expect(notice).toContainText('Das ist der letzte aktive Administrator; er muss aktiver Administrator bleiben.')
  await expect(notice.getByTestId('copy-button')).toBeVisible()

  // Nothing was changed on the server.
  expect((await findUser(page, OWNER.username))?.role).toBe('admin')
  await dialog.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(dialog).toBeHidden()
  await page.reload()
  await expect(row(page, OWNER.username)).toContainText('Administrator')
  await expect(row(page, OWNER.username)).toContainText('Aktiv')
})

test('with a second administrator the own account is still protected: demoting or disabling yourself is refused for its own reason', async ({ page }) => {
  await createUser(page, 'e2e-admin2', { role: 'admin', displayName: 'Zweiter Admin' })
  await openUsers(page)
  await page.getByTestId(`edit-${OWNER.username}`).click()
  const dialog = page.getByRole('dialog')

  await dialog.getByRole('radio', { name: 'Benutzer' }).click()
  await dialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(dialog.getByTestId('error-notice')).toContainText('Sie können sich Ihre eigene Administrator-Rolle nicht nehmen.')

  // Back to administrator, then try to lock yourself out.
  await dialog.getByRole('radio', { name: 'Administrator' }).click()
  await dialog.getByRole('switch').click()
  await dialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(dialog.getByTestId('error-notice')).toContainText('Sie können Ihr eigenes Konto nicht sperren.')
  await dialog.getByRole('button', { name: 'Abbrechen' }).click()

  // The other administrator can be demoted by the owner - that is allowed while one stays.
  await page.getByTestId('edit-e2e-admin2').click()
  await dialog.getByRole('radio', { name: 'Benutzer' }).click()
  await dialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(dialog).toBeHidden()
  await expect(row(page, 'e2e-admin2')).toContainText('Benutzer')
  expect((await findUser(page, OWNER.username))?.role).toBe('admin')
})

test('a failed action opens a complete error dialog with a Copy button (an account that is already gone)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await createUser(page, 'e2e-gustav', { displayName: 'Gustav Test' })
  await openUsers(page)
  // Somebody else deletes the account first; the list on this page is stale.
  await apiOk(page, 'DELETE', `/api/admin/users/${(await findUser(page, 'e2e-gustav'))!.id}`)
  await page.getByTestId('delete-e2e-gustav').click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen' }).click()

  const dialog = page.getByRole('alertdialog').filter({ has: page.getByTestId('error-dialog') })
  await expect(dialog).toBeVisible()
  const message = page.getByTestId('error-dialog')
  await expect(message).toContainText('Dieses Konto gibt es nicht.')
  await expect(dialog.getByRole('heading', { name: 'Das Konto konnte nicht gelöscht werden:' })).toBeVisible()
  await expect(message).toContainText('user.not_found')

  // The copy button puts the complete text (message, code, version) on the clipboard.
  await dialog.getByTestId('copy-button').click()
  await expect(dialog.getByTestId('copy-button')).toContainText('Kopiert')
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain('Dieses Konto gibt es nicht.')
  expect(copied).toContain('user.not_found')
  expect(copied).toMatch(/v\d+\.\d+\.\d+/)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})
