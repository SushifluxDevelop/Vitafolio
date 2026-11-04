import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from 'i18next'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import '../../i18n'
import { ErrorDialogProvider } from '../ui/ErrorDialog'
import { TotpSetup } from './TotpSetup'

beforeAll(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** A fake server: the setup call answers with a secret; the enable call is answered by `enable`. */
function stubServer(enable: (body: Record<string, string>) => Response) {
  const enableBodies: Record<string, string>[] = []
  const fetchMock = vi.fn((path: string, init?: RequestInit) => {
    if (path === '/api/account/2fa/totp/setup') return Promise.resolve(json(200, { secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/x?secret=JBSWY3DPEHPK3PXP' }))
    if (path === '/api/account/2fa/totp/enable') {
      const body = JSON.parse(String(init?.body)) as Record<string, string>
      enableBodies.push(body)
      return Promise.resolve(enable(body))
    }
    return Promise.resolve(json(404, {}))
  })
  vi.stubGlobal('fetch', fetchMock)
  return enableBodies
}

async function reachScanStep(askPassword: boolean) {
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ErrorDialogProvider>
        <TotpSetup onFinished={() => undefined} askPassword={askPassword} />
      </ErrorDialogProvider>
    </QueryClientProvider>,
  )
  await user.click(screen.getByTestId('totp-start'))
  await screen.findByTestId('totp-secret')
  return user
}

describe('enabling two-factor in the settings', () => {
  it('asks for the current password and sends it with the code', async () => {
    const bodies = stubServer(() => json(200, { recoveryCodes: ['a', 'b'] }))
    const user = await reachScanStep(true)
    await user.type(screen.getByLabelText('Aktuelles Passwort'), 'my current password')
    await user.type(screen.getByLabelText('Code aus der App'), '123456')
    await user.click(screen.getByRole('button', { name: 'Aktivieren' }))
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toEqual({ code: '123456', currentPassword: 'my current password' })
  })

  it('does not send the code without the password, and says so while the field is empty after a try', async () => {
    const bodies = stubServer(() => json(200, { recoveryCodes: [] }))
    const user = await reachScanStep(true)
    await user.type(screen.getByLabelText('Code aus der App'), '123456')
    await user.click(screen.getByRole('button', { name: 'Aktivieren' }))
    expect(bodies).toHaveLength(0)
    expect(screen.getByText('Bitte ein Passwort eingeben.')).toBeInTheDocument()
  })

  it('shows a wrong password at its field', async () => {
    stubServer(() => json(400, { code: 'validation.failed', errors: { currentPassword: [{ code: 'password.current_invalid' }] } }))
    const user = await reachScanStep(true)
    await user.type(screen.getByLabelText('Aktuelles Passwort'), 'wrong')
    await user.type(screen.getByLabelText('Code aus der App'), '123456')
    await user.click(screen.getByRole('button', { name: 'Aktivieren' }))
    expect(await screen.findByText('Das aktuelle Passwort ist falsch.')).toBeInTheDocument()
    expect(screen.getByLabelText('Aktuelles Passwort')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('enabling two-factor in the forced setup', () => {
  it('has no password field at first and sends the code alone', async () => {
    const bodies = stubServer(() => json(200, { recoveryCodes: ['a'] }))
    const user = await reachScanStep(false)
    expect(screen.queryByLabelText('Aktuelles Passwort')).toBeNull()
    await user.type(screen.getByLabelText('Code aus der App'), '123456')
    await user.click(screen.getByRole('button', { name: 'Aktivieren' }))
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toEqual({ code: '123456' })
  })

  it('shows the password field when the server answers "required" for it (400 validation.required)', async () => {
    stubServer((body) =>
      body.currentPassword ? json(200, { recoveryCodes: ['a'] }) : json(400, { code: 'validation.failed', errors: { currentPassword: [{ code: 'validation.required' }] } }),
    )
    const user = await reachScanStep(false)
    await user.type(screen.getByLabelText('Code aus der App'), '123456')
    await user.click(screen.getByRole('button', { name: 'Aktivieren' }))
    expect(await screen.findByLabelText('Aktuelles Passwort')).toBeInTheDocument()
    // The empty field is marked at once with the live rule's own wording (it wins over the server's generic one).
    expect(screen.getByLabelText('Aktuelles Passwort')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Bitte ein Passwort eingeben.')).toBeInTheDocument()
  })

  it('shows the password field when the server answers that it is needed, and then sends it', async () => {
    const bodies = stubServer((body) =>
      body.currentPassword ? json(200, { recoveryCodes: ['a'] }) : json(400, { code: 'validation.failed', errors: { currentPassword: [{ code: 'password.current_invalid' }] } }),
    )
    const user = await reachScanStep(false)
    await user.type(screen.getByLabelText('Code aus der App'), '123456')
    await user.click(screen.getByRole('button', { name: 'Aktivieren' }))
    const field = await screen.findByLabelText('Aktuelles Passwort')
    await user.type(field, 'the password')
    await user.click(screen.getByRole('button', { name: 'Aktivieren' }))
    await waitFor(() => expect(bodies).toHaveLength(2))
    expect(bodies[1]).toEqual({ code: '123456', currentPassword: 'the password' })
  })
})
