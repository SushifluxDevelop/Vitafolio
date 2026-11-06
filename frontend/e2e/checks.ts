import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

// Helpers for the checks that go beyond a journey: complete messages, contrast of what is really rendered, edited backup files.

/**
 * A genuine backup with one SQL statement added (an extra table, an extra trigger): what somebody who edits a backup by hand
 * and uploads it again would produce. Written to a temporary file and read back, the folder is removed afterwards.
 */
export function editBackup(genuine: Buffer, statement: string): Buffer {
  const folder = mkdtempSync(join(tmpdir(), 'cv-e2e-edited-'))
  try {
    const path = join(folder, 'edited.db')
    writeFileSync(path, genuine)
    const database = new DatabaseSync(path)
    // Plain journal mode, so everything lives in the one file that is read back
    database.exec('PRAGMA journal_mode = DELETE')
    database.exec(statement)
    database.close()
    return readFileSync(path)
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
}

/**
 * A message is shown in full: nothing clips it (no ellipsis, no line clamp, no hidden overflow that cuts text off) on the
 * element or any ancestor, and its box is not wider than the window. Scrolling containers (a dialog body that scrolls
 * internally) are fine: nothing is lost there.
 */
export async function expectNotTruncated(locator: Locator, what = 'message') {
  const problems = await locator.evaluate((element) => {
    const found: string[] = []
    for (let node: Element | null = element; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node)
      const label = node.tagName.toLowerCase() + (node.getAttribute('data-testid') ? '[' + node.getAttribute('data-testid') + ']' : '')
      if (style.textOverflow === 'ellipsis') found.push(label + ': text-overflow: ellipsis')
      const clamp = style.getPropertyValue('-webkit-line-clamp')
      if (clamp !== '' && clamp !== 'none') found.push(label + ': line-clamp')
      const cutsX = style.overflowX === 'hidden' && node.scrollWidth > node.clientWidth + 1
      const cutsY = style.overflowY === 'hidden' && node.scrollHeight > node.clientHeight + 1
      if (cutsX || cutsY) found.push(label + ': overflow hidden cuts ' + node.scrollWidth + 'x' + node.scrollHeight + ' down to ' + node.clientWidth + 'x' + node.clientHeight)
    }
    if (element.getBoundingClientRect().right > document.documentElement.clientWidth + 1) found.push('wider than the window')
    return found
  })
  expect(problems, what + ' is cut off').toEqual([])
}

export interface ContrastFinding {
  text: string
  ratio: number
  needed: number
  foreground: string
  background: string
  where: string
}

/**
 * Walks every visible piece of text on the page, works out its real colour and the real background behind it (all translucent
 * layers of the ancestors composited), and returns the pieces below WCAG 2.x (4.5:1; 3:1 for large text: 24 px, or 18.66 px
 * bold). Disabled controls are exempt (WCAG). Text over a gradient or an image cannot be measured this way and is counted
 * separately, as is text that is faded (mid-animation or deliberately translucent).
 */
export async function scanTextContrast(page: Page, scope?: Locator): Promise<{ measured: number; unmeasured: number; unmeasuredTexts: string[]; findings: ContrastFinding[] }> {
  const root = scope ? await scope.elementHandle() : null
  return page.evaluate((rootElement) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    type Rgba = [number, number, number, number]
    const parse = (value: string): Rgba => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = '#000'
      context.fillStyle = value
      context.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
      return [r!, g!, b!, a! / 255]
    }
    const over = (top: Rgba, bottom: Rgba): Rgba => {
      const alpha = top[3] + bottom[3] * (1 - top[3])
      if (alpha === 0) return [0, 0, 0, 0]
      const mixed = [0, 1, 2].map((i) => (top[i]! * top[3] + bottom[i]! * bottom[3] * (1 - top[3])) / alpha)
      return [mixed[0]!, mixed[1]!, mixed[2]!, alpha]
    }
    const channel = (value: number) => {
      const s = value / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    const luminance = (c: Rgba) => 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2])
    const ratio = (a: Rgba, b: Rgba) => {
      const l1 = luminance(a)
      const l2 = luminance(b)
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    }
    const text = (c: Rgba) => 'rgb(' + c.slice(0, 3).map(Math.round).join(', ') + ')'

    /**
     * The colours that can be behind an element: translucent layers composited bottom-up. A gradient contributes every one of its
     * colour stops (the worst case is measured); an image (url) cannot be measured and gives null.
     */
    const backgroundsOf = (element: Element | null): Rgba[] | null => {
      if (!element) return [[255, 255, 255, 1]]
      const style = getComputedStyle(element)
      const own = parse(style.backgroundColor)
      let below: Rgba[] | null
      if (own[3] === 1) below = [own]
      else {
        const parent = backgroundsOf(element.parentElement)
        below = parent ? parent.map((color) => over(own, color)) : null
      }
      if (!below) return null
      if (style.backgroundImage === 'none') return below
      // Layers are listed top first; each one is composited over what is below it (an opaque layer hides everything under it).
      const layers: string[] = []
      let depth = 0
      let start = 0
      const source = style.backgroundImage
      for (let index = 0; index < source.length; index++) {
        if (source[index] === '(') depth++
        else if (source[index] === ')') depth--
        else if (source[index] === ',' && depth === 0) {
          layers.push(source.slice(start, index))
          start = index + 1
        }
      }
      layers.push(source.slice(start))
      let current: Rgba[] = below
      for (const layer of layers.reverse()) {
        if (!/gradient\(/.test(layer) || /url\(/.test(layer)) return null
        const stops = (layer.match(/(rgba?\([^)]*\)|color\([^)]*\)|oklch\([^)]*\)|oklab\([^)]*\)|lab\([^)]*\)|lch\([^)]*\)|hsla?\([^)]*\)|#[0-9a-fA-F]{3,8})/g) ?? []).map(parse)
        const next = current.flatMap((color) => stops.map((stop) => over(stop, color)))
        current = [...new Map(next.map((color) => [color.map((value) => Math.round(value)).join(','), color] as const)).values()].slice(0, 400)
      }
      return current
    }
    const faded = (element: Element) => {
      for (let node: Element | null = element; node; node = node.parentElement) if (Number(getComputedStyle(node).opacity) < 1) return true
      return false
    }

    const findings: ContrastFinding[] = []
    let measured = 0
    let unmeasured = 0
    const unmeasuredTexts: string[] = []
    const start: Element = (rootElement as Element | null) ?? document.body
    const walker = document.createTreeWalker(start, NodeFilter.SHOW_TEXT)
    const seen = new Set<Element>()
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement
      if (!element || seen.has(element) || !node.textContent?.trim()) continue
      seen.add(element)
      if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName)) continue
      const style = getComputedStyle(element)
      const box = element.getBoundingClientRect()
      if (style.visibility === 'hidden' || style.display === 'none' || box.width === 0 || box.height === 0) continue
      if (element.closest('.sr-only, [aria-hidden="true"]')) continue
      if (element.closest(':disabled, [aria-disabled="true"], fieldset:disabled')) continue
      if (faded(element)) {
        unmeasured++
        continue
      }
      const backgrounds = backgroundsOf(element)
      if (!backgrounds) {
        unmeasured++
        unmeasuredTexts.push(node.textContent.trim().slice(0, 30))
        continue
      }
      const size = parseFloat(style.fontSize)
      const bold = Number(style.fontWeight) >= 700
      const needed = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5
      measured++
      // The worst case over everything that can be behind the text
      let value = Infinity
      let worst: { foreground: Rgba; background: Rgba } | null = null
      for (const candidate of backgrounds) {
        const foreground = over(parse(style.color), candidate)
        const current = ratio(foreground, candidate)
        if (current < value) {
          value = current
          worst = { foreground, background: candidate }
        }
      }
      const foreground = worst!.foreground
      const background = worst!.background
      if (value < needed) {
        findings.push({
          text: node.textContent.trim().slice(0, 50),
          ratio: Math.round(value * 100) / 100,
          needed,
          foreground: text(foreground),
          background: text(background),
          where: element.tagName.toLowerCase() + '.' + String(element.className).split(/\s+/).slice(0, 3).join('.'),
        })
      }
    }
    return { measured, unmeasured, unmeasuredTexts: unmeasuredTexts.slice(0, 10), findings }
  }, root)
}

/**
 * Waits until the fractional opacities on the page stop changing (entrance fades are over): measuring earlier would see
 * half-transparent text. Elements that stay translucent on purpose do not hold it up.
 */
export async function waitForCalmPage(page: Page) {
  let previous = ''
  await expect
    .poll(async () => {
      const current = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('body *')]
          .map((element, index) => ({ index, opacity: Number(getComputedStyle(element).opacity) }))
          .filter((entry) => entry.opacity > 0 && entry.opacity < 1)
          .map((entry) => entry.index + ':' + entry.opacity.toFixed(2))
          .join(','),
      )
      const calm = current === previous
      previous = current
      return calm
    })
    .toBe(true)
}
