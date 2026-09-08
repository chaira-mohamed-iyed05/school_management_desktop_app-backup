import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ar from './locales/ar.json'
import fr from './locales/fr.json'
import en from './locales/en.json'

export type SupportedLanguage = 'ar' | 'fr' | 'en'

export const LANGUAGES: { code: SupportedLanguage; label: string; dir: 'rtl' | 'ltr' }[] = [
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'en', label: 'English', dir: 'ltr' },
]

i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: 'ar', // Arabic is the default
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
  returnNull: false,
})

/**
 * Switch the application language.
 * Updates: i18next language, HTML lang attribute, HTML dir attribute,
 * and persists the choice through the settings IPC.
 */
export function switchLanguage(lang: SupportedLanguage): void {
  i18n.changeLanguage(lang)

  const dir = LANGUAGES.find((l) => l.code === lang)?.dir ?? 'ltr'
  document.documentElement.lang = lang
  document.documentElement.dir = dir

  // Persist to DB (fire-and-forget — non-critical)
  window.schoolApp?.settings
    .update({ defaultLanguage: lang })
    .catch(() => {/* silent */})
}

/**
 * Apply the persisted language on app startup.
 */
export function applyLanguage(lang: SupportedLanguage): void {
  i18n.changeLanguage(lang)
  const dir = LANGUAGES.find((l) => l.code === lang)?.dir ?? 'ltr'
  document.documentElement.lang = lang
  document.documentElement.dir = dir
}

export default i18n
