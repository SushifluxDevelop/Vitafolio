import type { FieldProblem, ProblemDetails } from './types'

/** A failed API call with everything the server said about it. */
export class ApiError extends Error {
  /** HTTP status; 0 when the server could not be reached at all. */
  readonly status: number
  /** Stable error code such as "auth.invalid_credentials"; the UI shows the translated text for it. */
  readonly code: string | undefined
  readonly params: Record<string, string | number | boolean>
  /** The server's English fallback text. */
  readonly detail: string | undefined
  /** Problems per field, each a code with its values. */
  readonly fieldErrors: Record<string, FieldProblem[]>
  readonly traceId: string | undefined
  /** Seconds the server asks to wait before the next try (429/503), if it said so. */
  readonly retryAfter: number | undefined

  constructor(status: number, problem?: ProblemDetails, retryAfter?: number, fallbackMessage?: string) {
    super(problem?.detail ?? problem?.title ?? fallbackMessage ?? `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.code = problem?.code
    this.params = problem?.params ?? {}
    this.detail = problem?.detail
    this.fieldErrors = problem?.errors ?? {}
    this.traceId = problem?.traceId
    this.retryAfter = retryAfter
  }
}

/** The "Retry-After" header in seconds (a number or an HTTP date); undefined when absent or unreadable. */
export function readRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return seconds >= 0 ? Math.ceil(seconds) : undefined
  const date = Date.parse(value)
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - Date.now()) / 1000))
}

/** Every state-changing request carries this header; the server refuses it without (cross-site pages cannot set it). */
const CSRF_HEADER = { 'X-Cv-Request': '1' }
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Calls whose own 401 is an ordinary answer (wrong password ...) and never a reason to refresh the session. */
const NO_REFRESH = new Set(['/api/auth/refresh', '/api/auth/login', '/api/auth/login/2fa', '/api/auth/register', '/api/auth/logout', '/api/setup'])

const authEvents = new EventTarget()

/** Calls back when the session turned out to be gone for good (refresh failed, revoked, key rotated, account disabled). */
export function onSessionLost(callback: () => void): () => void {
  authEvents.addEventListener('lost', callback)
  return () => authEvents.removeEventListener('lost', callback)
}

/**
 * Calls back when the server says every other request is refused until the two-factor setup is done (an administrator
 * turned "two-factor for everybody" on during a running session): the app reloads who is signed in and shows the setup.
 */
export function onTwoFactorSetupRequired(callback: () => void): () => void {
  authEvents.addEventListener('twofactor-setup', callback)
  return () => authEvents.removeEventListener('twofactor-setup', callback)
}

/** 401 codes that end the session for good: a refresh cannot help (revoked, signing key rotated, disabled, no cookie). */
const SESSION_GONE_CODES = new Set(['auth.invalid', 'auth.disabled', 'auth.required'])

async function readProblem(response: Response): Promise<ProblemDetails | undefined> {
  try {
    return (await response.json()) as ProblemDetails
  } catch {
    // Not JSON (a proxy error page, an empty body): the status is all there is.
    return undefined
  }
}

async function send(method: string, path: string, body: unknown): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (!SAFE_METHODS.has(method)) Object.assign(headers, CSRF_HEADER)
  // A FormData body (file upload) sets its own multipart content type with the boundary.
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  try {
    return await fetch(path, {
      method,
      credentials: 'same-origin',
      headers,
      ...(body === undefined ? {} : { body: isForm ? body : JSON.stringify(body) }),
    })
  } catch (cause) {
    // fetch rejects with a TypeError when there is no connection at all.
    const error = new ApiError(0, { code: 'network' }, undefined, cause instanceof Error ? cause.message : 'Network error')
    throw error
  }
}

async function toError(response: Response): Promise<ApiError> {
  const problem = await readProblem(response)
  return new ApiError(response.status, problem, readRetryAfter(response.headers.get('Retry-After')), response.statusText)
}

let refreshing: Promise<boolean> | null = null

/** One refresh at a time: parallel calls that all got "expired" share a single refresh instead of racing each other. */
function refreshSession(): Promise<boolean> {
  refreshing ??= send('POST', '/api/auth/refresh', undefined)
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

/**
 * Calls the API and returns the raw successful response (for file downloads). Refresh-once and error handling are the
 * same as in {@link api}.
 */
export async function apiResponse(method: string, path: string, body?: unknown): Promise<Response> {
  let response = await send(method, path, body)

  if (response.status === 401 && !NO_REFRESH.has(path)) {
    const failure = await toError(response.clone())
    if (failure.code === 'auth.expired') {
      if (await refreshSession()) {
        response = await send(method, path, body)
      } else {
        authEvents.dispatchEvent(new Event('lost'))
        throw failure
      }
    } else if (failure.code !== undefined && SESSION_GONE_CODES.has(failure.code)) {
      authEvents.dispatchEvent(new Event('lost'))
      throw failure
    }
  }

  // /api/auth/me answers this itself and the app reads it there; every other call tells the app to look again.
  if (response.status === 403 && path !== '/api/auth/me') {
    const failure = await toError(response.clone())
    if (failure.code === 'auth.twofactor_setup_required') {
      authEvents.dispatchEvent(new Event('twofactor-setup'))
      throw failure
    }
  }

  if (!response.ok) throw await toError(response)
  return response
}

/**
 * Calls the API and returns the parsed JSON (undefined for empty answers). On 401 "auth.expired" the session is
 * refreshed once and the call repeated once; if the refresh fails the original error is thrown and the app is told that
 * the session is gone. Every other failure throws an {@link ApiError}.
 */
export async function api<T = void>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await apiResponse(method, path, body)
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const get = <T>(path: string) => api<T>('GET', path)
export const post = <T = void>(path: string, body?: unknown) => api<T>('POST', path, body)
export const put = <T = void>(path: string, body?: unknown) => api<T>('PUT', path, body)
export const patch = <T = void>(path: string, body?: unknown) => api<T>('PATCH', path, body)
export const del = <T = void>(path: string) => api<T>('DELETE', path)
