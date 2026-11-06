import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { editBackup } from './checks'
import {
  apiOk,
  confirmStepUp,
  createUser,
  downloadBackupBytes,
  ensureBackup,
  expectNothingMoves,
  field,
  MEMBER_PASSWORD,
  openApp,
  OWNER,
  readBackupSettings,
  removeUsers,
  setInstanceSettings,
  settledLayout,
  SIGNED_OUT,
  writeBackupSettings,
} from './support'
import type { BackupSettingsInfo } from './support'

// "Nothing moves" for every form and dialog of the administration, registration and security settings: when a live hint, a
// server answer or a notice appears, changes or goes away, nothing around it moves, grows or shrinks - in German and in
// English, at 1024 px (the narrowest supported window, where German wraps most). The sign-in, setup, password and the first
// backup forms are in layout.spec.ts and setup.spec.ts.
test.use({ viewport: { width: 1024, height: 768 } })

const NAMES = ['e2e-layout-taken', 'e2e-layout-admin', 'e2e-layout-gone']

for (const language of ['de', 'en'] as const) {
  test.describe(language, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('cv.language', value), language)
      await removeUsers(page, ...NAMES)
    })
    test.afterEach(async ({ page }) => {
      await removeUsers(page, ...NAMES)
    })

    test('users: the create dialog (every live hint, the taken-name answer, the role hint) moves nothing', async ({ page }) => {
      await createUser(page, 'e2e-layout-taken')
      await openApp(page, '/admin?tab=users')
      await page.getByTestId('create-user').click()
      await expect(field(page, 'username')).toBeVisible()
      const before = await settledLayout(page)

      await expectNothingMoves(page, 'a too short username', () => field(page, 'username').pressSequentially('ab'), before)
      await expectNothingMoves(page, 'a forbidden character in the username', () => field(page, 'username').fill('bad name!'), before)
      await expectNothingMoves(page, 'a too short password', () => field(page, 'password').fill('short'), before)
      await expectNothingMoves(page, 'a repeat that does not match', () => field(page, 'repeat').fill('shx'), before)
      await expectNothingMoves(
        page,
        'the other role chosen (its hint text differs)',
        () => page.getByRole('dialog').getByRole('radio', { name: 'Administrator' }).click(),
        before,
      )
      await expectNothingMoves(
        page,
        'the server answering "username taken" at its field',
        async () => {
          await field(page, 'username').fill('e2e-layout-taken')
          await field(page, 'displayName').fill('Lena Layout')
          await field(page, 'password').fill(MEMBER_PASSWORD)
          await field(page, 'repeat').fill(MEMBER_PASSWORD)
          await page.getByRole('dialog').locator('button[type="submit"]').click()
          await expect(field(page, 'username')).toHaveAttribute('aria-invalid', 'true')
        },
        before,
      )
      await expectNothingMoves(page, 'the answer gone again after editing the name', () => field(page, 'username').fill('e2e-layout-taken2'), before)
      await expectNothingMoves(
        page,
        'everything emptied again',
        async () => {
          for (const name of ['username', 'displayName', 'password', 'repeat']) await field(page, name).fill('')
        },
        before,
      )
    })

    test('users: the edit dialog for the own account (last administrator, then the own-account refusals) moves nothing', async ({ page }) => {
      await openApp(page, '/admin?tab=users')
      await page.getByTestId(`edit-${OWNER.username}`).click()
      const dialog = page.getByRole('dialog')
      await expect(field(page, 'displayName')).toBeVisible()
      const before = await settledLayout(page)

      await expectNothingMoves(page, 'the display name emptied (required hint)', () => field(page, 'displayName').fill(''), before)
      await expectNothingMoves(page, 'the display name back', () => field(page, 'displayName').fill(OWNER.displayName), before)
      // The segments are "user" then "administrator": the first one takes the role away.
      await expectNothingMoves(page, 'the other role chosen (its hint text differs)', () => dialog.getByRole('radio').first().click(), before)
      const withRole = await settledLayout(page)
      await expectNothingMoves(
        page,
        'the server refusing the last administrator',
        async () => {
          await dialog.locator('button[type="submit"]').click()
          await expect(dialog.getByTestId('error-notice')).toBeVisible()
        },
        withRole,
      )

      // With a second administrator the refusals are about the own account.
      await createUser(page, 'e2e-layout-admin', { role: 'admin', displayName: 'Zweiter Admin' })
      await dialog.getByRole('button').filter({ hasText: language === 'de' ? 'Abbrechen' : 'Cancel' }).click()
      await expect(dialog).toBeHidden()
      await page.reload()
      await page.getByTestId(`edit-${OWNER.username}`).click()
      await expect(field(page, 'displayName')).toBeVisible()
      await dialog.getByRole('radio').first().click()
      const again = await settledLayout(page)
      await expectNothingMoves(
        page,
        'the server refusing to remove the own administrator role',
        async () => {
          await dialog.locator('button[type="submit"]').click()
          await expect(dialog.getByTestId('error-notice')).toBeVisible()
        },
        again,
      )
      await dialog.getByRole('radio').last().click()
      await dialog.getByRole('switch').click()
      const disabling = await settledLayout(page)
      await expectNothingMoves(
        page,
        'the server refusing to disable the own account',
        async () => {
          await dialog.locator('button[type="submit"]').click()
          await expect(dialog.getByTestId('error-notice')).toBeVisible()
        },
        disabling,
      )
    })

    test('users: the set-password dialog (hints, then the server answering for an account that is gone) moves nothing', async ({ page }) => {
      const gone = await createUser(page, 'e2e-layout-gone', { displayName: 'Gerd Gone' })
      await openApp(page, '/admin?tab=users')
      await page.getByTestId('users-table').locator('tbody tr', { hasText: 'e2e-layout-gone' }).getByRole('button').nth(1).click()
      await expect(field(page, 'newPassword')).toBeVisible()
      const before = await settledLayout(page)
      await expectNothingMoves(page, 'a too short password', () => field(page, 'newPassword').pressSequentially('kurz'), before)
      await expectNothingMoves(page, 'a repeat that does not match', () => field(page, 'repeatPassword').pressSequentially('kra'), before)
      await expectNothingMoves(
        page,
        'the server answering that the account does not exist (deleted behind the page)',
        async () => {
          await apiOk(page, 'DELETE', `/api/admin/users/${gone.id}`)
          await field(page, 'newPassword').fill(MEMBER_PASSWORD)
          await field(page, 'repeatPassword').fill(MEMBER_PASSWORD)
          await page.getByRole('dialog').locator('button[type="submit"]').click()
          await expect(page.getByRole('dialog').getByTestId('error-notice')).toBeVisible()
        },
        before,
      )
    })

    test('backups: the step-up dialog (empty submit, wrong password, the longest refusal of an edited file) moves nothing', async ({ page }) => {
      const backup = await ensureBackup(page)
      const genuine = await downloadBackupBytes(page, backup.id)
      await openApp(page, '/admin?tab=backups')
      await page.getByTestId('restore').first().click()
      const dialog = page.getByRole('alertdialog')
      await expect(dialog.locator('input[name="reauthPassword"]')).toBeVisible()
      const before = await settledLayout(page)
      await expectNothingMoves(page, 'submit without a password (required hint)', () => page.getByTestId('reauth-confirm').click(), before)
      await expectNothingMoves(
        page,
        'a wrong password answered by the server',
        async () => {
          await dialog.locator('input[name="reauthPassword"]').fill('not the password')
          await page.getByTestId('reauth-confirm').click()
          await expect(dialog.getByTestId('error-notice')).toBeVisible()
        },
        before,
      )
      await expectNothingMoves(page, 'the copy confirmation', () => dialog.getByTestId('copy-button').click(), before)
      await expectNothingMoves(page, 'the password emptied again', () => dialog.locator('input[name="reauthPassword"]').fill(''), before)
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()

      // The upload dialog and the longest answer it can give (an edited backup).
      await page.getByTestId('upload-input').setInputFiles({
        name: 'edited.db',
        mimeType: 'application/octet-stream',
        buffer: editBackup(genuine, 'CREATE TABLE smuggled (id INTEGER)'),
      })
      await expect(dialog.locator('input[name="reauthPassword"]')).toBeVisible()
      const upload = await settledLayout(page)
      await expectNothingMoves(
        page,
        'the longest refusal of an uploaded file',
        async () => {
          await confirmStepUp(page)
          await expect(dialog.getByTestId('error-notice')).toBeVisible()
        },
        upload,
      )
    })

    test('backups: the schedule form (times, weekdays, interval problems, the saved notice) moves nothing', async ({ page }) => {
      const original: BackupSettingsInfo = await readBackupSettings(page)
      const de = language === 'de'
      try {
        await openApp(page, '/admin?tab=backups')
        await expect(page.getByTestId('week-preview')).toBeVisible()
        await page.getByRole('radio').filter({ hasText: de ? 'Zu festen Zeiten' : 'At fixed times' }).click()
        const hours = page.locator('select[aria-label$=": ' + (de ? 'Stunde' : 'Hour') + '"]')
        const minutes = page.locator('select[aria-label$=": Minute"]')
        // Two rows of times (adding a row is a change of content, not a message).
        while ((await hours.count()) < 2) await page.getByTestId('add-time').click()
        await expect(hours).toHaveCount(2)
        const twoTimes = await settledLayout(page)

        await expectNothingMoves(
          page,
          'two equal times (duplicate problem)',
          async () => {
            await hours.nth(1).selectOption(await hours.nth(0).inputValue())
            await minutes.nth(1).selectOption(await minutes.nth(0).inputValue())
            await expect(page.getByText(de ? 'Eine Uhrzeit steht doppelt in der Liste.' : 'A time is in the list twice.').first()).toBeVisible()
          },
          twoTimes,
        )
        // The slot shows one problem at a time (the times first): make the times fine again before the weekdays are emptied.
        const firstMinute = await minutes.nth(0).inputValue()
        await minutes.nth(1).selectOption(firstMinute === '15' ? '45' : '15')
        await expectNothingMoves(
          page,
          'no weekday chosen (problem)',
          async () => {
            for (let day = 1; day <= 7; day++) {
              const chip = page.getByTestId(`weekday-${day}`)
              if ((await chip.getAttribute('aria-pressed')) === 'true') await chip.click()
            }
            await expect(page.getByText(de ? 'Bitte mindestens einen Wochentag wählen.' : 'Please choose at least one weekday.').first()).toBeVisible()
          },
          twoTimes,
        )

        // The interval kind has its own form: a deliberate change of content. What is typed into it is measured.
        await page.getByRole('radio').filter({ hasText: de ? 'Alle … Stunden' : 'Every … hours' }).click()
        await field(page, 'intervalHours').fill('6')
        const interval = await settledLayout(page)
        await expectNothingMoves(page, 'a bad interval (problem hint)', () => field(page, 'intervalHours').fill('x'), interval)
        await expectNothingMoves(page, 'the interval corrected', () => field(page, 'intervalHours').fill('6'), interval)
        await expectNothingMoves(page, 'a retention number out of range', () => field(page, 'keepDailyDays').fill('99999'), interval)
        await expectNothingMoves(page, 'a retention number emptied', () => field(page, 'keepRecent').fill(''), interval)
        await field(page, 'keepDailyDays').fill('60')
        await field(page, 'keepRecent').fill('20')

        // Saving: the "saved" notice appears where its room was reserved.
        await field(page, 'intervalHours').fill('12')
        const unsaved = await settledLayout(page)
        await expectNothingMoves(
          page,
          'the "saved" notice',
          async () => {
            await page.getByTestId('save-backup-settings').click()
            await expect(page.getByRole('status').filter({ hasText: de ? 'gespeichert' : 'saved' })).toBeVisible()
          },
          unsaved,
        )
      } finally {
        await writeBackupSettings(page, original)
      }
    })

    test('security: a wrong two-factor code answered by the server moves nothing', async ({ page }) => {
      await openApp(page, '/settings?tab=security')
      await page.getByTestId('totp-start').click()
      await expect(page.getByTestId('totp-secret')).toBeVisible()
      const form = page.locator('form', { has: page.locator('input[name="code"]') })
      await form.locator('input[name="currentPassword"]').fill(OWNER.password)
      const before = await settledLayout(page)
      await expectNothingMoves(page, 'a half code (nothing red while it is unfinished)', () => field(page, 'code').pressSequentially('123'), before)
      await expectNothingMoves(page, 'a letter in the code', () => field(page, 'code').fill('12a'), before)
      await expectNothingMoves(
        page,
        'the server refusing a wrong code',
        async () => {
          await field(page, 'code').fill('000000')
          await form.locator('button[type="submit"]').click()
          await expect(form.locator('[aria-invalid="true"], [role="alert"]').first()).toBeVisible()
        },
        before,
      )
    })

    test.describe('registration page', () => {
      test('registration: hints and the taken-name answer move nothing', async ({ page, browser }) => {
        await createUser(page, 'e2e-layout-taken')
        await setInstanceSettings(page, { registrationOpen: true, requireTwoFactor: false })
        const context = await browser.newContext({ storageState: SIGNED_OUT, locale: 'de-DE', viewport: { width: 1024, height: 768 } })
        await context.addInitScript((value) => localStorage.setItem('cv.language', value), language)
        const guest: Page = await context.newPage()
        try {
          await guest.goto('/register')
          await expect(field(guest, 'username')).toBeVisible()
          const before = await settledLayout(guest)
          await expectNothingMoves(guest, 'a too short username', () => field(guest, 'username').pressSequentially('ab'), before)
          await expectNothingMoves(guest, 'a forbidden character', () => field(guest, 'username').fill('bad name!'), before)
          await expectNothingMoves(guest, 'a too short password', () => field(guest, 'password').fill('short'), before)
          await expectNothingMoves(guest, 'a repeat that does not match', () => field(guest, 'repeat').fill('shx'), before)
          await expectNothingMoves(
            guest,
            'the server answering "username taken"',
            async () => {
              await field(guest, 'username').fill('e2e-layout-taken')
              await field(guest, 'displayName').fill('Lena Layout')
              await field(guest, 'password').fill(MEMBER_PASSWORD)
              await field(guest, 'repeat').fill(MEMBER_PASSWORD)
              await guest.locator('button[type="submit"]').click()
              await expect(field(guest, 'username')).toHaveAttribute('aria-invalid', 'true')
            },
            before,
          )
          await expectNothingMoves(
            guest,
            'everything emptied again',
            async () => {
              for (const name of ['username', 'displayName', 'password', 'repeat']) await field(guest, name).fill('')
            },
            before,
          )
        } finally {
          await context.close()
          await setInstanceSettings(page, { registrationOpen: false, requireTwoFactor: false })
        }
      })
    })
  })
}

test('the check itself works: something that pushes the page around is caught', async ({ browser }) => {
  const context = await browser.newContext({ storageState: SIGNED_OUT, locale: 'de-DE', viewport: { width: 1024, height: 768 } })
  const page = await context.newPage()
  await page.goto('/login')
  await expect(field(page, 'username')).toBeVisible()
  const before = await settledLayout(page)
  // A message inserted into the flow (what the rule forbids) moves the fields below it.
  await page.evaluate(() => {
    const spacer = document.createElement('div')
    spacer.style.height = '40px'
    document.querySelector('form')!.prepend(spacer)
  })
  const after = await settledLayout(page)
  expect(after).not.toEqual(before)
  await expect(expectNothingMoves(page, 'a growing page', async () => {
    await page.evaluate(() => {
      const spacer = document.createElement('div')
      spacer.style.height = '25px'
      document.querySelector('form')!.prepend(spacer)
    })
  })).rejects.toThrow(/layout changed/)
  await context.close()
})
