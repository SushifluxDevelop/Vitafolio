import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { profileApi } from '../../api/endpoints'
import type { CvRenderOptions } from '../../api/types'
import { Icon } from '../../components/ui/Icon'

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
  { label: 'DejaVu Sans', value: 'DejaVu Sans' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Calibri', value: 'Calibri' },
]

export function PreviewTab() {
  const { t, i18n } = useTranslation()
  const initialLang = (i18n.language?.startsWith('en') ? 'en' : 'de') as 'de' | 'en'

  const [options, setOptions] = useState<CvRenderOptions>({
    design: 'classic',
    accentColor: '#14213D',
    font: 'Liberation Sans',
    showPhoto: true,
    photoShape: 'rounded',
    language: initialLang,
  })

  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track active blob url to revoke when replacing or unmounting
  const activeUrlRef = useRef<string | null>(null)

  const updateOptions = (patch: Partial<CvRenderOptions>) => {
    setOptions((prev) => ({ ...prev, ...patch }))
  }

  // Load preview PDF when options change (with debounce)
  useEffect(() => {
    let isCancelled = false

    const timer = setTimeout(async () => {
      setIsLoading(true)
      setError(null)
      try {
        const blob = await profileApi.getPreviewPdf(options)
        if (isCancelled) return

        if (activeUrlRef.current) {
          URL.revokeObjectURL(activeUrlRef.current)
        }

        const url = URL.createObjectURL(blob)
        activeUrlRef.current = url
        setPdfUrl(url)
      } catch {
        if (!isCancelled) {
          setError(t('profile.preview.noPdf'))
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }, 250)

    return () => {
      isCancelled = true
      clearTimeout(timer)
    }
  }, [options, t])

  // Revoke object URL on unmount
  useEffect(() => {
    return () => {
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current)
        activeUrlRef.current = null
      }
    }
  }, [])

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const { blob, filename } = await profileApi.exportPdf(options)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError(t('profile.preview.noPdf'))
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDownloadDocx = async () => {
    setIsDownloadingDocx(true)
    try {
      const { blob, filename } = await profileApi.exportDocx(options)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError(t('profile.preview.noPdf'))
    } finally {
      setIsDownloadingDocx(false)
    }
  }

  const handleRefresh = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const blob = await profileApi.getPreviewPdf(options)
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current)
      }
      const url = URL.createObjectURL(blob)
      activeUrlRef.current = url
      setPdfUrl(url)
    } catch {
      setError(t('profile.preview.noPdf'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{t('profile.preview.title')}</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{t('profile.preview.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
            title={t('profile.preview.refresh')}
          >
            <Icon name="refresh" className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('profile.preview.refresh')}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadDocx}
            disabled={isDownloadingDocx}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
            title={t('profile.preview.downloadDocx')}
          >
            <Icon name="download" className="w-4 h-4" />
            <span className="hidden md:inline">{isDownloadingDocx ? t('profile.preview.downloadingDocx') : t('profile.preview.downloadDocx')}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-sm"
          >
            <Icon name="download" className="w-4 h-4" />
            <span>{isDownloading ? t('profile.preview.downloading') : t('profile.preview.download')}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Controls on left, PDF viewer on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls Column */}
        <div className="lg:col-span-4 space-y-5 bg-white dark:bg-neutral-900 p-5 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-sm">
          {/* Design Selection */}
          <div>
            <label className="block text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
              {t('profile.preview.design')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => updateOptions({ design: 'classic' })}
                className={`p-2.5 text-left rounded-lg border text-xs transition-all ${
                  options.design === 'classic'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-600'
                    : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                }`}
              >
                <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('profile.preview.designs.classic')}
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2">
                  {t('profile.preview.designs.classicDesc')}
                </div>
              </button>

              <button
                type="button"
                onClick={() => updateOptions({ design: 'modern' })}
                className={`p-2.5 text-left rounded-lg border text-xs transition-all ${
                  options.design === 'modern'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-600'
                    : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                }`}
              >
                <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('profile.preview.designs.modern')}
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2">
                  {t('profile.preview.designs.modernDesc')}
                </div>
              </button>

              <button
                type="button"
                onClick={() => updateOptions({ design: 'plain' })}
                className={`p-2.5 text-left rounded-lg border text-xs transition-all ${
                  options.design === 'plain'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-600'
                    : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                }`}
              >
                <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('profile.preview.designs.plain')}
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2">
                  {t('profile.preview.designs.plainDesc')}
                </div>
              </button>
            </div>
          </div>

          {/* Language Selection */}
          <div>
            <label className="block text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
              {t('profile.preview.language')}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => updateOptions({ language: 'de' })}
                className={`flex-1 py-1.5 px-3 text-sm rounded-md border font-medium transition-colors ${
                  options.language === 'de'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                {t('profile.preview.languageDe')}
              </button>
              <button
                type="button"
                onClick={() => updateOptions({ language: 'en' })}
                className={`flex-1 py-1.5 px-3 text-sm rounded-md border font-medium transition-colors ${
                  options.language === 'en'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                {t('profile.preview.languageEn')}
              </button>
            </div>
          </div>

          {/* Accent Color Selection */}
          <div>
            <label className="block text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
              {t('profile.preview.color')}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => updateOptions({ accentColor: c.hex })}
                  className={`h-9 rounded-md flex items-center justify-center transition-transform ${
                    options.accentColor === c.hex ? 'ring-2 ring-offset-2 ring-neutral-900 dark:ring-neutral-100 scale-105' : 'hover:scale-102'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={`${c.label} (${c.hex})`}
                >
                  {options.accentColor === c.hex && (
                    <Icon name="check" className="w-4 h-4 text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Font Selection */}
          <div>
            <label className="block text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
              {t('profile.preview.font')}
            </label>
            <select
              value={options.font || 'Liberation Sans'}
              onChange={(e) => updateOptions({ font: e.target.value })}
              className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100"
            >
              {FONTS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Photo Settings */}
          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.showPhoto ?? true}
                onChange={(e) => updateOptions({ showPhoto: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-neutral-300 dark:border-neutral-700"
              />
              <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                {t('profile.preview.showPhoto')}
              </span>
            </label>

            {options.showPhoto && (
              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5">
                  {t('profile.preview.photoShape')}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateOptions({ photoShape: 'round' })}
                    className={`flex-1 py-1 px-2 text-xs rounded border transition-colors ${
                      options.photoShape === 'round'
                        ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 border-transparent'
                        : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    {t('profile.preview.photoShapes.round')}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateOptions({ photoShape: 'rounded' })}
                    className={`flex-1 py-1 px-2 text-xs rounded border transition-colors ${
                      options.photoShape === 'rounded'
                        ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 border-transparent'
                        : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    {t('profile.preview.photoShapes.rounded')}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateOptions({ photoShape: 'rect' })}
                    className={`flex-1 py-1 px-2 text-xs rounded border transition-colors ${
                      options.photoShape === 'rect'
                        ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 border-transparent'
                        : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    {t('profile.preview.photoShapes.rect')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PDF Viewer Column */}
        <div className="lg:col-span-8 bg-neutral-100 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden relative shadow-inner min-h-[600px] h-[calc(100vh-230px)] flex flex-col">
          {/* Subtle status banner when loading */}
          {isLoading && (
            <div className="absolute top-3 right-3 z-10 bg-white/90 dark:bg-neutral-900/90 backdrop-blur px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 shadow flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
              <Icon name="refresh" className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>{t('profile.preview.loading')}</span>
            </div>
          )}

          {error ? (
            <div className="m-auto text-center p-8 max-w-md">
              <Icon name="alertTriangle" className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{error}</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-4 px-4 py-2 text-xs font-medium rounded-md bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 hover:opacity-90"
              >
                {t('profile.preview.refresh')}
              </button>
            </div>
          ) : pdfUrl ? (
            <object
              data={pdfUrl}
              type="application/pdf"
              className="w-full h-full flex-1"
              aria-label="PDF Preview"
            >
              <div className="m-auto text-center p-8 max-w-md">
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                  {t('profile.preview.subtitle')}
                </p>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Icon name="fileExport" className="w-4 h-4" />
                  {t('profile.preview.openNewTab')}
                </a>
              </div>
            </object>
          ) : (
            <div className="m-auto text-center p-8">
              <Icon name="refresh" className="w-8 h-8 animate-spin text-neutral-400 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">{t('profile.preview.loading')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
