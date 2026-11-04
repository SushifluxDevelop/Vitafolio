import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { adminApi } from '../../api/endpoints'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { ErrorNotice } from '../../components/ui/Notice'
import { Loading } from '../../components/ui/Page'
import { formatDateTime } from '../../format'
import { ACTIVITY_ACTIONS } from './activityActions'

const PAGE_SIZE = 25


/** The append-only activity log: who did what and when, filterable, newest first. Nobody can edit it. */
export function ActivityTab() {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [userId, setUserId] = useState('')

  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: adminApi.users, retry: false })
  const log = useQuery({
    queryKey: ['admin', 'activity', page, action, userId],
    queryFn: () => adminApi.activity({ page, pageSize: PAGE_SIZE, ...(action ? { action } : {}), ...(userId ? { userId } : {}) }),
    retry: false,
    placeholderData: (previous) => previous,
  })

  const pages = Math.max(1, Math.ceil((log.data?.total ?? 0) / PAGE_SIZE))
  const label = (code: string) => t(`activity.actions.${code}`, { defaultValue: t('activity.unknown', { code }) })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t('activity.filterAction')}
          <select
            className="input w-64"
            value={action}
            onChange={(event) => {
              setAction(event.target.value)
              setPage(1)
            }}
            data-testid="activity-action"
          >
            <option value="">{t('activity.all')}</option>
            {ACTIVITY_ACTIONS.map((code) => (
              <option key={code} value={code}>
                {label(code)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t('activity.filterUser')}
          <select
            className="input w-56"
            value={userId}
            onChange={(event) => {
              setUserId(event.target.value)
              setPage(1)
            }}
          >
            <option value="">{t('activity.all')}</option>
            {users.data?.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} ({user.username})
              </option>
            ))}
          </select>
        </label>
      </div>

      {log.isPending && <Loading />}
      {log.isError && <ErrorNotice error={log.error} title={t('activity.loadFailed')} />}
      {log.data && (
        <>
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="table" data-testid="activity-table">
              <thead>
                <tr>
                  <th scope="col">{t('activity.when')}</th>
                  <th scope="col">{t('activity.who')}</th>
                  <th scope="col">{t('activity.what')}</th>
                  <th scope="col">{t('activity.target')}</th>
                  <th scope="col">{t('activity.ip')}</th>
                  <th scope="col">{t('activity.details')}</th>
                </tr>
              </thead>
              <tbody>
                {log.data.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-ink-muted">
                      {t('activity.empty')}
                    </td>
                  </tr>
                )}
                {log.data.items.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="whitespace-nowrap tabular-nums">{formatDateTime(item.at, i18n.language)}</td>
                    <td>{item.actorName ?? '-'}</td>
                    <td>
                      <span className="font-medium">{label(item.action)}</span>
                    </td>
                    <td className="break-words">{item.target ?? '-'}</td>
                    <td className="tabular-nums">{item.ip ?? '-'}</td>
                    <td>
                      {item.details == null ? (
                        '-'
                      ) : (
                        <details>
                          <summary className="cursor-pointer text-link">{t('activity.show')}</summary>
                          <pre className="mt-1 font-mono text-xs break-words whitespace-pre-wrap select-text">{JSON.stringify(item.details, null, 2)}</pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-ink-muted">
            <span>{t('activity.total', { count: log.data.total })}</span>
            <div className="flex items-center gap-2">
              <Button small disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label={t('activity.previous')}>
                <Icon name="chevronLeft" size={16} />
              </Button>
              <span className="min-w-24 text-center tabular-nums">{t('activity.page', { page, pages })}</span>
              <Button small disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label={t('activity.next')}>
                <Icon name="chevronRight" size={16} />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
