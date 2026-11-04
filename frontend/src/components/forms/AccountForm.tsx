import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import type { NewAccount } from '../../api/endpoints'
import { useServerErrors } from '../../validation/useServerErrors'
import { displayNameCheck, isValid, normalizeSetupToken, passwordCheck, repeatCheck, setupTokenCheck, userNameCheck } from '../../validation/rules'
import { useAppState } from '../../auth/AppState'
import { Button } from '../ui/Button'
import { AlertSlot } from '../ui/AlertSlot'
import { LiveTextField } from '../ui/LiveTextField'
import { ErrorNotice } from '../ui/Notice'
import { NewPasswordFields } from './NewPasswordFields'
import { reserveFor } from './reserve'

interface AccountFormProps {
  submitLabel: string
  /** Performs the request; a failure must be thrown so the form can show the server's answer. */
  onSubmit: (account: NewAccount) => Promise<unknown>
  /** Error codes the server can answer with in normal operation (their room is reserved below the button). */
  answerCodes: readonly string[]
  /** The first-account setup asks for the one-time code from the server's log. */
  askSetupToken?: boolean
  /** Offers a Cancel button next to the submit button (dialogs). */
  onCancel?: () => void
  children?: React.ReactNode
}

/**
 * The wrong-setup-code answer belongs at the setup code field; the server may send it as a plain code or already as a
 * field problem, the form shows it at the field either way.
 */
export function tokenAnswerAtItsField(error: unknown): unknown {
  if (error instanceof ApiError && error.code === 'setup.token_invalid' && !error.fieldErrors.setupToken) {
    return new ApiError(error.status, {
      code: error.code,
      ...(error.detail ? { detail: error.detail } : {}),
      ...(error.traceId ? { traceId: error.traceId } : {}),
      errors: { setupToken: [{ code: 'setup.token_invalid' }] },
    })
  }
  return error
}

/**
 * Username, display name and password with repeat - the form of the first-account setup and of registration. Rules come
 * from the server (bootstrap), problems show while typing, the server's answers land at their field or in the alert slot.
 */
export function AccountForm({ submitLabel, onSubmit, answerCodes, askSetupToken = false, onCancel, children }: AccountFormProps) {
  const { t } = useTranslation()
  const { bootstrap } = useAppState()
  const rules = bootstrap.rules
  const [setupToken, setSetupToken] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const server = useServerErrors(['username', 'displayName', 'password', 'setupToken'])

  const userNameRule = userNameCheck(rules.username)
  const displayNameRule = displayNameCheck(rules.displayName)
  const passwordRule = passwordCheck(rules.password)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    // Never send what the form shows as red.
    if (askSetupToken && !isValid(setupTokenCheck, setupToken)) return
    if (!isValid(userNameRule, username) || !isValid(displayNameRule, displayName) || !isValid(passwordRule, password) || !isValid(repeatCheck(password), repeat)) return
    server.setError(null)
    setBusy(true)
    try {
      await onSubmit({
        username: username.trim(),
        displayName: displayName.trim(),
        password,
        ...(askSetupToken ? { setupToken: normalizeSetupToken(setupToken) } : {}),
      })
    } catch (error) {
      server.setError(tokenAnswerAtItsField(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-3">
      {askSetupToken && (
        <LiveTextField
          label={t('fields.setupToken')}
          name="setupToken"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus
          data-autofocus
          maxLength={40}
          inputClassName="font-mono tracking-wider uppercase"
          value={setupToken}
          onValueChange={(value) => {
            setSetupToken(value)
            server.edited('setupToken')
          }}
          check={setupTokenCheck}
          attempted={attempted}
          serverError={server.fields.setupToken}
          serverKeys={['errors.codes.setup.token_invalid']}
          hint={t('setup.tokenHint')}
        />
      )}
      <LiveTextField
        label={t('fields.username')}
        name="username"
        autoComplete="username"
        autoFocus={!askSetupToken}
        data-autofocus={askSetupToken ? undefined : true}
        maxLength={rules.username.maxLength}
        value={username}
        onValueChange={(value) => {
          setUsername(value)
          server.edited('username')
        }}
        check={userNameRule}
        attempted={attempted}
        serverError={server.fields.username}
        serverKeys={['errors.codes.user.username_taken']}
      />
      <LiveTextField
        label={t('fields.displayName')}
        name="displayName"
        autoComplete="name"
        maxLength={rules.displayName.maxLength}
        value={displayName}
        onValueChange={(value) => {
          setDisplayName(value)
          server.edited('displayName')
        }}
        check={displayNameRule}
        attempted={attempted}
        serverError={server.fields.displayName}
      />
      <NewPasswordFields
        password={password}
        repeat={repeat}
        onPassword={(value) => {
          setPassword(value)
          server.edited('password')
        }}
        onRepeat={setRepeat}
        policy={rules.password}
        attempted={attempted}
        serverError={server.fields.password}
      />
      {children}
      <div className={`mt-1 flex gap-2 ${onCancel ? 'justify-end' : ''}`}>
        {onCancel && (
          <Button onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </Button>
        )}
        <Button type="submit" variant="confirm" busy={busy} className={onCancel ? '' : 'w-full'}>
          {submitLabel}
        </Button>
      </div>
      <AlertSlot reserve={reserveFor(t, answerCodes)}>{server.hasGeneralError && <ErrorNotice error={server.error} />}</AlertSlot>
    </form>
  )
}
