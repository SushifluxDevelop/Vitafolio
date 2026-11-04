import { expect, test } from '@playwright/test'
import { field, openApp, OWNER } from './support'

// The "Datensicherung" tab against the real server: the schedule module with its live week preview, and the backups.
test.beforeEach(async ({ page }) => {
  await openApp(page, '/admin?tab=backups')
  await expect(page.getByTestId('week-preview')).toBeVisible()
})

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

test('"Jetzt sichern" either makes a backup or says friendly that nothing changed', async ({ page }) => {
  await page.getByTestId('backup-now').click()
  await expect(page.getByRole('status').filter({ hasText: /Sicherung erstellt|nichts geändert/ })).toBeVisible()
  await expect(page.getByTestId('backup-table').locator('tbody tr').first()).toBeVisible()
})

test('a backup can be deleted through the step-up dialog, which says it cannot be undone', async ({ page }) => {
  await page.getByTestId('backup-now').click()
  // "created" is a status line, "unchanged" an info notice - match the text, whatever element carries it.
  const result = page.getByText(/Sicherung erstellt|nichts geändert – es wurde keine neue angelegt/).first()
  await expect(result).toBeVisible()
  // Only a backup made by this very test is deleted (an unchanged database makes none).
  test.skip(!(await result.innerText()).includes('Sicherung erstellt'), 'nothing changed, so no backup of its own to delete')
  const rows = page.getByTestId('backup-table').locator('tbody tr')
  const before = await rows.count()
  await rows.first().getByTestId('delete-backup').click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Das lässt sich nicht rückgängig machen.')
  await dialog.locator('input[name="reauthPassword"]').fill('not the password')
  await page.getByTestId('reauth-confirm').click()
  await expect(dialog.getByTestId('error-notice')).toBeVisible()
  await dialog.locator('input[name="reauthPassword"]').fill(OWNER.password)
  await page.getByTestId('reauth-confirm').click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'Gelöscht:' })).toBeVisible()
  await expect(rows).toHaveCount(before - 1)
})

test('restore asks for the password and says what happens - and can be cancelled', async ({ page }) => {
  await page.getByTestId('restore').first().click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Der aktuelle Stand wird vorher selbst als Sicherung gespeichert')
  await expect(dialog).toContainText('Alle werden abgemeldet')
  await dialog.locator('input[name="reauthPassword"]').fill('not the password')
  await page.getByTestId('reauth-confirm').click()
  await expect(dialog.getByTestId('error-notice')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})
