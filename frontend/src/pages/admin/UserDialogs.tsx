import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { adminApi } from '../../api/endpoints'
import type { AdminUser, Role } from '../../api/types'
import { useAppState } from '../../auth/AppState'
import { AccountForm } from '../../components/forms/AccountForm'
import { NewPasswordFields } from '../../components/forms/NewPasswordFields'
import { reserveFor } from '../../components/forms/reserve'
import { AlertSlot } from '../../components/ui/AlertSlot'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { LiveTextField } from '../../components/ui/LiveTextField'
import { ErrorNotice } from '../../components/ui/Notice'
import { Segmented } from '../../components/ui/Segmented'
import { Toggle } from '../../components/ui/Toggle'
import { displayNameCheck, isValid, passwordCheck, repeatCheck } from '../../validation/rules'
import { useServerErrors } from '../../validation/useServerErrors'

function RoleChoice({ value, onChange }: { value: Role; onChange: (role: Role) => void }) {
  const { t } = useTranslation()
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{t('admin.users.role')}</p>
      <Segmented<Role>
        label={t('admin.users.role')}
        value={value}
        onChange={onChange}
        options={[
          { value: 'user', label: t('roles.user'), icon: 'users' },
          { value: 'admin', label: t('roles.admin'), icon: 'userShield' },
        ]}
      />
      <p className="mt-1.5 text-[0.8125rem] text-ink-muted">{t(`admin.users.roleHint.${value}`)}</p>
    </div>
  )
}

interface DialogBase {
  open: boolean
  onClose: () => void
}

/** A new account: username, display name, password and role. */
export function CreateUserDialog({ open, onClose, onCreated }: DialogBase & { onCreated: () => void }) {
  const { t } = useTranslation()
  const [role, setRole] = useState<Role>('user')
  return (
    <Dialog open={open} onClose={onClose} title={t('admin.users.createTitle')} icon="userPlus" size="md" closeOnBackdrop={false}>
      <AccountForm
        submitLabel={t('admin.users.createAction')}
        answerCodes={['rate_limited']}
        onCancel={onClose}
        onSubmit={async (account) => {
          await adminApi.createUser({ ...account, role })
          onCreated()
          onClose()
        }}
      >
        <RoleChoice value={role} onChange={setRole} />
      </AccountForm>
    </Dialog>
  )
}

/** Display name, role and the disabled flag of an account. */
export function EditUserDialog({ open, onClose, user, self, onSaved }: DialogBase & { user: AdminUser; self: boolean; onSaved: () => void }) {
  const { t } = useTranslation()
  const { bootstrap } = useAppState()
  const [displayName, setDisplayName] = useState(user.displayName)
  const [role, setRole] = useState<Role>(user.role)
  const [disabled, setDisabled] = useState(user.disabled)
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const server = useServerErrors(['displayName'])
  const rule = displayNameCheck(bootstrap.rules.displayName)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    if (!isValid(rule, displayName)) return
    server.setError(null)
    setBusy(true)
    try {
      await adminApi.updateUser(user.id, { displayName: displayName.trim(), role, disabled })
      onSaved()
      onClose()
    } catch (error) {
      server.setError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('admin.users.editTitle', { username: user.username })}
      icon="pencil"
      closeOnBackdrop={false}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="edit-user-form" variant="confirm" busy={busy}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="edit-user-form" onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
        <LiveTextField
          label={t('fields.displayName')}
          name="displayName"
          data-autofocus
          maxLength={bootstrap.rules.displayName.maxLength}
          value={displayName}
          onValueChange={(value) => {
            setDisplayName(value)
            server.edited('displayName')
          }}
          check={rule}
          attempted={attempted}
          serverError={server.fields.displayName}
        />
        <RoleChoice value={role} onChange={setRole} />
        <Toggle checked={!disabled} onChange={(active) => setDisabled(!active)} label={t('admin.users.accountActive')} description={t('admin.users.accountActiveHint')} />
        {self && <p className="text-[0.8125rem] text-ink-muted">{t('admin.users.selfNote')}</p>}
        <AlertSlot reserve={reserveFor(t, ['user.last_admin', 'user.self_demote', 'user.self_disable'])}>
          {server.hasGeneralError && <ErrorNotice error={server.error} title={t('admin.users.saveFailed')} />}
        </AlertSlot>
      </form>
    </Dialog>
  )
}

/** A new password for somebody else's account (the admin never sees the old one). */
export function SetPasswordDialog({ open, onClose, user }: DialogBase & { user: AdminUser }) {
  const { t } = useTranslation()
  const { bootstrap } = useAppState()
  const policy = bootstrap.rules.password
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const server = useServerErrors(['newPassword'])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    if (!isValid(passwordCheck(policy), password) || !isValid(repeatCheck(password), repeat)) return
    server.setError(null)
    setBusy(true)
    try {
      await adminApi.setPassword(user.id, { newPassword: password })
      onClose()
    } catch (error) {
      server.setError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('admin.users.passwordTitle', { name: user.displayName })}
      icon="key"
      closeOnBackdrop={false}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="set-password-form" variant="confirm" busy={busy}>
            {t('admin.users.passwordAction')}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-ink-muted">{t('admin.users.passwordText')}</p>
      <form id="set-password-form" onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-3">
        <NewPasswordFields
          password={password}
          repeat={repeat}
          onPassword={(value) => {
            setPassword(value)
            server.edited('newPassword')
          }}
          onRepeat={setRepeat}
          policy={policy}
          attempted={attempted}
          serverError={server.fields.newPassword}
          names={{ password: 'newPassword', repeat: 'repeatPassword' }}
        />
        <AlertSlot reserve={reserveFor(t, ['user.not_found', 'rate_limited'])}>{server.hasGeneralError && <ErrorNotice error={server.error} />}</AlertSlot>
      </form>
    </Dialog>
  )
}
