import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { authApi } from '../../api/endpoints'
import { useAppState } from '../../auth/AppState'
import { ME_KEY, SIGNED_OUT } from '../../auth/useAuth'
import type { Session } from '../../auth/useAuth'
import { TotpSetup } from '../../components/forms/TotpSetup'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { useErrorDialog } from '../../components/ui/ErrorDialog'
import { Notice } from '../../components/ui/Notice'

/**
 * Forced two-factor setup: the administrator requires it for everybody, and until it is done the server refuses every
 * other request. Same flow as in the settings, in the narrow form panel.
 */
export function TwoFactorSetupPage() {
  const { t } = useTranslation()
  const { bootstrap } = useAppState()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const showError = useErrorDialog()

  const signOut = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.setQueryData<Session>(ME_KEY, SIGNED_OUT)
      void navigate('/login', { replace: true })
    },
    onError: (error) => showError(error, t('shell.signOutFailed')),
  })

  return (
    <AuthLayout>
      <h1 className="text-[1.75rem] leading-tight">{t('forced2fa.title')}</h1>
      <p className="mt-2 mb-5 text-ink-muted">{t('forced2fa.intro')}</p>
      <div className="mb-5">
        <Notice tone="info">{t('forced2fa.hint')}</Notice>
      </div>
      <TotpSetup
        stacked
        askPassword={false}
        onFinished={() => {
          void queryClient.invalidateQueries({ queryKey: ME_KEY }).then(() => navigate('/', { replace: true }))
        }}
      />
      {bootstrap.mode === 'server' && (
        <button type="button" className="mt-6 text-sm font-semibold text-link underline" disabled={signOut.isPending} onClick={() => signOut.mutate()}>
          {t('nav.signOut')}
        </button>
      )}
    </AuthLayout>
  )
}
