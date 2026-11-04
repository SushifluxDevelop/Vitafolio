import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { accountApi } from '../../api/endpoints'
import { useUser } from '../../auth/AppState'
import { ME_KEY } from '../../auth/useAuth'
import type { Session } from '../../auth/useAuth'
import { reserveFor } from '../../components/forms/reserve'
import { TotpSetup } from '../../components/forms/TotpSetup'
import { AlertSlot } from '../../components/ui/AlertSlot'
import { Button } from '../../components/ui/Button'
import { LiveTextField } from '../../components/ui/LiveTextField'
import { ErrorNotice } from '../../components/ui/Notice'
import { isLoginCodeComplete, loginCodeCheck, required } from '../../validation/rules'
import { useServerErrors } from '../../validation/useServerErrors'

/** Two-factor authentication of the own account: set it up (QR code, recovery codes) or turn it off again. */
export function TotpSection() {
  const user = useUser()
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  if (!user.twoFactorEnabled) {
    return (
      <TotpSetup
        onFinished={() => {
          queryClient.setQueryData<Session>(ME_KEY, (current) => (current?.user ? { ...current, user: { ...current.user, twoFactorEnabled: true } } : current))
          void queryClient.invalidateQueries({ queryKey: ME_KEY })
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <p>
        <span className="badge badge-success">{t('overview.twoFactor.on')}</span>
      </p>
      <DisableForm />
    </div>
  )
}

function DisableForm() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const server = useServerErrors(['password', 'code'])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    // Never send what the form shows as red; a half code would only count as a failed attempt.
    if (password === '' || !isLoginCodeComplete(code)) return
    server.setError(null)
    setBusy(true)
    try {
      await accountApi.twoFactorDisable({ password, code: code.replaceAll(' ', '') })
      queryClient.setQueryData<Session>(ME_KEY, (current) => (current?.user ? { ...current, user: { ...current.user, twoFactorEnabled: false } } : current))
      void queryClient.invalidateQueries({ queryKey: ME_KEY })
    } catch (error) {
      server.setError(error)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex max-w-md flex-col gap-3" data-testid="disable-2fa-form">
      <p className="text-sm text-ink-muted">{t('settings.totp.disableIntro')}</p>
      <LiveTextField
        label={t('settings.totp.password')}
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onValueChange={(value) => {
          setPassword(value)
          server.edited('password')
        }}
        check={required('rules.password.required')}
        attempted={attempted}
        serverError={server.fields.password}
        serverKeys={['errors.codes.password.current_invalid']}
      />
      <LiveTextField
        label={t('settings.totp.codeOrRecovery')}
        name="code"
        autoComplete="one-time-code"
        maxLength={40}
        inputClassName="font-mono tracking-wider"
        value={code}
        onValueChange={(value) => {
          setCode(value)
          server.edited('code')
        }}
        check={loginCodeCheck}
        attempted={attempted}
        serverError={server.fields.code}
        serverKeys={['errors.codes.auth.twofactor_invalid']}
      />
      <div>
        <Button type="submit" variant="danger-outline" busy={busy} data-testid="disable-2fa">
          {t('settings.totp.disable')}
        </Button>
      </div>
      <AlertSlot reserve={reserveFor(t, ['twofactor.required_by_admin', 'rate_limited'])}>
        {server.hasGeneralError && <ErrorNotice error={server.error} title={t('settings.totp.disableFailed')} />}
      </AlertSlot>
    </form>
  )
}
