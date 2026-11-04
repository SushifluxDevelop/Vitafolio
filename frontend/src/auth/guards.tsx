import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation, useRouteError } from 'react-router'
import { ErrorScreen, errorKindOf } from '../components/ErrorScreen'
import { BootLoader } from '../components/ui/Page'
import { applyLanguage, isLanguage } from '../i18n'
import { isThemePreference, useTheme } from '../theme/ThemeProvider'
import { AppStateProvider, useAppState } from './AppState'
import { safeReturnPath, useBootstrapQuery, useSessionQuery } from './useAuth'

/** Applies the saved theme and language of the account once somebody is signed in (the account wins over this browser). */
function PreferencesSync() {
  const { session } = useAppState()
  const theme = useTheme()
  const userId = session.user?.id
  const savedTheme = session.user?.theme
  const savedLanguage = session.user?.language

  useEffect(() => {
    if (!userId) return
    if (isThemePreference(savedTheme)) theme.setPreference(savedTheme)
    if (isLanguage(savedLanguage)) void applyLanguage(savedLanguage)
    // Only when the account changes: later changes of the account's copy come from this very browser.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  return null
}

/**
 * Root route: resolves what the app needs to know before any page renders (the instance's mode and rules, who is
 * signed in) and shows a status screen when that is impossible (server unreachable, too many requests ...).
 */
export function AppGate() {
  const bootstrap = useBootstrapQuery()
  const session = useSessionQuery()

  if (bootstrap.isError) return <ErrorScreen kind={errorKindOf(bootstrap.error)} error={bootstrap.error} onRetry={() => void bootstrap.refetch()} />
  if (session.isError) return <ErrorScreen kind={errorKindOf(session.error)} error={session.error} onRetry={() => void session.refetch()} />
  if (!bootstrap.data || !session.data) return <BootLoader />

  return (
    <AppStateProvider value={{ bootstrap: bootstrap.data, session: session.data }}>
      <PreferencesSync />
      <Outlet />
    </AppStateProvider>
  )
}

/** Only while no account exists: the one-time setup of the first (admin) account. Not in the desktop program. */
export function SetupOnly() {
  const { bootstrap, session } = useAppState()
  if (bootstrap.mode === 'desktop') return <Navigate to="/" replace />
  if (!bootstrap.setupRequired) return <Navigate to={session.user ? '/' : '/login'} replace />
  return <Outlet />
}

/** Sign-in and registration: for somebody who is not signed in. Signed-in users are sent on. */
export function GuestOnly() {
  const { bootstrap, session } = useAppState()
  const location = useLocation()
  if (bootstrap.mode === 'desktop') return <Navigate to="/" replace />
  if (bootstrap.setupRequired) return <Navigate to="/setup" replace />
  if (session.user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={session.user.mustSetupTwoFactor ? '/two-factor-setup' : safeReturnPath(from)} replace />
  }
  if (session.twoFactorSetupRequired) return <Navigate to="/two-factor-setup" replace />
  return <Outlet />
}

/** Registration additionally needs the instance setting; otherwise the way leads back to sign-in. */
export function RegistrationOnly() {
  const { bootstrap } = useAppState()
  if (!bootstrap.registrationOpen) return <Navigate to="/login" replace />
  return <Outlet />
}

/**
 * Everything behind the sign-in. Server mode sends somebody who is not signed in to the sign-in page (and back to where
 * they were afterwards); in the desktop program a missing local session is an error of its own (401), because there is
 * no sign-in there.
 */
export function RequireUser() {
  const { bootstrap, session } = useAppState()
  const location = useLocation()

  if (bootstrap.mode === 'server' && bootstrap.setupRequired) return <Navigate to="/setup" replace />
  if (!session.user) {
    if (session.twoFactorSetupRequired) return <Navigate to="/two-factor-setup" replace />
    if (bootstrap.mode === 'desktop') return <ErrorScreen kind="401" />
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  if (session.user.mustSetupTwoFactor) return <Navigate to="/two-factor-setup" replace />
  return <Outlet />
}

/** The forced two-factor setup: only reachable while the server demands it. */
export function RequireTwoFactorSetup() {
  const { session } = useAppState()
  if (!session.twoFactorSetupRequired) return <Navigate to={session.user ? '/' : '/login'} replace />
  return <Outlet />
}

/** Administration: admins only (the server checks too; this only keeps the page from showing to others). */
export function RequireAdmin() {
  const { bootstrap, session } = useAppState()
  // The desktop program has no administration area; its single owner finds the backups in the settings.
  if (bootstrap.mode === 'desktop') return <Navigate to="/settings?tab=backups" replace />
  if (session.user?.role !== 'admin') return <ErrorScreen kind="403" />
  return <Outlet />
}

/** Shown for anything that goes wrong while rendering a route (the crash console above shows the details in dev). */
export function RouteError(): ReactNode {
  const error = useRouteError()
  // Rethrown so the app-level error boundary shows the developer console with the full stack.
  throw error instanceof Error ? error : new Error(String(error))
}
