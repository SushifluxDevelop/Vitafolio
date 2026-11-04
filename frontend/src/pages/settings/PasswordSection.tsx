import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { accountApi } from '../../api/endpoints'
import { useAppState } from '../../auth/AppState'
import { NewPasswordFields } from '../../components/forms/NewPasswordFields'
import { reserveFor } from '../../components/forms/reserve'
import { AlertSlot } from '../../components/ui/AlertSlot'
import { Button } from '../../components/ui/Button'
import { LiveTextField } from '../../components/ui/LiveTextField'
import { ErrorNotice, Notice } from '../../components/ui/Notice'
import { isValid, passwordCheck, repeatCheck, required } from '../../validation/rules'
import { useServerErrors } from '../../validation/useServerErrors'

/** Own password: the current one once, the new one twice, every rule shown while typing, the server checks again. */
export function PasswordSection() {
  const { t } = useTranslation()
  const { bootstrap } = useAppState()
  const policy = bootstrap.rules.password
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const server = useServerErrors(['currentPassword', 'newPassword'])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    // Never send what the form shows as red.
    if (current === '' || !isValid(passwordCheck(policy), password) || !isValid(repeatCheck(password), repeat)) return
    server.setError(null)
    setDone(false)
    setBusy(true)
    try {
      await accountApi.changePassword({ currentPassword: current, newPassword: password })
      setCurrent('')
      setPassword('')
      setRepeat('')
      setAttempted(false)
      setDone(true)
    } catch (error) {
      server.setError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex max-w-md flex-col gap-3" data-testid="password-form">
      <LiveTextField
        label={t('settings.password.current')}
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        value={current}
        onValueChange={(value) => {
          setCurrent(value)
          setDone(false)
          server.edited('currentPassword')
        }}
        check={required('rules.password.required')}
        attempted={attempted}
        serverError={server.fields.currentPassword}
        serverKeys={['errors.codes.password.current_invalid']}
      />
      <NewPasswordFields
        password={password}
        repeat={repeat}
        onPassword={(value) => {
          setPassword(value)
          setDone(false)
          server.edited('newPassword')
        }}
        onRepeat={setRepeat}
        policy={policy}
        attempted={attempted}
        serverError={server.fields.newPassword}
        names={{ password: 'newPassword', repeat: 'repeatPassword' }}
        labels={{ password: t('settings.password.new'), repeat: t('settings.password.repeat') }}
      />
      <div>
        <Button type="submit" variant="confirm" busy={busy}>
          {t('settings.password.submit')}
        </Button>
      </div>
      <AlertSlot reserve={[t('settings.password.done'), ...reserveFor(t, ['rate_limited'])]}>
        {server.hasGeneralError ? <ErrorNotice error={server.error} title={t('settings.password.failed')} /> : done ? <Notice tone="success">{t('settings.password.done')}</Notice> : null}
      </AlertSlot>
    </form>
  )
}
