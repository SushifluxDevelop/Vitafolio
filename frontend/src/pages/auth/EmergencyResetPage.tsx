import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { authApi } from '../../api/endpoints'
import { useAppState } from '../../auth/AppState'
import { reserveFor } from '../../components/forms/reserve'
import { NewPasswordFields } from '../../components/forms/NewPasswordFields'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { AlertSlot } from '../../components/ui/AlertSlot'
import { Button } from '../../components/ui/Button'
import { LiveTextField } from '../../components/ui/LiveTextField'
import { ErrorNotice, Notice } from '../../components/ui/Notice'
import { isValid, normalizeSetupToken, passwordCheck, repeatCheck, setupTokenCheck } from '../../validation/rules'
import { useServerErrors } from '../../validation/useServerErrors'

/**
 * Emergency password and 2FA reset for the sole administrator.
 * When locked out, the operator can request a one-time code to be printed to the server logs
 * and enter it here together with a new password.
 */
export function EmergencyResetPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { bootstrap } = useAppState()
  const rules = bootstrap.rules

  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [requested, setRequested] = useState(false)
  const [requestBusy, setRequestBusy] = useState(false)
  const [submitBusy, setSubmitBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [successUsername, setSuccessUsername] = useState<string | null>(null)

  const server = useServerErrors(['code', 'newPassword'])

  async function handleRequestCode() {
    setRequestBusy(true)
    server.setError(null)
    try {
      await authApi.requestEmergencyReset()
      setRequested(true)
    } catch (error) {
      server.setError(error)
    } finally {
      setRequestBusy(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)

    const codeValid = isValid(setupTokenCheck, code)
    const passValid = isValid(passwordCheck(rules?.password), password)
    const repeatValid = isValid(repeatCheck(password), repeat)

    if (!codeValid || !passValid || !repeatValid) return

    setSubmitBusy(true)
    server.setError(null)

    try {
      const result = await authApi.confirmEmergencyReset({
        code: normalizeSetupToken(code),
        newPassword: password,
      })
      setSuccessUsername(result.username)
    } catch (error) {
      server.setError(error)
      setSubmitBusy(false)
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-[1.75rem] leading-tight">{t('emergencyReset.title')}</h1>
      <p className="mt-2 mb-4 text-ink-muted">{t('emergencyReset.intro')}</p>

      {successUsername ? (
        <div className="flex flex-col gap-4">
          <Notice tone="success">
            <span className="font-semibold block mb-1">{t('emergencyReset.successTitle')}</span>
            {t('emergencyReset.successText', { username: successUsername })}
          </Notice>
          <Button type="button" variant="confirm" onClick={() => void navigate('/login', { replace: true })} className="w-full">
            {t('emergencyReset.toLogin')}
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-5 rounded border border-border bg-surface p-4">
            <h2 className="text-base font-semibold text-ink">{t('emergencyReset.step1Title')}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t('emergencyReset.step1Hint')}</p>
            <div className="mt-3">
              <Button type="button" variant="secondary" busy={requestBusy} onClick={() => void handleRequestCode()}>
                {t('emergencyReset.requestCode')}
              </Button>
            </div>
            {requested && (
              <div className="mt-3">
                <Notice tone="info">{t('emergencyReset.codeGeneratedNotice')}</Notice>
              </div>
            )}
          </div>

          <div className="rounded border border-border bg-surface p-4">
            <h2 className="text-base font-semibold text-ink mb-3">{t('emergencyReset.step2Title')}</h2>
            <form onSubmit={(event) => void handleSubmit(event)} noValidate className="flex flex-col gap-3">
              <LiveTextField
                label={t('emergencyReset.codeLabel')}
                name="code"
                autoComplete="off"
                inputClassName="font-mono tracking-wider"
                maxLength={40}
                value={code}
                onValueChange={(val) => {
                  setCode(val)
                  server.edited('code')
                }}
                check={setupTokenCheck}
                attempted={attempted}
                serverError={server.fields.code}
                serverKeys={['errors.codes.emergency_reset.code_invalid']}
                hint={t('emergencyReset.codeHint')}
              />

              <NewPasswordFields
                password={password}
                repeat={repeat}
                onPassword={(val) => {
                  setPassword(val)
                  server.edited('newPassword')
                }}
                onRepeat={setRepeat}
                policy={rules?.password}
                attempted={attempted}
                serverError={server.fields.newPassword}
                names={{ password: 'newPassword', repeat: 'repeatPassword' }}
              />

              <Button type="submit" variant="confirm" busy={submitBusy} className="mt-2 w-full">
                {t('emergencyReset.submit')}
              </Button>

              <AlertSlot reserve={reserveFor(t, ['admin.emergency_reset_other_admins_exist', 'admin.emergency_reset_no_admin', 'emergency_reset.code_invalid', 'rate_limited'])}>
                {server.error !== null && <ErrorNotice error={server.error} />}
              </AlertSlot>
            </form>
          </div>

          <p className="mt-4 text-sm text-ink-muted">
            <Link to="/login" className="text-link underline">
              {t('emergencyReset.backToLogin')}
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  )
}
