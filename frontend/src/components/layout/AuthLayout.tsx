import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { LanguageCode } from '../../api/types'
import { applyLanguage } from '../../i18n'
import { Logo, MadeWith, VersionLabel, Wordmark } from '../ui/Brand'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'
import { Segmented } from '../ui/Segmented'

const FEATURES: { key: string; icon: IconName }[] = [
  { key: 'cv', icon: 'files' },
  { key: 'letter', icon: 'fileText' },
  { key: 'designs', icon: 'palette' },
  { key: 'export', icon: 'fileExport' },
  { key: 'tracker', icon: 'timeline' },
]

/**
 * The shell of every page for somebody who is not signed in: a third of the width holds the form, two thirds a navy brand
 * panel with the wordmark, the tagline and what the app does. The form card is anchored near the top, not centred, so a
 * change of its height can never make it jump.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation()
  const language = (i18n.language.startsWith('en') ? 'en' : 'de') as LanguageCode

  // The reserved scrollbar gutter shows the page background: on these pages it takes the colour of the brand panel next to it.
  useEffect(() => {
    document.documentElement.setAttribute('data-auth', '')
    return () => document.documentElement.removeAttribute('data-auth')
  }, [])

  return (
    <div className="flex min-h-screen">
      <main className="flex min-h-screen flex-[0_0_33.333%] flex-col bg-bg px-8 pt-8 pb-6">
        <div className="mx-auto w-full max-w-sm pt-[max(2rem,10vh)]">
          <Logo size={44} className="mb-8" />
          {children}
        </div>
        <div className="mx-auto mt-auto w-full max-w-sm pt-8">
          <Segmented
            label={t('common.language')}
            value={language}
            onChange={(next) => void applyLanguage(next)}
            options={[
              { value: 'de', label: 'Deutsch' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>
      </main>

      <aside className="brand-panel sticky top-0 flex h-screen flex-1 flex-col self-start overflow-y-auto px-12 py-8 xl:px-16" aria-label={t('brand.panelLabel')}>
        <Wordmark onDark height={34} />

        <div className="my-auto max-w-3xl py-6">
          <h2 className="font-display text-4xl leading-[1.1] tracking-tight text-[#f3eee2] xl:text-5xl">{t('brand.tagline')}</h2>
          <p className="mt-4 max-w-lg text-[1.0625rem] leading-relaxed text-[#c4cce0]">{t('brand.subline')}</p>
          <div className="mt-3 h-1 w-14 rounded-xs bg-[#d9ae57]" aria-hidden="true" />

          <ul className="mt-8 grid grid-cols-2 gap-3">
            {FEATURES.map((feature, index) => (
              <li
                key={feature.key}
                className={`flex gap-3.5 rounded-md border border-white/12 bg-white/[0.06] p-4 backdrop-blur-sm ${index === FEATURES.length - 1 ? 'col-span-2' : ''}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[#d9ae57]/15 text-[#e3bc6a]">
                  <Icon name={feature.icon} size={21} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[0.9375rem] text-[#f3eee2]">{t(`brand.features.${feature.key}.title`)}</h3>
                  <p className="mt-0.5 text-sm leading-snug text-[#c4cce0]">{t(`brand.features.${feature.key}.text`)}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-5 flex items-start gap-2.5 text-sm leading-snug text-[#c4cce0]">
            <Icon name="sparkles" size={17} className="mt-0.5 shrink-0 text-[#e3bc6a]" />
            {t('brand.ai')}
          </p>
        </div>

        <footer className="flex items-center justify-between text-sm text-[#b4bdd4]">
          <span className="flex items-center gap-3">
            <MadeWith onDark />
            <span aria-hidden="true">·</span>
            <VersionLabel />
          </span>
          <span>{t('brand.copyright', { year: new Date().getFullYear() })}</span>
        </footer>
      </aside>
    </div>
  )
}
