import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { adminApi } from '../api/endpoints'
import { useAppState, useUser } from '../auth/AppState'
import { Logo } from '../components/ui/Brand'
import { Icon } from '../components/ui/Icon'
import type { IconName } from '../components/ui/Icon'
import { formatDateTime } from '../format'

function StatusCard({ icon, title, children, link }: { icon: IconName; title: string; children: ReactNode; link?: { to: string; label: string } }) {
  return (
    <section className="card flex gap-4 p-5" aria-label={title}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-select text-select-ink">
        <Icon name={icon} size={21} />
      </span>
      <div className="min-w-0">
        <h2 className="text-base">{title}</h2>
        <div className="mt-1 text-sm text-ink-muted">{children}</div>
        {link && (
          <Link to={link.to} className="mt-2 inline-block text-sm font-semibold">
            {link.label}
          </Link>
        )}
      </div>
    </section>
  )
}

/** The start page: a welcome and what is relevant about the account and the instance. */
export function OverviewPage() {
  const { t, i18n } = useTranslation()
  const { bootstrap } = useAppState()
  const user = useUser()
  const desktop = bootstrap.mode === 'desktop'
  const isAdmin = user.role === 'admin'

  const backups = useQuery({ queryKey: ['backups', 'list'], queryFn: adminApi.backups, enabled: isAdmin, retry: false })
  const lastBackup = backups.data?.map((entry) => entry.createdAt).sort().at(-1)

  return (
    <>
      <section className="brand-panel relative mb-6 flex items-center gap-6 overflow-hidden rounded-md border border-white/10 p-8" aria-label={t('overview.welcomeLabel')}>
        <Logo size={72} className="shrink-0 shadow-pop" />
        <div className="min-w-0">
          <h1 className="text-[1.875rem] leading-tight text-[#f3eee2]">{t('overview.welcome', { name: user.displayName })}</h1>
          <p className="mt-2 max-w-xl leading-relaxed text-[#c4cce0]">{t('brand.subline')}</p>
          <div className="mt-4 h-1 w-14 rounded-xs bg-[#d9ae57]" aria-hidden="true" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <StatusCard icon="users" title={t('overview.account.title')}>
          <p>
            {user.displayName} <span className="text-ink-muted">({user.username})</span>
          </p>
          <p className="mt-1.5">
            <span className="badge badge-select">{t(`roles.${user.role}`)}</span>
          </p>
        </StatusCard>

        {!desktop && (
          <StatusCard icon="shieldCheck" title={t('overview.twoFactor.title')} link={{ to: '/settings?tab=security', label: t('overview.twoFactor.manage') }}>
            {user.twoFactorEnabled ? (
              <span className="badge badge-success">{t('overview.twoFactor.on')}</span>
            ) : (
              <span className="badge badge-warning">{t('overview.twoFactor.off')}</span>
            )}
            <p className="mt-1.5">{user.twoFactorEnabled ? t('overview.twoFactor.onText') : t('overview.twoFactor.offText')}</p>
          </StatusCard>
        )}

        <StatusCard icon={desktop ? 'deviceDesktop' : 'world'} title={t('overview.mode.title')}>
          <p>{desktop ? t('overview.mode.desktop') : t('overview.mode.server')}</p>
        </StatusCard>

        {isAdmin && (
          <StatusCard icon="database" title={t('overview.backup.title')} link={{ to: desktop ? '/settings?tab=backups' : '/admin?tab=backups', label: t('overview.backup.manage') }}>
            <p>{lastBackup ? t('overview.backup.last', { when: formatDateTime(lastBackup, i18n.language) }) : backups.isPending ? t('common.loading') : t('overview.backup.none')}</p>
          </StatusCard>
        )}
      </div>
    </>
  )
}
