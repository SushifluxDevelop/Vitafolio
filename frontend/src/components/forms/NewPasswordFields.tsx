import { useTranslation } from 'react-i18next'
import type { TextRule } from '../../api/types'
import { passwordCheck, repeatCheck } from '../../validation/rules'
import { LiveTextField } from '../ui/LiveTextField'

interface NewPasswordFieldsProps {
  password: string
  repeat: string
  onPassword: (value: string) => void
  onRepeat: (value: string) => void
  policy: TextRule | undefined
  attempted: boolean
  /** The server's answers about the password field (too weak, ...), already translated. */
  serverError?: string | undefined
  /** Field names, so several forms can tell their fields apart (e2e tests find fields by name). */
  names?: { password: string; repeat: string }
  labels?: { password: string; repeat: string }
}

/**
 * New password plus its repeat, with live checks against the server's rules: too short shows while typing, a repeat that
 * can no longer become the password is flagged at once (an unfinished beginning is just work in progress).
 */
export function NewPasswordFields({
  password,
  repeat,
  onPassword,
  onRepeat,
  policy,
  attempted,
  serverError,
  names = { password: 'password', repeat: 'repeat' },
  labels,
}: NewPasswordFieldsProps) {
  const { t } = useTranslation()
  return (
    <>
      <LiveTextField
        label={labels?.password ?? t('fields.password')}
        name={names.password}
        type="password"
        autoComplete="new-password"
        maxLength={policy?.maxLength}
        value={password}
        onValueChange={onPassword}
        check={passwordCheck(policy)}
        attempted={attempted}
        serverError={serverError}
        serverKeys={['errors.codes.validation.min_length']}
        hint={policy ? t('fields.passwordHint', { min: policy.minLength }) : undefined}
      />
      <LiveTextField
        label={labels?.repeat ?? t('fields.repeat')}
        name={names.repeat}
        type="password"
        autoComplete="new-password"
        maxLength={policy?.maxLength}
        value={repeat}
        onValueChange={onRepeat}
        check={repeatCheck(password)}
        attempted={attempted}
      />
    </>
  )
}
