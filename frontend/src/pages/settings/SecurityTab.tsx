import { useTranslation } from 'react-i18next'
import { Section } from '../../components/ui/Page'
import { useUser } from '../../auth/AppState'
import { PasswordSection } from './PasswordSection'
import { SessionSection } from './SessionSection'
import { TotpSection } from './TotpSection'

/** Sicherheit: password, two-factor authentication and the signed-in sessions. */
export function SecurityTab() {
  const { t } = useTranslation()
  const user = useUser()
  return (
    <div className="flex flex-col gap-6">
      <Section title={t('settings.password.title')} description={t('settings.password.text')}>
        <PasswordSection />
      </Section>
      <Section
        title={t('settings.totp.title')}
        description={user.twoFactorEnabled ? t('settings.totp.textOn') : t('settings.totp.textOff')}
      >
        <TotpSection />
      </Section>
      <Section title={t('settings.sessions.title')} description={t('settings.sessions.text')}>
        <SessionSection />
      </Section>
    </div>
  )
}
