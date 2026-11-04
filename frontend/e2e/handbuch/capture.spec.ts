import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, request as playwrightRequest, test } from '@playwright/test'
import type { APIRequestContext, Browser, BrowserContext, Locator, Page } from '@playwright/test'
import { field, settledLayout, totp } from '../support'

/**
 * Screenshot capture for the user manuals (docs/handbuch/de/bilder and docs/handbuch/en/bilder).
 *
 * This is NOT part of the normal suite: playwright.config.ts only runs it when HANDBOOK_CAPTURE=1 (and then runs nothing else).
 *
 * How it is run: against a FRESH test server with the built UI, in the Playwright browser container - exactly what
 * scripts/e2e.ps1 sets up. The runner starts the server and the browser container, then calls Playwright; this file only needs
 *   HANDBOOK_CAPTURE=1            (environment of the Playwright call; set before calling the runner it is inherited)
 *   PLAYWRIGHT_BASE_URL           (set by the runner)
 *   PLAYWRIGHT_WS_ENDPOINT        (set by the runner, optional)
 *   E2E_SETUP_CODE                (optional: the one-time setup code of the fresh server, if the server asks for one)
 * The server should run with APP_CHANNEL=release, so the footer shows a release version and not "-dev".
 *
 * What it does: one serial run. 1. Photographs the setup page of the still empty server in both languages. 2. Creates made-up
 * demo data through the API (three accounts, backups, a backup schedule, some activity). 3. For German and then English: signs in
 * as the demo administrator, photographs the read-only screens, signs out again. 4. Last, the steps that change something (setting
 * up two-factor sign-in for the administrator and removing it again, a failed sign-in), so both languages see the same data.
 *
 * Output: element or clip screenshots at device scale 2, light theme, 1280 x 800 window; the same file names in both folders.
 * The German UI feeds the German manual, the English UI the English one. Only made-up people ("Mira Beispiel" ...) appear;
 * machine-specific text (the backup folder) is replaced in the page before it is photographed.
 */

type Lang = 'de' | 'en'
const LANGS: readonly Lang[] = ['de', 'en']

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5245'
const SETUP_CODE = process.env.E2E_SETUP_CODE
const HEADERS = { 'X-Cv-Request': '1' }
const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_ROOT = resolve(HERE, '..', '..', '..', 'docs', 'handbuch')

interface Person {
  username: string
  displayName: string
  password: string
}

const MIRA: Person = { username: 'mira', displayName: 'Mira Beispiel', password: 'Ein langer Beispielsatz 2026' }
const JONAS: Person = { username: 'jonas', displayName: 'Jonas Muster', password: 'Noch ein Beispielsatz 2026' }
const LENA: Person = { username: 'lena', displayName: 'Lena Probe', password: 'Dritter Beispielsatz 2026' }

// Other devices of the demo administrator, so the list of signed-in devices has something to show.
const EDGE_ON_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0'
const FIREFOX_ON_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0'

test.describe.configure({ mode: 'serial' })
test.skip(process.env.HANDBOOK_CAPTURE !== '1', 'Manual screenshots are only taken with HANDBOOK_CAPTURE=1')

// ---- helpers ------------------------------------------------------------------------------------------------------------------

function outDir(lang: Lang): string {
  const dir = resolve(OUT_ROOT, lang, 'bilder')
  mkdirSync(dir, { recursive: true })
  return dir
}

async function apiContext(userAgent?: string): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL: BASE_URL, extraHTTPHeaders: HEADERS, ...(userAgent ? { userAgent } : {}) })
}

async function signInApi(person: Person, userAgent?: string): Promise<APIRequestContext> {
  const api = await apiContext(userAgent)
  const response = await api.post('/api/auth/login', { data: { username: person.username, password: person.password } })
  expect(response.ok(), `sign-in of ${person.username} answered ${response.status()}`).toBe(true)
  return api
}

/** A browser window in the manual's language, light theme, scale 2; signed in when an API session is given. */
async function openWindow(browser: Browser, lang: Lang, api?: APIRequestContext): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    locale: lang === 'de' ? 'de-DE' : 'en-GB',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    ...(api ? { storageState: await api.storageState() } : {}),
  })
  await context.addInitScript(
    ([language]) => {
      localStorage.setItem('cv.language', language!)
      localStorage.setItem('cv.theme', 'light')
    },
    [lang],
  )
  return { context, page: await context.newPage() }
}

/** Fonts loaded, entrance animations over, pointer out of the way. */
async function settle(page: Page): Promise<void> {
  await page.mouse.move(0, 0)
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  await settledLayout(page)
}

/** Replaces text that belongs to this machine (the backup folder, the time zone name) by neutral demo text. */
async function scrub(page: Page): Promise<void> {
  await page.evaluate(() => {
    const set = (id: string, text: string) => {
      const element = document.querySelector(`[data-testid="${id}"]`)
      if (element) element.textContent = text
    }
    set('backup-directory', '/data/backups')
    set('backup-timezone', 'Europe/Berlin')
  })
}

/** A numbered badge with a frame around the part it explains (drawn over the page, nothing moves). */
async function mark(target: Locator, n: number, placement: 'corner' | 'above' = 'corner'): Promise<void> {
  await target.evaluate(
    (element, args) => {
      const box = element.getBoundingClientRect()
      const x = box.left + window.scrollX
      const y = box.top + window.scrollY
      const frame = document.createElement('div')
      frame.setAttribute('data-capture-mark', '')
      Object.assign(frame.style, {
        position: 'absolute',
        left: `${x - 3}px`,
        top: `${y - 3}px`,
        width: `${box.width + 6}px`,
        height: `${box.height + 6}px`,
        border: '2px solid #b8872a',
        borderRadius: '4px',
        boxSizing: 'border-box',
        pointerEvents: 'none',
        zIndex: '99998',
      })
      const badge = document.createElement('div')
      badge.setAttribute('data-capture-mark', '')
      badge.textContent = String(args.n)
      Object.assign(badge.style, {
        position: 'absolute',
        left: `${args.above ? x + box.width / 2 - 11 : Math.max(x - 8, 2)}px`,
        top: `${args.above ? y - 28 : Math.max(y - 8, 2)}px`,
        width: '22px',
        height: '22px',
        borderRadius: '11px',
        background: '#14213d',
        color: '#f3eee2',
        border: '2px solid #d9ae57',
        boxSizing: 'border-box',
        font: '700 12px/18px Inter, sans-serif',
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: '99999',
      })
      document.body.append(frame, badge)
    },
    { n, above: placement === 'above' },
  )
}

async function clearMarks(page: Page): Promise<void> {
  await page.evaluate(() => document.querySelectorAll('[data-capture-mark]').forEach((element) => element.remove()))
}

async function shot(target: Locator, lang: Lang, name: string): Promise<void> {
  await settle(target.page())
  await target.screenshot({ path: resolve(outDir(lang), `${name}.png`), animations: 'disabled', caret: 'hide' })
}

/** The whole window (only where the overall layout is the point). */
async function shotWindow(page: Page, lang: Lang, name: string): Promise<void> {
  await settle(page)
  await page.screenshot({ path: resolve(outDir(lang), `${name}.png`), animations: 'disabled', caret: 'hide' })
}

/** The top part of an element (a long table): its width, at most `maxHeight` pixels, in page coordinates. */
async function shotTop(target: Locator, lang: Lang, name: string, maxHeight: number): Promise<void> {
  const page = target.page()
  await settle(page)
  const box = await target.boundingBox()
  expect(box, `${name}: nothing to photograph`).not.toBeNull()
  const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))
  await page.screenshot({
    path: resolve(outDir(lang), `${name}.png`),
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
    clip: { x: box!.x + scroll.x, y: box!.y + scroll.y, width: box!.width, height: Math.min(box!.height, maxHeight) },
  })
}

/** An input of a form inside a dialog (the shared `field` helper wants a whole page). */
const inputIn = (scope: Locator, name: string) => scope.locator(`input[name="${name}"]`)

const cards = (page: Page) => page.locator('[role="tabpanel"] section.card')

async function endSession(context: BrowserContext, api: APIRequestContext): Promise<void> {
  // Ends exactly this session, so the list of signed-in devices is the same in both languages.
  await context.request.post('/api/auth/logout', { headers: HEADERS })
  await context.close()
  await api.dispose()
}

// ---- 1. the setup page of the empty server -----------------------------------------------------------------------------------

test('setup page (empty server)', async ({ browser }) => {
  for (const lang of LANGS) {
    const { context, page } = await openWindow(browser, lang)
    const bootstrap = await (await page.request.get('/api/bootstrap')).json()
    expect(bootstrap.setupRequired, 'the capture needs a fresh server (empty database)').toBe(true)

    await page.goto('/setup')
    await expect(field(page, 'username')).toBeVisible()
    await field(page, 'username').fill(MIRA.username)
    await field(page, 'displayName').fill(MIRA.displayName)
    // The one-time setup code (only present when the server asks for it); shown as typed dots like the passwords
    const setupCode = field(page, 'setupCode')
    if ((await setupCode.count()) > 0 && SETUP_CODE) await setupCode.fill(SETUP_CODE)
    await field(page, 'password').fill(MIRA.password)
    await field(page, 'repeat').fill(MIRA.password)
    await shot(page.locator('main > div').first(), lang, 'setup')
    await context.close()
  }
})

// ---- 2. made-up demo data ------------------------------------------------------------------------------------------------------

test('demo data: three accounts, backups, schedule, some activity', async () => {
  const anonymous = await apiContext()
  const mira = await apiContext(EDGE_ON_WINDOWS)
  const setup = await mira.post('/api/setup', {
    data: { username: MIRA.username, displayName: MIRA.displayName, password: MIRA.password, ...(SETUP_CODE ? { setupCode: SETUP_CODE } : {}) },
  })
  expect(setup.ok(), `setup answered ${setup.status()}`).toBe(true)
  const backup = async () => {
    const response = await mira.post('/api/admin/backups')
    // 409 = nothing changed since the last one: fine
    expect([201, 409]).toContain(response.status())
  }
  await backup()

  const create = async (person: Person) => {
    const response = await mira.post('/api/admin/users', { data: { ...person, role: 'user' } })
    expect(response.ok(), `creating ${person.username} answered ${response.status()}`).toBe(true)
    return (await response.json()) as { id: string }
  }
  await create(JONAS)
  await backup()
  const lena = await create(LENA)
  const disable = await mira.patch(`/api/admin/users/${lena.id}`, { data: { disabled: true } })
  expect(disable.ok()).toBe(true)
  await backup()

  // Jonas: signs in once, has two-factor sign-in on. One wrong password in between (a "sign-in failed" entry in the log).
  const wrong = await anonymous.post('/api/auth/login', { data: { username: JONAS.username, password: 'nicht das Passwort' } })
  expect(wrong.status()).toBe(401)
  const jonas = await signInApi(JONAS, FIREFOX_ON_LINUX)
  const started = await jonas.post('/api/account/2fa/totp/setup')
  expect(started.ok()).toBe(true)
  const { secret } = (await started.json()) as { secret: string }
  const enabled = await jonas.post('/api/account/2fa/totp/enable', { data: { code: totp(secret), password: JONAS.password } })
  expect(enabled.ok(), `two-factor of jonas answered ${enabled.status()}`).toBe(true)
  await jonas.dispose()
  await backup()

  // A schedule that is easy to read: weekdays 02:00 and 18:00
  const settings = await mira.put('/api/admin/backups/settings', {
    data: {
      automaticEnabled: true,
      onStart: true,
      beforeShutdown: true,
      schedule: { kind: 'times', intervalHours: 6, times: ['02:00', '18:00'], weekdays: [1, 2, 3, 4, 5] },
      catchUpMissed: true,
      keepRecent: 20,
      keepDailyDays: 60,
    },
  })
  expect(settings.ok(), `backup settings answered ${settings.status()}`).toBe(true)

  // An uploaded backup: download one and upload it again
  const list = (await (await mira.get('/api/admin/backups')).json()) as { id: string }[]
  expect(list.length).toBeGreaterThan(0)
  const download = await mira.post(`/api/admin/backups/${list[0]!.id}/download`, { data: { password: MIRA.password } })
  expect(download.ok(), `download answered ${download.status()}`).toBe(true)
  const upload = await mira.post('/api/admin/backups/upload', {
    multipart: { file: { name: 'vitafolio-backup.db', mimeType: 'application/octet-stream', buffer: await download.body() }, password: MIRA.password },
  })
  expect(upload.ok(), `upload answered ${upload.status()}`).toBe(true)

  // More devices of the administrator (they stay signed in), then this setup session ends
  await (await signInApi(MIRA, FIREFOX_ON_LINUX)).dispose()
  await mira.post('/api/auth/logout')
  await mira.dispose()
  await anonymous.dispose()
})

// ---- 3. the read-only screens, German first, then English ----------------------------------------------------------------------

for (const lang of LANGS) {
  test(`figures without changes (${lang})`, async ({ browser }) => {
    // Signed out: sign-in page and the second step
    {
      const { context, page } = await openWindow(browser, lang)
      await page.goto('/login')
      await field(page, 'username').fill(MIRA.username)
      await field(page, 'password').fill(MIRA.password)
      await shot(page.locator('main > div').first(), lang, 'anmeldung')

      await field(page, 'username').fill(JONAS.username)
      await field(page, 'password').fill(JONAS.password)
      await page.locator('button[type="submit"]').click()
      await expect(field(page, 'code')).toBeVisible()
      await shot(page.locator('main > div').first(), lang, 'anmeldung-code')
      await context.close()
    }

    // Signed in as the demo administrator
    const api = await signInApi(MIRA, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')
    const { context, page } = await openWindow(browser, lang, api)
    const open = async (path: string) => {
      await page.goto(path)
      await expect(page.getByTestId('current-user')).toContainText(MIRA.displayName)
    }

    // The main window with numbered parts: menu, own area, colour scheme switch, footer
    await open('/')
    await expect(page.locator('aside footer')).toBeVisible()
    await mark(page.locator('aside nav'), 1)
    await mark(page.getByTestId('current-user').locator('xpath=../..'), 2)
    await mark(page.locator('aside').getByRole('radiogroup'), 3)
    await mark(page.locator('aside footer'), 4)
    await shotWindow(page, lang, 'hauptfenster')
    await clearMarks(page)

    // Personal settings: signed-in devices, appearance
    await open('/settings?tab=security')
    await expect(page.getByTestId('sessions-table')).toBeVisible()
    await expect(page.getByTestId('sessions-table').locator('tbody tr')).not.toHaveCount(0)
    await shot(cards(page).nth(2), lang, 'geraete')
    await open('/settings?tab=appearance')
    await shot(page.locator('[role="tabpanel"]'), lang, 'darstellung')

    // App administration: users (with the four row actions numbered), the create dialog, access switches, activity log
    await open('/admin?tab=users')
    const table = page.getByTestId('users-table')
    await expect(table.locator('tbody tr')).toHaveCount(3)
    const actions = table.locator('tbody tr').first().getByRole('button')
    for (let index = 0; index < 4; index++) await mark(actions.nth(index), index + 1, 'above')
    await shot(page.locator('[role="tabpanel"]'), lang, 'benutzer')
    await clearMarks(page)

    await page.getByTestId('create-user').click()
    const create = page.getByRole('dialog')
    await expect(create).toBeVisible()
    await inputIn(create, 'username').fill('lukas')
    await inputIn(create, 'displayName').fill('Lukas Demo')
    await inputIn(create, 'password').fill('Ein vierter Beispielsatz 2026')
    await inputIn(create, 'repeat').fill('Ein vierter Beispielsatz 2026')
    await page.waitForTimeout(400)
    await shot(create, lang, 'benutzer-anlegen')
    await page.keyboard.press('Escape')
    await expect(create).toBeHidden()

    await open('/admin?tab=settings')
    await shot(cards(page).first(), lang, 'admin-einstellungen')

    await open('/admin?tab=activity')
    await expect(page.getByTestId('activity-table').locator('tbody tr').first()).toBeVisible()
    await shotTop(page.locator('[role="tabpanel"]'), lang, 'aktivitaetsprotokoll', 560)

    // Backups: schedule (numbered), week preview, list with the three buttons (numbered), restore dialog
    await open('/admin?tab=backups')
    await expect(page.getByTestId('week-preview')).toBeVisible()
    await expect(page.getByTestId('backup-table').locator('tbody tr').first()).toBeVisible()
    await scrub(page)
    const schedule = cards(page).nth(0)
    await mark(schedule.locator('div.bg-surface-2').first(), 1)
    await mark(schedule.getByRole('switch').nth(1).locator('xpath=ancestor::div[contains(@class,"flex-col")][1]'), 2)
    await mark(schedule.getByRole('radiogroup').first(), 3)
    await mark(schedule.getByRole('switch').nth(3).locator('xpath=ancestor::div[contains(@class,"justify-between")][1]'), 4)
    await mark(schedule.locator('input[name="keepRecent"]').locator('xpath=ancestor::div[contains(@class,"grid")][1]'), 5)
    await shot(schedule, lang, 'zeitplan')
    await clearMarks(page)

    await shot(cards(page).nth(1), lang, 'vorschau')

    const list = cards(page).nth(2)
    await mark(page.getByTestId('backup-now'), 1)
    await mark(page.getByTestId('download-current'), 2)
    await mark(page.getByTestId('upload-backup'), 3)
    await shot(list, lang, 'sicherungen')
    await clearMarks(page)

    await page.getByTestId('restore').first().click()
    const restore = page.getByRole('alertdialog')
    await expect(restore).toBeVisible()
    await inputIn(restore, 'reauthPassword').fill(MIRA.password)
    await page.waitForTimeout(400)
    await shot(restore, lang, 'wiederherstellen')
    await page.keyboard.press('Escape')
    await expect(restore).toBeHidden()

    await endSession(context, api)
  })
}

// ---- 4. steps that change something (last, so both languages saw the same data above) -----------------------------------------

for (const lang of LANGS) {
  test(`figures with changes (${lang})`, async ({ browser }) => {
    // An error message with its Copy button: a wrong password
    {
      const { context, page } = await openWindow(browser, lang)
      await page.goto('/login')
      await field(page, 'username').fill(MIRA.username)
      await field(page, 'password').fill('das ist nicht das Passwort')
      await page.locator('button[type="submit"]').click()
      const notice = page.getByTestId('error-notice')
      await expect(notice).toBeVisible()
      await shot(notice, lang, 'fehlermeldung')
      await context.close()
    }

    // Two-factor setup of the demo administrator: QR code, recovery codes - then switched off again
    const api = await signInApi(MIRA)
    const { context, page } = await openWindow(browser, lang, api)
    await page.goto('/settings?tab=security')
    await expect(page.getByTestId('current-user')).toContainText(MIRA.displayName)
    await page.getByTestId('totp-start').click()
    const secret = (await page.getByTestId('totp-secret').innerText()).trim()
    await expect(page.getByRole('img', { name: /QR/ })).toBeVisible()
    await shot(cards(page).nth(1), lang, 'zwei-faktor-einrichten')

    await field(page, 'code').fill(totp(secret))
    // If the server asks for the account password again here, it is entered the same way (field name "password")
    await page.getByRole('button', { name: lang === 'de' ? 'Aktivieren' : 'Turn on' }).click()
    const codes = page.getByTestId('recovery-codes')
    await expect(codes).toBeVisible()
    await expect(codes.locator('li')).toHaveCount(10)
    const recoveryCode = (await codes.locator('li').first().innerText()).trim()
    await shot(cards(page).nth(1), lang, 'wiederherstellungscodes')
    await page.getByTestId('totp-done').click()

    const form = page.getByTestId('disable-2fa-form')
    await form.locator('input[name="password"]').fill(MIRA.password)
    await form.locator('input[name="code"]').fill(recoveryCode)
    await page.getByTestId('disable-2fa').click()
    await expect(page.getByTestId('totp-start')).toBeVisible()

    await endSession(context, api)
  })
}
