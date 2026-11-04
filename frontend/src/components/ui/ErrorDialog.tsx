import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { copyableError, describeError } from '../../api/errors'
import { useVersion } from '../../hooks/useVersion'
import { Button } from './Button'
import { CopyButton } from './CopyButton'
import { Dialog } from './Dialog'

// For failures of actions that have no form to show them in (delete a user, revoke a session, run a backup): a
// dismissable dialog (close button, Esc) whose body scrolls, so the complete message is always readable and copyable.
// Usage: const showError = useErrorDialog(); try { ... } catch (error) { showError(error, t('...')) }

type ShowError = (error: unknown, title?: string) => void

const ErrorDialogContext = createContext<ShowError | null>(null)

export function useErrorDialog(): ShowError {
  const show = useContext(ErrorDialogContext)
  if (!show) throw new Error('useErrorDialog needs <ErrorDialogProvider> above it')
  return show
}

interface Shown {
  error: unknown
  title: string | undefined
  open: boolean
}

export function ErrorDialogProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const version = useVersion().data?.version
  const [shown, setShown] = useState<Shown | null>(null)

  const show = useCallback<ShowError>((error, title) => setShown({ error, title, open: true }), [])
  const close = () => setShown((current) => (current ? { ...current, open: false } : null))
  const description = useMemo(() => (shown ? describeError(t, shown.error) : null), [shown, t])

  return (
    <ErrorDialogContext.Provider value={show}>
      {children}
      <Dialog
        open={shown?.open === true}
        onClose={close}
        title={shown?.title ?? t('errors.dialogTitle')}
        icon="alertCircle"
        tone="danger"
        role="alertdialog"
        size="md"
        footer={
          <>
            {description && <CopyButton getText={() => copyableError(description, { title: shown?.title, version })} />}
            <Button variant="confirm" onClick={close}>
              {t('common.close')}
            </Button>
          </>
        }
      >
        {description && (
          <div data-testid="error-dialog">
            <p className="text-[0.9375rem] leading-relaxed break-words select-text">{description.message}</p>
            {description.technical.length > 0 && (
              <section className="mt-4">
                <h3 className="mb-1.5 text-sm text-ink-muted">{t('errors.technical.heading')}</h3>
                <pre className="rounded-sm border border-line bg-sunken p-3 font-mono text-xs break-words whitespace-pre-wrap select-text">
                  {description.technical.join('\n')}
                </pre>
              </section>
            )}
          </div>
        )}
      </Dialog>
    </ErrorDialogContext.Provider>
  )
}
