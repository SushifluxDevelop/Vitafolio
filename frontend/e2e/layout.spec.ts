import { expect, test } from '@playwright/test'
import { expectNothingMoves, field, openApp, SIGNED_OUT, settledLayout } from './support'

// "Nothing moves": when a message appears, changes or disappears - a live hint, a server answer, an alert - nothing around
// it may move, grow or shrink, not the card, not the fields below, not the page width. German texts are longer than
// English ones, and 1024 px is the narrowest supported window, so both languages are measured there.
test.use({ viewport: { width: 1024, height: 768 } })

for (const language of ['de', 'en'] as const) {
  test.describe(language, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('cv.language', value), language)
    })

    test.describe('signed out', () => {
      test.use({ storageState: SIGNED_OUT })

      test('sign-in: live hints and a failed sign-in do not move anything', async ({ page }) => {
        await page.goto('/login')
        await expect(field(page, 'username')).toBeVisible()
        const before = await settledLayout(page)

        await expectNothingMoves(page, 'typing a username', () => field(page, 'username').pressSequentially('nobody'), before)
        await expectNothingMoves(page, 'username emptied again', () => field(page, 'username').fill(''), before)
        await expectNothingMoves(
          page,
          'wrong credentials answered by the server',
          async () => {
            await field(page, 'username').fill('nobody-here')
            await field(page, 'password').fill('whatever whatever whatever')
            await page.locator('button[type="submit"]').click()
            await expect(page.getByTestId('error-notice')).toBeVisible()
          },
          before,
        )
        await expectNothingMoves(page, 'the copy confirmation', () => page.getByTestId('copy-button').click(), before)
      })

      test('sign-in: an empty submit marks the fields without moving anything', async ({ page }) => {
        await page.goto('/login')
        const before = await settledLayout(page)
        await expectNothingMoves(page, 'submit with empty fields', () => page.locator('button[type="submit"]').click(), before)
      })
    })

    test('settings: the password form hints do not move anything', async ({ page }) => {
      await openApp(page, '/settings?tab=security')
      const form = page.getByTestId('password-form')
      await expect(form).toBeVisible()
      const before = await settledLayout(page)
      await expectNothingMoves(page, 'current password typed', () => form.locator('input[name="currentPassword"]').fill('x'), before)
      await expectNothingMoves(page, 'a too short new password', () => form.locator('input[name="newPassword"]').fill('abc'), before)
      await expectNothingMoves(page, 'a repeat that does not match', () => form.locator('input[name="repeatPassword"]').fill('zzz'), before)
      await expectNothingMoves(
        page,
        'the server refusing a wrong current password',
        async () => {
          await form.locator('input[name="currentPassword"]').fill('not the password')
          await form.locator('input[name="newPassword"]').fill('a long enough new passphrase')
          await form.locator('input[name="repeatPassword"]').fill('a long enough new passphrase')
          await form.locator('button[type="submit"]').click()
          await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible()
        },
        before,
      )
      await expectNothingMoves(
        page,
        'all fields emptied again',
        async () => {
          for (const name of ['currentPassword', 'newPassword', 'repeatPassword']) await form.locator(`input[name="${name}"]`).fill('')
        },
        before,
      )
    })

    test('backups: editing the schedule and the master switch move nothing', async ({ page }) => {
      await openApp(page, '/admin?tab=backups')
      await expect(page.getByTestId('week-preview')).toBeVisible()
      const master = page.getByRole('switch').first()
      const before = await settledLayout(page)
      await expectNothingMoves(page, 'the master switch turned off (preview caption changes)', () => master.click(), before)
      await expectNothingMoves(page, 'the master switch turned on again', () => master.click(), before)
      await expectNothingMoves(page, 'an invalid retention number', () => field(page, 'keepRecent').fill('4'), before)
      await expectNothingMoves(page, 'the number corrected again', () => field(page, 'keepRecent').fill('20'), before)
    })
  })
}
