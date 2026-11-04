import { createHmac } from 'node:crypto'
import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

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

export async function signIn(page: Page, password: string = OWNER.password) {
  await page.goto('/login')
  await field(page, 'username').fill(OWNER.username)
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
