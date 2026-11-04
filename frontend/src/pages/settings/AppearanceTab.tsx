import { useTranslation } from 'react-i18next'
import type { LanguageCode, ThemePreference } from '../../api/types'
import { Section } from '../../components/ui/Page'
import { Segmented } from '../../components/ui/Segmented'
import { useAppearance } from '../../theme/useAppearance'

/** Darstellung: theme (system, light, dark) and language. Applied at once, saved to the account when signed in. */
export function AppearanceTab() {
  const { t, i18n } = useTranslation()
  const appearance = useAppearance()
  const language: LanguageCode = i18n.language.startsWith('en') ? 'en' : 'de'

  return (
    <div className="flex flex-col gap-6">
      <Section title={t('settings.theme.title')} description={t('settings.theme.text')}>
        <Segmented<ThemePreference>
          label={t('settings.theme.title')}
          value={appearance.preference}
          onChange={appearance.setTheme}
          options={[
            { value: 'system', label: t('settings.theme.system'), icon: 'deviceDesktop' },
            { value: 'light', label: t('settings.theme.light'), icon: 'sun' },
            { value: 'dark', label: t('settings.theme.dark'), icon: 'moon' },
          ]}
        />
      </Section>

      <Section title={t('settings.language.title')} description={t('settings.language.text')}>
        <Segmented<LanguageCode>
          label={t('settings.language.title')}
          value={language}
          onChange={(next) => void appearance.setLanguage(next)}
          options={[
            { value: 'de', label: 'Deutsch', icon: 'language' },
            { value: 'en', label: 'English', icon: 'language' },
          ]}
        />
      </Section>
    </div>
  )
}
