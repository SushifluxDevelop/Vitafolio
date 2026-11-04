import type { Rules, TextRule } from '../api/types'

/**
 * What is wrong with a field's current value: a full i18n key plus the values for its placeholders. Rules return this
 * instead of text so they can be tested without translations and the field component decides when to show it.
 *
 * The limits come from the server (/api/bootstrap) - there is no second hand-typed copy here. The server stays the
 * authority and checks everything again; where it knows more (a taken name) its answer is shown as well.
 */
export interface Problem {
  key: string
  values?: Record<string, string | number>
}

/**
 * Context a rule gets besides the value. "settled" is true once the user left the field or tried to submit: only then
 * is a half-finished value (e.g. a repeat that is still the start of the password) a problem instead of work in progress.
 */
export interface CheckContext {
  settled: boolean
}

type CheckFunction = (value: string, context: CheckContext) => Problem | undefined

/**
 * A rule for one field. It also lists every problem it can report (with worst-case values), so the field can reserve
 * room for the longest message up front: a message must never push anything around when it appears.
 */
export interface Check extends CheckFunction {
  readonly problems: readonly Problem[]
}

function rule(problems: readonly Problem[], check: CheckFunction): Check {
  return Object.assign(check, { problems })
}

/** For a field that has no rule of its own (it may still show an answer of the server). */
export const noRule: Check = rule([], () => undefined)

export function required(key: string): Check {
  return rule([{ key }], (value) => (value.trim() === '' ? { key } : undefined))
}

/**
 * The username, trimmed like the server does. A forbidden character is reported before the length: it is the most
 * useful thing to say while someone is typing. Without the policy (not loaded yet) only "required" applies.
 */
export function userNameCheck(policy: Rules['username'] | undefined): Check {
  const problems: Problem[] = [{ key: 'rules.userName.required' }, { key: 'rules.userName.characters' }]
  if (policy) {
    problems.push({ key: 'rules.userName.tooShort', values: { length: policy.minLength - 1, min: policy.minLength } })
    problems.push({ key: 'rules.userName.tooLong', values: { length: policy.maxLength + 99, max: policy.maxLength } })
  }
  return rule(problems, (value): Problem | undefined => {
    const name = value.trim()
    if (name === '') return { key: 'rules.userName.required' }
    if (!policy) return undefined
    if (!safeRegExp(policy.pattern).test(name)) return { key: 'rules.userName.characters' }
    if (name.length < policy.minLength) return { key: 'rules.userName.tooShort', values: { length: name.length, min: policy.minLength } }
    if (name.length > policy.maxLength) return { key: 'rules.userName.tooLong', values: { length: name.length, max: policy.maxLength } }
    return undefined
  })
}

/** The display name: required and within the server's length. */
export function displayNameCheck(policy: TextRule | undefined): Check {
  const problems: Problem[] = [{ key: 'rules.displayName.required' }]
  if (policy) {
    problems.push({ key: 'rules.displayName.tooShort', values: { length: policy.minLength - 1, min: policy.minLength } })
    problems.push({ key: 'rules.displayName.tooLong', values: { length: policy.maxLength + 99, max: policy.maxLength } })
  }
  return rule(problems, (value): Problem | undefined => {
    const name = value.trim()
    if (name === '') return { key: 'rules.displayName.required' }
    if (!policy) return undefined
    if (name.length < policy.minLength) return { key: 'rules.displayName.tooShort', values: { length: name.length, min: policy.minLength } }
    if (name.length > policy.maxLength) return { key: 'rules.displayName.tooLong', values: { length: name.length, max: policy.maxLength } }
    return undefined
  })
}

/** The new password: required and long enough as soon as the server's limits are known. */
export function passwordCheck(policy: TextRule | undefined): Check {
  const problems: Problem[] = [{ key: 'rules.password.required' }]
  if (policy) {
    problems.push({ key: 'rules.password.tooShort', values: { length: policy.minLength - 1, min: policy.minLength } })
    problems.push({ key: 'rules.password.tooLong', values: { length: policy.maxLength + 99, max: policy.maxLength } })
  }
  return rule(problems, (value): Problem | undefined => {
    if (value.length === 0) return { key: 'rules.password.required' }
    if (!policy) return undefined
    if (value.length < policy.minLength) return { key: 'rules.password.tooShort', values: { length: value.length, min: policy.minLength } }
    if (value.length > policy.maxLength) return { key: 'rules.password.tooLong', values: { length: value.length, max: policy.maxLength } }
    return undefined
  })
}

/**
 * The repeated password. A repeat that is still the beginning of the password is not wrong yet - the user is typing -
 * so it is only flagged once it cannot become the password any more, or once the field is settled.
 */
export function repeatCheck(password: string): Check {
  return rule([{ key: 'rules.password.repeatRequired' }, { key: 'rules.password.mismatch' }], (value, { settled }) => {
    if (value.length === 0) return { key: 'rules.password.repeatRequired' }
    if (value === password) return undefined
    if (!settled && password.startsWith(value)) return undefined
    return { key: 'rules.password.mismatch' }
  })
}

/**
 * A whole number between min and max; everything else (also an empty field) is the one problem `key`, which gets
 * min and max as values so one text can serve every range.
 */
export function integerCheck(key: string, min: number, max: number): Check {
  const problem = { key, values: { min, max } }
  return rule([problem], (value) => {
    const number = Number(value)
    return value.trim() !== '' && Number.isInteger(number) && number >= min && number <= max ? undefined : problem
  })
}

export const TOTP_DIGITS = 6

/** The digits of a typed code with the spaces removed, as the server reads it. */
export function digitsOf(value: string): string {
  return value.replaceAll(' ', '')
}

/**
 * The code from the authenticator app. A code that is merely unfinished is no problem while typing (everyone knows it
 * has six digits); a wrong character or too many digits is.
 */
export const totpCheck: Check = rule(
  [{ key: 'rules.totp.required' }, { key: 'rules.totp.digitsOnly' }, { key: 'rules.totp.length', values: { count: TOTP_DIGITS } }],
  (value) => {
    const digits = digitsOf(value)
    if (digits === '') return { key: 'rules.totp.required' }
    if (/\D/.test(digits)) return { key: 'rules.totp.digitsOnly' }
    if (digits.length > TOTP_DIGITS) return { key: 'rules.totp.length', values: { count: TOTP_DIGITS } }
    return undefined
  },
)

/** True when the value is a complete authenticator code; the submit button waits for this so no half code is sent. */
export function isTotpCodeComplete(value: string): boolean {
  const digits = digitsOf(value)
  return digits.length === TOTP_DIGITS && /^\d+$/.test(digits)
}

/** At most this many characters of a recovery code are accepted in the sign-in field. */
export const RECOVERY_CODE_MAX = 40

/**
 * A code for the second step: the six digits of the authenticator app or a recovery code. Something made of digits only
 * is an app code and flagged when it gets too long; anything else is taken as a recovery code.
 */
export const loginCodeCheck: Check = rule(
  [{ key: 'rules.code.required' }, { key: 'rules.totp.length', values: { count: TOTP_DIGITS } }],
  (value) => {
    const digits = digitsOf(value)
    if (digits === '') return { key: 'rules.code.required' }
    if (/^\d+$/.test(digits) && digits.length > TOTP_DIGITS) return { key: 'rules.totp.length', values: { count: TOTP_DIGITS } }
    return undefined
  },
)

/** True when the value can be sent: a full app code, or a recovery code (not made of digits only). */
export function isLoginCodeComplete(value: string): boolean {
  const digits = digitsOf(value)
  if (digits === '') return false
  return /^\d+$/.test(digits) ? digits.length === TOTP_DIGITS : digits.length >= TOTP_DIGITS
}

/** The setup code is 28 characters in seven groups of four: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX. */
export const SETUP_TOKEN_LENGTH = 28

/** Its alphabet has no look-alikes: no 0, 1, I, L, O. */
const SETUP_TOKEN_ALPHABET = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]*$/

/** The typed code without the separators people add (spaces, dashes, underscores), upper case. */
function setupTokenCharacters(value: string): string {
  return value.replace(/[\s_-]/g, '').toUpperCase()
}

/** The code the way the server expects it: separators removed, upper case, groups of four joined by dashes. */
export function normalizeSetupToken(value: string): string {
  return (setupTokenCharacters(value).match(/.{1,4}/g) ?? []).join('-')
}

/**
 * The one-time setup code of the first start. Pasted with or without dashes or spaces, in any case. Unfinished is fine
 * while typing; too many characters or a character that cannot be part of it is a problem at once, an unfinished code
 * one as soon as the field is settled.
 */
export const setupTokenCheck: Check = rule(
  [
    { key: 'rules.setupToken.required' },
    { key: 'rules.setupToken.characters' },
    { key: 'rules.setupToken.tooLong', values: { count: SETUP_TOKEN_LENGTH } },
    { key: 'rules.setupToken.incomplete', values: { count: SETUP_TOKEN_LENGTH } },
  ],
  (value, { settled }): Problem | undefined => {
    const characters = setupTokenCharacters(value)
    if (characters === '') return { key: 'rules.setupToken.required' }
    if (!SETUP_TOKEN_ALPHABET.test(characters)) return { key: 'rules.setupToken.characters' }
    if (characters.length > SETUP_TOKEN_LENGTH) return { key: 'rules.setupToken.tooLong', values: { count: SETUP_TOKEN_LENGTH } }
    if (settled && characters.length < SETUP_TOKEN_LENGTH) return { key: 'rules.setupToken.incomplete', values: { count: SETUP_TOKEN_LENGTH } }
    return undefined
  },
)

/** True when nothing is wrong with the value; submit handlers use it so they never send what the form shows as red. */
export function isValid(check: Check, value: string): boolean {
  return check(value, { settled: true }) === undefined
}

/** A pattern that came from the server must never throw while someone types; an unusable one accepts everything. */
function safeRegExp(pattern: string): RegExp {
  try {
    return new RegExp(pattern)
  } catch {
    return /^/
  }
}
