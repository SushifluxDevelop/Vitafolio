import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'
import { Dialog } from './Dialog'

// Our own confirmation dialog - never window.confirm/alert/prompt (the browser's boxes ignore the app's look).
// Usage: const confirm = useConfirm(); if (!(await confirm({ ... }))) return

export interface ConfirmOptions {
  title: string
  message: ReactNode
  /** The action named on the button ("Löschen", "Zurücksetzen" - not "OK"). */
  confirmLabel: string
  cancelLabel?: string
  /** "danger" = destructive action (red, focus starts on the cancel button). */
  tone?: 'danger' | 'default'
}

type ConfirmFunction = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFunction | null>(null)

export function useConfirm(): ConfirmFunction {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm needs <ConfirmProvider> above it')
  return confirm
}

interface Pending {
  options: ConfirmOptions
  resolve: (ok: boolean) => void
  /** Closed but still held, so the text does not vanish while the dialog fades out. */
  open: boolean
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [pending, setPending] = useState<Pending | null>(null)
  const pendingRef = useRef<Pending | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  const confirm = useCallback<ConfirmFunction>(
    (options) =>
      new Promise<boolean>((resolve) => {
        // A second request replaces an open one; the first counts as cancelled.
        pendingRef.current?.resolve(false)
        const next = { options, resolve, open: true }
        pendingRef.current = next
        setPending(next)
      }),
    [],
  )

  const close = (ok: boolean) => {
    pendingRef.current?.resolve(ok)
    pendingRef.current = null
    setPending((current) => (current ? { ...current, open: false } : null))
  }

  const options = pending?.options
  const danger = options?.tone === 'danger'

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={pending?.open === true}
        onClose={() => close(false)}
        title={options?.title ?? ''}
        icon={danger ? 'trash' : 'alertTriangle'}
        tone={danger ? 'danger' : 'default'}
        role="alertdialog"
        size="sm"
        hideCloseButton
        // Destructive: start on the cancel button, so a hasty Enter does not delete anything.
        initialFocus={danger ? cancelRef : confirmRef}
        footer={
          <>
            <Button ref={cancelRef} onClick={() => close(false)}>
              {options?.cancelLabel ?? t('common.cancel')}
            </Button>
            <Button ref={confirmRef} variant={danger ? 'danger' : 'confirm'} onClick={() => close(true)}>
              {options?.confirmLabel ?? ''}
            </Button>
          </>
        }
      >
        <div className="text-[0.9375rem] leading-relaxed text-ink-muted">{options?.message}</div>
      </Dialog>
    </ConfirmContext.Provider>
  )
}
