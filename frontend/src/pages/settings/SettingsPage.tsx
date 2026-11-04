import { useTranslation } from 'react-i18next'
import { useAppState } from '../../auth/AppState'
import { PageHeader } from '../../components/ui/Page'
import { TabPanel, Tabs, useTabParam } from '../../components/ui/Tabs'
import type { TabItem } from '../../components/ui/Tabs'
import { BackupsPanel } from '../../features/backups/BackupsPanel'
import { AppearanceTab } from './AppearanceTab'
import { SecurityTab } from './SecurityTab'

type SettingsTab = 'appearance' | 'security' | 'backups'

/**
 * Einstellungen: the user's own options only, grouped by topic in tabs (the active tab is in the address). The security
 * tab only exists where there are accounts (server); the desktop program has the backups here instead, because there is
 * no administration area for a single local owner.
 */
export function SettingsPage() {
  const { t } = useTranslation()
  const { bootstrap } = useAppState()
  const desktop = bootstrap.mode === 'desktop'

  const tabs: TabItem<SettingsTab>[] = [
    { id: 'appearance', label: t('settings.tabs.appearance'), icon: 'palette' },
    ...(desktop ? [{ id: 'backups' as const, label: t('settings.tabs.backups'), icon: 'database' as const }] : [{ id: 'security' as const, label: t('settings.tabs.security'), icon: 'shieldLock' as const }]),
  ]
  const [active, setActive] = useTabParam(tabs.map((tab) => tab.id))

  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <Tabs tabs={tabs} active={active} onChange={setActive} label={t('settings.title')} />
      <TabPanel id={active}>
        {active === 'appearance' && <AppearanceTab />}
        {active === 'security' && <SecurityTab />}
        {active === 'backups' && <BackupsPanel />}
      </TabPanel>
    </>
  )
}
