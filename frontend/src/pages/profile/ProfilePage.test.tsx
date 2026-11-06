import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from 'i18next'
import { MemoryRouter } from 'react-router'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../i18n'
import { profileApi } from '../../api/endpoints'
import type { Profile } from '../../api/types'
import { ConfirmProvider } from '../../components/ui/ConfirmDialog'
import { ErrorDialogProvider } from '../../components/ui/ErrorDialog'
import { ProfilePage } from './ProfilePage'

beforeAll(async () => {
  await i18n.changeLanguage('de')
})

const mockProfile: Profile = {
  id: 'p1',
  firstName: 'Max',
  lastName: 'Mustermann',
  academicTitle: 'Dr.',
  professionalTitle: 'Senior Architekt',
  email: 'max@example.com',
  phone: '+49 123 45678',
  street: 'Musterstr. 1',
  postalCode: '10115',
  city: 'Berlin',
  country: 'Deutschland',
  dateOfBirth: '1990-01-01',
  placeOfBirth: 'München',
  nationality: 'Deutsch',
  maritalStatus: 'Ledig',
  website: 'https://max.example.com',
  linkedIn: 'https://linkedin.com/in/max',
  gitHub: null,
  xing: null,
  bio: 'Passionierter Entwickler',
  hasPhoto: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  experiences: [
    {
      id: 'exp1',
      jobTitle: 'Senior Software Engineer',
      employer: 'Tech GmbH',
      employmentType: 'Vollzeit',
      city: 'Berlin',
      country: 'Deutschland',
      startDate: '2022-01',
      endDate: null,
      isCurrent: true,
      description: 'Leitung von Cloud-Projekten',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ],
  educations: [
    {
      id: 'edu1',
      degree: 'M.Sc. Informatik',
      fieldOfStudy: 'Softwaretechnik',
      institution: 'TU Berlin',
      city: 'Berlin',
      country: 'Deutschland',
      startDate: '2016-10',
      endDate: '2019-09',
      isCurrent: false,
      grade: '1.2',
      description: 'Schwerpunkt Verteilte Systeme',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ],
  skills: [
    {
      id: 'skill1',
      name: 'TypeScript',
      category: 'Programmiersprachen',
      level: 5,
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ],
  languages: [
    {
      id: 'lang1',
      language: 'Englisch',
      level: 'C1',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ],
  certificates: [],
  interests: [],
  customSections: [],
}

function renderPage(initialTab = 'personal') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/profile?tab=${initialTab}`]}>
        <ConfirmProvider>
          <ErrorDialogProvider>
            <ProfilePage />
          </ErrorDialogProvider>
        </ConfirmProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(profileApi, 'get').mockResolvedValue(mockProfile)
  })

  it('renders all tabs and personal info', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Stammprofil' })).toBeInTheDocument()
    })

    expect(screen.getByRole('tab', { name: /Persönliches/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Berufserfahrung/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Ausbildung/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Kenntnisse/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Sprachen/ })).toBeInTheDocument()

    // Form values
    expect(screen.getByLabelText('Vorname')).toHaveValue('Max')
    expect(screen.getByLabelText('Nachname')).toHaveValue('Mustermann')
    expect(screen.getByLabelText('Berufsbezeichnung / Untertitel')).toHaveValue('Senior Architekt')
  })

  it('allows editing personal data and calling update', async () => {
    const updateSpy = vi.spyOn(profileApi, 'update').mockResolvedValue({
      ...mockProfile,
      firstName: 'Maximilian',
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByLabelText('Vorname')).toHaveValue('Max')
    })

    const firstNameInput = screen.getByLabelText('Vorname')
    await userEvent.clear(firstNameInput)
    await userEvent.type(firstNameInput, 'Maximilian')

    const saveButton = screen.getByRole('button', { name: 'Speichern' })
    await userEvent.click(saveButton)

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalled()
      expect(updateSpy.mock.calls[0]?.[0]).toMatchObject({
        firstName: 'Maximilian',
        lastName: 'Mustermann',
      })
    })
  })

  it('renders experiences tab with existing station', async () => {
    renderPage('experiences')

    await waitFor(() => {
      expect(screen.getByText('Senior Software Engineer')).toBeInTheDocument()
      expect(screen.getByText('bei Tech GmbH')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Station hinzufügen' })).toBeInTheDocument()
  })

  it('renders skills tab with grouped skill', async () => {
    renderPage('skills')

    await waitFor(() => {
      expect(screen.getByText('TypeScript')).toBeInTheDocument()
      expect(screen.getByText('Programmiersprachen')).toBeInTheDocument()
    })
  })

  it('renders preview tab when selected', async () => {
    vi.spyOn(profileApi, 'getPreviewPdf').mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }))
    global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-pdf')
    global.URL.revokeObjectURL = vi.fn()

    renderPage('preview')

    await waitFor(() => {
      expect(screen.getByText('Lebenslauf-Vorschau')).toBeInTheDocument()
      expect(screen.getByText('Klassisch')).toBeInTheDocument()
      expect(screen.getByText('Modern')).toBeInTheDocument()
    })
  })
})
