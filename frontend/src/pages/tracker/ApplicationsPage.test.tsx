// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import i18n from 'i18next'
import { MemoryRouter } from 'react-router'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../i18n'
import { applicationsApi, coverLettersApi } from '../../api/endpoints'
import type {
  Application,
  ApplicationListItem,
  ApplicationStats,
} from '../../api/types'
import { ConfirmProvider } from '../../components/ui/ConfirmDialog'
import { ApplicationsPage } from './ApplicationsPage'

beforeAll(async () => {
  await i18n.changeLanguage('de')
})

const mockStats: ApplicationStats = {
  total: 3,
  draft: 1,
  applied: 1,
  acknowledged: 0,
  interview: 1,
  offer: 0,
  rejected: 0,
  withdrawn: 0,
  followUpsDue: 1,
}

const mockListItems: ApplicationListItem[] = [
  {
    id: 'app1',
    jobTitle: 'Senior Cloud Engineer',
    company: 'CloudScale AG',
    location: 'Berlin / Remote',
    status: 'applied',
    appliedAt: '2026-10-15T00:00:00Z',
    followUpAt: null,
    isFollowUpDue: true,
    coverLetterTitle: 'Anschreiben CloudScale',
    hasArchivedPdf: true,
    updatedAt: '2026-10-15T00:00:00Z',
  },
  {
    id: 'app2',
    jobTitle: 'Lead Architect',
    company: 'Enterprise Corp',
    location: 'München',
    status: 'interview',
    appliedAt: '2026-11-01T00:00:00Z',
    followUpAt: null,
    isFollowUpDue: false,
    coverLetterTitle: null,
    hasArchivedPdf: false,
    updatedAt: '2026-11-02T00:00:00Z',
  },
  {
    id: 'app3',
    jobTitle: 'Fullstack Dev',
    company: 'Startup GmbH',
    location: null,
    status: 'draft',
    appliedAt: null,
    followUpAt: null,
    isFollowUpDue: false,
    coverLetterTitle: null,
    hasArchivedPdf: false,
    updatedAt: '2026-11-03T00:00:00Z',
  },
]

const mockAppDetails: Application = {
  id: 'app1',
  jobTitle: 'Senior Cloud Engineer',
  company: 'CloudScale AG',
  location: 'Berlin / Remote',
  contactPerson: 'Herr Dr. Markus Schmidt',
  contactEmail: 'schmidt@cloudscale.example',
  contactPhone: '+49 30 9876543',
  jobPostingUrl: 'https://cloudscale.example/jobs/1',
  jobDescription: 'Tolles Team.',
  salaryExpectation: '90.000 EUR',
  status: 'applied',
  appliedAt: '2026-10-15T00:00:00Z',
  followUpAt: null,
  isFollowUpDue: true,
  coverLetterId: 'cl1',
  coverLetterTitle: 'Anschreiben CloudScale',
  cvDesign: 'classic',
  cvAccentColor: '#14213D',
  cvFont: 'Liberation Sans',
  cvLanguage: 'de',
  cvShowPhoto: true,
  cvPhotoShape: 'rounded',
  includeCoverSheet: true,
  attachmentIds: [],
  hasArchivedPdf: true,
  notes: 'Sehr gutes Erstgespräch geplant.',
  createdAt: '2026-10-15T00:00:00Z',
  updatedAt: '2026-10-15T00:00:00Z',
  events: [
    {
      id: 'ev1',
      applicationId: 'app1',
      status: 'applied',
      date: '2026-10-15T00:00:00Z',
      title: 'Bewerbung eingereicht',
      note: 'Per E-Mail versendet.',
      createdAt: '2026-10-15T00:00:00Z',
    },
  ],
}

vi.mock('../../api/endpoints', () => ({
  applicationsApi: {
    list: vi.fn(),
    stats: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    updateStatus: vi.fn(),
    addEvent: vi.fn(),
    deleteEvent: vi.fn(),
    getPreviewPdf: vi.fn(),
    downloadDossier: vi.fn(),
    archiveSnapshot: vi.fn(),
  },
  coverLettersApi: {
    list: vi.fn(),
  },
  attachmentsApi: {
    list: vi.fn().mockResolvedValue([]),
    upload: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    reorder: vi.fn(),
    downloadUrl: vi.fn((id: string) => `/api/attachments/${id}/download`),
  },
  aiApi: {
    getConfig: vi.fn().mockResolvedValue({
      provider: 'copy_paste',
      model: 'gpt-4o-mini',
      baseUrl: null,
      hasApiKey: false,
      pseudonymize: true,
    }),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ConfirmProvider>
          <ApplicationsPage />
        </ConfirmProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('ApplicationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(applicationsApi.list).mockResolvedValue(mockListItems)
    vi.mocked(applicationsApi.stats).mockResolvedValue(mockStats)
    vi.mocked(applicationsApi.get).mockResolvedValue(mockAppDetails)
    vi.mocked(coverLettersApi.list).mockResolvedValue([
      { id: 'cl1', title: 'Anschreiben CloudScale', recipientCompany: 'CloudScale AG', subject: 'Subject', updatedAt: '2026-10-15T00:00:00Z' },
    ])
  })

  it('renders title, stats cards and follow-up alert banner', async () => {
    renderPage()

    expect(await screen.findByText('Bewerbungs-Tracker')).toBeInTheDocument()
    expect(await screen.findByText('Gesamt')).toBeInTheDocument()
    const followUpBadges = await screen.findAllByText('Nachfassen fällig')
    expect(followUpBadges.length).toBeGreaterThanOrEqual(1)

    // Follow-up banner
    expect(await screen.findByText(/Bei 1 Bewerbung\(en\) ist ein Nachfassen fällig/)).toBeInTheDocument()
  })

  it('renders kanban board with columns and application cards', async () => {
    renderPage()

    // Check items in Kanban
    expect(await screen.findByText('Senior Cloud Engineer')).toBeInTheDocument()
    expect(screen.getByText('Lead Architect')).toBeInTheDocument()
    expect(screen.getByText('Fullstack Dev')).toBeInTheDocument()
  })

  it('switches to list view and displays table rows', async () => {
    renderPage()

    const listBtn = await screen.findByRole('button', { name: /Listenansicht/i })
    fireEvent.click(listBtn)

    expect(await screen.findByText('CloudScale AG')).toBeInTheDocument()
    expect(screen.getByText('Enterprise Corp')).toBeInTheDocument()
  })

  it('opens new application dialog, fills fields and calls create endpoint', async () => {
    vi.mocked(applicationsApi.create).mockResolvedValue(mockAppDetails)
    renderPage()

    const newBtn = await screen.findByRole('button', { name: /Neue Bewerbung/i })
    fireEvent.click(newBtn)

    expect(await screen.findByText('Neue Bewerbung anlegen')).toBeInTheDocument()

    const jobTitleInput = screen.getByPlaceholderText(/Senior Cloud Architect/i)
    const companyInput = screen.getByPlaceholderText(/Acme Corp GmbH/i)

    fireEvent.change(jobTitleInput, { target: { value: 'Frontend Spezialist' } })
    fireEvent.change(companyInput, { target: { value: 'Tech AG' } })

    const submitBtn = screen.getByRole('button', { name: /Speichern/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(applicationsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          jobTitle: 'Frontend Spezialist',
          company: 'Tech AG',
        })
      )
    })
  })

  it('opens details modal when clicking an application card and allows adding an event', async () => {
    vi.mocked(applicationsApi.addEvent).mockResolvedValue({
      id: 'ev2',
      applicationId: 'app1',
      status: 'interview',
      date: '2026-11-06T00:00:00Z',
      title: 'Zweites Gespräch',
      note: 'Deep Dive Tech.',
      createdAt: '2026-11-06T00:00:00Z',
    })

    renderPage()

    const card = await screen.findByText('Senior Cloud Engineer')
    fireEvent.click(card)

    expect(await screen.findByText('Senior Cloud Engineer – CloudScale AG')).toBeInTheDocument()
    expect(screen.getByText('Herr Dr. Markus Schmidt')).toBeInTheDocument()

    // Switch to Timeline tab
    const timelineTab = screen.getByRole('button', { name: /Verlauf & Ereignisse/i })
    fireEvent.click(timelineTab)

    expect(await screen.findByText('Bewerbung eingereicht')).toBeInTheDocument()

    // Add event
    const titleInput = screen.getByPlaceholderText(/Titel \(z\. B\. 1\. Vorstellungsgespräch\)/i)
    fireEvent.change(titleInput, { target: { value: 'Zweites Gespräch' } })

    const addBtn = screen.getByRole('button', { name: /Hinzufügen/i })
    fireEvent.click(addBtn)

    await waitFor(() => {
      expect(applicationsApi.addEvent).toHaveBeenCalledWith(
        'app1',
        expect.objectContaining({
          title: 'Zweites Gespräch',
        })
      )
    })
  })

  it('triggers download dossier from details modal', async () => {
    const mockBlob = new Blob(['%PDF-test'], { type: 'application/pdf' })
    vi.mocked(applicationsApi.downloadDossier).mockResolvedValue({
      blob: mockBlob,
      filename: 'Bewerbung_CloudScale.pdf',
    })

    renderPage()

    const card = await screen.findByText('Senior Cloud Engineer')
    fireEvent.click(card)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Senior Cloud Engineer – CloudScale AG')).toBeInTheDocument()

    const downloadBtn = within(dialog).getByRole('button', { name: /Dossier herunterladen/i })
    fireEvent.click(downloadBtn)

    await waitFor(() => {
      expect(applicationsApi.downloadDossier).toHaveBeenCalledWith('app1')
    })
  })
})
