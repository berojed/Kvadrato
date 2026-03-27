import { createContext, useContext, useCallback, useMemo } from 'react'
import { useUIPreferences } from '@/context/UIPreferencesContext'
import hrDict from '@/locales/hr.json'
import enDict from '@/locales/en.json'

const I18nContext = createContext({
  language: 'hr',
  setLanguage: () => {},
  t: (key) => key,
  locale: 'hr-HR',
  dateFnsLocaleKey: 'hr',
})

const DICTIONARIES = { hr: hrDict, en: enDict }
const LOCALE_MAP = { hr: 'hr-HR', en: 'en-US' }

/**
 * Resolve a dotted key path against a dictionary object.
 * Example: resolve('auth.email', dict) → dict.auth.email
 */
function resolve(key, dict) {
  const parts = key.split('.')
  let current = dict
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[part]
  }
  return typeof current === 'string' ? current : undefined
}

export function I18nProvider({ children }) {
  const { language, setLanguage } = useUIPreferences()

  /**
   * Translation lookup: active language → Croatian fallback → raw key.
   * Supports simple parameter interpolation: t('key', { count: 5 })
   * replaces {count} in the resolved string.
   */
  const t = useCallback((key, params) => {
    const dict = DICTIONARIES[language]
    let value = resolve(key, dict)

    // Fallback to Croatian
    if (value === undefined && language !== 'hr') {
      value = resolve(key, DICTIONARIES.hr)
    }

    // Final fallback: raw key
    if (value === undefined) return key

    // Interpolate params
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      }
    }

    return value
  }, [language])

  const locale = LOCALE_MAP[language] || 'hr-HR'
  const dateFnsLocaleKey = language

  const ctx = useMemo(() => ({
    language,
    setLanguage,
    t,
    locale,
    dateFnsLocaleKey,
  }), [language, setLanguage, t, locale, dateFnsLocaleKey])

  return (
    <I18nContext.Provider value={ctx}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
