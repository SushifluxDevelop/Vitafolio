import { describe, expect, it } from 'vitest'
import type { Rules } from '../api/types'
import {
  displayNameCheck,
  integerCheck,
  isLoginCodeComplete,
  isTotpCodeComplete,
  isValid,
  loginCodeCheck,
  normalizeSetupToken,
  passwordCheck,
  repeatCheck,
  required,
  setupTokenCheck,
  totpCheck,
  userNameCheck,
} from './rules'

const live = { settled: false }
const settled = { settled: true }
const rules: Rules = {
  username: { minLength: 3, maxLength: 32, pattern: '^[A-Za-z0-9._-]+$' },
  displayName: { minLength: 1, maxLength: 64 },
  password: { minLength: 12, maxLength: 128 },
}

describe('password', () => {
  const check = passwordCheck(rules.password)

  it('is required, and too short while typing with the live count', () => {
    expect(check('', live)?.key).toBe('rules.password.required')
    expect(check('short', live)).toEqual({ key: 'rules.password.tooShort', values: { length: 5, min: 12 } })
    expect(check('long enough pass', live)).toBeUndefined()
  })

  it('is too long above the server limit', () => {
    expect(check('x'.repeat(129), live)?.key).toBe('rules.password.tooLong')
  })

  it('only asks for something until the policy is known', () => {
    expect(passwordCheck(undefined)('a', live)).toBeUndefined()
    expect(passwordCheck(undefined)('', live)?.key).toBe('rules.password.required')
  })

  it('lists every message it can show so the room can be reserved', () => {
    expect(check.problems.map((problem) => problem.key)).toEqual(['rules.password.required', 'rules.password.tooShort', 'rules.password.tooLong'])
  })
})

describe('repeat', () => {
  const check = repeatCheck('secret password')

  it('treats an unfinished beginning as work in progress, not as an error', () => {
    expect(check('secret', live)).toBeUndefined()
    expect(check('secret', settled)?.key).toBe('rules.password.mismatch')
  })

  it('flags a repeat that can no longer become the password at once', () => {
    expect(check('sx', live)?.key).toBe('rules.password.mismatch')
  })

  it('accepts the same password and asks for it when empty', () => {
    expect(check('secret password', settled)).toBeUndefined()
    expect(check('', live)?.key).toBe('rules.password.repeatRequired')
  })
})

describe('username and display name', () => {
  const check = userNameCheck(rules.username)

  it('reports a forbidden character before the length', () => {
    expect(check('a b', live)?.key).toBe('rules.userName.characters')
  })

  it('checks the length with the typed count, trimmed like the server', () => {
    expect(check('ab', live)).toEqual({ key: 'rules.userName.tooShort', values: { length: 2, min: 3 } })
    expect(check('  abc  ', live)).toBeUndefined()
    expect(check('a'.repeat(33), live)?.key).toBe('rules.userName.tooLong')
  })

  it('survives a pattern the browser cannot compile instead of throwing while typing', () => {
    expect(() => userNameCheck({ ...rules.username, pattern: '([' })('abc', live)).not.toThrow()
  })

  it('checks the display name length', () => {
    const name = displayNameCheck(rules.displayName)
    expect(name('', live)?.key).toBe('rules.displayName.required')
    expect(name('x'.repeat(65), live)?.key).toBe('rules.displayName.tooLong')
    expect(name('Ada', live)).toBeUndefined()
  })
})

describe('codes', () => {
  it('treats an unfinished authenticator code as fine but a wrong character or too many digits as a problem', () => {
    expect(totpCheck('123', live)).toBeUndefined()
    expect(totpCheck('12a', live)?.key).toBe('rules.totp.digitsOnly')
    expect(totpCheck('1234567', live)?.key).toBe('rules.totp.length')
    expect(totpCheck('123 456', live)).toBeUndefined()
  })

  it('only counts a complete code as sendable', () => {
    expect(isTotpCodeComplete('123456')).toBe(true)
    expect(isTotpCodeComplete('123 456')).toBe(true)
    expect(isTotpCodeComplete('12345')).toBe(false)
    expect(isTotpCodeComplete('12345a')).toBe(false)
  })

  it('accepts an app code or a recovery code at sign-in', () => {
    expect(loginCodeCheck('1234567', live)?.key).toBe('rules.totp.length')
    expect(loginCodeCheck('ab12-cd34-ef56', live)).toBeUndefined()
    expect(isLoginCodeComplete('123456')).toBe(true)
    expect(isLoginCodeComplete('12345')).toBe(false)
    expect(isLoginCodeComplete('abcd-efgh-ijkl')).toBe(true)
    expect(isLoginCodeComplete('')).toBe(false)
  })
})

describe('setup code', () => {
  it('is normalised to groups of four: any case, with or without dashes, spaces or underscores', () => {
    expect(normalizeSetupToken('abcd-efgh-jkmn-pqrs-tuvw-xyz2-3456')).toBe('ABCD-EFGH-JKMN-PQRS-TUVW-XYZ2-3456')
    expect(normalizeSetupToken('abcdefghjkmnpqrstuvwxyz23456')).toBe('ABCD-EFGH-JKMN-PQRS-TUVW-XYZ2-3456')
    expect(normalizeSetupToken(' abcd efgh_jkmn  pqrs tuvw xyz2 3456 ')).toBe('ABCD-EFGH-JKMN-PQRS-TUVW-XYZ2-3456')
    expect(normalizeSetupToken('abcd-ef')).toBe('ABCD-EF')
    expect(normalizeSetupToken('')).toBe('')
  })

  it('is required, and an unfinished code is no problem until the field is settled', () => {
    expect(setupTokenCheck('', live)?.key).toBe('rules.setupToken.required')
    expect(setupTokenCheck('ABCD-EF', live)).toBeUndefined()
    expect(setupTokenCheck('ABCD-EF', settled)?.key).toBe('rules.setupToken.incomplete')
    expect(setupTokenCheck('ABCD-EFGH-JKMN-PQRS-TUVW-XYZ2-3456', settled)).toBeUndefined()
    expect(setupTokenCheck('abcdefghjkmnpqrstuvwxyz23456', settled)).toBeUndefined()
    expect(setupTokenCheck('ABCD-EFGH-JKMN-PQRS-TUVW-XYZ2', settled)?.key).toBe('rules.setupToken.incomplete')
  })

  it('flags a wrong character or a too long code at once', () => {
    expect(setupTokenCheck('ABCD-EF!H', live)?.key).toBe('rules.setupToken.characters')
    expect(setupTokenCheck('ABCD-EFGH-JKMN-PQRS-TUVW-XYZ2-3456-Q', live)?.key).toBe('rules.setupToken.tooLong')
    // The alphabet has no look-alikes: 0, 1, I, L and O can never be part of the code.
    for (const wrong of ['ABCD-0000', 'ABCD-1111', 'ABCD-IIII', 'ABCD-LLLL', 'ABCD-OOOO']) expect(setupTokenCheck(wrong, live)?.key, wrong).toBe('rules.setupToken.characters')
  })

  it('lists every message it can show so the room can be reserved', () => {
    expect(setupTokenCheck.problems).toHaveLength(4)
  })
})

describe('helpers', () => {
  it('required trims', () => {
    expect(required('x')('   ', live)).toEqual({ key: 'x' })
    expect(required('x')(' a ', live)).toBeUndefined()
  })

  it('integerCheck takes whole numbers in range only', () => {
    const check = integerCheck('k', 5, 500)
    expect(isValid(check, '5')).toBe(true)
    expect(isValid(check, '500')).toBe(true)
    expect(isValid(check, '4')).toBe(false)
    expect(isValid(check, '501')).toBe(false)
    expect(isValid(check, '1.5')).toBe(false)
    expect(isValid(check, '')).toBe(false)
  })
})
