import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import i18n from 'i18next'
import type { ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import '../../i18n'
import { MadeWith, VersionLabel } from './Brand'

beforeAll(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function stubVersion(body: unknown, status = 200) {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('version display', () => {
  it.each([
    ['release', 'v2026.11.12 (13.557)'],
    ['beta', 'v2026.11.12 (13.557 β)'],
    ['dev', 'v2026.11.12 (13.557-dev)'],
    ['without counters', 'v2026.11.12'],
  ])('shows the readable form of the server as it is (%s)', async (_name, version) => {
    stubVersion({ version, short: 'v2026.11.12', buildId: 'v2026.11.12.13.557', channel: 'release' })
    render(wrap(<VersionLabel />))
    expect(await screen.findByTestId('version')).toHaveTextContent(version)
  })

  it('never shows empty parentheses or a broken text when the version is not known', async () => {
    stubVersion({ title: 'down' }, 503)
    const { container } = render(wrap(<VersionLabel />))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByTestId('version')).toBeNull()
    expect(container.textContent).not.toContain('()')
  })

  it('fetches the version once, however often it is shown', async () => {
    const fetchMock = stubVersion({ version: 'v1 (2.3)', short: 'v1', buildId: 'v1.2.3', channel: 'release' })
    render(wrap(<><VersionLabel /><VersionLabel /></>))
    expect(await screen.findAllByTestId('version')).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('made with', () => {
  it('says "Mit ♥ gemacht" in German and "Made with ♥" in every other language, with a green heart', async () => {
    const { container, rerender } = render(<MadeWith />)
    expect(container).toHaveTextContent('Mit ♥ gemacht')
    expect(screen.getByRole('img', { name: 'Herz' })).toHaveClass('text-heart')
    await i18n.changeLanguage('en')
    rerender(<MadeWith />)
    expect(container).toHaveTextContent('Made with ♥')
    await i18n.changeLanguage('de')
  })
})
