import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from './Icon'

/** Title block of a page inside the app shell; actions (a "create" button) sit on the right, always in the same place. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex items-end justify-between gap-6">
      <div className="min-w-0">
        <h1 className="text-[1.75rem] leading-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

/** A titled card (one topic of a settings page). */
export function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-6" aria-label={title}>
      <h2 className="text-lg">{title}</h2>
      {description && <p className="mt-1 mb-5 max-w-2xl text-sm text-ink-muted">{description}</p>}
      {!description && <div className="mb-4" />}
      {children}
    </section>
  )
}

/** A neutral loading indicator for a block of content. */
export function Loading({ label }: { label?: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-ink-muted" role="status">
      <Icon name="loader" size={20} className="animate-spin" />
      <span>{label ?? t('common.loading')}</span>
    </div>
  )
}

/** The full-screen variant while the app decides where the user belongs. */
export function BootLoader() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg text-ink-muted" role="status" aria-busy="true">
      <Icon name="loader" size={26} className="animate-spin" />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  )
}
