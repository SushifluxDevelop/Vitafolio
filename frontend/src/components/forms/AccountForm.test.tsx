import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from 'i18next'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import '../../i18n'
import { ApiError } from '../../api/client'
import type { NewAccount } from '../../api/endpoints'
import type { Bootstrap } from '../../api/types'
import { AppStateProvider } from '../../auth/AppState'
import { AccountForm } from './AccountForm'

beforeAll(async () => {
  await i18n.changeLanguage('de')
})

const bootstrap: Bootstrap = {
  productName: 'x',
  mode: 'server',
  setupRequired: true,
  setupTokenRequired: true,
  registrationOpen: false,
  rules: {
    username: { minLength: 3, maxLength: 32, pattern: '^[A-Za-z0-9._-]+$' },
    displayName: { minLength: 1, maxLength: 64 },
    password: { minLength: 12, maxLength: 128 },
  },
  languages: ['de', 'en'],
}

function renderForm(onSubmit: (account: NewAccount) => Promise<unknown>, askSetupToken: boolean) {
  return render(
    <AppStateProvider value={{ bootstrap, session: { user: null, twoFactorSetupRequired: false } }}>
      <AccountForm submitLabel="Konto anlegen" onSubmit={onSubmit} answerCodes={['rate_limited']} askSetupToken={askSetupToken} />
    </AppStateProvider>,
  )
}

async function fillAccount(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Benutzername'), 'owner')
  await user.type(screen.getByLabelText('Anzeigename'), 'Owner')
  await user.type(screen.getByLabelText('Passwort'), 'correct horse battery')
  await user.type(screen.getByLabelText('Passwort wiederholen'), 'correct horse battery')
}

describe('setup code field', () => {
  it('is only there while the server asks for it, with the helper text', () => {
    const { unmount } = renderForm(() => Promise.resolve(), true)
    expect(screen.getByLabelText('Einrichtungscode')).toBeInTheDocument()
    expect(screen.getByText(/auf Unraid unter Docker → Vitafolio → Logs/)).toBeInTheDocument()
    unmount()
    renderForm(() => Promise.resolve(), false)
    expect(screen.queryByLabelText('Einrichtungscode')).toBeNull()
  })

  it('flags a wrong character while typing, before any blur or click', async () => {
    const user = userEvent.setup()
    renderForm(() => Promise.resolve(), true)
    await user.type(screen.getByLabelText('Einrichtungscode'), 'ab!d')
    expect(screen.getByText(/besteht nur aus Buchstaben und Ziffern/)).toBeInTheDocument()
  })

  it('does not send an unfinished code, and shows what is missing', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((_account: NewAccount) => Promise.resolve())
    renderForm(onSubmit, true)
    await user.type(screen.getByLabelText('Einrichtungscode'), 'ABCD-EFGH-JKMN')
    await fillAccount(user)
    await user.click(screen.getByRole('button', { name: 'Konto anlegen' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/Noch nicht vollständig/)).toBeInTheDocument()
  })

  it.each([
    ['abcd-efgh-jkmn-pqrs-tuvw-xyz2-3456', 'ABCD-EFGH-JKMN-PQRS-TUVW-XYZ2-3456'],
    ['abcdefghjkmnpqrstuvwxyz23456', 'ABCD-EFGH-JKMN-PQRS-TUVW-XYZ2-3456'],
    ['  abcd efgh  jkmn pqrs tuvw xyz2 3456 ', 'ABCD-EFGH-JKMN-PQRS-TUVW-XYZ2-3456'],
    ['ABCD-EFGH-JKMN-PQRS-TUVW-XYZ2-3456', 'ABCD-EFGH-JKMN-PQRS-TUVW-XYZ2-3456'],
  ])('sends %s in the server format', async (typed, sent) => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((_account: NewAccount) => Promise.resolve())
    renderForm(onSubmit, true)
    await user.type(screen.getByLabelText('Einrichtungscode'), typed)
    await fillAccount(user)
    await user.click(screen.getByRole('button', { name: 'Konto anlegen' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ username: 'owner', setupToken: sent })
  })

  it('never sends a setup code when the server did not ask for one', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((_account: NewAccount) => Promise.resolve())
    renderForm(onSubmit, false)
    await fillAccount(user)
    await user.click(screen.getByRole('button', { name: 'Konto anlegen' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0]![0]).not.toHaveProperty('setupToken')
  })

  it('shows the wrong-code answer at the field - also when the server sends it as a plain code - and clears it when the code is edited', async () => {
    const user = userEvent.setup()
    renderForm(() => Promise.reject(new ApiError(403, { code: 'setup.token_invalid' })), true)
    await user.type(screen.getByLabelText('Einrichtungscode'), 'ABCD-EFGH-JKMN-PQRS-TUVW-XYZ2-3456')
    await fillAccount(user)
    await user.click(screen.getByRole('button', { name: 'Konto anlegen' }))
    await screen.findByText(/Der Einrichtungscode stimmt nicht/)
    expect(screen.getByLabelText('Einrichtungscode')).toHaveAttribute('aria-invalid', 'true')
    // At the field, not in an alert.
    expect(screen.queryByTestId('error-notice')).toBeNull()
    await user.type(screen.getByLabelText('Einrichtungscode'), 'X')
    expect(screen.queryByText(/Der Einrichtungscode stimmt nicht/)).toBeNull()
  })
})
