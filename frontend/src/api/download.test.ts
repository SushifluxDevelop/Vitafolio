import { describe, expect, it } from 'vitest'
import { filenameFromDisposition, safeFilename } from './download'

describe('filenameFromDisposition', () => {
  it('reads a quoted name', () => {
    expect(filenameFromDisposition('attachment; filename="backup-2026-11-04-0200.db"')).toBe('backup-2026-11-04-0200.db')
  })

  it('prefers the extended name', () => {
    expect(filenameFromDisposition("attachment; filename=\"fallback.db\"; filename*=UTF-8''sicherung%20%C3%A4.db")).toBe('sicherung ä.db')
  })

  it('returns undefined without a header', () => {
    expect(filenameFromDisposition(null)).toBeUndefined()
  })
})

describe('safeFilename', () => {
  it('removes path characters and falls back for empty or dot names', () => {
    expect(safeFilename('../../etc/passwd', 'x.db')).toBe('.._.._etc_passwd')
    expect(safeFilename('a\\b:c.db', 'x.db')).toBe('a_b_c.db')
    expect(safeFilename('..', 'x.db')).toBe('x.db')
    expect(safeFilename(undefined, 'x.db')).toBe('x.db')
  })
})
