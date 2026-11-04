import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import { adminApi } from '../../api/endpoints'
import type { Reauth } from '../../api/endpoints'
import type { BackupEntry } from '../../api/types'
import { AlertSlot } from '../../components/ui/AlertSlot'
import { Button } from '../../components/ui/Button'
import { useErrorDialog } from '../../components/ui/ErrorDialog'
import { Notice } from '../../components/ui/Notice'
import { formatBytes, formatDateTime } from '../../format'
import { ReauthDialog } from './ReauthDialog'

/** The largest backup file the server accepts. */
export const MAX_UPLOAD_BYTES = 512 * 1024 * 1024

type Action =
  | { id: number; open: boolean; kind: 'download'; entry: BackupEntry }
  | { id: number; open: boolean; kind: 'current' }
  | { id: number; open: boolean; kind: 'upload'; file: File }
  | { id: number; open: boolean; kind: 'restore'; entry: BackupEntry }
  | { id: number; open: boolean; kind: 'delete'; entry: BackupEntry }

/** Omit that keeps the union members apart (a plain Omit on a union loses their own fields). */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never

type Result = { tone: 'success' | 'info' | 'warning'; text: string }

interface BackupListProps {
  entries: readonly BackupEntry[]
  desktop: boolean
  /** The signed-in account has two-factor authentication: sensitive actions ask for the code as well. */
  twoFactor: boolean
  /** Called after something changed the list (a backup was made, uploaded ...). */
  onChanged: () => void
  language: string
}

/** The file name the browser should propose when the server did not send one. */
function fallbackName(entry?: BackupEntry): string {
  return entry ? entry.file : 'backup.db'
}

/**
 * The backups: "Jetzt sichern", "Aktuellen Stand herunterladen", "Sicherung hochladen" and the list with Herunterladen and
 * Wiederherstellen per entry. Download, upload and restore expose or replace everybody's data, so in server mode they go
 * through a dialog that asks for the password (and the 2FA code); the restore dialog says exactly what will happen.
 */
export function BackupList({ entries, desktop, twoFactor, onChanged, language }: BackupListProps) {
  const { t } = useTranslation()
  const showError = useErrorDialog()
  const fileInput = useRef<HTMLInputElement>(null)
  const [action, setAction] = useState<Action | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const counter = useRef(0)

  const open = (next: DistributiveOmit<Action, 'id' | 'open'>) => setAction({ ...next, id: ++counter.current, open: true } as Action)
  const close = () => setAction((current) => (current ? { ...current, open: false } : null))

  const backupNow = useMutation({
    mutationFn: adminApi.runBackup,
    onSuccess: (entry) => {
      setResult({ tone: 'success', text: t('backups.result.created', { file: entry.file }) })
      onChanged()
    },
    onError: (error) => {
      // "Nothing changed" is an answer, not a failure.
      if (error instanceof ApiError && error.code === 'backup.unchanged') {
        setResult({ tone: 'info', text: t('backups.result.unchanged') })
        return
      }
      showError(error, t('backups.backupNowFailed'))
    },
  })

  // Download without password in the desktop program (the local owner), through the dialog in server mode.
  async function download(entry: BackupEntry | undefined, credentials: Reauth) {
    const name = entry ? await adminApi.downloadBackup(entry.id, credentials, fallbackName(entry)) : await adminApi.downloadCurrent(credentials, 'backup.db')
    setResult({ tone: 'success', text: t('backups.result.downloaded', { file: name }) })
    if (!entry) onChanged()
  }

  function startDownload(entry?: BackupEntry) {
    if (desktop) {
      download(entry, {}).catch((error: unknown) => showError(error, t('backups.downloadFailed')))
      return
    }
    open(entry ? { kind: 'download', entry } : { kind: 'current' })
  }

  function onFilePicked(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = ''
    if (!file) return
    if (file.size > MAX_UPLOAD_BYTES) {
      setResult({ tone: 'warning', text: t('backups.result.tooBig', { size: formatBytes(file.size, language), max: formatBytes(MAX_UPLOAD_BYTES, language) }) })
      return
    }
    setResult(null)
    open({ kind: 'upload', file })
  }

  const sorted = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const kindLabel = (kind: string) => t(`backups.kind.${kind}`, { defaultValue: kind })
  const reserve = [
    t('backups.result.deleted', { file: 'backup-0000-00-00-0000.db' }),
    t('backups.result.created', { file: 'backup-0000-00-00-0000.db' }),
    t('backups.result.unchanged'),
    t('backups.result.tooBig', { size: '999 MB', max: '512 MB' }),
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="create" icon="plus" busy={backupNow.isPending} onClick={() => backupNow.mutate()} data-testid="backup-now">
          {t('backups.backupNow')}
        </Button>
        <Button icon="download" onClick={() => startDownload()} data-testid="download-current">
          {t('backups.downloadCurrent')}
        </Button>
        <Button icon="upload" onClick={() => fileInput.current?.click()} data-testid="upload-backup">
          {t('backups.upload')}
        </Button>
        <input ref={fileInput} type="file" className="sr-only" tabIndex={-1} aria-label={t('backups.upload')} data-testid="upload-input" onChange={(event) => onFilePicked(event.target.files?.[0])} />
      </div>

      <div className="mt-3">
        <AlertSlot plain reserve={reserve}>
          {result && <Notice tone={result.tone}>{result.text}</Notice>}
        </AlertSlot>
      </div>

      <div className="mt-2 overflow-x-auto rounded-md border border-line">
        <table className="table" data-testid="backup-table">
          <thead>
            <tr>
              <th scope="col">{t('backups.table.when')}</th>
              <th scope="col">{t('backups.table.kind')}</th>
              <th scope="col" className="text-right">
                {t('backups.table.size')}
              </th>
              <th scope="col" className="text-right">
                {t('backups.table.actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-ink-muted">
                  {t('backups.table.empty')}
                </td>
              </tr>
            )}
            {sorted.map((entry) => (
              <tr key={entry.id}>
                <td className="whitespace-nowrap tabular-nums">{formatDateTime(entry.createdAt, language)}</td>
                <td>
                  <span className="badge badge-neutral">{kindLabel(entry.kind)}</span>
                </td>
                <td className="text-right whitespace-nowrap tabular-nums">{formatBytes(entry.sizeBytes, language)}</td>
                <td>
                  {/* Wraps below each other in a narrow window instead of pushing the table wider than the card. */}
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button small onClick={() => startDownload(entry)}>
                      {t('backups.download')}
                    </Button>
                    <Button small onClick={() => open({ kind: 'restore', entry })} data-testid="restore">
                      {t('backups.restore')}
                    </Button>
                    <Button small variant="danger-outline" onClick={() => open({ kind: 'delete', entry })} data-testid="delete-backup">
                      {t('common.delete')}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {action?.kind === 'download' && (
        <ReauthDialog
          key={action.id}
          open={action.open}
          onClose={close}
          title={t('backups.dialog.downloadTitle')}
          icon="download"
          confirmLabel={t('backups.download')}
          askPassword={!desktop}
          askCode={!desktop && twoFactor}
          onConfirm={async (credentials) => {
            await download(action.entry, credentials)
            close()
          }}
        >
          <p>{t('backups.dialog.downloadText', { date: formatDateTime(action.entry.createdAt, language) })}</p>
          <p className="mt-2">{t('backups.dialog.sensitive')}</p>
        </ReauthDialog>
      )}

      {action?.kind === 'current' && (
        <ReauthDialog
          key={action.id}
          open={action.open}
          onClose={close}
          title={t('backups.dialog.currentTitle')}
          icon="download"
          confirmLabel={t('backups.downloadCurrent')}
          askPassword={!desktop}
          askCode={!desktop && twoFactor}
          onConfirm={async (credentials) => {
            await download(undefined, credentials)
            close()
          }}
        >
          <p>{t('backups.dialog.currentText')}</p>
          <p className="mt-2">{t('backups.dialog.sensitive')}</p>
        </ReauthDialog>
      )}

      {action?.kind === 'upload' && (
        <ReauthDialog
          key={action.id}
          open={action.open}
          onClose={close}
          title={t('backups.dialog.uploadTitle')}
          icon="upload"
          confirmLabel={t('backups.upload')}
          askPassword={!desktop}
          askCode={!desktop && twoFactor}
          onConfirm={async (credentials) => {
            const entry = await adminApi.uploadBackup(action.file, credentials)
            setResult({ tone: 'success', text: t('backups.result.uploaded', { file: entry?.file ?? action.file.name }) })
            onChanged()
            close()
          }}
        >
          <p>{t('backups.dialog.uploadText', { name: action.file.name, size: formatBytes(action.file.size, language) })}</p>
          <p className="mt-2">{t('backups.dialog.uploadChecks')}</p>
        </ReauthDialog>
      )}

      {action?.kind === 'delete' && (
        <ReauthDialog
          key={action.id}
          open={action.open}
          onClose={close}
          title={t('backups.dialog.deleteTitle')}
          icon="trash"
          tone="danger"
          confirmLabel={t('common.delete')}
          askPassword={!desktop}
          askCode={!desktop && twoFactor}
          onConfirm={async (credentials) => {
            await adminApi.deleteBackup(action.entry.id, credentials)
            setResult({ tone: 'success', text: t('backups.result.deleted', { file: action.entry.file }) })
            onChanged()
            close()
          }}
        >
          <p>{t('backups.dialog.deleteText', { date: formatDateTime(action.entry.createdAt, language), kind: kindLabel(action.entry.kind) })}</p>
          <p className="mt-2 font-medium text-ink">{t('backups.dialog.deleteIrreversible')}</p>
        </ReauthDialog>
      )}

      {action?.kind === 'restore' && (
        <ReauthDialog
          key={action.id}
          open={action.open}
          onClose={close}
          title={t('backups.dialog.restoreTitle')}
          icon="history"
          tone="danger"
          confirmLabel={t('backups.restore')}
          askPassword={!desktop}
          askCode={!desktop && twoFactor}
          onConfirm={async (credentials) => {
            await adminApi.restoreBackup(action.entry.id, credentials)
            // Every session ended with the restore (server) / the program shows the restored data after a reload (desktop).
            if (desktop) window.location.reload()
            else window.location.assign('/login')
          }}
        >
          <p>{t('backups.dialog.restoreIntro', { date: formatDateTime(action.entry.createdAt, language), kind: kindLabel(action.entry.kind) })}</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>{t('backups.dialog.restoreSafety')}</li>
            <li>{desktop ? t('backups.dialog.restoreReloadDesktop') : t('backups.dialog.restoreSignOut')}</li>
            <li>{t('backups.dialog.restoreReplace')}</li>
          </ul>
        </ReauthDialog>
      )}
    </div>
  )
}
