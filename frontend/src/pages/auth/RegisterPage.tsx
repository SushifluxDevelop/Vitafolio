import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { authApi } from '../../api/endpoints'
import { ME_KEY } from '../../auth/useAuth'
import type { Session } from '../../auth/useAuth'
import { AccountForm } from '../../components/forms/AccountForm'
import { AuthLayout } from '../../components/layout/AuthLayout'

/** Self-registration; only reachable while the administrator has opened it. */
export function RegisterPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return (
    <AuthLayout>
      <h1 className="text-[1.75rem] leading-tight">{t('register.title')}</h1>
      <p className="mt-2 mb-6 text-ink-muted">{t('register.intro')}</p>
      <AccountForm
        submitLabel={t('register.submit')}
        answerCodes={['rate_limited', 'registration.closed']}
        onSubmit={async (account) => {
          const { user } = await authApi.register(account)
          queryClient.setQueryData<Session>(ME_KEY, { user, twoFactorSetupRequired: user.mustSetupTwoFactor })
          void navigate('/', { replace: true })
        }}
      />
      <p className="mt-2 text-sm text-ink-muted">
        {t('register.haveAccount')}{' '}
        <Link to="/login" className="font-semibold">
          {t('login.title')}
        </Link>
      </p>
    </AuthLayout>
  )
}
