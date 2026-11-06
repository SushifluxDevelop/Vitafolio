import { expect, test } from '@playwright/test'
import { editBackup, expectNotTruncated } from './checks'
import { confirmStepUp, createUser, downloadBackupBytes, ensureBackup, openApp, openAs, removeUsers, signedInContext, signIn, SIGNED_OUT } from './support'

// Error routes and error messages against the real server: the status screens, and what a failed action shows - a specific,
// complete (never cut off) and copyable message.
const NAME = 'e2e-errors'

test.describe('status screens', () => {
  test.beforeEach(async ({ page }) => {
    await removeUsers(page, NAME)
  })
  test.afterEach(async ({ page }) => {
    await removeUsers(page, NAME)
  })

  test('an unknown address in the signed-in app is the 404 screen with a way home', async ({ page }) => {
    await openApp(page)
    await page.goto('/admin/nothing-here')
    const screen = page.getByTestId('error-screen-404')
    await expect(screen).toBeVisible()
    await expect(screen.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible()
    await screen.getByRole('link', { name: 'Zur Übersicht' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByTestId('current-user')).toBeVisible()
  })

  test('a normal user who opens the administration gets the 403 screen - and the server refuses the API as well', async ({ page, browser }) => {
    await createUser(page, NAME, { displayName: 'Erik Eingeschränkt' })
    const { context, page: member } = await signedInContext(browser, NAME)
    try {
      await openAs(member, 'Erik Eingeschränkt')
      // No link to the administration for him ...
      await expect(member.locator('nav a[href="/admin"]')).toHaveCount(0)
      // ... and by address the 403 screen, not the page.
      await member.goto('/admin?tab=users')
      const screen = member.getByTestId('error-screen-403')
      await expect(screen).toBeVisible()
      await expect(screen.getByRole('heading', { name: 'Kein Zugriff' })).toBeVisible()
      await expect(member.getByTestId('users-table')).toHaveCount(0)
      // The server checks too: the list of users is refused, not just hidden.
      for (const path of ['/api/admin/users', '/api/admin/settings', '/api/admin/activity?page=1&pageSize=5', '/api/admin/backups']) {
        const answer = await context.request.get(path)
        expect(answer.status(), path).toBe(403)
      }
    } finally {
      await context.close()
    }
  })

  test('the status screens 401, 429, 500 and 503 exist on their own addresses with their own title', async ({ page }) => {
    const titles: Record<string, string> = { '401': 'Nicht angemeldet', '429': 'Zu viele Anfragen', '500': 'Das hat nicht geklappt', '503': 'Nicht erreichbar' }
    for (const [kind, title] of Object.entries(titles)) {
      await page.goto(`/error/${kind}`)
      const screen = page.getByTestId(`error-screen-${kind}`)
      await expect(screen).toBeVisible()
      await expect(screen.getByRole('heading', { name: title })).toBeVisible()
      await expect(screen.getByText(kind, { exact: true })).toBeVisible()
    }
  })
})

test.describe('a failed action shows a specific, complete and copyable message', () => {
  test.use({ storageState: SIGNED_OUT })

  test('a wrong password: the full message is selectable, and "Kopieren" puts message, code, version and time on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await signIn(page, 'definitely not the password')
    const notice = page.getByTestId('error-notice')
    await expect(notice).toContainText('Benutzername oder Passwort ist falsch.')
    await expectNotTruncated(notice.locator('p').first(), 'the sign-in error')
    // The text can be selected (not an image, not user-select: none).
    expect(await notice.locator('p').first().evaluate((element) => getComputedStyle(element).userSelect)).not.toBe('none')

    await notice.getByRole('button', { name: 'Details' }).click()
    await expect(notice).toContainText('auth.invalid_credentials')
    await notice.getByTestId('copy-button').click()
    await expect(notice.getByTestId('copy-button')).toContainText('Kopiert')
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toContain('Benutzername oder Passwort ist falsch.')
    expect(copied).toContain('auth.invalid_credentials')
    expect(copied).toMatch(/Version: v\d+\.\d+\.\d+/)
    expect(copied).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  test('the longest upload refusal is shown completely at the narrowest window (1024 px) in German and English', async ({ browser }) => {
    for (const language of ['de', 'en'] as const) {
      // The owner's saved session (no new sign-in: the sign-in is rate limited per account on purpose).
      const context = await browser.newContext({ storageState: 'e2e/.auth/owner.json', locale: 'de-DE', viewport: { width: 1024, height: 768 } })
      await context.addInitScript((value) => localStorage.setItem('cv.language', value), language)
      const page = await context.newPage()
      try {
        await openApp(page)
        const genuine = await downloadBackupBytes(page, (await ensureBackup(page)).id)
        await page.goto('/admin?tab=backups')
        await page.getByTestId('upload-input').setInputFiles({ name: 'edited.db', mimeType: 'application/octet-stream', buffer: editBackup(genuine, 'CREATE TABLE smuggled (id INTEGER)') })
        await confirmStepUp(page)
        const notice = page.getByRole('alertdialog').getByTestId('error-notice')
        await expect(notice).toContainText(language === 'de' ? 'keine unveränderte Vitafolio-Sicherung' : 'not an unchanged Vitafolio backup')
        await expectNotTruncated(notice.locator('p').first(), `${language}: the refusal text`)
        // Whole message inside the visible dialog box (the dialog may scroll, but the text is all in the page).
        const text = await notice.locator('p').first().innerText()
        expect(text.length).toBeGreaterThan(120)
        expect(text.endsWith('…')).toBe(false)
      } finally {
        await context.close()
      }
    }
  })
})

