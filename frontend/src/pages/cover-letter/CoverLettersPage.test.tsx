import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import { MemoryRouter } from 'react-router'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../i18n'
import { coverLettersApi, profileApi } from '../../api/endpoints'
import type { CoverLetter, CoverLetterListItem } from '../../api/types'
import { ConfirmProvider } from '../../components/ui/ConfirmDialog'
import { CoverLettersPage } from './CoverLettersPage'

beforeAll(async () => {
  await i18n.changeLanguage('de')
})

const mockLetter: CoverLetter = {
  id: 'cl1',
  title: 'Bewerbung Cloud Specialist',
  senderName: 'Max Mustermann',
  senderStreet: 'Musterstr. 1',
  senderPostalCode: '10115',
  senderCity: 'Berlin',
  senderPhone: '+49 123 45678',
  senderEmail: 'max@example.com',
  recipientCompany: 'CloudScale AG',
  recipientDepartment: 'IT',
  recipientContactPerson: 'Frau Schmidt',
  recipientStreet: 'Industriestr. 10',
  recipientPostalCode: '80331',
  recipientCity: 'München',
  recipientCountry: 'Deutschland',
  place: 'Berlin',
  date: '06.11.2026',
  subject: 'Bewerbung als Cloud Specialist',
  salutation: 'Sehr geehrte Frau Schmidt,',
  body: 'mit großem Interesse bewerbe ich mich bei Ihnen.',
  closing: 'Mit freundlichen Grüßen',
  signatureName: 'Max Mustermann',
  hasSignature: false,
  attachmentsNote: 'Lebenslauf, Zeugnisse',
  language: 'de',
  font: 'Liberation Sans',
  accentColor: '#14213D',
  createdAt: '2026-11-06T00:00:00Z',
  updatedAt: '2026-11-06T00:00:00Z',
}

const mockListItem: CoverLetterListItem = {
  id: 'cl1',
  title: 'Bewerbung Cloud Specialist',
  recipientCompany: 'CloudScale AG',
  subject: 'Bewerbung als Cloud Specialist',
  date: '06.11.2026',
  updatedAt: '2026-11-06T00:00:00Z',
}

vi.mock('../../api/endpoints', () => ({
  coverLettersApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    uploadSignature: vi.fn(),
    deleteSignature: vi.fn(),
    getPreviewPdf: vi.fn(),
    exportPdf: vi.fn(),
    exportDocx: vi.fn(),
  },
  profileApi: {
    get: vi.fn(),
  },
}))

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>
        <MemoryRouter>
          <CoverLettersPage />
        </MemoryRouter>
      </ConfirmProvider>
    </QueryClientProvider>
  )
}

describe('CoverLettersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-file')
    global.URL.revokeObjectURL = vi.fn()
  })

  it('renders list of cover letters and creates a new one', async () => {
    vi.mocked(coverLettersApi.list).mockResolvedValue([mockListItem])
    vi.mocked(coverLettersApi.get).mockResolvedValue(mockLetter)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Bewerbung Cloud Specialist')).toBeInTheDocument()
      expect(screen.getByText('CloudScale AG')).toBeInTheDocument()
    })

    // Click on the letter to open editor
    fireEvent.click(screen.getByText('Bewerbung Cloud Specialist'))

    await waitFor(() => {
      expect(coverLettersApi.get).toHaveBeenCalledWith('cl1')
      expect(screen.getByDisplayValue('CloudScale AG')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Sehr geehrte Frau Schmidt,')).toBeInTheDocument()
    })
  })

  it('renders empty state when no letters exist', async () => {
    vi.mocked(coverLettersApi.list).mockResolvedValue([])

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Noch keine Anschreiben vorhanden. Erstellen Sie Ihr erstes Anschreiben!')).toBeInTheDocument()
    })
  })

  it('triggers PDF and DOCX downloads when buttons are clicked', async () => {
    vi.mocked(coverLettersApi.list).mockResolvedValue([mockListItem])
    vi.mocked(coverLettersApi.get).mockResolvedValue(mockLetter)
    vi.mocked(coverLettersApi.exportPdf).mockResolvedValue({
      blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
      filename: 'Anschreiben_CloudScale.pdf',
    })
    vi.mocked(coverLettersApi.exportDocx).mockResolvedValue({
      blob: new Blob(['PK\x03\x04'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
      filename: 'Anschreiben_CloudScale.docx',
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Bewerbung Cloud Specialist')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Bewerbung Cloud Specialist'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('CloudScale AG')).toBeInTheDocument()
    })

    // Download PDF
    const downloadPdfBtn = screen.getByTitle('PDF herunterladen')
    fireEvent.click(downloadPdfBtn)

    await waitFor(() => {
      expect(coverLettersApi.exportPdf).toHaveBeenCalledWith(
        'cl1',
        expect.objectContaining({
          font: 'Liberation Sans',
          language: 'de',
        })
      )
    })

    // Download DOCX
    const downloadDocxBtn = screen.getByTitle('Word herunterladen (.docx)')
    fireEvent.click(downloadDocxBtn)

    await waitFor(() => {
      expect(coverLettersApi.exportDocx).toHaveBeenCalledWith(
        'cl1',
        expect.objectContaining({
          font: 'Liberation Sans',
          language: 'de',
        })
      )
    })
  })
})

