import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../api/client'
import { fieldErrors } from '../api/errors'

/**
 * The server's answer to a submit, split into messages per field and one general message. A field message is about
 * the value that was sent, so it disappears the moment the user edits that field: "this name is taken" under a name
 * that is being changed right now is a stale red mark, which is exactly what live validation is meant to avoid.
 *
 * @param formFields the server field names this form shows; an error about any other field goes to the general alert.
 */
export function useServerErrors(formFields: readonly string[]) {
  const { t } = useTranslation()
  const [error, setErrorState] = useState<unknown>(null)
  const [edited, setEdited] = useState<readonly string[]>([])

  const fields = Object.fromEntries(Object.entries(fieldErrors(t, error)).filter(([field]) => !edited.includes(field)))
  // Judged on the answer as it came, not on what is still shown: an edited field must not turn into a general alert.
  const hasFieldError =
    error instanceof ApiError && Object.keys(fieldErrors(t, error)).some((field) => formFields.includes(field))

  return {
    /** The raw failure of the last submit (or null), for describeError(). */
    error,
    /** Stores the failure of a submit, or null before a new one; every field shows its message again. */
    setError(next: unknown) {
      setErrorState(next)
      setEdited([])
    },
    fields: fields as Record<string, string | undefined>,
    /** True when there is a failure that no field of this form explains, so it belongs in an alert. */
    hasGeneralError: error !== null && !hasFieldError,
    /** Call when the user edits a field: the server's message about its old value no longer applies. */
    edited(field: string) {
      setEdited((previous) => (previous.includes(field) ? previous : [...previous, field]))
    },
  }
}
