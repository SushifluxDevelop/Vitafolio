import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Reauth } from '../../api/endpoints'
import { reserveFor } from '../../components/forms/reserve'
import { AlertSlot } from '../../components/ui/AlertSlot'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import type { IconName } from '../../components/ui/Icon'
import { LiveTextField } from '../../components/ui/LiveTextField'
import { ErrorNotice } from '../../components/ui/Notice'
import { isLoginCodeComplete, loginCodeCheck, required } from '../../validation/rules'

/**
 * Every answer the three actions can give in normal operation; the room under the form is sized for the longest of them in the
 * active language, so a refusal never makes the dialog grow.
 */
export const REAUTH_ANSWERS = [
  'auth.reauth_failed',
  'rate_limited',
  'maintenance.busy',
  'twofactor.code_already_used',
  'twofactor.key_unavailable',
  'backup.too_new',
  'backup.invalid',
  'backup.not_found',
  'backup.restore_failed',
  'backup.restore_failed_not_rolled_back',
  'backup.upload_limit',
  'backup.invalid_schema_mismatch',
  'backup.busy',
  'validation.file_too_large',
] as const

export interface ReauthDialogProps {
  open: boolean
  onClose: () => void
  title: string
  icon: IconName
  tone?: 'default' | 'danger'
  /** What happens, in plain words (a list for a restore). */
  children: ReactNode
  confirmLabel: string
  /** Server mode: ask for the current password; the desktop program has none and only asks for the confirmation. */
  askPassword: boolean
  /** The account has two-factor authentication: the current code is asked as well. */
  askCode: boolean
  /** Runs the action; a failure must be thrown so the dialog can show the server's answer. */
  onConfirm: (credentials: Reauth) => Promise<void>
}

/**
 * The app's own confirmation for the actions that expose or replace everybody's data (download, upload, restore of a
 * backup): says what happens, asks for the admin's current password (and 2FA code) in server mode and shows the server's
 * answer - a wrong password, a refusal - inside the dialog, in reserved room so nothing moves.
 */
export function ReauthDialog({ open, onClose, title, icon, tone = 'default', children, confirmLabel, askPassword, askCode, onConfirm }: ReauthDialogProps) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const formId = 'reauth-form'

  async function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    // Never send what the form shows as red; a half code would only count as a failed attempt.
    if (askPassword && password === '') return
    if (askCode && !isLoginCodeComplete(code)) return
    setError(null)
    setBusy(true)
    try {
      await onConfirm({
        ...(askPassword ? { password } : {}),
        ...(askCode ? { code: code.replaceAll(' ', '') } : {}),
      })
    } catch (failure) {
      setError(failure)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose()
      }}
      title={title}
      icon={icon}
      tone={tone}
      role="alertdialog"
      size="md"
      closeOnBackdrop={false}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId} variant={tone === 'danger' ? 'danger' : 'confirm'} busy={busy} data-testid="reauth-confirm">
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[0.9375rem] leading-relaxed text-ink-muted">{children}</div>
      <form id={formId} onSubmit={(event) => void submit(event)} noValidate className="mt-4 flex flex-col gap-3">
        {askPassword && (
          <LiveTextField
            label={t('backups.reauth.password')}
            name="reauthPassword"
            type="password"
            autoComplete="current-password"
            data-autofocus
            value={password}
            onValueChange={setPassword}
            check={required('rules.password.required')}
            attempted={attempted}
            hint={t('backups.reauth.passwordHint')}
          />
        )}
        {askCode && (
          <LiveTextField
            label={t('backups.reauth.code')}
            name="reauthCode"
            autoComplete="one-time-code"
            maxLength={40}
            inputClassName="font-mono tracking-wider"
            value={code}
            onValueChange={setCode}
            check={loginCodeCheck}
            attempted={attempted}
          />
        )}
        <AlertSlot reserve={reserveFor(t, REAUTH_ANSWERS)}>{error !== null && <ErrorNotice error={error} />}</AlertSlot>
      </form>
    </Dialog>
  )
}
