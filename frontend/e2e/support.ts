import { createHmac } from 'node:crypto'
import { expect } from '@playwright/test'
import type { APIRequestContext, Browser, BrowserContext, Locator, Page } from '@playwright/test'

/**
 * The first account of the E2E instance (created by the setup test, an administrator). The suite runs serially and every
 * test leaves the account as it found it.
 */
export const OWNER = {
  username: 'e2e-owner',
  displayName: 'E2E Owner',
  password: 'correct horse battery staple e2e',
} as const

/** Fields are found by their name and buttons by their type, so the helpers work in every language the suite runs in. */
export const field = (page: Page, name: string) => page.locator(`input[name="${name}"]`)

export async function signIn(page: Page, password: string = OWNER.password, username: string = OWNER.username) {
  await page.goto('/login')
  await field(page, 'username').fill(username)
  await field(page, 'password').fill(password)
  await page.locator('button[type="submit"]').click()
}

export async function signInComplete(page: Page) {
  await signIn(page)
  await expect(page.getByTestId('current-user')).toContainText(OWNER.displayName)
}

/** Opens a page of the signed-in app with the session saved by the setup test (no new sign-in). */
export async function openApp(page: Page, path = '/') {
  await page.goto(path)
  await expect(page.getByTestId('current-user')).toContainText(OWNER.displayName)
}

/** For tests that sign in or out themselves: an empty browser, so the saved session stays untouched. */
export const SIGNED_OUT = { cookies: [], origins: [] }

export async function signOut(page: Page) {
  await page.getByTestId('sign-out').click()
  await expect(page).toHaveURL(/\/login$/)
}

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s) - what an authenticator app computes from the shared key. */
export function totp(secret: string, offsetSteps = 0): string {
  const key = base32Decode(secret.replace(/\s+/g, '').toUpperCase())
  const counter = Math.floor(Date.now() / 1000 / 30) + offsetSteps
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', key).update(message).digest()
  const offset = hmac[hmac.length - 1]! & 0x0f
  const binary = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return binary.toString().padStart(6, '0')
}

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const char of input.replace(/=+$/, '')) {
    const value = alphabet.indexOf(char)
    if (value < 0) throw new Error(`Invalid base32 character: ${char}`)
    bits += value.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

/** Puts the page into a theme before anything renders ("light" or "dark"). */
export async function useTheme(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((value) => localStorage.setItem('cv.theme', value), theme)
}

/** WCAG 2.x contrast ratio between two CSS colours, computed in the page (any colour syntax, via a canvas). */
export async function contrastBetween(page: Page, foreground: string, background: string): Promise<number> {
  return page.evaluate(
    ([fg, bg]) => {
      const toRgb = (color: string) => {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        const context = canvas.getContext('2d')!
        context.fillStyle = color
        context.fillRect(0, 0, 1, 1)
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data
        return [r!, g!, b!]
      }
      const channel = (value: number) => {
        const s = value / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      const luminance = ([r, g, b]: number[]) => 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!)
      const l1 = luminance(toRgb(fg!))
      const l2 = luminance(toRgb(bg!))
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    },
    [foreground, background] as const,
  )
}

/** The computed value of a design token on <html>. */
export function token(page: Page, name: string): Promise<string> {
  return page.evaluate((property) => getComputedStyle(document.documentElement).getPropertyValue(property).trim(), `--${name}`)
}

/** Waits up to `timeout` ms for the locator to be visible; false instead of an error when it is not. */
export async function appears(locator: Locator, timeout = 3_000): Promise<boolean> {
  return locator.waitFor({ state: 'visible', timeout }).then(
    () => true,
    () => false,
  )
}

/**
 * Position and size of everything a user looks at (cards, headings, labels, fields, buttons, links) plus the usable page
 * width, which changes when a scrollbar appears. Two snapshots are equal exactly when nothing moved, grew or shrank. The
 * messages themselves are not listed: they may change - the things around them may not.
 */
export async function layoutSnapshot(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const snapshot: Record<string, string> = { 'page width': String(document.documentElement.clientWidth) }
    const seen: Record<string, number> = {}
    const round = (value: number) => Math.round(value * 10) / 10
    for (const element of document.querySelectorAll('section, h1, h2, label, input, select, textarea, button, a[href]')) {
      const box = element.getBoundingClientRect()
      if (box.width === 0 && box.height === 0) continue
      // The brand panel and the sidebar stick to the window: they would only look "moved" when the page scrolls.
      if (element.closest('aside')) continue
      // Messages are what is supposed to appear: their own parts are not part of "the rest of the page".
      if (element.closest('[role="alert"], [role="status"], [role="note"]')) continue
      const tag = element.tagName.toLowerCase()
      seen[tag] = (seen[tag] ?? 0) + 1
      // A card is named by its heading, a field by its name: their text contains what appears and disappears.
      const label = tag === 'section' ? element.querySelector('h1, h2')?.textContent : tag === 'textarea' ? '' : element.textContent
      const name = element.getAttribute('name') ?? label?.trim().slice(0, 24) ?? ''
      snapshot[`${tag}#${seen[tag]} ${name}`] = `x ${round(box.x)}, y ${round(box.y + window.scrollY)}, ${round(box.width)} x ${round(box.height)}`
    }
    return snapshot
  })
}

/** The layout once the entrance animation is over: the same snapshot twice in a row, 150 ms apart. */
export async function settledLayout(page: Page): Promise<Record<string, string>> {
  let previous = await layoutSnapshot(page)
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(150)
    const current = await layoutSnapshot(page)
    if (JSON.stringify(current) === JSON.stringify(previous)) return current
    previous = current
  }
  throw new Error('The layout never settled (still moving after 3 s).')
}

/** Nothing may move when a message appears or disappears: runs `act` and asserts the layout is what it was before. */
export async function expectNothingMoves(page: Page, what: string, act: () => Promise<void>, expectedBefore?: Record<string, string>) {
  const before = expectedBefore ?? (await settledLayout(page))
  await act()
  const after = await settledLayout(page)
  expect(after, `layout changed: ${what}`).toEqual(before)
}

// ---- test accounts and direct API calls ----------------------------------------------------------------------------------------
// The suite prepares and cleans up its data through the real API (same server, same rules as the UI) and checks the outcome in
// the browser. Every test uses its own made-up account names and removes them again.

/** The password of every extra test account (made up, long enough for the server's policy). */
export const MEMBER_PASSWORD = 'member passphrase for the e2e tests'

/** Anything with an API request context that carries cookies: a page or a browser context. */
type Requester = { request: APIRequestContext }

export interface ApiAnswer<T> {
  status: number
  body: T
}

/** Calls the real API with the CSRF header the server demands; the answer is returned whatever the status is. */
export async function apiCall<T = unknown>(who: Requester, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, data?: unknown): Promise<ApiAnswer<T>> {
  const response = await who.request.fetch(path, { method, headers: { 'X-Cv-Request': '1' }, ...(data === undefined ? {} : { data }) })
  const text = await response.text()
  return { status: response.status(), body: (text === '' ? null : JSON.parse(text)) as T }
}

/** Like {@link apiCall}, but a status outside 2xx is an error of the test (used for preparing and cleaning up data). */
export async function apiOk<T = unknown>(who: Requester, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, data?: unknown): Promise<T> {
  const answer = await apiCall<T>(who, method, path, data)
  if (answer.status < 200 || answer.status > 299) throw new Error(`${method} ${path} -> ${answer.status}: ${JSON.stringify(answer.body)}`)
  return answer.body
}

export interface ListedUser {
  id: string
  username: string
  displayName: string
  role: 'admin' | 'user'
  disabled: boolean
  twoFactorEnabled: boolean
}

/** Creates an account through the admin API (the caller is signed in as an administrator). */
export async function createUser(
  who: Requester,
  username: string,
  options: { role?: 'admin' | 'user'; displayName?: string; password?: string } = {},
): Promise<ListedUser> {
  return apiOk<ListedUser>(who, 'POST', '/api/admin/users', {
    username,
    displayName: options.displayName ?? username,
    password: options.password ?? MEMBER_PASSWORD,
    role: options.role ?? 'user',
  })
}

/** Deletes the named accounts when they exist (cleanup that must also work after a half-finished test). */
export async function removeUsers(who: Requester, ...usernames: string[]) {
  const users = await apiOk<ListedUser[]>(who, 'GET', '/api/admin/users')
  for (const user of users.filter((candidate) => usernames.includes(candidate.username))) {
    await apiOk(who, 'DELETE', `/api/admin/users/${user.id}`)
  }
}

export async function findUser(who: Requester, username: string): Promise<ListedUser | undefined> {
  const users = await apiOk<ListedUser[]>(who, 'GET', '/api/admin/users')
  return users.find((candidate) => candidate.username === username)
}

/** An empty browser window of its own (German, 1280 px) - several people at once in one test. */
export async function newBrowserContext(browser: Browser, viewport = { width: 1280, height: 800 }): Promise<BrowserContext> {
  return browser.newContext({ storageState: SIGNED_OUT, locale: 'de-DE', viewport })
}

/** A fresh browser window with an account signed in through the API (without a second factor). Close the context afterwards. */
export async function signedInContext(browser: Browser, username: string, password: string = MEMBER_PASSWORD): Promise<{ context: BrowserContext; page: Page }> {
  const context = await newBrowserContext(browser)
  await apiOk(context, 'POST', '/api/auth/login', { username, password })
  return { context, page: await context.newPage() }
}

/** Turns two-factor authentication on for the signed-in account through the API; returns the shared key and the recovery codes. */
export async function enableTotp(who: Requester, password: string = MEMBER_PASSWORD): Promise<{ secret: string; recoveryCodes: string[] }> {
  const setup = await apiOk<{ secret: string }>(who, 'POST', '/api/account/2fa/totp/setup')
  const enabled = await apiOk<{ recoveryCodes: string[] }>(who, 'POST', '/api/account/2fa/totp/enable', { code: totp(setup.secret), currentPassword: password })
  return { secret: setup.secret, recoveryCodes: enabled.recoveryCodes }
}

/**
 * A fresh browser window signed in as an account that has two-factor authentication, with one of its recovery codes (single use).
 * For cleanup that must work even when a test died with a closed window: the code was not used by the test itself.
 */
export async function signInWithRecoveryCode(browser: Browser, username: string, recoveryCode: string, password: string = MEMBER_PASSWORD): Promise<BrowserContext> {
  const context = await newBrowserContext(browser)
  const first = await apiOk<{ challengeId: string }>(context, 'POST', '/api/auth/login', { username, password })
  await apiOk(context, 'POST', '/api/auth/login/2fa', { challengeId: first.challengeId, code: recoveryCode })
  return context
}

export interface InstanceSettings {
  registrationOpen: boolean
  requireTwoFactor: boolean
}

export const setInstanceSettings = (who: Requester, settings: InstanceSettings) => apiOk<InstanceSettings>(who, 'PUT', '/api/admin/settings', settings)

/** Opens a page of an account that is already signed in (waits for the app shell). */
export async function openAs(page: Page, displayName: string, path = '/') {
  await page.goto(path)
  await expect(page.getByTestId('current-user')).toContainText(displayName)
}

/** Types the current password into the step-up dialog and presses its confirm button. */
export async function confirmStepUp(page: Page, password: string = OWNER.password) {
  const dialog = page.getByRole('alertdialog')
  await dialog.locator('input[name="reauthPassword"]').fill(password)
  await page.getByTestId('reauth-confirm').click()
}

// ---- backups -------------------------------------------------------------------------------------------------------------------

export interface ListedBackup {
  id: string
  file: string
  createdAt: string
  sizeBytes: number
  kind: string
  tier: string
}

export const listBackups = (who: Requester) => apiOk<ListedBackup[]>(who, 'GET', '/api/admin/backups')

/** Makes sure at least one backup exists (a fresh instance has none; "nothing changed" is fine when there is one) and returns the newest. */
export async function ensureBackup(who: Requester): Promise<ListedBackup> {
  const answer = await apiCall(who, 'POST', '/api/admin/backups')
  if (answer.status !== 201 && answer.status !== 409) throw new Error(`POST /api/admin/backups -> ${answer.status}: ${JSON.stringify(answer.body)}`)
  const newest = (await listBackups(who)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  if (!newest) throw new Error('There is still no backup after "back up now".')
  return newest
}

/** The bytes of a backup file, fetched with the step-up the server demands (the password). */
export async function downloadBackupBytes(who: Requester, id: string, password: string = OWNER.password): Promise<Buffer> {
  const response = await who.request.fetch(`/api/admin/backups/${id}/download`, { method: 'POST', headers: { 'X-Cv-Request': '1' }, data: { password } })
  if (!response.ok()) throw new Error(`Download of ${id} failed: ${response.status()} ${await response.text()}`)
  return response.body()
}

/** Uploads a backup file through the API (multipart, with the step-up password); the answer is returned whatever the status is. */
export async function uploadBackupApi(who: Requester, bytes: Buffer, name = 'e2e-upload.db', password: string = OWNER.password) {
  const response = await who.request.fetch('/api/admin/backups/upload', {
    method: 'POST',
    headers: { 'X-Cv-Request': '1' },
    multipart: { file: { name, mimeType: 'application/octet-stream', buffer: bytes }, password },
  })
  const text = await response.text()
  return { status: response.status(), body: text === '' ? null : JSON.parse(text) }
}

/** Deletes every uploaded backup (tier "uploaded"): the uploads of a test are never part of what other tests expect. */
export async function deleteUploadedBackups(who: Requester, password: string = OWNER.password) {
  for (const backup of (await listBackups(who)).filter((entry) => entry.kind === 'uploaded')) {
    await apiOk(who, 'DELETE', `/api/admin/backups/${backup.id}`, { password })
  }
}

export interface BackupSettingsInfo {
  automaticEnabled: boolean
  onStart: boolean
  beforeShutdown: boolean
  schedule: { kind: 'off' | 'interval' | 'times'; intervalHours: number; times: string[]; weekdays: number[] }
  catchUpMissed: boolean
  keepRecent: number
  keepDailyDays: number
  nextRuns: string[]
  timeZone: string
  directory: string
}

export const readBackupSettings = (who: Requester) => apiOk<BackupSettingsInfo>(who, 'GET', '/api/admin/backups/settings')

/** Writes back the editable part of settings read earlier (cleanup of tests that save a schedule). */
export async function writeBackupSettings(who: Requester, info: BackupSettingsInfo) {
  const { nextRuns: _runs, timeZone: _zone, directory: _directory, ...editable } = info
  await apiOk(who, 'PUT', '/api/admin/backups/settings', editable)
}
