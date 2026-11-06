import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  apiOk,
  confirmStepUp,
  createUser,
  deleteUploadedBackups,
  downloadBackupBytes,
  ensureBackup,
  field,
  listBackups,
  openApp,
  OWNER,
  readBackupSettings,
  removeUsers,
  uploadBackupApi,
  writeBackupSettings,
} from './support'
import type { BackupSettingsInfo } from './support'
import { editBackup } from './checks'

// The "Datensicherung" tab against the real server: the schedule module with its live week preview, and the backups.
// The saved schedule and the uploaded backups are put back after every test. A restore (which signs everybody out) is
// in restore.spec.ts, which runs last on its own.
const MARKER = 'e2e-backup-marker'

let original: BackupSettingsInfo

test.beforeEach(async ({ page }) => {
  original = await readBackupSettings(page)
  await openApp(page, '/admin?tab=backups')
  await expect(page.getByTestId('week-preview')).toBeVisible()
})
test.afterEach(async ({ page }) => {
  await writeBackupSettings(page, original)
  await deleteUploadedBackups(page)
  await removeUsers(page, MARKER)
})

const rows = (page: Page) => page.getByTestId('backup-table').locator('tbody tr')

/** The number of backups the server holds, once the table shows exactly that many rows (the list refreshes a moment after an action). */
async function settledRowCount(page: Page): Promise<number> {
  const total = (await listBackups(page)).length
  await expect(rows(page)).toHaveCount(total)
  return total
}
const dialog = (page: Page) => page.getByRole('alertdialog')

test('the master switch disables the schedule (shown, not hidden) and the preview says nothing is planned', async ({ page }) => {
  const master = page.getByRole('switch').first()
  await expect(master).toHaveAttribute('aria-checked', 'true')
  await master.click()
  await expect(master).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByTestId('week-preview')).toContainText('keine automatischen Sicherungen geplant')
  await expect(page.getByRole('switch').nth(1)).toBeDisabled()
  await expect(page.getByTestId('preview-marker')).toHaveCount(0)
  // Leave the saved settings alone: discard the change.
  await page.getByRole('button', { name: 'Verwerfen' }).click()
  await expect(master).toHaveAttribute('aria-checked', 'true')
})

test('a saved master switch "off" holds after a reload: schedule controls disabled, preview says no automatic backups, manual backups still work', async ({ page }) => {
  const master = page.getByRole('switch').first()
  await master.click()
  await page.getByTestId('save-backup-settings').click()
  await expect(page.getByText('Die Einstellungen wurden gespeichert.')).toBeVisible()
  expect((await readBackupSettings(page)).automaticEnabled).toBe(false)

  await page.reload()
  await expect(page.getByTestId('week-preview')).toBeVisible()
  await expect(master).toHaveAttribute('aria-checked', 'false')
  // Everything of the schedule stays visible but cannot be used; the preview says so.
  await expect(page.getByRole('switch').nth(1)).toBeDisabled()
  await expect(page.getByRole('switch').nth(2)).toBeDisabled()
  await expect(page.getByRole('radio', { name: 'Zu festen Zeiten' })).toBeDisabled()
  await expect(page.getByTestId('week-preview')).toContainText('keine automatischen Sicherungen geplant')
  await expect(page.getByTestId('preview-marker')).toHaveCount(0)
  // Manual backup, download and upload are always available (the master switch only governs the automatic ones).
  await expect(page.getByTestId('backup-now')).toBeEnabled()
  await expect(page.getByTestId('download-current')).toBeEnabled()
  await expect(page.getByTestId('upload-backup')).toBeEnabled()

  // And on again, saved.
  await master.click()
  await page.getByTestId('save-backup-settings').click()
  await expect(page.getByText('Die Einstellungen wurden gespeichert.')).toBeVisible()
  await page.reload()
  await expect(master).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('radio', { name: 'Zu festen Zeiten' })).toBeEnabled()
})

test('the week preview follows the schedule live: fixed times draw markers, an interval draws more', async ({ page }) => {
  await page.getByRole('radio', { name: 'Zu festen Zeiten' }).click()
  const markers = page.getByTestId('preview-marker')
  const timesOnly = await markers.count()
  expect(timesOnly).toBeGreaterThan(0)
  await page.getByTestId('add-time').click()
  await expect.poll(() => markers.count()).toBeGreaterThan(timesOnly)
  await page.getByRole('radio', { name: 'Alle … Stunden' }).click()
  await field(page, 'intervalHours').fill('6')
  await expect.poll(() => markers.count()).toBeGreaterThan(20)
  await field(page, 'intervalHours').fill('x')
  await expect(page.getByText('Bitte eine ganze Zahl von 1 bis 168 eingeben.')).toBeVisible()
  await page.getByRole('button', { name: 'Verwerfen' }).click()
})

test('weekday chips narrow the plan; none selected is a problem shown at once', async ({ page }) => {
  await page.getByRole('radio', { name: 'Zu festen Zeiten' }).click()
  for (let day = 1; day <= 7; day++) {
    const chip = page.getByTestId(`weekday-${day}`)
    if ((await chip.getAttribute('aria-pressed')) === 'true') await chip.click()
  }
  await expect(page.getByText('Bitte mindestens einen Wochentag wählen.')).toBeVisible()
  await expect(page.getByTestId('preview-marker')).toHaveCount(0)
  await page.getByRole('button', { name: 'Verwerfen' }).click()
})

test('a schedule with fixed times on chosen weekdays is saved, and the server\'s next runs are what the page shows after a reload', async ({ page }) => {
  await page.getByRole('radio', { name: 'Zu festen Zeiten' }).click()
  // Monday, Wednesday and Friday only.
  for (let day = 1; day <= 7; day++) {
    const chip = page.getByTestId(`weekday-${day}`)
    const wanted = day === 1 || day === 3 || day === 5
    if ((await chip.getAttribute('aria-pressed')) === 'true' !== wanted) await chip.click()
  }
  // One time of day, 03:30 (a list that is empty at first gets one with the add button).
  if ((await page.getByRole('group', { name: 'Uhrzeit 1', exact: true }).count()) === 0) await page.getByTestId('add-time').click()
  const first = page.getByRole('group', { name: 'Uhrzeit 1', exact: true })
  await first.getByLabel('Uhrzeit 1: Stunde').selectOption('03')
  await first.getByLabel('Uhrzeit 1: Minute').selectOption('30')
  // Anything beyond the first time of day is removed again.
  while ((await page.getByRole('button', { name: /^Uhrzeit .* entfernen$/ }).count()) > 1) await page.getByRole('button', { name: /^Uhrzeit .* entfernen$/ }).last().click()
  await page.getByTestId('save-backup-settings').click()
  await expect(page.getByText('Die Einstellungen wurden gespeichert.')).toBeVisible()

  // What the server stored and planned.
  const saved = await readBackupSettings(page)
  expect(saved.schedule).toMatchObject({ kind: 'times', times: ['03:30'], weekdays: [1, 3, 5] })
  const now = Date.now()
  const runs = saved.nextRuns.map((iso) => Date.parse(iso))
  expect(runs.length, 'a plan for three weekdays within seven days').toBeGreaterThanOrEqual(2)
  expect(runs.length).toBeLessThanOrEqual(3)
  for (const run of runs) {
    expect(run).toBeGreaterThan(now - 60_000)
    expect(run).toBeLessThanOrEqual(now + 7 * 24 * 3600 * 1000 + 60_000)
  }
  expect([...runs].sort((a, b) => a - b)).toEqual(runs)

  // After a reload the page shows exactly that: the form as saved and one marker per planned run.
  await page.reload()
  await expect(page.getByTestId('week-preview')).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Zu festen Zeiten' })).toHaveAttribute('aria-checked', 'true')
  for (let day = 1; day <= 7; day++) await expect(page.getByTestId(`weekday-${day}`)).toHaveAttribute('aria-pressed', String(day === 1 || day === 3 || day === 5))
  await expect(page.getByLabel('Uhrzeit 1: Stunde')).toHaveValue('03')
  await expect(page.getByLabel('Uhrzeit 1: Minute')).toHaveValue('30')
  await expect(page.getByTestId('preview-marker')).toHaveCount(runs.length)
  // Nothing unsaved: the save button waits for the next change.
  await expect(page.getByTestId('save-backup-settings')).toBeDisabled()
  await expect(page.getByTestId('backup-timezone')).toHaveText(saved.timeZone)
})

test('"Jetzt sichern" either makes a backup or says friendly that nothing changed', async ({ page }) => {
  await page.getByTestId('backup-now').click()
  await expect(page.getByRole('status').filter({ hasText: /Sicherung erstellt|nichts geändert/ })).toBeVisible()
  await expect(rows(page).first()).toBeVisible()
})

test('a backup can be deleted through the step-up dialog, which says it cannot be undone', async ({ page }) => {
  // A change first, so "Jetzt sichern" really makes a backup of its own (without one it answers "nothing changed").
  await createUser(page, MARKER)
  await page.getByTestId('backup-now').click()
  const created = page.getByRole('status').filter({ hasText: 'Sicherung erstellt:' })
  await expect(created).toBeVisible()
  const file = (await created.innerText()).replace(/^[\s\S]*Sicherung erstellt:\s*/, '').trim()
  expect(file).toMatch(/\.db$/)
  expect((await listBackups(page)).some((entry) => entry.file === file)).toBe(true)

  const before = await settledRowCount(page)
  // The newest row is the one just made.
  await expect(rows(page).first()).toContainText('Von Hand')
  await rows(page).first().getByTestId('delete-backup').click()
  await expect(dialog(page)).toContainText('Das lässt sich nicht rückgängig machen.')
  await dialog(page).locator('input[name="reauthPassword"]').fill('not the password')
  await page.getByTestId('reauth-confirm').click()
  await expect(dialog(page).getByTestId('error-notice')).toContainText('Passwort oder Code stimmt nicht. Es wurde nichts verändert.')
  await confirmStepUp(page)
  await expect(dialog(page)).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: `Gelöscht: ${file}` })).toBeVisible()
  await expect(rows(page)).toHaveCount(before - 1)
  expect((await listBackups(page)).some((entry) => entry.file === file)).toBe(false)
})

test('restore asks for the password and says what happens - and can be cancelled', async ({ page }) => {
  await ensureBackup(page)
  await page.reload()
  await page.getByTestId('restore').first().click()
  const confirm = dialog(page)
  await expect(confirm).toContainText('Der aktuelle Stand wird vorher selbst als Sicherung gespeichert')
  await expect(confirm).toContainText('Alle werden abgemeldet')
  await confirm.locator('input[name="reauthPassword"]').fill('not the password')
  await page.getByTestId('reauth-confirm').click()
  await expect(confirm.getByTestId('error-notice')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(confirm).toBeHidden()
})

test('download: the step-up dialog refuses a wrong password in place and then hands over a real backup file', async ({ page }) => {
  await ensureBackup(page)
  await page.reload()
  await expect(rows(page).first()).toBeVisible()
  await rows(page).first().getByRole('button', { name: 'Herunterladen' }).click()
  const confirm = dialog(page)
  await expect(confirm).toContainText('Die Datei enthält die Daten aller Konten')
  // Nothing is typed yet: the button waits for a password instead of sending an empty one.
  await page.getByTestId('reauth-confirm').click()
  await expect(confirm.getByText('Bitte ein Passwort eingeben.')).toBeVisible()
  await confirm.locator('input[name="reauthPassword"]').fill('not the password')
  await page.getByTestId('reauth-confirm').click()
  await expect(confirm.getByTestId('error-notice')).toContainText('Passwort oder Code stimmt nicht. Es wurde nichts verändert.')
  await expect(confirm).toBeVisible()

  const download = page.waitForEvent('download')
  await confirm.locator('input[name="reauthPassword"]').fill(OWNER.password)
  await page.getByTestId('reauth-confirm').click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^vitafolio-backup-\d{4}-\d{2}-\d{2}-\d{4}\.db$/)
  const folder = mkdtempSync(join(tmpdir(), 'cv-e2e-download-'))
  try {
    const target = join(folder, file.suggestedFilename())
    await file.saveAs(target)
    const bytes = readFileSync(target)
    expect(bytes.length).toBeGreaterThan(4096)
    // A real SQLite database, not an error page.
    expect(bytes.subarray(0, 15).toString('latin1')).toBe('SQLite format 3')
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
  await expect(confirm).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'Heruntergeladen:' })).toBeVisible()
  // The download is written into the activity log.
  expect((await apiOk<{ total: number }>(page, 'GET', '/api/admin/activity?page=1&pageSize=5&action=backup.downloaded')).total).toBeGreaterThan(0)
})

test('"Aktuellen Stand herunterladen" asks for the password too and delivers a fresh backup', async ({ page }) => {
  await page.getByTestId('download-current').click()
  const confirm = dialog(page)
  await expect(confirm).toContainText('frische Sicherung')
  const download = page.waitForEvent('download')
  await confirmStepUp(page)
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^vitafolio-backup-.*\.db$/)
  await expect(confirm).toBeHidden()
})

test('upload: a valid backup is checked and listed as uploaded, a wrong password is refused in the dialog', async ({ page }) => {
  const newest = await ensureBackup(page)
  const bytes = await downloadBackupBytes(page, newest.id)
  await page.reload()
  const before = await settledRowCount(page)

  await page.getByTestId('upload-input').setInputFiles({ name: 'meine-sicherung.db', mimeType: 'application/octet-stream', buffer: bytes })
  const confirm = dialog(page)
  await expect(confirm).toContainText('meine-sicherung.db')
  await confirm.locator('input[name="reauthPassword"]').fill('not the password')
  await page.getByTestId('reauth-confirm').click()
  await expect(confirm.getByTestId('error-notice')).toContainText('Passwort oder Code stimmt nicht. Es wurde nichts verändert.')
  await confirmStepUp(page)
  await expect(confirm).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'Hochgeladen:' })).toContainText('kann wiederhergestellt werden')
  await expect(rows(page)).toHaveCount(before + 1)
  await expect(rows(page).filter({ hasText: 'Hochgeladen' })).toHaveCount(1)
})

test('upload: files that are no valid backup are refused with a specific, complete, copyable message and nothing is stored', async ({ page }) => {
  const uploaded = async (name: string, bytes: Buffer) => {
    await page.getByTestId('upload-input').setInputFiles({ name, mimeType: 'application/octet-stream', buffer: bytes })
    await confirmStepUp(page)
    return dialog(page).getByTestId('error-notice')
  }
  const before = await listBackups(page)

  // 1) Not a database at all.
  let notice = await uploaded('notiz.txt', Buffer.from('Das ist keine Sicherung, nur ein Text.'))
  await expect(notice).toContainText('Die Datei ist keine gültige Sicherung dieser App.')
  await expect(notice.getByTestId('copy-button')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toBeHidden()

  // 2) A real SQLite database, but not this app's: the structure does not fit.
  const folder = mkdtempSync(join(tmpdir(), 'cv-e2e-foreign-'))
  try {
    const path = join(folder, 'fremd.db')
    const database = new DatabaseSync(path)
    database.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT); INSERT INTO notes (body) VALUES (\'hello\');')
    database.close()
    notice = await uploaded('fremd.db', readFileSync(path))
    await expect(notice).toContainText('Die Datei ist keine gültige Sicherung dieser App.')
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeHidden()
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }

  // 3) A genuine backup that somebody edited: an extra table, and an extra trigger (a database can carry code that runs later).
  const genuine = await downloadBackupBytes(page, (await ensureBackup(page)).id)
  for (const [name, statement] of [
    ['extra-table.db', 'CREATE TABLE smuggled (id INTEGER PRIMARY KEY, payload TEXT)'],
    ['extra-trigger.db', 'CREATE TRIGGER smuggled_trigger AFTER INSERT ON app_settings BEGIN SELECT 1; END'],
  ] as const) {
    notice = await uploaded(name, editBackup(genuine, statement))
    await expect(notice, name).toContainText('keine unveränderte Vitafolio-Sicherung')
    await expect(notice).toContainText('Verwenden Sie nur Sicherungen, die die App selbst erstellt hat')
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeHidden()
  }

  expect((await listBackups(page)).length).toBe(before.length)
})

test('upload: a file over the size limit is refused before anything is sent, with its size and the limit in the message', async ({ page }) => {
  // A 513 MB file made of one shared block (no memory is spent): put into the file input like a chosen file.
  await page.evaluate(() => {
    const block = new Blob([new ArrayBuffer(1024 * 1024)])
    const big = new File(Array.from({ length: 513 }, () => block), 'riesig.db')
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    const transfer = new DataTransfer()
    transfer.items.add(big)
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  const notice = page.getByRole('note').filter({ hasText: 'Die Datei ist zu groß' })
  await expect(notice).toContainText('513')
  await expect(notice).toContainText('512')
  await expect(dialog(page)).toHaveCount(0)
})

test('upload: the limit of uploaded backups is answered specifically, and deleting one makes room again', async ({ page }) => {
  const newest = await ensureBackup(page)
  const bytes = await downloadBackupBytes(page, newest.id)
  for (let index = 0; index < 10; index++) expect((await uploadBackupApi(page, bytes, `limit-${index}.db`)).status).toBe(201)
  await page.reload()
  await page.getByTestId('upload-input').setInputFiles({ name: 'elfte.db', mimeType: 'application/octet-stream', buffer: bytes })
  await confirmStepUp(page)
  await expect(dialog(page).getByTestId('error-notice')).toContainText('Höchstens 10 hochgeladene Sicherungen – bitte erst eine löschen.')
  await page.keyboard.press('Escape')

  // Delete one uploaded backup: the next upload works.
  await rows(page).filter({ hasText: 'Hochgeladen' }).first().getByTestId('delete-backup').click()
  await confirmStepUp(page)
  await expect(dialog(page)).toBeHidden()
  await page.getByTestId('upload-input').setInputFiles({ name: 'elfte.db', mimeType: 'application/octet-stream', buffer: bytes })
  await confirmStepUp(page)
  await expect(dialog(page)).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'Hochgeladen:' })).toBeVisible()
})
