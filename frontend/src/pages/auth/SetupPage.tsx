import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { authApi } from '../../api/endpoints'
import type { Bootstrap } from '../../api/types'
import { useAppState } from '../../auth/AppState'
import { BOOTSTRAP_KEY, ME_KEY } from '../../auth/useAuth'
import type { Session } from '../../auth/useAuth'
import { AccountForm } from '../../components/forms/AccountForm'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Notice } from '../../components/ui/Notice'

/** First start: creates the first account, which becomes the administrator, and signs it in. */
export function SetupPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { bootstrap } = useAppState()

  return (
    <AuthLayout>
      <h1 className="text-[1.75rem] leading-tight">{t('setup.title')}</h1>
      <p className="mt-2 mb-6 text-ink-muted">{t('setup.intro')}</p>
      <div className="mb-5">
        <Notice tone="info">{t('setup.adminHint')}</Notice>
      </div>
      <AccountForm
        submitLabel={t('setup.submit')}
        askSetupToken={bootstrap.setupTokenRequired === true}
        answerCodes={['setup.already_done', 'setup.token_invalid', 'rate_limited']}
        onSubmit={async (account) => {
          const { user } = await authApi.setup(account)
          queryClient.setQueryData<Session>(ME_KEY, { user, twoFactorSetupRequired: user.mustSetupTwoFactor })
          queryClient.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (current) => (current ? { ...current, setupRequired: false } : current))
          void navigate('/', { replace: true })
        }}
      />
    </AuthLayout>
  )
}
