import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import { authApi } from '../../api/endpoints'
import type { User } from '../../api/types'
import { useAppState } from '../../auth/AppState'
import { ME_KEY, safeReturnPath } from '../../auth/useAuth'
import type { Session } from '../../auth/useAuth'
import { reserveFor } from '../../components/forms/reserve'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { AlertSlot } from '../../components/ui/AlertSlot'
import { Button } from '../../components/ui/Button'
import { LiveTextField } from '../../components/ui/LiveTextField'
import { ErrorNotice } from '../../components/ui/Notice'
import { isLoginCodeComplete, loginCodeCheck, required } from '../../validation/rules'
import { useServerErrors } from '../../validation/useServerErrors'

type Step = { kind: 'password' } | { kind: 'code'; challengeId: string }

/** Sign-in: username and password, then - when the account has two-factor authentication - the code. */
export function LoginPage() {
  const [step, setStep] = useState<Step>({ kind: 'password' })
  return <AuthLayout>{step.kind === 'password' ? <PasswordStep onCode={(challengeId) => setStep({ kind: 'code', challengeId })} /> : <CodeStep challengeId={step.challengeId} onBack={() => setStep({ kind: 'password' })} />}</AuthLayout>
}

function useFinishSignIn() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  return (user: User) => {
    queryClient.setQueryData<Session>(ME_KEY, { user, twoFactorSetupRequired: user.mustSetupTwoFactor })
    const from = (location.state as { from?: string } | null)?.from
    void navigate(user.mustSetupTwoFactor ? '/two-factor-setup' : safeReturnPath(from), { replace: true })
  }
}

function PasswordStep({ onCode }: { onCode: (challengeId: string) => void }) {
  const { t } = useTranslation()
  const { bootstrap } = useAppState()
  const finish = useFinishSignIn()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const server = useServerErrors([])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    // The sign-in form does not reveal rules: only "something is missing" is checked here.
    if (username.trim() === '' || password === '') return
    server.setError(null)
    setBusy(true)
    try {
      const result = await authApi.login({ username: username.trim(), password })
      if ('twoFactorRequired' in result) onCode(result.challengeId)
      else finish(result.user)
    } catch (error) {
      server.setError(error)
      setBusy(false)
    }
  }

  return (
    <>
      <h1 className="text-[1.75rem] leading-tight">{t('login.title')}</h1>
      <p className="mt-2 mb-6 text-ink-muted">{t('login.intro')}</p>
      <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-3">
        <LiveTextField
          label={t('fields.username')}
          name="username"
          autoComplete="username"
          autoFocus
          value={username}
          onValueChange={setUsername}
          check={required('rules.userName.required')}
          attempted={attempted}
        />
        <LiveTextField
          label={t('fields.password')}
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onValueChange={setPassword}
          check={required('rules.password.required')}
          attempted={attempted}
        />
        <Button type="submit" variant="confirm" busy={busy} className="mt-1 w-full">
          {t('login.submit')}
        </Button>
        <AlertSlot reserve={reserveFor(t, ['auth.invalid_credentials', 'auth.disabled', 'rate_limited', 'rate_limited_account'])}>
          {server.error !== null && <ErrorNotice error={server.error} />}
        </AlertSlot>
      </form>
      <div className="mt-3 flex flex-col gap-1 text-sm text-ink-muted">
        {bootstrap.registrationOpen && (
          <p>
            {t('login.noAccount')}{' '}
            <Link to="/register" className="font-semibold text-link underline">
              {t('register.title')}
            </Link>
          </p>
        )}
        <p>
          <Link to="/emergency-reset" className="text-ink-muted hover:text-ink underline">
            {t('login.emergencyResetLink')}
          </Link>
        </p>
      </div>
    </>
  )
}

function CodeStep({ challengeId, onBack }: { challengeId: string; onBack: () => void }) {
  const { t } = useTranslation()
  const finish = useFinishSignIn()
  const [code, setCode] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const server = useServerErrors([])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    // A half-entered code is not sent: it would only count as a failed attempt.
    if (!isLoginCodeComplete(code)) return
    server.setError(null)
    setBusy(true)
    try {
      const { user } = await authApi.loginTwoFactor({ challengeId, code: code.trim() })
      finish(user)
    } catch (error) {
      server.setError(error)
      setBusy(false)
    }
  }

  return (
    <>
      <h1 className="text-[1.75rem] leading-tight">{t('login.codeTitle')}</h1>
      <p className="mt-2 mb-6 text-ink-muted">{t('login.codeIntro')}</p>
      <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-3">
        <LiveTextField
          label={t('fields.code')}
          name="code"
          autoComplete="one-time-code"
          inputMode="text"
          autoFocus
          maxLength={40}
          inputClassName="font-mono tracking-wider"
          value={code}
          onValueChange={setCode}
          check={loginCodeCheck}
          attempted={attempted}
          hint={t('login.codeHint')}
        />
        <Button type="submit" variant="confirm" busy={busy} className="mt-1 w-full">
          {t('login.codeSubmit')}
        </Button>
        <AlertSlot reserve={reserveFor(t, ['auth.twofactor_invalid', 'rate_limited', 'rate_limited_account'])}>
          {server.error !== null && <ErrorNotice error={server.error} />}
        </AlertSlot>
      </form>
      <button type="button" className="mt-2 text-sm font-semibold text-link underline" onClick={onBack}>
        {t('login.back')}
      </button>
    </>
  )
}

