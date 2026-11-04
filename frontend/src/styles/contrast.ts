/** WCAG 2.x contrast maths for the token check; hex colours only (the tokens are plain hex values). */

function channel(value: number): number {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) throw new Error(`Not a #rrggbb colour: ${hex}`)
  const n = parseInt(match[1]!, 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

/** The WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a)
  const l2 = luminance(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

/** Reads the custom properties of the light (":root") and dark ("[data-theme='dark']") blocks of tokens.css. */
export function parseThemes(css: string): Record<'light' | 'dark', Record<string, string>> {
  const read = (selectorStart: string) => {
    const start = css.indexOf(selectorStart)
    if (start < 0) throw new Error(`Block not found: ${selectorStart}`)
    const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
    return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]))
  }
  const light = read(':root')
  const dark = { ...light, ...read("[data-theme='dark']") }
  return { light, dark }
}
