import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { accountApi } from '../../api/endpoints'
import type { SessionInfo } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { useErrorDialog } from '../../components/ui/ErrorDialog'
import { ErrorNotice } from '../../components/ui/Notice'
import { Loading } from '../../components/ui/Page'
import { describeUserAgent, formatDateTime } from '../../format'

const KEY = ['account', 'sessions'] as const

/** The signed-in sessions of the account: where, since when, last use; every other one can be ended. */
export function SessionSection() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const showError = useErrorDialog()
  const sessions = useQuery({ queryKey: KEY, queryFn: accountApi.sessions, retry: false })

  const revoke = useMutation({
    mutationFn: accountApi.revokeSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
    onError: (error) => showError(error, t('settings.sessions.revokeFailed')),
  })

  async function end(session: SessionInfo) {
    const ok = await confirm({
      title: t('settings.sessions.confirmTitle'),
      message: t('settings.sessions.confirmText', { device: describeUserAgent(session.userAgent), ip: session.ip ?? '-' }),
      confirmLabel: t('settings.sessions.end'),
      tone: 'danger',
    })
    if (ok) revoke.mutate(session.id)
  }

  if (sessions.isPending) return <Loading />
  if (sessions.isError) return <ErrorNotice error={sessions.error} title={t('settings.sessions.loadFailed')} />

  const sorted = [...sessions.data].sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="table" data-testid="sessions-table">
        <thead>
          <tr>
            <th scope="col">{t('settings.sessions.device')}</th>
            <th scope="col">{t('settings.sessions.ip')}</th>
            <th scope="col">{t('settings.sessions.started')}</th>
            <th scope="col">{t('settings.sessions.lastUsed')}</th>
            <th scope="col" className="text-right">
              <span className="sr-only">{t('backups.table.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((session) => (
            <tr key={session.id}>
              <td>
                <span className="font-medium">{describeUserAgent(session.userAgent)}</span>{' '}
                {session.current && <span className="badge badge-select ml-1">{t('settings.sessions.current')}</span>}
              </td>
              <td className="tabular-nums">{session.ip ?? '-'}</td>
              <td className="whitespace-nowrap tabular-nums">{formatDateTime(session.createdAt, i18n.language)}</td>
              <td className="whitespace-nowrap tabular-nums">{formatDateTime(session.lastUsedAt, i18n.language)}</td>
              <td className="text-right">
                {!session.current && (
                  <Button small variant="danger-outline" onClick={() => void end(session)}>
                    {t('settings.sessions.end')}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
