import { expect, test } from '@playwright/test'
import { contrastBetween, openApp, SIGNED_OUT, token, useTheme } from './support'

// WCAG 2.x on the main token pairs, computed from the real rendered values in BOTH themes (4.5:1 for text, 3:1 for UI
// parts). The full pair list lives in the unit test of the token file; this one proves it for what the browser renders.
const PAIRS: [string, string, number][] = [
  ['ink', 'bg', 4.5],
  ['ink', 'surface', 4.5],
  ['ink-muted', 'bg', 4.5],
  ['ink-muted', 'surface', 4.5],
  ['link', 'surface', 4.5],
  ['confirm-ink', 'confirm', 4.5],
  ['create-ink', 'create', 4.5],
  ['danger-ink', 'danger', 4.5],
  ['select-ink', 'select-bg', 4.5],
  ['line-strong', 'surface', 3],
  ['focus', 'surface', 3],
  ['toggle-on', 'surface', 3],
  ['toggle-off', 'surface', 3],
]

for (const theme of ['light', 'dark'] as const) {
  test(`token pairs keep their contrast in the ${theme} theme`, async ({ browser }) => {
    const context = await browser.newContext({ storageState: SIGNED_OUT })
    const page = await context.newPage()
    await useTheme(page, theme)
    await page.goto('/login')
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    for (const [foreground, background, minimum] of PAIRS) {
      const ratio = await contrastBetween(page, await token(page, foreground), await token(page, background))
      expect(ratio, `${theme}: --${foreground} on --${background}`).toBeGreaterThanOrEqual(minimum)
    }
    await context.close()
  })

  test(`rendered text on the overview is readable in the ${theme} theme`, async ({ page }) => {
    await openApp(page)
    // The account's saved theme wins over the browser's, so choose it the way a user does (and put it back afterwards).
    await page.getByRole('radio', { name: theme === 'light' ? 'Hell' : 'Dunkel' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    const shown = theme
    const background = await page.evaluate(() => getComputedStyle(document.querySelector('main')!).backgroundColor)
    const text = await page.locator('main section h2').first().evaluate((element) => getComputedStyle(element).color)
    expect(await contrastBetween(page, text, background), `${shown} theme`).toBeGreaterThanOrEqual(4.5)
    await page.getByRole('radio', { name: 'System' }).click()
  })
}
