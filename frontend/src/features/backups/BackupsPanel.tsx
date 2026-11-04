import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { adminApi } from '../../api/endpoints'
import type { BackupSettingsInfo } from '../../api/types'
import { useAppState } from '../../auth/AppState'
import { reserveFor } from '../../components/forms/reserve'
import { AlertSlot } from '../../components/ui/AlertSlot'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Notice, ErrorNotice } from '../../components/ui/Notice'
import { Loading, Section } from '../../components/ui/Page'
import { BackupList } from './BackupList'
import { computeNextRuns } from './nextRuns'
import { isDirty, previewSchedule, toDraft, toSettings } from './scheduleModel'
import type { Draft } from './scheduleModel'
import { ScheduleForm } from './ScheduleForm'
import { WeekPreview } from './WeekPreview'
import type { PreviewState } from './WeekPreview'

const SETTINGS_KEY = ['backups', 'settings'] as const
const LIST_KEY = ['backups', 'list'] as const

/** The current time, refreshed every minute, so the strip's "now" line and its window move on. */
function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

/**
 * The whole "Datensicherung" area: the schedule module with its live week preview, and the backups with their actions.
 * Server mode: App-Administration (admins). Desktop program: Einstellungen (the local owner).
 */
export function BackupsPanel() {
  const { t } = useTranslation()
  const settings = useQuery({ queryKey: SETTINGS_KEY, queryFn: adminApi.backupSettings, retry: false })
  const list = useQuery({ queryKey: LIST_KEY, queryFn: adminApi.backups, retry: false })

  if (settings.isPending || list.isPending) return <Loading />
  if (settings.isError || list.isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <ErrorNotice error={settings.error ?? list.error} title={t('backups.loadFailed')} />
        <Button
          icon="refresh"
          onClick={() => {
            void settings.refetch()
            void list.refetch()
          }}
        >
          {t('errorScreen.retry')}
        </Button>
      </div>
    )
  }

  return <BackupsEditor info={settings.data} entries={list.data} />
}

function BackupsEditor({ info, entries }: { info: BackupSettingsInfo; entries: Parameters<typeof BackupList>[0]['entries'] }) {
  const { t, i18n } = useTranslation()
  const { bootstrap, session } = useAppState()
  const queryClient = useQueryClient()
  const desktop = bootstrap.mode === 'desktop'
  const now = useNow()

  const saved = info
  const [draft, setDraft] = useState<Draft>(() => toDraft(info))
  const [attempted, setAttempted] = useState(false)
  const [savedAt, setSavedAt] = useState(false)
  const dirty = isDirty(draft, saved)

  const save = useMutation({
    mutationFn: async () => {
      const next = toSettings(draft, saved)
      if (!next) throw new Error('unreachable: the draft was checked before')
      await adminApi.saveBackupSettings(next)
      // The server's list of next runs is the authority once saved.
      return queryClient.fetchQuery({ queryKey: SETTINGS_KEY, queryFn: adminApi.backupSettings, staleTime: 0 })
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData(SETTINGS_KEY, fresh)
      setDraft(toDraft(fresh))
      setAttempted(false)
      setSavedAt(true)
    },
  })

  const update = (next: Draft) => {
    setDraft(next)
    setSavedAt(false)
    save.reset()
  }

  const submit = () => {
    setAttempted(true)
    // Never send what the form shows as red.
    if (!toSettings(draft, saved)) return
    save.mutate()
  }

  const schedule = previewSchedule(draft, saved.schedule)
  // Cheap enough to plan on every render (at most 168 hourly runs).
  const runs = dirty ? computeNextRuns(schedule, now, saved.timeZone) : saved.nextRuns.map((iso) => Date.parse(iso)).filter((value) => !Number.isNaN(value))
  const state: PreviewState = !draft.automaticEnabled ? 'automaticOff' : draft.kind === 'off' ? 'scheduleOff' : runs.length === 0 ? 'noneInWindow' : 'planned'

  return (
    <div className="flex flex-col gap-6">
      <Section title={t('backups.schedule.sectionTitle')} description={t('backups.schedule.sectionText')}>
        <ScheduleForm draft={draft} onChange={update} attempted={attempted} />
        <div className="mt-6 flex items-center gap-2">
          <Button variant="confirm" icon="deviceFloppy" busy={save.isPending} disabled={!dirty} onClick={submit} data-testid="save-backup-settings">
            {t('common.save')}
          </Button>
          <Button
            disabled={!dirty || save.isPending}
            onClick={() => {
              setDraft(toDraft(saved))
              setAttempted(false)
            }}
          >
            {t('common.discard')}
          </Button>
        </div>
        <div className="mt-3">
          <AlertSlot reserve={[t('backups.schedule.saved'), ...reserveFor(t, ['validation.failed', 'rate_limited'])]}>
            {save.isError ? <ErrorNotice error={save.error} title={t('backups.schedule.saveFailed')} /> : savedAt ? <Notice tone="success">{t('backups.schedule.saved')}</Notice> : null}
          </AlertSlot>
        </div>
      </Section>

      <Section title={t('backups.preview.title')} description={t('backups.preview.text')}>
        <WeekPreview
          runs={runs}
          now={now}
          timeZone={saved.timeZone}
          state={state}
          unsaved={dirty}
          language={i18n.language}
          onStart={draft.automaticEnabled && draft.onStart}
          beforeShutdown={draft.automaticEnabled && draft.beforeShutdown}
        />
        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-line pt-4 text-sm">
          <dt className="flex items-center gap-2 text-ink-muted">
            <Icon name="world" size={16} />
            {t('backups.preview.timeZone')}
          </dt>
          <dd className="font-medium" data-testid="backup-timezone">
            {saved.timeZone}
          </dd>
          <dt className="flex items-center gap-2 text-ink-muted">
            <Icon name="folder" size={16} />
            {t('backups.preview.directory')}
          </dt>
          <dd className="font-mono text-[0.8125rem] break-all select-all" data-testid="backup-directory">
            {saved.directory}
          </dd>
        </dl>
        {desktop && (
          <div className="mt-4">
            <Notice tone="info">{t('backups.desktopNote')}</Notice>
          </div>
        )}
      </Section>

      <Section title={t('backups.list.title')} description={t('backups.list.text')}>
        <BackupList
          entries={entries}
          desktop={desktop}
          twoFactor={session.user?.twoFactorEnabled ?? false}
          language={i18n.language}
          onChanged={() => void queryClient.invalidateQueries({ queryKey: ['backups'] })}
        />
      </Section>
    </div>
  )
}

export { LIST_KEY as BACKUP_LIST_KEY }
