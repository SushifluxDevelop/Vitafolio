import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { adminApi } from '../../api/endpoints'
import type { AdminSettings } from '../../api/types'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { useErrorDialog } from '../../components/ui/ErrorDialog'
import { ErrorNotice } from '../../components/ui/Notice'
import { Loading, Section } from '../../components/ui/Page'
import { Toggle } from '../../components/ui/Toggle'

const KEY = ['admin', 'settings'] as const

/** Instance-wide switches, stored in the database and effective at once. Each change saves itself. */
export function SettingsTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const showError = useErrorDialog()
  const settings = useQuery({ queryKey: KEY, queryFn: adminApi.settings, retry: false })

  const save = useMutation({
    mutationFn: adminApi.saveSettings,
    onSuccess: (saved, sent) => queryClient.setQueryData<AdminSettings>(KEY, saved ?? sent),
    onError: (error) => showError(error, t('admin.settings.saveFailed')),
  })

  if (settings.isPending) return <Loading />
  if (settings.isError) return <ErrorNotice error={settings.error} title={t('admin.settings.loadFailed')} />
  const current = settings.data

  async function change(patch: Partial<AdminSettings>) {
    if (patch.requireTwoFactor === true) {
      const ok = await confirm({
        title: t('admin.settings.confirm2faTitle'),
        message: t('admin.settings.confirm2faText'),
        confirmLabel: t('admin.settings.confirm2faAction'),
      })
      if (!ok) return
    }
    save.mutate({ ...current, ...patch })
  }

  return (
    <div className="flex flex-col gap-6">
      <Section title={t('admin.settings.accessTitle')} description={t('admin.settings.accessText')}>
        <div className="flex flex-col gap-6" data-testid="admin-settings">
          <Toggle
            checked={current.registrationOpen}
            onChange={(value) => void change({ registrationOpen: value })}
            label={t('admin.settings.registrationOpen')}
            description={t('admin.settings.registrationOpenHint')}
            disabled={save.isPending}
          />
          <div className="border-t border-line" />
          <Toggle
            checked={current.requireTwoFactor}
            onChange={(value) => void change({ requireTwoFactor: value })}
            label={t('admin.settings.requireTwoFactor')}
            description={t('admin.settings.requireTwoFactorHint')}
            disabled={save.isPending}
          />
        </div>
      </Section>
    </div>
  )
}
