import { useState, useRef } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { profileApi } from '../../api/endpoints'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { ErrorNotice, Notice } from '../../components/ui/Notice'
import type { Profile } from '../../api/types'

interface JsonResumeModalProps {
  open: boolean
  onClose: () => void
  onImportSuccess: (profile: Profile) => void
}

export function JsonResumeModal({ open, onClose, onImportSuccess }: JsonResumeModalProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'export' | 'import'>('export')
  const [replace, setReplace] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await profileApi.getJsonResume()
      const jsonString = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'resume.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSuccess(t('profile.jsonResume.exportSuccess') ?? 'JSON Resume erfolgreich exportiert.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Exportieren.')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setError(null)
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      try {
        JSON.parse(content) // Validate JSON syntax
        setJsonText(content)
      } catch {
        setError('Die ausgewählte Datei enthält kein gültiges JSON.')
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!jsonText.trim()) {
      setError('Bitte wählen Sie eine JSON-Datei aus oder fügen Sie JSON ein.')
      return
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      setError('Ungültiges JSON-Format. Bitte prüfen Sie den Inhalt.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const updatedProfile = await profileApi.importJsonResume(parsed, replace)
      onImportSuccess(updatedProfile)
      setSuccess(t('profile.jsonResume.importSuccess') ?? 'JSON Resume erfolgreich importiert!')
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Importieren.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="JSON Resume Standard (v1.0.0)"
      icon="files"
      size="md"
    >
      <div className="space-y-4">
        <Notice tone="info">
          Der offene <strong>JSON Resume</strong> Standard (jsonresume.org) ermöglicht den nahtlosen
          Austausch Ihrer Profildaten mit anderen Tools, Portalen und Open-Source-Generatoren.
        </Notice>

        <div className="flex border-b border-border">
          <button
            type="button"
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              mode === 'export'
                ? 'border-b-2 border-primary text-primary font-semibold'
                : 'text-ink-muted hover:text-ink'
            }`}
            onClick={() => {
              setMode('export')
              setError(null)
              setSuccess(null)
            }}
          >
            Exportieren (JSON herunterladen)
          </button>
          <button
            type="button"
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              mode === 'import'
                ? 'border-b-2 border-primary text-primary font-semibold'
                : 'text-ink-muted hover:text-ink'
            }`}
            onClick={() => {
              setMode('import')
              setError(null)
              setSuccess(null)
            }}
          >
            Importieren (JSON einlesen)
          </button>
        </div>

        {error && <ErrorNotice error={error} />}
        {success && <Notice tone="success">{success}</Notice>}

        {mode === 'export' ? (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-ink-muted">
              Laden Sie Ihr gesamtes Profil (Stammdaten, Werdegang, Ausbildung, Kenntnisse, Sprachen,
              Zertifikate, Interessen) im standardisierten Schema <code className="bg-canvas-subtle px-1 py-0.5 rounded text-xs">schema.json</code> herunter.
            </p>
            <div className="flex justify-end pt-2">
              <Button
                variant="confirm"
                icon="download"
                onClick={handleExport}
                disabled={loading}
              >
                {loading ? 'Wird vorbereitet...' : 'resume.json herunterladen'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-ink">
                JSON Resume Datei (.json)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".json,application/json"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  variant="secondary"
                  icon="upload"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  Datei auswählen
                </Button>
                {fileName && <span className="text-sm text-ink font-medium">{fileName}</span>}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-ink-muted font-medium">
                Oder JSON-Inhalt direkt einfügen:
              </label>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='{ "$schema": "...", "basics": { ... } }'
                rows={6}
                className="w-full font-mono text-xs p-2.5 rounded border border-border bg-canvas text-ink focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="replaceExisting"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <label htmlFor="replaceExisting" className="text-sm text-ink">
                Bestehende Stationen und Kenntnisse ersetzen (statt anzufügen)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={onClose} disabled={loading}>
                Abbrechen
              </Button>
              <Button
                variant="confirm"
                icon="upload"
                onClick={handleImport}
                disabled={loading || !jsonText.trim()}
              >
                {loading ? 'Wird importiert...' : 'Importieren'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}
