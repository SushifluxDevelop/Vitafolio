import type { TFunction } from 'i18next'
import { ApiError } from './client'
import type { FieldProblem } from './types'

/** Server codes that share the text of another one (the maintenance gate answers with the plain code and a specific one). */
const CODE_ALIASES: Record<string, string> = { maintenance: 'maintenance.busy' }

/** Translated text for a stable error code, or undefined when this language has none (the caller then falls back). */
function codeText(t: TFunction, code: string | undefined, params: Record<string, string | number | boolean> = {}): string | undefined {
  if (!code) return undefined
  const text = t(`errors.codes.${CODE_ALIASES[code] ?? code}`, { ...params, defaultValue: '' })
  return typeof text === 'string' && text !== '' ? text : undefined
}

/** One field problem as text: the translated code, else the bare code, so nothing is ever swallowed. */
export function problemText(t: TFunction, problem: FieldProblem): string {
  return codeText(t, problem.code, problem.params) ?? problem.code
}

/** The first problem of every field the server named, translated; keys are the server's field names (camelCase). */
export function fieldErrors(t: TFunction, error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {}
  const result: Record<string, string> = {}
  for (const [field, problems] of Object.entries(error.fieldErrors)) {
    const first = problems[0]
    if (first) result[field.charAt(0).toLowerCase() + field.slice(1)] = problemText(t, first)
  }
  return result
}

export interface ErrorDescription {
  /** What went wrong, in the user's language and specific to the failure. */
  message: string
  /** Everything technical, complete (status, code, trace id, the server's own text, field codes). */
  technical: string[]
}

/**
 * Turns any failure into a specific message for the user plus the complete technical text. Never a generic "an error
 * occurred" when the server told more: the translated text for its code, else its own English text, else the status.
 */
export function describeError(t: TFunction, error: unknown): ErrorDescription {
  if (!(error instanceof ApiError)) {
    const text = error instanceof Error ? error.message : String(error)
    return { message: t('errors.unexpected'), technical: text ? [text] : [] }
  }

  const technical: string[] = []
  if (error.status > 0) technical.push(`HTTP ${error.status}`)
  if (error.code) technical.push(`${t('errors.technical.code')}: ${error.code}`)
  if (error.detail) technical.push(`${t('errors.technical.detail')}: ${error.detail}`)
  for (const [field, problems] of Object.entries(error.fieldErrors)) {
    technical.push(`${t('errors.technical.field')} ${field}: ${problems.map((p) => p.code).join(', ')}`)
  }
  if (error.traceId) technical.push(`${t('errors.technical.traceId')}: ${error.traceId}`)

  const params = { ...error.params, ...(error.retryAfter === undefined ? {} : { seconds: error.retryAfter }) }
  // Without a Retry-After the text must not promise a number of seconds.
  let code = error.code === 'rate_limited' && error.retryAfter === undefined ? 'rate_limited_unknown' : error.code
  // Too many attempts for one account (not just from this address) has its own text.
  if (error.code === 'rate_limited' && error.params.scope === 'account') code = 'rate_limited_account'
  // A file that is not an unchanged backup of this app (its structure does not fit) says exactly that.
  if (error.code === 'backup.invalid' && error.params.reason === 'schema_mismatch') code = 'backup.invalid_schema_mismatch'
  // A failed restore says whether the previous state came back by itself (rolledBack) and names the safety backup.
  if (code === 'backup.restore_failed' && error.params.rolledBack === false) code = 'backup.restore_failed_not_rolled_back'
  let message = codeText(t, code, params)

  if (!message && Object.keys(error.fieldErrors).length > 0) {
    // A validation answer whose fields this form does not show: name the first problem instead of a bare "invalid".
    const [field, problems] = Object.entries(error.fieldErrors)[0]!
    const first = problems[0]
    message = first ? `${t('errors.validationField', { field })} ${problemText(t, first)}` : undefined
  }
  message ??= codeText(t, `status.${error.status}`, params)
  message ??= error.detail ?? t('errors.statusFallback', { status: error.status })
  return { message, technical }
}

/** Shorthand for the message alone, for places that show nothing but the sentence. */
export function errorMessage(t: TFunction, error: unknown): string {
  return describeError(t, error).message
}

/** The text a Copy button puts on the clipboard: everything the user sees plus app version and time. */
export function copyableError(description: ErrorDescription, context: { version?: string | undefined; title?: string | undefined; time?: Date }): string {
  const lines = [context.title, description.message, ...description.technical]
  if (context.version) lines.push(`Version: ${context.version}`)
  lines.push(`${(context.time ?? new Date()).toISOString()}`)
  return lines.filter((line): line is string => Boolean(line)).join('\n')
}
