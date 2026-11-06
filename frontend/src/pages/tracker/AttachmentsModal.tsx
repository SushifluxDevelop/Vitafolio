import { useState, useRef } from 'react'
import type { ChangeEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { attachmentsApi } from '../../api/endpoints'
import { Button } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { Dialog } from '../../components/ui/Dialog'
import { ErrorNotice, Notice } from '../../components/ui/Notice'
import { Icon } from '../../components/ui/Icon'
import { TextField } from '../../components/ui/TextField'

interface AttachmentsModalProps {
  open: boolean
  onClose: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentsModal({ open, onClose }: AttachmentsModalProps) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCategory, setUploadCategory] = useState('Zeugnis')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ['attachments'],
    queryFn: attachmentsApi.list,
    enabled: open,
  })

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('Bitte wählen Sie eine Datei aus.')
      return attachmentsApi.upload(selectedFile, uploadTitle.trim() || undefined, uploadCategory || undefined)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attachments'] })
      setSelectedFile(null)
      setUploadTitle('')
      setError(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => attachmentsApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attachments'] })
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.'),
  })

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    if (!uploadTitle.trim()) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
      setUploadTitle(nameWithoutExt)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Anlagen & Zeugnisse verwalten"
      icon="files"
      size="lg"
    >
      <div className="space-y-6">
        <Notice tone="info">
          Laden Sie Arbeitszeugnisse, Diplome, Zertifikate oder Arbeitsproben hoch. Diese können Sie
          anschließend flexibel jedem Bewerbungsdossier anhängen.
        </Notice>

        {error && <ErrorNotice error={error} />}

        {/* Upload form card */}
        <div className="p-4 rounded-lg border border-border bg-canvas-subtle space-y-4">
          <h3 className="font-semibold text-sm text-ink flex items-center gap-2">
            <Icon name="upload" size={16} />
            Neues Dokument hinzufügen (PDF, PNG, JPG, WebP bis 20 MB)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <TextField
                label="Bezeichnung"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="z. B. Arbeitszeugnis Tech GmbH 2025"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">Kategorie</label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full text-sm p-2 rounded border border-border bg-canvas text-ink focus:border-primary focus:outline-none"
              >
                <option value="Zeugnis">Arbeitszeugnis</option>
                <option value="Abschluss">Abschluss / Diplom</option>
                <option value="Zertifikat">Zertifikat / Schulung</option>
                <option value="Referenz">Referenzschreiben</option>
                <option value="Arbeitsprobe">Arbeitsprobe</option>
                <option value="Sonstiges">Sonstiges</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="secondary"
                icon="upload"
                onClick={() => fileInputRef.current?.click()}
                small
              >
                Datei auswählen
              </Button>
              {selectedFile && (
                <span className="text-xs text-ink font-medium">
                  {selectedFile.name} ({formatBytes(selectedFile.size)})
                </span>
              )}
            </div>

            <Button
              variant="confirm"
              icon="plus"
              onClick={() => uploadMutation.mutate()}
              disabled={!selectedFile || uploadMutation.isPending}
              small
            >
              {uploadMutation.isPending ? 'Wird hochgeladen...' : 'Dokument speichern'}
            </Button>
          </div>
        </div>

        {/* Existing attachments list */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-ink">
            Gespeicherte Dokumente ({attachments.length})
          </h3>

          {isLoading ? (
            <p className="text-xs text-ink-muted">Wird geladen...</p>
          ) : attachments.length === 0 ? (
            <div className="p-8 text-center text-ink-muted text-xs border border-dashed border-border rounded-lg">
              Noch keine Anlagen hinterlegt. Laden Sie oben ein erstes Zeugnis oder Zertifikat hoch.
            </div>
          ) : (
            <div className="divide-y divide-border border border-border rounded-lg bg-canvas overflow-hidden">
              {attachments.map((att) => (
                <div key={att.id} className="p-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="p-2 rounded bg-primary/10 text-primary shrink-0">
                      <Icon name={att.contentType === 'application/pdf' ? 'fileText' : 'files'} size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-ink truncate">{att.title}</span>
                        {att.category && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-canvas-subtle text-ink-muted border border-border">
                            {att.category}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-3">
                        <span>{att.fileName}</span>
                        <span>·</span>
                        <span>{formatBytes(att.sizeBytes)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={attachmentsApi.downloadUrl(att.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      <Icon name="download" size={14} className="mr-1" />
                      Ansehen
                    </a>
                    <Button
                      variant="danger"
                      icon="trash"
                      small
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Anlage löschen',
                          message: `Möchten Sie "${att.title}" wirklich löschen?`,
                          confirmLabel: 'Löschen',
                        })
                        if (ok) {
                          deleteMutation.mutate(att.id)
                        }
                      }}
                    >
                      Löschen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Schließen
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
