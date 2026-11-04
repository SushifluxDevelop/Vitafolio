import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { copyableError, describeError } from '../../api/errors'
import { useVersion } from '../../hooks/useVersion'
import { CopyButton } from './CopyButton'
import { Icon } from './Icon'
import type { IconName } from './Icon'

type Tone = 'danger' | 'success' | 'warning' | 'info'

const ICON: Record<Tone, IconName> = { danger: 'alertCircle', success: 'circleCheck', warning: 'alertTriangle', info: 'infoCircle' }

/** A plain notice with an icon (saved, hints, warnings). For failures use {@link ErrorNotice}. */
export function Notice({ tone, children }: { tone: Exclude<Tone, 'danger'>; children: ReactNode }) {
  return (
    <div role={tone === 'success' ? 'status' : 'note'} className={`notice notice-${tone}`}>
      <div className="flex gap-(--notice-gap)">
        <span className="mt-0.5 shrink-0">
          <Icon name={ICON[tone]} size={18} />
        </span>
        <p className="min-w-0 flex-1 break-words">{children}</p>
      </div>
    </div>
  )
}

interface ErrorNoticeProps {
  error: unknown
  /** What was being done ("Konto konnte nicht angelegt werden"); shown before the reason when given. */
  title?: string
}

/**
 * A failure the user caused by an action, shown in full: the specific translated message (never truncated, it wraps),
 * a Copy button that puts message, technical details, error code, app version and time on the clipboard, and the
 * technical text behind an expander (also complete). The footer row is always there, so every notice has the same
 * extra height and {@link AlertSlot} can reserve it.
 */
export function ErrorNotice({ error, title }: ErrorNoticeProps) {
  const { t } = useTranslation()
  const version = useVersion().data?.version
  const [open, setOpen] = useState(false)
  const description = describeError(t, error)

  return (
    <div role="alert" className="notice notice-danger" data-testid="error-notice">
      <div className="flex gap-(--notice-gap)">
        <span className="mt-0.5 shrink-0">
          <Icon name="alertCircle" size={18} />
        </span>
        <p className="min-w-0 flex-1 break-words select-text">
          {title && <strong className="font-semibold">{title} </strong>}
          {description.message}
        </p>
      </div>
      <div className="flex h-(--notice-footer) items-center justify-between gap-2 pt-1 pl-[calc(var(--notice-icon)+var(--notice-gap))]">
        {description.technical.length > 0 ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-xs text-[0.8125rem] font-medium underline underline-offset-2"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <Icon name="chevronDown" size={14} className={open ? 'rotate-180' : ''} />
            {t('errors.technical.toggle')}
          </button>
        ) : (
          <span />
        )}
        <CopyButton getText={() => copyableError(description, { title, version })} />
      </div>
      {open && (
        <pre className="mt-1 mb-1 ml-[calc(var(--notice-icon)+var(--notice-gap))] font-mono text-xs break-words whitespace-pre-wrap select-text">
          {description.technical.join('\n')}
        </pre>
      )}
    </div>
  )
}
