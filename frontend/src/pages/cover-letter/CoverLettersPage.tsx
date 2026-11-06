import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { coverLettersApi, profileApi } from '../../api/endpoints'
import type { CoverLetter, CoverLetterPayload, CoverLetterRenderOptions } from '../../api/types'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { Icon } from '../../components/ui/Icon'
import { formatDateTime } from '../../format'

const PRESET_COLORS = [
  { label: 'Navy', hex: '#14213D' },
  { label: 'Blue', hex: '#0284C7' },
  { label: 'Emerald', hex: '#059669' },
  { label: 'Indigo', hex: '#4F46E5' },
  { label: 'Violet', hex: '#7C3AED' },
  { label: 'Rose', hex: '#E11D48' },
  { label: 'Gold', hex: '#B8872A' },
  { label: 'Slate', hex: '#334155' },
]

const FONTS = [
  { label: 'Liberation Sans', value: 'Liberation Sans' },
  { label: 'Roboto', value: 'Roboto' },
  { label: 'Open Sans', value: 'Open Sans' },
  { label: 'Arial', value: 'Arial' },
]

export function CoverLettersPage() {
  const { t, i18n } = useTranslation()
  const initialLang = (i18n.language?.startsWith('en') ? 'en' : 'de') as 'de' | 'en'
  const queryClient = useQueryClient()
  const confirm = useConfirm()

  const [selectedLetter, setSelectedLetter] = useState<CoverLetter | null>(null)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor')

  // PDF Preview State
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const previewUrlRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Query for list of cover letters
  const lettersQuery = useQuery({
    queryKey: ['coverLetters'],
    queryFn: coverLettersApi.list,
  })

  // Mutation for saving / updating
  const saveMutation = useMutation({
    mutationFn: async (letter: CoverLetter) => {
      const payload: CoverLetterPayload = {
        title: letter.title,
        senderName: letter.senderName,
        senderStreet: letter.senderStreet,
        senderPostalCode: letter.senderPostalCode,
        senderCity: letter.senderCity,
        senderPhone: letter.senderPhone,
        senderEmail: letter.senderEmail,
        recipientCompany: letter.recipientCompany,
        recipientDepartment: letter.recipientDepartment,
        recipientContactPerson: letter.recipientContactPerson,
        recipientStreet: letter.recipientStreet,
        recipientPostalCode: letter.recipientPostalCode,
        recipientCity: letter.recipientCity,
        recipientCountry: letter.recipientCountry,
        place: letter.place,
        date: letter.date,
        subject: letter.subject,
        salutation: letter.salutation,
        body: letter.body,
        closing: letter.closing,
        signatureName: letter.signatureName,
        attachmentsNote: letter.attachmentsNote,
        language: letter.language,
        font: letter.font,
        accentColor: letter.accentColor,
      }
      return coverLettersApi.update(letter.id, payload)
    },
    onSuccess: (updated) => {
      setSelectedLetter(updated)
      void queryClient.invalidateQueries({ queryKey: ['coverLetters'] })
      void refreshPreview(updated)
    },
    onError: () => {
      setError(t('common.saveFailed', 'Speichern fehlgeschlagen.'))
    },
  })

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
    }
  }, [])

  // Create new cover letter with prefilled sender data from profile
  const handleCreateNew = async () => {
    try {
      const profile = await profileApi.get().catch(() => null)
      const today = new Date().toLocaleDateString(initialLang === 'en' ? 'en-US' : 'de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })

      const payload: CoverLetterPayload = {
        title: initialLang === 'en' ? 'New Cover Letter' : 'Neues Anschreiben',
        senderName: profile ? `${profile.firstName} ${profile.lastName}`.trim() : '',
        senderStreet: profile?.street ?? '',
        senderPostalCode: profile?.postalCode ?? '',
        senderCity: profile?.city ?? '',
        senderPhone: profile?.phone ?? '',
        senderEmail: profile?.email ?? '',
        recipientCompany: initialLang === 'en' ? 'Example Corp' : 'Musterfirma GmbH',
        recipientDepartment: '',
        recipientContactPerson: '',
        recipientStreet: '',
        recipientPostalCode: '',
        recipientCity: initialLang === 'en' ? 'City' : 'Musterstadt',
        recipientCountry: '',
        place: profile?.city ?? (initialLang === 'en' ? 'City' : 'Musterstadt'),
        date: today,
        subject: initialLang === 'en' ? 'Application as ...' : 'Bewerbung als ...',
        salutation: initialLang === 'en' ? 'Dear Hiring Manager,' : 'Sehr geehrte Damen und Herren,',
        body:
          initialLang === 'en'
            ? 'with great interest I am applying for the position as...\n\nIn my previous career, I gained solid experience in...\n\nI look forward to introducing myself in a personal interview.'
            : 'mit großem Interesse bewerbe ich mich bei Ihnen für die ausgeschriebene Position als...\n\nIn meiner bisherigen beruflichen Laufbahn konnte ich fundierte Erfahrungen sammeln in...\n\nÜber eine Einladung zu einem persönlichen Gespräch freue ich mich sehr.',
        closing: initialLang === 'en' ? 'Sincerely,' : 'Mit freundlichen Grüßen',
        signatureName: profile ? `${profile.firstName} ${profile.lastName}`.trim() : '',
        attachmentsNote: initialLang === 'en' ? 'Resume, Diplomas, References' : 'Lebenslauf, Zeugnisse, Zertifikate',
        language: initialLang,
        font: 'Liberation Sans',
        accentColor: '#14213D',
      }

      const created = await coverLettersApi.create(payload)
      setSelectedLetter(created)
      setActiveTab('editor')
      void queryClient.invalidateQueries({ queryKey: ['coverLetters'] })
    } catch {
      setError(t('coverLetters.createFailed', 'Erstellen fehlgeschlagen.'))
    }
  }

  // Load single letter details
  const handleSelectLetter = async (id: string) => {
    setError(null)
    try {
      const data = await coverLettersApi.get(id)
      setSelectedLetter(data)
      setActiveTab('editor')
    } catch {
      setError(t('common.loadingFailed', 'Laden fehlgeschlagen.'))
    }
  }

  // Delete letter
  const handleDelete = async (id: string, title: string) => {
    const ok = await confirm({
      title: t('common.delete'),
      message: t('coverLetters.deleteConfirm', { title }),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    })
    if (!ok) return

    try {
      await coverLettersApi.delete(id)
      if (selectedLetter?.id === id) {
        setSelectedLetter(null)
        setPreviewBlobUrl(null)
      }
      void queryClient.invalidateQueries({ queryKey: ['coverLetters'] })
    } catch {
      setError(t('common.deleteFailed', 'Löschen fehlgeschlagen.'))
    }
  }

  // Refresh PDF preview
  const refreshPreview = useCallback(async (letterToRender: CoverLetter | null) => {
    if (!letterToRender) return
    setIsPreviewLoading(true)
    try {
      const opts: CoverLetterRenderOptions = {
        font: letterToRender.font ?? 'Liberation Sans',
        accentColor: letterToRender.accentColor ?? '#14213D',
        language: letterToRender.language,
        includeFoldMarks: true,
      }
      const blob = await coverLettersApi.getPreviewPdf(letterToRender.id, opts)
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
      const url = URL.createObjectURL(blob)
      previewUrlRef.current = url
      setPreviewBlobUrl(url)
    } catch {
      // preview error
    } finally {
      setIsPreviewLoading(false)
    }
  }, [])

  // Trigger preview fetch when switching to preview tab
  useEffect(() => {
    if (activeTab === 'preview' && selectedLetter) {
      void refreshPreview(selectedLetter)
    }
  }, [activeTab, selectedLetter, refreshPreview])

  // Download PDF
  const handleDownloadPdf = async () => {
    if (!selectedLetter) return
    setIsDownloadingPdf(true)
    try {
      const opts: CoverLetterRenderOptions = {
        font: selectedLetter.font ?? 'Liberation Sans',
        accentColor: selectedLetter.accentColor ?? '#14213D',
        language: selectedLetter.language,
        includeFoldMarks: true,
      }
      const { blob, filename } = await coverLettersApi.exportPdf(selectedLetter.id, opts)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError(t('coverLetters.downloadFailed', 'Download fehlgeschlagen.'))
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  // Download Docx
  const handleDownloadDocx = async () => {
    if (!selectedLetter) return
    setIsDownloadingDocx(true)
    try {
      const opts: CoverLetterRenderOptions = {
        font: selectedLetter.font ?? 'Liberation Sans',
        accentColor: selectedLetter.accentColor ?? '#14213D',
        language: selectedLetter.language,
        includeFoldMarks: true,
      }
      const { blob, filename } = await coverLettersApi.exportDocx(selectedLetter.id, opts)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError(t('coverLetters.downloadFailed', 'Download fehlgeschlagen.'))
    } finally {
      setIsDownloadingDocx(false)
    }
  }

  // Upload Signature
  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedLetter) return
    try {
      const updated = await coverLettersApi.uploadSignature(selectedLetter.id, file)
      setSelectedLetter(updated)
      void refreshPreview(updated)
    } catch {
      setError(t('coverLetters.signatureUploadFailed', 'Unterschrift konnte nicht hochgeladen werden.'))
    }
  }

  // Delete Signature
  const handleSignatureDelete = async () => {
    if (!selectedLetter) return
    try {
      const updated = await coverLettersApi.deleteSignature(selectedLetter.id)
      setSelectedLetter(updated)
      void refreshPreview(updated)
    } catch {
      setError(t('coverLetters.signatureDeleteFailed', 'Unterschrift konnte nicht gelöscht werden.'))
    }
  }

  const updateField = <K extends keyof CoverLetter>(key: K, value: CoverLetter[K]) => {
    if (!selectedLetter) return
    setSelectedLetter({ ...selectedLetter, [key]: value })
  }

  const letters = lettersQuery.data ?? []

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">{t('coverLetters.title')}</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{t('coverLetters.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedLetter ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedLetter(null)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
              >
                <Icon name="chevronLeft" className="w-4 h-4" />
                <span>{t('coverLetters.actions.backToList')}</span>
              </button>
              <button
                type="button"
                onClick={() => saveMutation.mutate(selectedLetter)}
                disabled={saveMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-sm"
              >
                <Icon name="deviceFloppy" className="w-4 h-4" />
                <span>{saveMutation.isPending ? t('coverLetters.actions.saving') : t('common.save')}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleCreateNew}
              disabled={lettersQuery.isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-sm"
            >
              <Icon name="plus" className="w-4 h-4" />
              <span>{t('coverLetters.newLetter')}</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Main Content Area */}
      {!selectedLetter ? (
        // Letters List View
        <div>
          {letters.length === 0 && !lettersQuery.isLoading ? (
            <div className="text-center py-16 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg">
              <Icon name="files" className="w-12 h-12 mx-auto text-neutral-400 mb-3" />
              <p className="text-neutral-600 dark:text-neutral-400 font-medium">{t('coverLetters.empty')}</p>
              <button
                type="button"
                onClick={handleCreateNew}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Icon name="plus" className="w-4 h-4" />
                <span>{t('coverLetters.newLetter')}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {letters.map((letter) => (
                <div
                  key={letter.id}
                  className="card p-5 hover:border-blue-500/50 transition-colors flex flex-col justify-between cursor-pointer"
                  onClick={() => void handleSelectLetter(letter.id)}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">{letter.title}</h2>
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shrink-0 font-medium">
                        DIN 5008
                      </span>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2 line-clamp-1">
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">{letter.recipientCompany}</span>
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1 line-clamp-1">{letter.subject}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
                    <span>{letter.date ?? formatDateTime(letter.updatedAt, i18n.language)}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDelete(letter.id, letter.title)
                      }}
                      className="text-red-500 hover:text-red-700 p-1 rounded"
                      title={t('common.delete')}
                    >
                      <Icon name="trash" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Letter Editor & Preview View
        <div className="space-y-4">
          {/* Editor Header Navigation & Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-neutral-50 dark:bg-neutral-900/40 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                  activeTab === 'editor'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                }`}
              >
                {t('coverLetters.tabs.editor')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                  activeTab === 'preview'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                }`}
              >
                {t('coverLetters.tabs.preview')}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadDocx}
                disabled={isDownloadingDocx}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                title={t('coverLetters.actions.downloadDocx')}
              >
                <Icon name="download" className="w-3.5 h-3.5" />
                <span>{t('coverLetters.actions.downloadDocx')}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                title={t('coverLetters.actions.downloadPdf')}
              >
                <Icon name="download" className="w-3.5 h-3.5" />
                <span>{t('coverLetters.actions.downloadPdf')}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(selectedLetter.id, selectedLetter.title)}
                className="p-1.5 text-red-500 hover:text-red-700 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                title={t('common.delete')}
              >
                <Icon name="trash" className="w-4 h-4" />
              </button>
            </div>
          </div>

          {activeTab === 'editor' ? (
            // Editor Form Layout
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content Columns (2 cols) */}
              <div className="lg:col-span-2 space-y-6">
                {/* Title & Language */}
                <div className="card p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                        {t('coverLetters.fields.title')}
                      </label>
                      <input
                        type="text"
                        value={selectedLetter.title}
                        onChange={(e) => updateField('title', e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                        {t('coverLetters.fields.language')}
                      </label>
                      <select
                        value={selectedLetter.language}
                        onChange={(e) => updateField('language', e.target.value as 'de' | 'en')}
                        className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-sm"
                      >
                        <option value="de">Deutsch (DIN 5008)</option>
                        <option value="en">English (Business Letter)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Recipient Box (DIN 5008 Anschriftfeld) */}
                <div className="card p-5 space-y-4">
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-2">
                    <Icon name="briefcase" className="w-4 h-4 text-blue-600" />
                    {t('coverLetters.fields.recipientSection')}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                        {t('coverLetters.fields.recipientCompany')} *
                      </label>
                      <input
                        type="text"
                        value={selectedLetter.recipientCompany}
                        onChange={(e) => updateField('recipientCompany', e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                        {t('coverLetters.fields.recipientDepartment')}
                      </label>
                      <input
                        type="text"
                        value={selectedLetter.recipientDepartment ?? ''}
                        onChange={(e) => updateField('recipientDepartment', e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                        {t('coverLetters.fields.recipientContactPerson')}
                      </label>
                      <input
                        type="text"
                        value={selectedLetter.recipientContactPerson ?? ''}
                        onChange={(e) => updateField('recipientContactPerson', e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                        {t('coverLetters.fields.recipientStreet')}
                      </label>
                      <input
                        type="text"
                        value={selectedLetter.recipientStreet ?? ''}
                        onChange={(e) => updateField('recipientStreet', e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                        {t('coverLetters.fields.recipientPostalCode')}
                      </label>
                      <input
                        type="text"
                        value={selectedLetter.recipientPostalCode ?? ''}
                        onChange={(e) => updateField('recipientPostalCode', e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                        {t('coverLetters.fields.recipientCity')} *
                      </label>
                      <input
                        type="text"
                        value={selectedLetter.recipientCity}
                        onChange={(e) => updateField('recipientCity', e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-sm"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Letter Body & DIN Content */}
                <div className="card p-5 space-y-4">
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-2">
                    <Icon name="fileText" className="w-4 h-4 text-blue-600" />
                    {t('coverLetters.fields.contentSection')}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                        {t('coverLetters.fields.place')}
                      </label>
                      <input
                        type="text"
                        value={selectedLetter.place ?? ''}
                        onChange={(e) => updateField('place', e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                        {t('coverLetters.fields.date')}
                      </label>
                      <input
                        type="text"
                        value={selectedLetter.date ?? ''}
                        onChange={(e) => updateField('date', e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                        {t('coverLetters.fields.subject')} *
                      </label>
                      <input
                        type="text"
                        value={selectedLetter.subject}
                        onChange={(e) => updateField('subject', e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-sm font-semibold"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                        {t('coverLetters.fields.salutation')} *
                      </label>
                      <input
                        type="text"
                        value={selectedLetter.salutation}
                        onChange={(e) => updateField('salutation', e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-sm"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                        {t('coverLetters.fields.body')} *
                      </label>
                      <textarea
                        rows={12}
                        value={selectedLetter.body}
                        onChange={(e) => updateField('body', e.target.value)}
                        placeholder={t('coverLetters.fields.bodyPlaceholder')}
                        className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-sm leading-relaxed font-sans"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                        {t('coverLetters.fields.closing')}
                      </label>
                      <input
                        type="text"
                        value={selectedLetter.closing}
                        onChange={(e) => updateField('closing', e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                        {t('coverLetters.fields.signatureName')}
                      </label>
                      <input
                        type="text"
                        value={selectedLetter.signatureName ?? ''}
                        onChange={(e) => updateField('signatureName', e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                        {t('coverLetters.fields.attachmentsNote')}
                      </label>
                      <input
                        type="text"
                        value={selectedLetter.attachmentsNote ?? ''}
                        onChange={(e) => updateField('attachmentsNote', e.target.value)}
                        placeholder="Lebenslauf, Arbeitszeugnisse"
                        className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar Column (1 col): Sender Details, Signature, Design Options */}
              <div className="space-y-6">
                {/* Design Options */}
                <div className="card p-5 space-y-4">
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-2">
                    <Icon name="palette" className="w-4 h-4 text-blue-600" />
                    {t('coverLetters.fields.optionsSection')}
                  </h3>

                  <div>
                    <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-2">
                      {t('coverLetters.fields.accentColor')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_COLORS.map((color) => {
                        const isSelected = (selectedLetter.accentColor ?? '#14213D').toLowerCase() === color.hex.toLowerCase()
                        return (
                          <button
                            key={color.hex}
                            type="button"
                            onClick={() => updateField('accentColor', color.hex)}
                            className={`w-7 h-7 rounded-full border-2 transition-transform ${
                              isSelected ? 'scale-110 border-blue-500 ring-2 ring-blue-300' : 'border-white dark:border-neutral-900'
                            }`}
                            style={{ backgroundColor: color.hex }}
                            title={color.label}
                          />
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                      {t('coverLetters.fields.font')}
                    </label>
                    <select
                      value={selectedLetter.font ?? 'Liberation Sans'}
                      onChange={(e) => updateField('font', e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-sm"
                    >
                      {FONTS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Digital Signature */}
                <div className="card p-5 space-y-3">
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-2">
                    <Icon name="pencil" className="w-4 h-4 text-blue-600" />
                    {t('coverLetters.fields.signatureSection')}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('coverLetters.fields.signatureHint')}</p>

                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleSignatureUpload} />

                  {selectedLetter.hasSignature ? (
                    <div className="flex items-center justify-between p-2.5 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-300">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Icon name="check" className="w-4 h-4" />
                        {t('coverLetters.fields.hasSignature')}
                      </span>
                      <button
                        type="button"
                        onClick={handleSignatureDelete}
                        className="text-red-500 hover:text-red-700 font-semibold underline text-xs"
                      >
                        {t('coverLetters.fields.deleteSignature')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 px-3 text-xs font-semibold rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-blue-500 text-neutral-600 dark:text-neutral-400 flex items-center justify-center gap-1.5"
                    >
                      <Icon name="upload" className="w-3.5 h-3.5" />
                      <span>{t('coverLetters.fields.uploadSignature')}</span>
                    </button>
                  )}
                </div>

                {/* Sender Information (Customizable per letter) */}
                <div className="card p-5 space-y-3">
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-2">
                    <Icon name="users" className="w-4 h-4 text-blue-600" />
                    {t('coverLetters.fields.senderSection')}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('coverLetters.fields.senderHint')}</p>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-0.5">
                        {t('coverLetters.fields.senderName')}
                      </label>
                      <input
                        type="text"
                        value={selectedLetter.senderName ?? ''}
                        onChange={(e) => updateField('senderName', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-0.5">
                        {t('coverLetters.fields.senderStreet')}
                      </label>
                      <input
                        type="text"
                        value={selectedLetter.senderStreet ?? ''}
                        onChange={(e) => updateField('senderStreet', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-0.5">
                          {t('coverLetters.fields.senderPostalCode')}
                        </label>
                        <input
                          type="text"
                          value={selectedLetter.senderPostalCode ?? ''}
                          onChange={(e) => updateField('senderPostalCode', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-0.5">
                          {t('coverLetters.fields.senderCity')}
                        </label>
                        <input
                          type="text"
                          value={selectedLetter.senderCity ?? ''}
                          onChange={(e) => updateField('senderCity', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-0.5">
                        {t('coverLetters.fields.senderEmail')}
                      </label>
                      <input
                        type="email"
                        value={selectedLetter.senderEmail ?? ''}
                        onChange={(e) => updateField('senderEmail', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-0.5">
                        {t('coverLetters.fields.senderPhone')}
                      </label>
                      <input
                        type="tel"
                        value={selectedLetter.senderPhone ?? ''}
                        onChange={(e) => updateField('senderPhone', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-surface text-ink text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Live PDF Preview Tab
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <Icon name="fileText" className="w-4 h-4 text-blue-600" />
                  DIN 5008 Live-Vorschau
                </span>
                <button
                  type="button"
                  onClick={() => void refreshPreview(selectedLetter)}
                  disabled={isPreviewLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <Icon name="refresh" className={`w-3.5 h-3.5 ${isPreviewLoading ? 'animate-spin' : ''}`} />
                  <span>{t('coverLetters.actions.refreshPreview')}</span>
                </button>
              </div>

              <div className="w-full h-[750px] bg-neutral-100 dark:bg-neutral-900 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 relative">
                {isPreviewLoading && (
                  <div className="absolute inset-0 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xs flex items-center justify-center z-10">
                    <div className="flex flex-col items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                      <Icon name="refresh" className="w-6 h-6 animate-spin text-blue-600" />
                      <span>{t('profile.preview.loading')}</span>
                    </div>
                  </div>
                )}
                {previewBlobUrl ? (
                  <object data={previewBlobUrl} type="application/pdf" className="w-full h-full">
                    <p className="p-8 text-center text-sm text-neutral-600 dark:text-neutral-400">
                      PDF-Vorschau nicht unterstützt.{' '}
                      <a href={previewBlobUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                        {t('coverLetters.actions.openNewTab')}
                      </a>
                    </p>
                  </object>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-neutral-500">
                    {t('profile.preview.loading')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
