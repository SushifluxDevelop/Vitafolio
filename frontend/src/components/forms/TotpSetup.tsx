import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import { accountApi } from '../../api/endpoints'
import type { TotpSetup as TotpSetupData } from '../../api/types'
import { useErrorDialog } from '../ui/ErrorDialog'
import { AlertSlot } from '../ui/AlertSlot'
import { Button } from '../ui/Button'
import { CopyButton } from '../ui/CopyButton'
import { LiveTextField } from '../ui/LiveTextField'
import { Notice, ErrorNotice } from '../ui/Notice'
import { QrCode } from '../ui/QrCode'
import { isTotpCodeComplete, required, totpCheck } from '../../validation/rules'
import { useServerErrors } from '../../validation/useServerErrors'
import { reserveFor } from './reserve'

type Phase = { kind: 'start' } | { kind: 'scan'; setup: TotpSetupData } | { kind: 'codes'; recoveryCodes: string[] }

interface TotpSetupProps {
  /** Called when the user is through (after seeing the recovery codes). */
  onFinished: () => void
  /** Called as soon as the server has enabled two-factor authentication (before the codes are acknowledged). */
  onEnabled?: () => void
  /**
   * Ask for the current password with the first code (the account settings). The forced setup right after a fresh sign-in
   * does not; there the field only appears if the server answers that it is needed.
   */
  askPassword?: boolean
  /** Show the secret and the QR code side by side (wide places) or stacked (the narrow sign-in panel). */
  stacked?: boolean
}

/**
 * Sets up the authenticator app: the server's secret as QR code and as text to type in, then the first code to prove it
 * works, then the recovery codes - shown once, copyable. Used in the account settings and in the forced setup.
 */
export function TotpSetup({ onFinished, onEnabled, askPassword = true, stacked = false }: TotpSetupProps) {
  const { t } = useTranslation()
  const showError = useErrorDialog()
  const [phase, setPhase] = useState<Phase>({ kind: 'start' })

  const start = useMutation({
    mutationFn: accountApi.totpSetup,
    onSuccess: (setup) => setPhase({ kind: 'scan', setup }),
    onError: (error) => showError(error, t('settings.totp.startFailed')),
  })

  if (phase.kind === 'start') {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="max-w-xl text-sm text-ink-muted">{t('settings.totp.intro')}</p>
        <Button variant="confirm" icon="qrcode" busy={start.isPending} onClick={() => start.mutate()} data-testid="totp-start">
          {t('settings.totp.start')}
        </Button>
      </div>
    )
  }

  if (phase.kind === 'scan') {
    return (
      <ScanStep
        setup={phase.setup}
        stacked={stacked}
        askPassword={askPassword}
        onEnabled={(recoveryCodes) => {
          setPhase({ kind: 'codes', recoveryCodes })
          onEnabled?.()
        }}
      />
    )
  }

  const text = phase.recoveryCodes.join('\n')
  return (
    <div className="flex flex-col gap-4" data-testid="recovery-codes">
      <Notice tone="warning">{t('settings.totp.codesWarning')}</Notice>
      <ul className="grid grid-cols-2 gap-2 rounded-sm border border-line bg-sunken p-4 font-mono text-sm select-text">
        {phase.recoveryCodes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <CopyButton getText={() => text} />
        <Button variant="confirm" onClick={onFinished} data-testid="totp-done">
          {t('settings.totp.done')}
        </Button>
      </div>
    </div>
  )
}

function ScanStep({ setup, stacked, askPassword, onEnabled }: { setup: TotpSetupData; stacked: boolean; askPassword: boolean; onEnabled: (recoveryCodes: string[]) => void }) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  // Without a password field the server decides: its "current password wrong/missing" answer reveals the field.
  const [needPassword, setNeedPassword] = useState(askPassword)
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const server = useServerErrors(['code', 'currentPassword'])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    // A half-entered code is not sent: it would only count as a failed attempt.
    if (!isTotpCodeComplete(code)) return
    if (needPassword && password === '') return
    server.setError(null)
    setBusy(true)
    try {
      const { recoveryCodes } = await accountApi.totpEnable({ code: code.replaceAll(' ', ''), ...(needPassword ? { currentPassword: password } : {}) })
      onEnabled(recoveryCodes)
    } catch (error) {
      if (error instanceof ApiError && (error.fieldErrors.currentPassword || error.code === 'password.current_invalid')) setNeedPassword(true)
      server.setError(error)
      setBusy(false)
    }
  }

  return (
    <div className={`flex gap-6 ${stacked ? 'flex-col' : 'items-start'}`}>
      <div className="shrink-0">
        <QrCode text={setup.otpauthUri} label={t('settings.totp.qrLabel')} />
      </div>
      <div className="min-w-0 flex-1">
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-ink-muted">
          <li>{t('settings.totp.step1')}</li>
          <li>{t('settings.totp.step2')}</li>
        </ol>
        <p className="mb-1 text-sm font-medium">{t('settings.totp.manualKey')}</p>
        <p className="mb-4 flex flex-wrap items-center gap-2">
          <code className="rounded-sm border border-line bg-sunken px-2 py-1 font-mono text-sm tracking-wider break-all select-all" data-testid="totp-secret">
            {setup.secret}
          </code>
          <CopyButton getText={() => setup.secret} />
        </p>
        <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-3">
          {needPassword && (
            <LiveTextField
              label={t('settings.totp.password')}
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={password}
              onValueChange={(value) => {
                setPassword(value)
                server.edited('currentPassword')
              }}
              check={required('rules.password.required')}
              attempted={attempted}
              serverError={server.fields.currentPassword}
              serverKeys={['errors.codes.password.current_invalid']}
            />
          )}
          <LiveTextField
            label={t('settings.totp.codeLabel')}
            name="code"
            autoComplete="one-time-code"
            inputMode="numeric"
            autoFocus
            maxLength={8}
            inputClassName="font-mono tracking-widest"
            value={code}
            onValueChange={(value) => {
              setCode(value)
              server.edited('code')
            }}
            check={totpCheck}
            attempted={attempted}
            serverError={server.fields.code}
          />
          <div>
            <Button type="submit" variant="confirm" busy={busy}>
              {t('settings.totp.enable')}
            </Button>
          </div>
          <AlertSlot reserve={reserveFor(t, ['auth.twofactor_invalid', 'rate_limited'])}>
            {server.hasGeneralError && <ErrorNotice error={server.error} />}
          </AlertSlot>
        </form>
      </div>
    </div>
  )
}
