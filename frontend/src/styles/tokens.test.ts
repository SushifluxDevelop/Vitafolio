import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrastRatio, parseThemes } from './contrast'

const css = readFileSync(resolve(import.meta.dirname, 'tokens.css'), 'utf8')
const themes = parseThemes(css)

/** [foreground token, background token, minimum ratio, what it is]. 4.5 for text, 3 for large text and UI parts. */
const PAIRS: [string, string, number, string][] = [
  ['ink', 'bg', 4.5, 'body text on the page'],
  ['ink', 'surface', 4.5, 'body text on a card'],
  ['ink', 'surface-2', 4.5, 'body text on a hovered or striped row'],
  ['ink', 'bg-sunken', 4.5, 'body text on a sunken area'],
  ['ink-muted', 'bg', 4.5, 'secondary text on the page'],
  ['ink-muted', 'surface', 4.5, 'secondary text on a card'],
  ['ink-muted', 'surface-2', 4.5, 'secondary text on a hovered or striped row'],
  ['ink-muted', 'bg-sunken', 4.5, 'secondary text on a sunken area'],
  ['link', 'bg', 4.5, 'link on the page'],
  ['link', 'surface', 4.5, 'link on a card'],
  ['gold-text', 'bg', 4.5, 'small gold text on the page'],
  ['gold-text', 'surface', 4.5, 'small gold text on a card'],
  ['confirm-ink', 'confirm', 4.5, 'confirm button label'],
  ['confirm-ink', 'confirm-hover', 4.5, 'confirm button label (hover)'],
  ['create-ink', 'create', 4.5, 'create button label'],
  ['create-ink', 'create-hover', 4.5, 'create button label (hover)'],
  ['select-ink', 'select-bg', 4.5, 'active tab / filter / navigation entry'],
  ['danger-ink', 'danger', 4.5, 'destructive button label'],
  ['danger-ink', 'danger-hover', 4.5, 'destructive button label (hover)'],
  ['danger', 'surface', 4.5, 'danger text on a card'],
  ['danger', 'bg', 4.5, 'danger text on the page'],
  ['danger-soft-ink', 'danger-soft', 4.5, 'error notice'],
  ['success-soft-ink', 'success-soft', 4.5, 'success notice'],
  ['warning-soft-ink', 'warning-soft', 4.5, 'warning notice'],
  // UI parts: borders that identify a control, indicators, focus ring, toggle track and knob.
  ['line-strong', 'surface', 3, 'input border on a card'],
  ['line-strong', 'bg', 3, 'input border on the page'],
  ['focus', 'bg', 3, 'focus ring on the page'],
  ['focus', 'surface', 3, 'focus ring on a card'],
  ['indicator', 'surface', 3, 'active tab indicator'],
  ['indicator', 'bg', 3, 'active navigation indicator'],
  ['toggle-on', 'surface', 3, 'toggle track "on"'],
  ['toggle-off', 'surface', 3, 'toggle track "off"'],
  ['toggle-on', 'bg', 3, 'toggle track "on" on the page'],
  ['toggle-off', 'bg', 3, 'toggle track "off" on the page'],
  ['toggle-knob', 'toggle-on', 3, 'toggle knob on "on"'],
  ['toggle-knob', 'toggle-off', 3, 'toggle knob on "off"'],
  ['heart', 'surface', 3, 'green heart'],
  ['heart', 'bg', 3, 'green heart on the page'],
]

describe.each(['light', 'dark'] as const)('contrast of the %s theme', (theme) => {
  const tokens = themes[theme]
  it.each(PAIRS)('%s on %s needs %s:1 (%s)', (foreground, background, minimum) => {
    const fg = tokens[foreground]
    const bg = tokens[background]
    expect(fg, `token --${foreground} missing in ${theme}`).toBeDefined()
    expect(bg, `token --${background} missing in ${theme}`).toBeDefined()
    expect(contrastRatio(fg!, bg!)).toBeGreaterThanOrEqual(minimum)
  })
})
