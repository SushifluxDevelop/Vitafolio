import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../i18n'
import { profileApi } from '../../api/endpoints'
import { PreviewTab } from './PreviewTab'

vi.mock('../../api/endpoints', () => ({
  profileApi: {
    getPreviewPdf: vi.fn(),
    exportPdf: vi.fn(),
  },
}))

describe('PreviewTab', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('de')
  })

  beforeEach(() => {
    vi.clearAllMocks()
    global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-pdf')
    global.URL.revokeObjectURL = vi.fn()
    vi.mocked(profileApi.getPreviewPdf).mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }))
    vi.mocked(profileApi.exportPdf).mockResolvedValue({
      blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
      filename: 'Lebenslauf_Max_Mustermann.pdf',
    })
  })

  it('renders design options, controls and requests initial preview', async () => {
    render(<PreviewTab />)

    expect(screen.getByText('Lebenslauf-Vorschau')).toBeInTheDocument()
    expect(screen.getByText('Klassisch')).toBeInTheDocument()
    expect(screen.getByText('Modern')).toBeInTheDocument()
    expect(screen.getByText('PDF herunterladen')).toBeInTheDocument()

    await waitFor(() => {
      expect(profileApi.getPreviewPdf).toHaveBeenCalledWith(
        expect.objectContaining({
          design: 'classic',
          accentColor: '#14213D',
        })
      )
    })
  })

  it('allows switching to modern design', async () => {
    render(<PreviewTab />)

    const modernBtn = screen.getByText('Modern')
    fireEvent.click(modernBtn)

    await waitFor(() => {
      expect(profileApi.getPreviewPdf).toHaveBeenCalledWith(
        expect.objectContaining({
          design: 'modern',
        })
      )
    })
  })

  it('allows switching to plain design', async () => {
    render(<PreviewTab />)

    const plainBtn = screen.getByText('Schlicht')
    fireEvent.click(plainBtn)

    await waitFor(() => {
      expect(profileApi.getPreviewPdf).toHaveBeenCalledWith(
        expect.objectContaining({
          design: 'plain',
        })
      )
    })
  })

  it('allows picking another accent color', async () => {
    render(<PreviewTab />)

    const emeraldBtn = screen.getByTitle('Emerald (#059669)')
    fireEvent.click(emeraldBtn)

    await waitFor(() => {
      expect(profileApi.getPreviewPdf).toHaveBeenCalledWith(
        expect.objectContaining({
          accentColor: '#059669',
        })
      )
    })
  })

  it('triggers exportPdf on download click', async () => {
    render(<PreviewTab />)

    const downloadBtn = screen.getByText('PDF herunterladen')
    fireEvent.click(downloadBtn)

    await waitFor(() => {
      expect(profileApi.exportPdf).toHaveBeenCalled()
    })
  })
})
