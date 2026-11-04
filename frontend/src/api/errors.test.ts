import i18n from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'
import '../i18n'
import { ApiError } from './client'
import { copyableError, describeError, fieldErrors } from './errors'

beforeAll(async () => {
  await i18n.changeLanguage('de')
})

const t = i18n.t.bind(i18n)

describe('describeError', () => {
  it('shows the translated text for the server code with its params', () => {
    const error = new ApiError(429, { code: 'rate_limited' }, 42)
    expect(describeError(t, error).message).toBe('Zu viele Versuche. Bitte in 42 Sekunden noch einmal probieren.')
  })

  it('does not promise a number of seconds the server did not give', () => {
    const error = new ApiError(429, { code: 'rate_limited' })
    expect(describeError(t, error).message).not.toMatch(/\d/)
  })

  it('falls back to the server text for a code it does not know, never to a generic sentence', () => {
    const error = new ApiError(409, { code: 'something.new', detail: 'The thing is not possible.' })
    expect(describeError(t, error).message).toBe('The thing is not possible.')
  })

  it('names the first field problem when a form does not show the field', () => {
    const error = new ApiError(400, { code: 'validation.failed', errors: { keepRecent: [{ code: 'validation.range', params: { min: 5, max: 500 } }] } })
    expect(describeError(t, error).message).toBe('Die Eingaben sind nicht gültig.')
    const noCode = new ApiError(400, { errors: { keepRecent: [{ code: 'validation.range', params: { min: 5, max: 500 } }] } })
    expect(describeError(t, noCode).message).toContain('Der Wert muss zwischen 5 und 500 liegen.')
  })

  it('keeps all technical details complete', () => {
    const error = new ApiError(500, { code: 'server.error', detail: 'Boom', traceId: 'trace-1' })
    expect(describeError(t, error).technical).toEqual(['HTTP 500', 'Fehlercode: server.error', 'Meldung des Servers: Boom', 'Ablaufkennung: trace-1'])
  })

  it('says specifically that the server cannot be reached', () => {
    const error = new ApiError(0, { code: 'network' })
    expect(describeError(t, error).message).toContain('nicht erreichbar')
  })
})

describe('fieldErrors', () => {
  it('translates the first problem per field and lowercases the first letter of the field name', () => {
    const error = new ApiError(400, { errors: { Username: [{ code: 'user.username_taken' }], password: [{ code: 'validation.min_length', params: { min: 12 } }] } })
    expect(fieldErrors(t, error)).toEqual({ username: 'Dieser Benutzername ist schon vergeben.', password: 'Zu kurz: mindestens 12 Zeichen.' })
  })
})

describe('codes the server added later', () => {
  it('shows the maintenance text for the plain and the specific code', () => {
    const plain = describeError(t, new ApiError(503, { code: 'maintenance' })).message
    const specific = describeError(t, new ApiError(503, { code: 'maintenance.busy' })).message
    expect(plain).toBe(specific)
    expect(plain).toContain('gewartet')
  })

  it.each(['backup.restore_failed', 'twofactor.code_already_used', 'twofactor.key_unavailable', 'backup.too_new', 'backup.invalid'])(
    'has a translated text for %s (not the bare code, not the English fallback)',
    (code) => {
      const message = describeError(t, new ApiError(409, { code, detail: 'English fallback' })).message
      expect(message).not.toBe('English fallback')
      expect(message).not.toBe(code)
    },
  )
})

describe('failed restore', () => {
  it('says the previous state came back by itself and names the safety backup', () => {
    const error = new ApiError(500, { code: 'backup.restore_failed', params: { safetyBackup: 'app-1-pre-restore.db', safetyBackupId: 'b9', rolledBack: true } })
    const message = describeError(t, error).message
    expect(message).toContain('automatisch zurückgeholt')
    expect(message).toContain('app-1-pre-restore.db')
  })

  it('says when the previous state could not be brought back and what to do', () => {
    const error = new ApiError(500, { code: 'backup.restore_failed', params: { safetyBackup: 'app-1-pre-restore.db', safetyBackupId: 'b9', rolledBack: false } })
    const message = describeError(t, error).message
    expect(message).toContain('nicht automatisch zurückgeholt')
    expect(message).toContain('app-1-pre-restore.db')
    expect(message).toContain('Stellen Sie diese Sicherung wieder her')
  })
})

describe('codes of the pentest follow-ups', () => {
  it.each([
    ['setup.token_invalid', 'Einrichtungscode stimmt nicht'],
    ['host.not_allowed', 'ALLOWED_HOSTS'],
    ['backup.busy', 'läuft eine Sicherung oder Wiederherstellung'],
  ])('%s has its own text', (code, part) => {
    expect(describeError(t, new ApiError(400, { code, detail: 'English fallback' })).message).toContain(part)
  })

  it('names the real upload limit the server sends', () => {
    expect(describeError(t, new ApiError(409, { code: 'backup.upload_limit', params: { max: 10 } })).message).toBe('Höchstens 10 hochgeladene Sicherungen – bitte erst eine löschen.')
    expect(describeError(t, new ApiError(409, { code: 'backup.upload_limit', params: { max: 25 } })).message).toContain('Höchstens 25 ')
  })

  it('says a file with a different structure is not an unchanged backup of this app', () => {
    const message = describeError(t, new ApiError(400, { code: 'backup.invalid', params: { reason: 'schema_mismatch' } })).message
    expect(message).toContain('keine unveränderte Vitafolio-Sicherung')
    // Any other reason keeps the plain text.
    expect(describeError(t, new ApiError(400, { code: 'backup.invalid', params: { reason: 'integrity' } })).message).toBe('Die Datei ist keine gültige Sicherung dieser App.')
  })

  it('tells too many attempts for one account apart from too many from this address', () => {
    const account = describeError(t, new ApiError(429, { code: 'rate_limited', params: { scope: 'account' } }, 900)).message
    const ip = describeError(t, new ApiError(429, { code: 'rate_limited', params: { scope: 'ip' } }, 42)).message
    expect(account).toBe('Zu viele Versuche für dieses Konto – bitte 15 Minuten warten.')
    expect(ip).toBe('Zu viele Versuche. Bitte in 42 Sekunden noch einmal probieren.')
  })
})

describe('copyableError', () => {
  it('carries message, technical text, version and time', () => {
    const text = copyableError({ message: 'Etwas ging schief.', technical: ['HTTP 500'] }, { version: 'v2026.11.12 (13.557)', title: 'Titel', time: new Date('2026-11-04T12:00:00Z') })
    expect(text).toBe('Titel\nEtwas ging schief.\nHTTP 500\nVersion: v2026.11.12 (13.557)\n2026-11-04T12:00:00.000Z')
  })
})
