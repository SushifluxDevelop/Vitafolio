import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { profileApi } from '../../api/endpoints'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/Page'
import { TabPanel, Tabs, useTabParam } from '../../components/ui/Tabs'
import type { TabItem } from '../../components/ui/Tabs'
import { ProfileWizard } from '../../features/profile/ProfileWizard'
import { CertificatesTab } from './CertificatesTab'
import { CustomSectionsTab } from './CustomSectionsTab'
import { EducationsTab } from './EducationsTab'
import { ExperiencesTab } from './ExperiencesTab'
import { InterestsTab } from './InterestsTab'
import { JsonResumeModal } from './JsonResumeModal'
import { LanguagesTab } from './LanguagesTab'
import { PersonalTab } from './PersonalTab'
import { PreviewTab } from './PreviewTab'
import { SkillsTab } from './SkillsTab'

type ProfileTab =
  | 'personal'
  | 'experiences'
  | 'educations'
  | 'skills'
  | 'languages'
  | 'certificates'
  | 'interests'
  | 'customSections'
  | 'preview'

export function ProfilePage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [wizardMode, setWizardMode] = useState(false)
  const [jsonResumeOpen, setJsonResumeOpen] = useState(false)

  const tabs: TabItem<ProfileTab>[] = [
    { id: 'personal', label: t('profile.tabs.personal'), icon: 'fileText' },
    { id: 'experiences', label: t('profile.tabs.experiences'), icon: 'briefcase' },
    { id: 'educations', label: t('profile.tabs.educations'), icon: 'timeline' },
    { id: 'skills', label: t('profile.tabs.skills'), icon: 'sparkles' },
    { id: 'languages', label: t('profile.tabs.languages'), icon: 'language' },
    { id: 'certificates', label: t('profile.tabs.certificates'), icon: 'circleCheck' },
    { id: 'interests', label: t('profile.tabs.interests'), icon: 'sun' },
    { id: 'customSections', label: t('profile.tabs.customSections'), icon: 'files' },
    { id: 'preview', label: t('profile.tabs.preview'), icon: 'fileExport' },
  ]

  const [active, setActive] = useTabParam(tabs.map((tab) => tab.id))

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: profileApi.get,
  })

  if (profileQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-ink-muted">
        <p>{t('common.loading')}</p>
      </div>
    )
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <div className="card p-8 text-center text-ink">
        <p className="font-semibold text-danger">{t('common.loadFailed') ?? 'Fehler beim Laden des Profils'}</p>
      </div>
    )
  }

  const profile = profileQuery.data

  return (
    <>
      <PageHeader
        title={t('profile.title')}
        subtitle={t('profile.description')}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={wizardMode ? 'layoutBoard' : 'sparkles'}
              onClick={() => setWizardMode(!wizardMode)}
            >
              {wizardMode ? 'Klassische Ansicht' : 'Assistenten-Modus'}
            </Button>
            <Button
              variant="secondary"
              icon="files"
              onClick={() => setJsonResumeOpen(true)}
            >
              JSON Resume
            </Button>
          </div>
        }
      />

      {wizardMode ? (
        <ProfileWizard profile={profile} onExitWizard={() => setWizardMode(false)} />
      ) : (
        <>
          <Tabs tabs={tabs} active={active} onChange={setActive} label={t('profile.title')} />
          <TabPanel id={active}>
            {active === 'personal' && <PersonalTab profile={profile} />}
            {active === 'experiences' && <ExperiencesTab profile={profile} />}
            {active === 'educations' && <EducationsTab profile={profile} />}
            {active === 'skills' && <SkillsTab profile={profile} />}
            {active === 'languages' && <LanguagesTab profile={profile} />}
            {active === 'certificates' && <CertificatesTab profile={profile} />}
            {active === 'interests' && <InterestsTab profile={profile} />}
            {active === 'customSections' && <CustomSectionsTab profile={profile} />}
            {active === 'preview' && <PreviewTab />}
          </TabPanel>
        </>
      )}

      <JsonResumeModal
        open={jsonResumeOpen}
        onClose={() => setJsonResumeOpen(false)}
        onImportSuccess={(p) => {
          queryClient.setQueryData(['profile'], p)
          void queryClient.invalidateQueries({ queryKey: ['profile'] })
        }}
      />
    </>
  )
}

