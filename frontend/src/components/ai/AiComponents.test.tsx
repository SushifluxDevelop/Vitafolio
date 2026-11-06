// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../i18n'
import { aiApi } from '../../api/endpoints'
import type { AiConfig } from '../../api/types'
import { AiAssistantModal } from './AiAssistantModal'
import { AiSettingsModal } from './AiSettingsModal'

beforeAll(async () => {
  await i18n.changeLanguage('de')
})

const mockDefaultConfig: AiConfig = {
  provider: 'copy_paste',
  model: 'gpt-4o-mini',
  baseUrl: null,
  hasApiKey: false,
  pseudonymize: true,
}

const mockDirectConfig: AiConfig = {
  provider: 'openai',
  model: 'gpt-4o',
  baseUrl: null,
  hasApiKey: true,
  pseudonymize: true,
}

vi.mock('../../api/endpoints', () => ({
  aiApi: {
    getConfig: vi.fn(),
    saveConfig: vi.fn(),
    testConnection: vi.fn(),
    buildPrompt: vi.fn(),
    parseResponse: vi.fn(),
    generate: vi.fn(),
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('AiSettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(aiApi.getConfig).mockResolvedValue(mockDefaultConfig)
  })

  it('renders provider selection and copy-paste guidance in default mode', async () => {
    render(<AiSettingsModal open onClose={vi.fn()} />, { wrapper: createWrapper() })

    expect(await screen.findByText('KI-Einstellungen')).toBeInTheDocument()
    expect(await screen.findByText(/Kostenlos & 100% datenschutzfreundlich/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Persönliche Daten durch Platzhalter schützen/i)).toBeChecked()
  })

  it('switches provider to openai, inputs API key, tests connection and saves', async () => {
    vi.mocked(aiApi.saveConfig).mockResolvedValue(mockDirectConfig)
    vi.mocked(aiApi.testConnection).mockResolvedValue({ success: true, message: 'OK' })

    render(<AiSettingsModal open onClose={vi.fn()} />, { wrapper: createWrapper() })

    // Change provider
    const select = await screen.findByRole('combobox')
    fireEvent.change(select, { target: { value: 'openai' } })

    // Input API Key
    const keyInput = screen.getByPlaceholderText(/Neuen Schlüssel eingeben/i)
    fireEvent.change(keyInput, { target: { value: 'sk-test-12345' } })

    // Test connection
    const testBtn = screen.getByRole('button', { name: /Verbindung testen/i })
    fireEvent.click(testBtn)

    await waitFor(() => {
      expect(aiApi.testConnection).toHaveBeenCalled()
    })

    // Save
    const saveBtn = screen.getByRole('button', { name: /Einstellungen speichern/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(aiApi.saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
          apiKey: 'sk-test-12345',
        })
      )
    })
  })
})

describe('AiAssistantModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(aiApi.getConfig).mockResolvedValue(mockDefaultConfig)
  })

  it('handles copy-paste workflow for cover letter generation and applies result', async () => {
    const handleApply = vi.fn()
    vi.mocked(aiApi.buildPrompt).mockResolvedValue({
      task: 'generate_cover_letter',
      systemPrompt: 'System Prompt',
      userPrompt: 'User Prompt',
      fullCopyPasteText: 'Full copy paste prompt',
      pseudonymized: true,
    })

    vi.mocked(aiApi.parseResponse).mockResolvedValue({
      subject: 'Bewerbung als Senior Cloud Engineer',
      salutation: 'Sehr geehrte Damen und Herren,',
      opening: 'Einleitungstext.',
      body: 'Hauptteil des Anschreibens.',
      closing: 'Mit freundlichen Grüßen',
      keyMatches: ['Kubernetes', 'Cloud'],
    })

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })

    render(
      <AiAssistantModal
        open
        onClose={vi.fn()}
        task="generate_cover_letter"
        initialJobTitle="Senior Cloud Engineer"
        initialCompany="CloudScale AG"
        onApplyCoverLetter={handleApply}
      />,
      { wrapper: createWrapper() }
    )

    expect(await screen.findByText('Anschreiben formulieren')).toBeInTheDocument()

    // 1. Copy Prompt
    const copyBtn = screen.getByRole('button', { name: /1\. Prompt kopieren/i })
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(aiApi.buildPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          task: 'generate_cover_letter',
          jobTitle: 'Senior Cloud Engineer',
          company: 'CloudScale AG',
        })
      )
    })

    // 2. Paste Answer
    const textarea = screen.getByPlaceholderText(/Fügen Sie die vollständige Antwort aus Ihrem KI-Chat hier ein/i)
    fireEvent.change(textarea, { target: { value: '```json\n{"subject":"Bewerbung als Senior Cloud Engineer"}\n```' } })

    // 3. Parse Answer
    const parseBtn = screen.getByRole('button', { name: /3\. Antwort auswerten & übernehmen/i })
    fireEvent.click(parseBtn)

    await waitFor(() => {
      expect(aiApi.parseResponse).toHaveBeenCalled()
    })

    // 4. Preview should be rendered
    expect(await screen.findByText('Vorschau Anschreiben')).toBeInTheDocument()
    expect(screen.getByText('Bewerbung als Senior Cloud Engineer')).toBeInTheDocument()

    // 5. Apply
    const applyBtn = screen.getByRole('button', { name: /In Anschreiben übernehmen/i })
    fireEvent.click(applyBtn)

    expect(handleApply).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Bewerbung als Senior Cloud Engineer',
      })
    )
  })

  it('renders job analysis match score and tips', async () => {
    vi.mocked(aiApi.parseResponse).mockResolvedValue({
      matchScore: 92,
      summary: 'Hervorragende Passung.',
      matchedRequirements: [
        { requirement: '5+ Jahre Cloud', candidateMatch: '7 Jahre bei CloudScale' },
      ],
      missingRequirements: [
        { requirement: 'Go Kenntnisse', suggestion: 'Erwähne C# und Rust' },
      ],
      tips: ['Fokussiere auf Multi-Region Architektur.'],
    })

    render(
      <AiAssistantModal
        open
        onClose={vi.fn()}
        task="analyze_job"
        initialJobTitle="Lead Cloud Architect"
        initialCompany="Enterprise Corp"
      />,
      { wrapper: createWrapper() }
    )

    expect(await screen.findByText('Stellenanzeige analysieren')).toBeInTheDocument()

    const textarea = screen.getByPlaceholderText(/Fügen Sie die vollständige Antwort aus Ihrem KI-Chat hier ein/i)
    fireEvent.change(textarea, { target: { value: '{"matchScore": 92}' } })

    const parseBtn = screen.getByRole('button', { name: /3\. Antwort auswerten & übernehmen/i })
    fireEvent.click(parseBtn)

    expect(await screen.findByText('92 %')).toBeInTheDocument()
    expect(screen.getByText('Hervorragende Passung.')).toBeInTheDocument()
    expect(screen.getByText('5+ Jahre Cloud')).toBeInTheDocument()
    expect(screen.getByText(/Fokussiere auf Multi-Region Architektur/i)).toBeInTheDocument()
  })
})
