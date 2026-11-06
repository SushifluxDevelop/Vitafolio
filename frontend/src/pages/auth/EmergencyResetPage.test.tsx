import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from 'i18next'
import { MemoryRouter } from 'react-router'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import '../../i18n'
import { authApi } from '../../api/endpoints'
import type { Bootstrap } from '../../api/types'
import { AppStateProvider } from '../../auth/AppState'
import { EmergencyResetPage } from './EmergencyResetPage'

beforeAll(async () => {
  await i18n.changeLanguage('de')
})

const bootstrap: Bootstrap = {
  productName: 'Vitafolio',
  mode: 'server',
  setupRequired: false,
  setupTokenRequired: false,
  registrationOpen: false,
  rules: {
    username: { minLength: 3, maxLength: 32, pattern: '^[A-Za-z0-9._-]+$' },
    displayName: { minLength: 1, maxLength: 64 },
    password: { minLength: 12, maxLength: 128 },
  },
  languages: ['de', 'en'],
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AppStateProvider value={{ bootstrap, session: { user: null, twoFactorSetupRequired: false } }}>
          <EmergencyResetPage />
        </AppStateProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('EmergencyResetPage', () => {
  it('renders step 1 and step 2 sections', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Notfall-Zugang für Administratoren' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notfall-Code im Server-Log erzeugen' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Notfall-Code/)).toBeInTheDocument()
    expect(screen.getByLabelText('Passwort')).toBeInTheDocument()
    expect(screen.getByLabelText('Passwort wiederholen')).toBeInTheDocument()
  })

  it('requests emergency code on button click and shows confirmation notice', async () => {
    const requestSpy = vi.spyOn(authApi, 'requestEmergencyReset').mockResolvedValue({ requested: true })
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Notfall-Code im Server-Log erzeugen' }))
    expect(requestSpy).toHaveBeenCalledOnce()
    await waitFor(() => {
      expect(screen.getByText(/Der Notfall-Code wurde erzeugt!/)).toBeInTheDocument()
    })
    requestSpy.mockRestore()
  })

  it('submits confirmation and shows success view when inputs are valid', async () => {
    const confirmSpy = vi.spyOn(authApi, 'confirmEmergencyReset').mockResolvedValue({ success: true, username: 'admin' })
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText(/Notfall-Code/), 'ABCD-EFGH-JKMN-PQRS-TUVW-XYZ2-3456')
    await user.type(screen.getByLabelText('Passwort'), 'new-secret-password-123')
    await user.type(screen.getByLabelText('Passwort wiederholen'), 'new-secret-password-123')

    await user.click(screen.getByRole('button', { name: 'Passwort zurücksetzen und 2FA deaktivieren' }))

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith({
        code: 'ABCD-EFGH-JKMN-PQRS-TUVW-XYZ2-3456',
        newPassword: 'new-secret-password-123',
      })
      expect(screen.getByText('Passwort erfolgreich zurückgesetzt!')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Zur Anmeldung' })).toBeInTheDocument()
    })
    confirmSpy.mockRestore()
  })
})
