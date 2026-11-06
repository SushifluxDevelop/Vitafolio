import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { scanTextContrast, waitForCalmPage } from './checks'
import { contrastBetween, createUser, field, openApp, removeUsers, SIGNED_OUT } from './support'

// WCAG 2.x on what is really rendered, not on token values: every visible piece of text on each screen is measured against the
// real background behind it (translucent layers composited), in BOTH shipped themes (light, dark): 4.5:1 for text, 3:1 for large
// text (24 px, or 18.66 px bold). Form fields and the focus ring are measured as UI parts (3:1). Disabled controls are exempt
// (WCAG); text over a gradient or image and text that is faded is counted as "unmeasured" and reported by the numbers.
// The token pairs themselves are in contrast.spec.ts.
const THEMES = ['light', 'dark'] as const
const MARKER = 'e2e-contrast-marker'

async function useColorScheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.emulateMedia({ colorScheme: theme })
}

/** Measures the whole page and fails with every piece of text that is too faint, naming text, colours and ratio. */
async function expectReadable(page: Page, theme: string, what: string, minimumMeasured = 5) {
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  await waitForCalmPage(page)
  const result = await scanTextContrast(page)
  expect(result.measured, `${what}: something was measured`).toBeGreaterThanOrEqual(minimumMeasured)
  test.info().annotations.push({ type: `${what} (${theme})`, description: `${result.measured} measured, ${result.unmeasured} unmeasured${result.unmeasured > 0 ? ': ' + result.unmeasuredTexts.join(' | ') : ''}` })
  const lines = result.findings.map((item) => `"${item.text}" ${item.ratio}:1 < ${item.needed}:1 (${item.foreground} on ${item.background}, ${item.where})`)
  expect(lines, `${theme} theme, ${what} (${result.measured} texts measured, ${result.unmeasured} unmeasured)`).toEqual([])
}

for (const theme of THEMES) {
  test.describe(`${theme} theme, signed out`, () => {
    test.use({ storageState: SIGNED_OUT })

    test('sign-in page, a failed sign-in and the 404 screen', async ({ page }) => {
      await useColorScheme(page, theme)
      await page.goto('/login')
      await expectReadable(page, theme, 'sign-in page')
      await field(page, 'username').fill('nobody-here')
      await field(page, 'password').fill('whatever whatever whatever')
      await page.locator('button[type="submit"]').click()
      await expect(page.getByTestId('error-notice')).toBeVisible()
      await expectReadable(page, theme, 'sign-in page with the error notice')
      await page.goto('/this/does/not/exist')
      await expect(page.getByTestId('error-screen-404')).toBeVisible()
      await expectReadable(page, theme, 'the 404 screen', 3)
    })

    test('form fields and the focus ring are visible as UI parts (3:1)', async ({ page }) => {
      await useColorScheme(page, theme)
      await page.goto('/login')
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await waitForCalmPage(page)
      // The border of a field and its focus ring against what is behind them (a text field shows its ring whenever it has the focus).
      await field(page, 'username').focus()
      await expect(field(page, 'username')).toBeFocused()
      const measured = await page.evaluate(() => {
        const input = document.activeElement as HTMLElement
        const style = getComputedStyle(input)
        let backdrop = 'rgb(255, 255, 255)'
        for (let node: Element | null = input.parentElement; node; node = node.parentElement) {
          const color = getComputedStyle(node).backgroundColor
          if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
            backdrop = color
            break
          }
        }
        return { tag: input.tagName, border: style.borderTopColor, borderWidth: style.borderTopWidth, outline: style.outlineColor, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, backdrop }
      })
      expect(measured.tag, 'the focus is in the username field').toBe('INPUT')
      expect(await contrastBetween(page, measured.border, measured.backdrop), `field border on ${measured.backdrop}`).toBeGreaterThanOrEqual(3)
      expect(measured.outlineStyle, 'a focus ring is drawn').not.toBe('none')
      expect(parseFloat(measured.outlineWidth)).toBeGreaterThan(0)
      expect(await contrastBetween(page, measured.outline, measured.backdrop), `focus ring on ${measured.backdrop}`).toBeGreaterThanOrEqual(3)
    })
  })

  test.describe(`${theme} theme, signed in`, () => {
    test.afterEach(async ({ page }) => {
      await removeUsers(page, MARKER)
    })

    test('overview and settings', async ({ page }) => {
      await useColorScheme(page, theme)
      await openApp(page, '/')
      await expectReadable(page, theme, 'overview')
      await openApp(page, '/settings?tab=appearance')
      await expectReadable(page, theme, 'settings: appearance')
      await openApp(page, '/settings?tab=security')
      await expect(page.getByTestId('sessions-table')).toBeVisible()
      await expectReadable(page, theme, 'settings: security')
    })

    test('administration: users, the create dialog and the delete confirmation', async ({ page }) => {
      await useColorScheme(page, theme)
      await createUser(page, MARKER, { displayName: 'Kai Kontrast' })
      await openApp(page, '/admin?tab=users')
      await expect(page.getByTestId('users-table')).toBeVisible()
      await expectReadable(page, theme, 'users list')
      await page.getByTestId('create-user').click()
      await field(page, 'username').pressSequentially('ab')
      await field(page, 'password').pressSequentially('short')
      await expect(page.getByText('Zu kurz: 5 von mindestens 12 Zeichen.')).toBeVisible()
      await expectReadable(page, theme, 'create-user dialog with live hints')
      await page.keyboard.press('Escape')
      await page.getByTestId(`delete-${MARKER}`).click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
      await expectReadable(page, theme, 'delete confirmation (danger tone)')
    })

    test('administration: settings and activity log', async ({ page }) => {
      await useColorScheme(page, theme)
      await openApp(page, '/admin?tab=settings')
      await expect(page.getByTestId('admin-settings')).toBeVisible()
      await expectReadable(page, theme, 'instance settings with the toggles')
      await openApp(page, '/admin?tab=activity')
      await expect(page.getByTestId('activity-table')).toBeVisible()
      await expectReadable(page, theme, 'activity log')
    })

    test('administration: backups with schedule, preview, notices and the step-up dialog', async ({ page }) => {
      await useColorScheme(page, theme)
      await createUser(page, MARKER, { displayName: 'Kai Kontrast' })
      await openApp(page, '/admin?tab=backups')
      await expect(page.getByTestId('week-preview')).toBeVisible()
      await expectReadable(page, theme, 'backups: schedule and preview')
      // Success notice (a backup was made), then the info notice (nothing changed since).
      await page.getByTestId('backup-now').click()
      await expect(page.getByRole('status').filter({ hasText: 'Sicherung erstellt:' })).toBeVisible()
      await expectReadable(page, theme, 'backups with the success notice')
      await page.getByTestId('backup-now').click()
      await expect(page.getByRole('note').filter({ hasText: 'nichts geändert' })).toBeVisible()
      await expectReadable(page, theme, 'backups with the info notice')
      // The step-up dialog with a refused password (error notice inside a dialog).
      await page.getByTestId('restore').first().click()
      await page.getByRole('alertdialog').locator('input[name="reauthPassword"]').fill('not the password')
      await page.getByTestId('reauth-confirm').click()
      await expect(page.getByRole('alertdialog').getByTestId('error-notice')).toBeVisible()
      await expectReadable(page, theme, 'restore dialog with the refused password')
      await page.keyboard.press('Escape')
      // A schedule with a problem (the red hint text).
      await page.getByRole('radio', { name: 'Alle … Stunden' }).click()
      await field(page, 'intervalHours').fill('x')
      await expect(page.getByText('Bitte eine ganze Zahl von 1 bis 168 eingeben.')).toBeVisible()
      await expectReadable(page, theme, 'schedule with a problem hint')
      await page.getByRole('button', { name: 'Verwerfen' }).click()
    })
  })
}

test('the scan itself works: faint text and a faint text on a gradient are caught', async ({ browser }) => {
  const context = await browser.newContext({ storageState: SIGNED_OUT, locale: 'de-DE' })
  const page = await context.newPage()
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/login')
  await waitForCalmPage(page)
  const clean = await scanTextContrast(page)
  expect(clean.findings).toEqual([])
  // Make the intro text almost invisible: the scan has to name it.
  await page.evaluate(() => {
    const intro = document.querySelector('h1 + p') as HTMLElement
    intro.style.color = '#d8d8d8'
    intro.style.backgroundImage = 'linear-gradient(90deg, #ffffff, #fafafa)'
  })
  const faint = await scanTextContrast(page)
  expect(faint.findings.length).toBeGreaterThan(0)
  expect(faint.findings[0]!.ratio).toBeLessThan(4.5)
  await context.close()
})
