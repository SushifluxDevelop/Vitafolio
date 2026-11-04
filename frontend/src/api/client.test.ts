import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, onSessionLost, onTwoFactorSetupRequired, readRetryAfter } from './client'

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const call = (index: number) => ({ path: fetchMock.mock.calls[index]![0] as string, init: fetchMock.mock.calls[index]![1] as RequestInit })

describe('requests', () => {
  it('sends the CSRF header on state-changing calls only, and same-origin credentials always', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json(200, {})))
    await api('GET', '/api/auth/me')
    await api('POST', '/api/account/password', { a: 1 })
    expect((call(0).init.headers as Record<string, string>)['X-Cv-Request']).toBeUndefined()
    expect((call(1).init.headers as Record<string, string>)['X-Cv-Request']).toBe('1')
    expect(call(1).init.credentials).toBe('same-origin')
    expect(call(1).init.body).toBe('{"a":1}')
  })

  it('returns undefined for an empty answer', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(api('POST', '/api/auth/logout')).resolves.toBeUndefined()
  })
})

describe('typed errors', () => {
  it('carries status, code, params, detail, field errors and trace id', async () => {
    fetchMock.mockResolvedValue(
      json(400, {
        status: 400,
        detail: 'Validation failed.',
        code: 'validation.failed',
        errors: { password: [{ code: 'validation.min_length', params: { min: 12 } }] },
        traceId: 'abc',
      }),
    )
    const error = await api('POST', '/api/setup', {}).catch((failure: unknown) => failure)
    expect(error).toBeInstanceOf(ApiError)
    const api_ = error as ApiError
    expect(api_.status).toBe(400)
    expect(api_.code).toBe('validation.failed')
    expect(api_.fieldErrors.password).toEqual([{ code: 'validation.min_length', params: { min: 12 } }])
    expect(api_.traceId).toBe('abc')
    expect(api_.message).toBe('Validation failed.')
  })

  it('reads Retry-After from a 429', async () => {
    fetchMock.mockResolvedValue(json(429, { code: 'rate_limited' }, { 'Retry-After': '42' }))
    const error = (await api('POST', '/api/auth/login', {}).catch((failure: unknown) => failure)) as ApiError
    expect(error.retryAfter).toBe(42)
  })

  it('turns an unreachable server into an error with status 0 and code "network"', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = (await api('GET', '/api/bootstrap').catch((failure: unknown) => failure)) as ApiError
    expect(error.status).toBe(0)
    expect(error.code).toBe('network')
  })

  it('survives a non-JSON error body (a proxy page)', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }))
    const error = (await api('GET', '/api/bootstrap').catch((failure: unknown) => failure)) as ApiError
    expect(error.status).toBe(502)
    expect(error.code).toBeUndefined()
  })

  it('parses Retry-After as seconds or HTTP date', () => {
    expect(readRetryAfter('120')).toBe(120)
    expect(readRetryAfter(null)).toBeUndefined()
    expect(readRetryAfter('nonsense')).toBeUndefined()
    expect(readRetryAfter(new Date(Date.now() + 30_000).toUTCString())).toBeGreaterThan(25)
  })
})

describe('refresh on auth.expired', () => {
  it('refreshes once and repeats the call once', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { code: 'auth.expired' }))
      .mockResolvedValueOnce(json(200, { user: {} })) // POST /api/auth/refresh
      .mockResolvedValueOnce(json(200, { ok: true }))
    await expect(api('GET', '/api/account/sessions')).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(call(1).path).toBe('/api/auth/refresh')
    expect(call(1).init.method).toBe('POST')
    expect(call(2).path).toBe('/api/account/sessions')
  })

  it('does not loop: a second expiry after a successful refresh is the answer', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { code: 'auth.expired' }))
      .mockResolvedValueOnce(json(200, {}))
      .mockResolvedValueOnce(json(401, { code: 'auth.expired' }))
    const error = (await api('GET', '/api/account/sessions').catch((failure: unknown) => failure)) as ApiError
    expect(error.code).toBe('auth.expired')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('tells the app the session is gone when the refresh fails, and throws the original error', async () => {
    const lost = vi.fn()
    const unsubscribe = onSessionLost(lost)
    fetchMock.mockResolvedValueOnce(json(401, { code: 'auth.expired' })).mockResolvedValueOnce(json(401, { code: 'auth.refresh_invalid' }))
    const error = (await api('GET', '/api/account/sessions').catch((failure: unknown) => failure)) as ApiError
    unsubscribe()
    expect(error.code).toBe('auth.expired')
    expect(lost).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shares one refresh between parallel calls', async () => {
    let refreshes = 0
    fetchMock.mockImplementation((path: string) => {
      if (path === '/api/auth/refresh') {
        refreshes++
        return new Promise((resolve) => setTimeout(() => resolve(json(200, {})), 10))
      }
      // The first call of each path is expired, the repeated one succeeds.
      const seen = fetchMock.mock.calls.filter(([p]) => p === path).length
      return Promise.resolve(seen === 1 ? json(401, { code: 'auth.expired' }) : json(200, { path }))
    })
    const results = await Promise.all([api('GET', '/api/a'), api('GET', '/api/b')])
    expect(results).toEqual([{ path: '/api/a' }, { path: '/api/b' }])
    expect(refreshes).toBe(1)
  })

  it('never refreshes for the sign-in calls (their 401 is an ordinary answer) or for other 401 codes', async () => {
    fetchMock.mockResolvedValue(json(401, { code: 'auth.expired' }))
    await api('POST', '/api/auth/login', {}).catch(() => undefined)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fetchMock.mockReset()
    fetchMock.mockResolvedValue(json(401, { code: 'auth.invalid_credentials' }))
    await api('GET', '/api/auth/me').catch(() => undefined)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('session ended for good', () => {
  it.each(['auth.invalid', 'auth.disabled', 'auth.required'])('%s ends the session at once: the app is told, no refresh is tried', async (code) => {
    const lost = vi.fn()
    const unsubscribe = onSessionLost(lost)
    fetchMock.mockResolvedValue(json(401, { code }))
    const error = (await api('GET', '/api/account/sessions').catch((failure: unknown) => failure)) as ApiError
    unsubscribe()
    expect(error.code).toBe(code)
    expect(lost).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not treat a disabled account at sign-in as a lost session (that is the answer of the sign-in)', async () => {
    const lost = vi.fn()
    const unsubscribe = onSessionLost(lost)
    fetchMock.mockResolvedValue(json(401, { code: 'auth.disabled' }))
    await api('POST', '/api/auth/login', {}).catch(() => undefined)
    unsubscribe()
    expect(lost).not.toHaveBeenCalled()
  })

  it('does not treat an unrelated 401 code as a lost session', async () => {
    const lost = vi.fn()
    const unsubscribe = onSessionLost(lost)
    fetchMock.mockResolvedValue(json(401, { code: 'auth.invalid_credentials' }))
    await api('GET', '/api/auth/me').catch(() => undefined)
    unsubscribe()
    expect(lost).not.toHaveBeenCalled()
  })
})

describe('two-factor setup demanded during a running session', () => {
  it('tells the app to look at the session again, and still throws the error', async () => {
    const demanded = vi.fn()
    const unsubscribe = onTwoFactorSetupRequired(demanded)
    fetchMock.mockResolvedValue(json(403, { code: 'auth.twofactor_setup_required' }))
    const error = (await api('GET', '/api/admin/users').catch((failure: unknown) => failure)) as ApiError
    unsubscribe()
    expect(error.code).toBe('auth.twofactor_setup_required')
    expect(demanded).toHaveBeenCalledTimes(1)
  })

  it('does not fire for /api/auth/me (the app reads that answer itself; firing would loop)', async () => {
    const demanded = vi.fn()
    const unsubscribe = onTwoFactorSetupRequired(demanded)
    fetchMock.mockResolvedValue(json(403, { code: 'auth.twofactor_setup_required' }))
    await api('GET', '/api/auth/me').catch(() => undefined)
    unsubscribe()
    expect(demanded).not.toHaveBeenCalled()
  })

  it('does not fire for other 403 answers', async () => {
    const demanded = vi.fn()
    const unsubscribe = onTwoFactorSetupRequired(demanded)
    fetchMock.mockResolvedValue(json(403, { code: 'auth.forbidden' }))
    await api('GET', '/api/admin/users').catch(() => undefined)
    unsubscribe()
    expect(demanded).not.toHaveBeenCalled()
  })
})
