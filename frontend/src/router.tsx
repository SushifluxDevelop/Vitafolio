import { createBrowserRouter, useParams } from 'react-router'
import { AppGate, GuestOnly, RegistrationOnly, RequireAdmin, RequireTwoFactorSetup, RequireUser, RouteError, SetupOnly } from './auth/guards'
import { ErrorScreen } from './components/ErrorScreen'
import type { ErrorKind } from './components/ErrorScreen'
import { AppShell } from './components/layout/AppShell'
import { AdminPage } from './pages/admin/AdminPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { SetupPage } from './pages/auth/SetupPage'
import { TwoFactorSetupPage } from './pages/auth/TwoFactorSetupPage'
import { OverviewPage } from './pages/OverviewPage'
import { SettingsPage } from './pages/settings/SettingsPage'

const KINDS: readonly string[] = ['401', '403', '404', '429', '500', '503']

/** The status screens on their own addresses (/error/503 ...), also the target for links from outside the app. */
function ErrorRoute() {
  const { kind = '' } = useParams()
  return <ErrorScreen kind={(KINDS.includes(kind) ? kind : '404') as ErrorKind} />
}

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    element: <AppGate />,
    children: [
      { element: <SetupOnly />, children: [{ path: '/setup', element: <SetupPage /> }] },
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { element: <RegistrationOnly />, children: [{ path: '/register', element: <RegisterPage /> }] },
        ],
      },
      { element: <RequireTwoFactorSetup />, children: [{ path: '/two-factor-setup', element: <TwoFactorSetupPage /> }] },
      {
        element: <RequireUser />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: '/', element: <OverviewPage /> },
              { path: '/settings', element: <SettingsPage /> },
              { element: <RequireAdmin />, children: [{ path: '/admin', element: <AdminPage /> }] },
            ],
          },
        ],
      },
      { path: '/error/:kind', element: <ErrorRoute /> },
      { path: '*', element: <ErrorScreen kind="404" /> },
    ],
  },
])
