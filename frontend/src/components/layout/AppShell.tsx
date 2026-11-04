import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { authApi } from '../../api/endpoints'
import { SIGNED_OUT, ME_KEY } from '../../auth/useAuth'
import type { Session } from '../../auth/useAuth'
import { useAppState } from '../../auth/AppState'
import { useAppearance } from '../../theme/useAppearance'
import { MadeWith, VersionLabel, Wordmark } from '../ui/Brand'
import { useErrorDialog } from '../ui/ErrorDialog'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'
import { Segmented } from '../ui/Segmented'

interface NavItem {
  to: string
  label: string
  icon: IconName
  end?: boolean
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-semibold transition-colors ${
    isActive ? 'bg-select text-select-ink shadow-[inset_3px_0_0_var(--indicator)]' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
  }`

/** Two letters for the avatar tile, from the display name. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? `${words[0]![0]}${words[words.length - 1]![0]}` : (words[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

/**
 * The frame of the signed-in app: a sidebar (wordmark, navigation, user area with settings, theme switch and sign-out,
 * footer with the credit line and the running version) next to the page. Below 1024 px the page scrolls sideways - there
 * is no phone layout.
 */
export function AppShell() {
  const { t } = useTranslation()
  const { bootstrap, session } = useAppState()
  const user = session.user!
  const appearance = useAppearance()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const showError = useErrorDialog()
  const desktop = bootstrap.mode === 'desktop'

  const signOut = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.setQueryData<Session>(ME_KEY, SIGNED_OUT)
      // Nothing of the previous account may stay in the cache for the next one.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'bootstrap' && query.queryKey[0] !== 'version' && query.queryKey[0] !== 'me' })
      void navigate('/login', { replace: true })
    },
    onError: (error) => showError(error, t('shell.signOutFailed')),
  })

  const items: NavItem[] = [
    { to: '/', label: t('nav.overview'), icon: 'home', end: true },
    ...(user.role === 'admin' && !desktop ? [{ to: '/admin', label: t('nav.admin'), icon: 'userShield' as const }] : []),
  ]

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-line bg-surface">
        <div className="px-5 pt-6 pb-5">
          <Wordmark height={26} />
        </div>

        <nav aria-label={t('nav.label')} className="flex flex-col gap-1 px-3">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              <Icon name={item.icon} size={19} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3 border-t border-line px-3 py-4">
          <div className="flex items-center gap-3 px-2">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-select text-sm font-semibold text-select-ink"
              aria-hidden="true"
            >
              {initials(user.displayName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink" data-testid="current-user" title={user.displayName}>
                {user.displayName}
              </p>
              <p className="truncate text-xs text-ink-muted">{desktop ? t('shell.localAccount') : t(`roles.${user.role}`)}</p>
            </div>
          </div>

          <NavLink to="/settings" className={navLinkClass}>
            <Icon name="settings" size={19} />
            {t('nav.settings')}
          </NavLink>

          <div className="px-1">
            <Segmented
              label={t('shell.theme')}
              value={appearance.preference}
              onChange={appearance.setTheme}
              options={[
                { value: 'system', label: t('settings.theme.system'), icon: 'deviceDesktop' },
                { value: 'light', label: t('settings.theme.light'), icon: 'sun' },
                { value: 'dark', label: t('settings.theme.dark'), icon: 'moon' },
              ]}
              compact
            />
          </div>

          {!desktop && (
            <button type="button" className="btn btn-secondary btn-sm justify-start" data-testid="sign-out" disabled={signOut.isPending} onClick={() => signOut.mutate()}>
              <Icon name="logout" size={16} />
              {t('nav.signOut')}
            </button>
          )}
        </div>

        <footer className="flex flex-col gap-0.5 border-t border-line px-5 py-3 text-xs text-ink-muted">
          <MadeWith />
          <VersionLabel />
        </footer>
      </aside>

      <main className="min-w-0 flex-1 bg-bg">
        <div className="mx-auto w-full max-w-5xl px-8 py-8 xl:px-12 xl:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
