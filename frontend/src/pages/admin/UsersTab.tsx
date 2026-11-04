import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { adminApi } from '../../api/endpoints'
import type { AdminUser } from '../../api/types'
import { useUser } from '../../auth/AppState'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { useErrorDialog } from '../../components/ui/ErrorDialog'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import type { IconName } from '../../components/ui/Icon'
import { ErrorNotice } from '../../components/ui/Notice'
import { Loading } from '../../components/ui/Page'
import { formatDateTime } from '../../format'
import { CreateUserDialog, EditUserDialog, SetPasswordDialog } from './UserDialogs'

const KEY = ['admin', 'users'] as const

type Dialog = { id: number; open: boolean; kind: 'create' } | { id: number; open: boolean; kind: 'edit' | 'password'; user: AdminUser }

function RowAction({ icon, label, onClick, disabled, danger = false, testId }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean; danger?: boolean; testId?: string }) {
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-sm !px-2 ${danger ? 'text-danger' : ''}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
    >
      <Icon name={icon} size={17} />
    </button>
  )
}

/** Accounts: list with role, status, two-factor state and last sign-in; create, edit, set password, reset 2FA, delete. */
export function UsersTab() {
  const { t, i18n } = useTranslation()
  const me = useUser()
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const showError = useErrorDialog()
  const users = useQuery({ queryKey: KEY, queryFn: adminApi.users, retry: false })
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const counter = useRef(0)

  const open = (next: { kind: 'create' } | { kind: 'edit' | 'password'; user: AdminUser }) => setDialog({ ...next, id: ++counter.current, open: true } as Dialog)
  const close = () => setDialog((current) => (current ? { ...current, open: false } : null))
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY })

  const resetTwoFactor = useMutation({
    mutationFn: adminApi.resetTwoFactor,
    onSuccess: refresh,
    onError: (error) => showError(error, t('admin.users.resetFailed')),
  })
  const remove = useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: refresh,
    onError: (error) => showError(error, t('admin.users.deleteFailed')),
  })

  async function askReset(user: AdminUser) {
    const ok = await confirm({
      title: t('admin.users.resetTitle'),
      message: t('admin.users.resetText', { name: user.displayName }),
      confirmLabel: t('admin.users.resetAction'),
      tone: 'danger',
    })
    if (ok) resetTwoFactor.mutate(user.id)
  }

  async function askDelete(user: AdminUser) {
    const ok = await confirm({
      title: t('admin.users.deleteTitle'),
      message: t('admin.users.deleteText', { name: user.displayName, username: user.username }),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    })
    if (ok) remove.mutate(user.id)
  }

  if (users.isPending) return <Loading />
  if (users.isError) return <ErrorNotice error={users.error} title={t('admin.users.loadFailed')} />

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">{t('admin.users.count', { count: users.data.length })}</p>
        <Button variant="create" icon="userPlus" onClick={() => open({ kind: 'create' })} data-testid="create-user">
          {t('admin.users.create')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-line">
        <table className="table" data-testid="users-table">
          <thead>
            <tr>
              <th scope="col">{t('admin.users.name')}</th>
              <th scope="col">{t('admin.users.role')}</th>
              <th scope="col">{t('admin.users.status')}</th>
              <th scope="col">{t('admin.users.twoFactor')}</th>
              <th scope="col">{t('admin.users.lastLogin')}</th>
              <th scope="col" className="text-right">
                <span className="sr-only">{t('backups.table.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.data.map((user) => {
              const self = user.id === me.id
              return (
                <tr key={user.id}>
                  <td>
                    <div className="font-medium">{user.displayName}</div>
                    <div className="text-xs text-ink-muted">{user.username}</div>
                  </td>
                  <td>
                    <span className={`badge ${user.role === 'admin' ? 'badge-select' : 'badge-neutral'}`}>{t(`roles.${user.role}`)}</span>
                  </td>
                  <td>
                    <span className={`badge ${user.disabled ? 'badge-danger' : 'badge-success'}`}>{user.disabled ? t('admin.users.disabled') : t('admin.users.active')}</span>
                  </td>
                  <td>
                    <span className={`badge ${user.twoFactorEnabled ? 'badge-success' : 'badge-neutral'}`}>{user.twoFactorEnabled ? t('common.on') : t('common.off')}</span>
                  </td>
                  <td className="whitespace-nowrap tabular-nums">{user.lastLoginAt ? formatDateTime(user.lastLoginAt, i18n.language) : t('admin.users.never')}</td>
                  <td className="text-right whitespace-nowrap">
                    <RowAction icon="pencil" label={t('admin.users.edit')} onClick={() => open({ kind: 'edit', user })} testId={`edit-${user.username}`} />
                    <RowAction icon="key" label={t('admin.users.setPassword')} onClick={() => open({ kind: 'password', user })} />
                    <RowAction icon="shieldLock" label={t('admin.users.resetAction')} disabled={!user.twoFactorEnabled} onClick={() => void askReset(user)} />
                    <RowAction
                      icon="trash"
                      danger
                      label={self ? t('admin.users.deleteSelf') : t('common.delete')}
                      disabled={self}
                      onClick={() => void askDelete(user)}
                      testId={`delete-${user.username}`}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {dialog?.kind === 'create' && <CreateUserDialog key={dialog.id} open={dialog.open} onClose={close} onCreated={() => void refresh()} />}
      {dialog?.kind === 'edit' && <EditUserDialog key={dialog.id} open={dialog.open} onClose={close} user={dialog.user} self={dialog.user.id === me.id} onSaved={() => void refresh()} />}
      {dialog?.kind === 'password' && <SetPasswordDialog key={dialog.id} open={dialog.open} onClose={close} user={dialog.user} />}
    </div>
  )
}
