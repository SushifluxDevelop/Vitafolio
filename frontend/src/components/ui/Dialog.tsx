import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Icon } from './Icon'
import type { IconName } from './Icon'

const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

export interface DialogProps {
  open: boolean
  /** Called for Esc, the close button and a click on the backdrop. */
  onClose: () => void
  title: string
  /** Icon in the tinted tile next to the title. */
  icon?: IconName
  tone?: 'default' | 'danger'
  /** "alertdialog" for confirmations and errors, "dialog" for forms. */
  role?: 'dialog' | 'alertdialog'
  /** Width of the panel. */
  size?: 'sm' | 'md' | 'lg'
  /** What gets the focus when the dialog opens; the first focusable element when not given. */
  initialFocus?: RefObject<HTMLElement | null>
  /** A click on the backdrop closes the dialog (not for forms with unsaved input). */
  closeOnBackdrop?: boolean
  /** Hide the close button in the corner (confirmations have their own cancel button). */
  hideCloseButton?: boolean
  children: ReactNode
  footer?: ReactNode
}

const WIDTH = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' } as const

/**
 * The app's own dialog - never the browser's or the operating system's. Own overlay, focus trap, Esc and backdrop close,
 * focus returns to where it was; the body scrolls inside the panel, so a long text (an error message) is always fully
 * readable. Motion respects the reduced-motion setting.
 */
export function Dialog({
  open,
  onClose,
  title,
  icon,
  tone = 'default',
  role = 'dialog',
  size = 'md',
  initialFocus,
  closeOnBackdrop = true,
  hideCloseButton = false,
  children,
  footer,
}: DialogProps) {
  const reduce = useReducedMotion() ?? false

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-(--overlay) p-6 pt-[max(2rem,10vh)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.16 }}
          onMouseDown={(event) => {
            if (closeOnBackdrop && event.target === event.currentTarget) onClose()
          }}
        >
          <Panel
            onClose={onClose}
            title={title}
            icon={icon}
            tone={tone}
            role={role}
            size={size}
            initialFocus={initialFocus}
            hideCloseButton={hideCloseButton}
            footer={footer}
            reduce={reduce}
          >
            {children}
          </Panel>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

interface PanelProps extends Pick<DialogProps, 'onClose' | 'title' | 'icon' | 'tone' | 'role' | 'size' | 'initialFocus' | 'hideCloseButton' | 'footer' | 'children'> {
  reduce: boolean
}

function Panel({ onClose, title, icon, tone, role, size = 'md', initialFocus, hideCloseButton, footer, children, reduce }: PanelProps) {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // The Escape listener lives as long as the panel, so it reads the newest onClose (which may depend on a busy state).
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const focusTarget =
      initialFocus?.current ?? panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
    focusTarget?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closeRef.current()
      }
    }
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('keydown', onEscape)
      document.body.style.overflow = previousOverflow
      previous?.focus?.()
    }
    // Runs once when the panel mounts (it only exists while the dialog is open).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !panelRef.current) return
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (items.length === 0) return
    const first = items[0]!
    const last = items[items.length - 1]!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const danger = tone === 'danger'
  return (
    <motion.div
      ref={panelRef}
      role={role}
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      className={`flex max-h-[calc(100vh-4rem)] w-full flex-col rounded-lg border border-line bg-surface shadow-pop ${WIDTH[size]}`}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.99 }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
    >
      <div className="flex items-start gap-3 px-6 pt-5 pb-3">
        {icon && (
          <span
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm ${danger ? 'bg-danger-soft text-danger-soft-ink' : 'bg-select text-select-ink'}`}
          >
            <Icon name={icon} size={20} />
          </span>
        )}
        <h2 id={titleId} className="min-w-0 flex-1 pt-1 text-lg leading-snug">
          {title}
        </h2>
        {!hideCloseButton && (
          <button type="button" className="btn btn-ghost btn-sm -mr-2" aria-label={t('common.close')} onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 text-ink">{children}</div>
      {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
    </motion.div>
  )
}
