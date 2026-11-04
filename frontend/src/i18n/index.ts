import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { branding } from '../branding'
import type { LanguageCode } from '../api/types'
import de from './locales/de.json'
import en from './locales/en.json'

export const LANGUAGES: readonly LanguageCode[] = ['de', 'en']
export const DEFAULT_LANGUAGE: LanguageCode = 'de'
const STORAGE_KEY = 'cv.language'

export function isLanguage(value: unknown): value is LanguageCode {
  return value === 'de' || value === 'en'
}

/** The browser's own language when it is a supported one; German otherwise. */
function browserLanguage(): LanguageCode {
  const preferred = typeof navigator === 'undefined' ? '' : navigator.language.toLowerCase().slice(0, 2)
  return isLanguage(preferred) ? preferred : DEFAULT_LANGUAGE
}

/** The language saved in this browser; without one the browser's language (German unless it is English). */
export function storedLanguage(): LanguageCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isLanguage(stored) ? stored : browserLanguage()
  } catch {
    return browserLanguage()
  }
}

/** Switches the interface language and remembers it in this browser (the account copy is saved by the caller). */
export async function applyLanguage(language: LanguageCode): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Storage can be blocked; the choice then only lasts for this page load.
  }
  document.documentElement.lang = language
  await i18n.changeLanguage(language)
}

void i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en } },
  lng: storedLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES as string[],
  interpolation: {
    // React escapes on its own.
    escapeValue: false,
    // The product name lives in branding.json only; texts say {{product}}.
    defaultVariables: { product: branding.name },
  },
})

document.documentElement.lang = i18n.language

export default i18n
