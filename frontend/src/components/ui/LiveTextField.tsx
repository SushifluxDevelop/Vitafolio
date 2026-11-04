import { useState } from 'react'
import type { ChangeEvent, FocusEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Check } from '../../validation/rules'
import { TextField } from './TextField'
import type { TextFieldProps } from './TextField'

interface LiveTextFieldProps extends Omit<TextFieldProps, 'error' | 'value' | 'onChange' | 'reserve'> {
  value: string
  onValueChange: (value: string) => void
  /** The rule for this field; it is evaluated on every keystroke. */
  check: Check
  /** A submit was tried: every problem is shown, also in fields the user never touched. */
  attempted?: boolean
  /** The server's answer to the last submit for this field (taken name, wrong code, ...). */
  serverError?: string | undefined
  /** Translation keys of the answers the server can give for this field, so their room is reserved up front. */
  serverKeys?: readonly string[]
}

/**
 * A text field with live validation (the app-wide default): a problem shows up as soon as the typed value has one -
 * not after the user leaves the field or presses a button, by which time the whole form is usually filled in and the
 * message is overlooked. A field nobody has typed into stays calm, except after a submit attempt. A problem the user
 * can see right now wins over an older answer of the server.
 *
 * The room under the field is reserved for the longest message the rule or the server can produce, so showing one
 * moves nothing (see TextField "reserve").
 */
export function LiveTextField({ value, onValueChange, check, attempted = false, serverError, serverKeys = [], onBlur, ...field }: LiveTextFieldProps) {
  const { t } = useTranslation()
  const [touched, setTouched] = useState(false)
  const [left, setLeft] = useState(false)

  const problem = check(value, { settled: attempted || left })
  // "Touched" is derived while rendering: the first typed character is enough, and clearing the field again keeps it
  // touched, so a field emptied by the user says "required" instead of silently going back to neutral.
  const show = touched || value !== '' || attempted
  if (!touched && value !== '') setTouched(true)
  const liveError = problem && show ? t(problem.key, problem.values) : undefined
  const reserve = [...check.problems.map((possible) => t(possible.key, possible.values)), ...serverKeys.map((key) => t(key))]

  return (
    <TextField
      {...field}
      value={value}
      error={liveError ?? serverError}
      reserve={reserve}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onValueChange(event.target.value)}
      onBlur={(event: FocusEvent<HTMLInputElement>) => {
        setLeft(true)
        onBlur?.(event)
      }}
    />
  )
}
