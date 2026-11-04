import { describe, expect, it } from 'vitest'
import de from './locales/de.json'
import en from './locales/en.json'

function keys(node: unknown, prefix = ''): string[] {
  if (node === null || typeof node !== 'object') return [prefix]
  return Object.entries(node).flatMap(([key, value]) => keys(value, prefix ? `${prefix}.${key}` : key))
}

/** Plural forms differ per language; compare the base key only. */
const base = (key: string) => key.replace(/_(one|other)$/, '')

describe('locales', () => {
  it('have exactly the same keys in German and English', () => {
    const german = new Set(keys(de).map(base))
    const english = new Set(keys(en).map(base))
    expect([...german].filter((key) => !english.has(key))).toEqual([])
    expect([...english].filter((key) => !german.has(key))).toEqual([])
  })

  it('have no empty text', () => {
    for (const locale of [de, en]) {
      const values: string[] = []
      const walk = (node: unknown) => {
        if (typeof node === 'string') values.push(node)
        else if (node && typeof node === 'object') Object.values(node).forEach(walk)
      }
      walk(locale)
      expect(values.filter((value) => value.trim() === '')).toEqual([])
    }
  })

  it('use the same placeholders in both languages', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort().join(',')
    const flat = (locale: unknown) => {
      const result = new Map<string, string>()
      const walk = (node: unknown, path: string) => {
        if (typeof node === 'string') result.set(base(path), node)
        else if (node && typeof node === 'object') for (const [key, value] of Object.entries(node)) walk(value, path ? `${path}.${key}` : key)
      }
      walk(locale, '')
      return result
    }
    const english = flat(en)
    for (const [key, text] of flat(de)) {
      expect(placeholders(english.get(key) ?? ''), key).toBe(placeholders(text))
    }
  })
})
