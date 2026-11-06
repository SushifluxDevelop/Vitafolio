import { expect, test } from '@playwright/test'
import { apiCall, apiOk, confirmStepUp, createUser, ensureBackup, listBackups, MEMBER_PASSWORD, newBrowserContext, removeUsers, signedInContext, signInComplete, SIGNED_OUT } from './support'

// Restoring a backup against the real server: everybody is signed out, the data is back as it was, and the state from
// just before the restore is kept as a safety backup. It ends every session, including the one the other tests share, so it
// runs last (project "destructive") in an empty browser and signs in itself.
test.use({ storageState: SIGNED_OUT })

const MEMBER = 'e2e-restore-member'
const MARKER = 'e2e-restore-marker'

test('restore: everybody is signed out, a user created after the backup is gone, and the state before is kept as a safety backup', async ({ page, browser }) => {
  await signInComplete(page)
  await removeUsers(page, MEMBER, MARKER)
  // The member exists at backup time (and stays), and is signed in on another device when the restore happens.
  await createUser(page, MEMBER, { displayName: 'Rita Rest' })
  const member = await signedInContext(browser, MEMBER)
  expect((await apiCall(member.context, 'GET', '/api/auth/me')).status).toBe(200)
  const sessionCookies = await page.context().cookies()

  // The backup to restore holds the state right now: with the member, without the marker.
  const backup = await ensureBackup(page)
  await createUser(page, MARKER, { displayName: 'Mara Marker' })
  const safetyBefore = (await listBackups(page)).filter((entry) => entry.kind === 'pre-restore').length

  await page.goto('/admin?tab=users')
  await expect(page.getByTestId('users-table').locator('tbody tr', { hasText: MARKER })).toBeVisible()
  await page.goto('/admin?tab=backups')
  const rows = page.getByTestId('backup-table').locator('tbody tr')
  await expect(rows).toHaveCount((await listBackups(page)).length)
  // The newest row is the backup made above.
  await rows.first().getByTestId('restore').click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Alle werden abgemeldet und müssen sich neu anmelden.')
  await dialog.locator('input[name="reauthPassword"]').fill('not the password')
  await page.getByTestId('reauth-confirm').click()
  await expect(dialog.getByTestId('error-notice')).toContainText('Passwort oder Code stimmt nicht. Es wurde nichts verändert.')
  // Nothing was restored by the refused attempt.
  expect((await apiOk<Array<{ username: string }>>(page, 'GET', '/api/admin/users')).some((user) => user.username === MARKER)).toBe(true)
  await confirmStepUp(page)

  // Everybody is signed out: the page that restored lands on the sign-in...
  await expect(page).toHaveURL(/\/login$/)
  // ...the other device is out at its next request...
  expect((await apiCall(member.context, 'GET', '/api/auth/me')).status).toBe(401)
  await member.page.goto('/settings')
  await expect(member.page).toHaveURL(/\/login$/)
  await member.context.close()
  // ...and the old session of the restoring browser is worth nothing either, even when its cookies are replayed.
  const replay = await newBrowserContext(browser)
  await replay.addCookies(sessionCookies)
  expect((await apiCall(replay, 'GET', '/api/auth/me')).status).toBe(401)
  await replay.close()

  // Signing in again works; the data is what the backup held.
  await signInComplete(page)
  const users = await apiOk<Array<{ username: string }>>(page, 'GET', '/api/admin/users')
  expect(users.some((user) => user.username === MARKER), 'the user created after the backup is gone').toBe(false)
  expect(users.some((user) => user.username === MEMBER), 'the user from before the backup is back').toBe(true)
  // The member can sign in again with the old password.
  const again = await newBrowserContext(browser)
  expect((await apiCall(again, 'POST', '/api/auth/login', { username: MEMBER, password: MEMBER_PASSWORD })).status).toBe(200)
  await again.close()

  // The state from just before the restore is kept ("Vor Wiederherstellung") and the restore is in the log.
  const entries = await listBackups(page)
  expect(entries.filter((entry) => entry.kind === 'pre-restore').length).toBeGreaterThan(safetyBefore)
  expect(entries.some((entry) => entry.id === backup.id)).toBe(true)
  await page.goto('/admin?tab=backups')
  await expect(page.getByTestId('backup-table').locator('tbody tr', { hasText: 'Vor Wiederherstellung' }).first()).toBeVisible()
  expect((await apiOk<{ total: number }>(page, 'GET', '/api/admin/activity?page=1&pageSize=5&action=backup.restored')).total).toBeGreaterThan(0)
  await page.goto('/admin?tab=activity')
  await page.getByTestId('activity-action').selectOption('backup.restored')
  await expect(page.getByTestId('activity-table').locator('tbody tr').first()).toContainText('Sicherung wiederhergestellt')

  await removeUsers(page, MEMBER, MARKER)
})
