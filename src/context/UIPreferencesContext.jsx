import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'

const UIPreferencesContext = createContext(null)

const STORAGE_KEY = 'kvadrato-ui-preferences'
const VALID_LANGUAGES = ['hr', 'en']
const VALID_THEMES = ['light', 'dark', 'system']
const VALID_FONTS = ['inter', 'system-ui', 'nunito-sans', 'source-sans-3', 'dm-sans']

const DEFAULTS = { language: 'hr', theme: 'light', font: 'inter' }

// Migration map: old font alias → new real family slug
const FONT_MIGRATION = {
  system: 'system-ui',
  airbnb: 'nunito-sans',
  zillow: 'source-sans-3',
  uber: 'dm-sans',
}

/**
 * Load preferences from localStorage, migrating from legacy keys if needed.
 * Pure function — no side effects on DOM.
 */
function loadPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      let font = parsed.font
      if (FONT_MIGRATION[font]) font = FONT_MIGRATION[font]
      return {
        language: VALID_LANGUAGES.includes(parsed.language) ? parsed.language : DEFAULTS.language,
        theme: VALID_THEMES.includes(parsed.theme) ? parsed.theme : DEFAULTS.theme,
        font: VALID_FONTS.includes(font) ? font : DEFAULTS.font,
      }
    }

    // ── Migrate from legacy separate storage keys ────────────────────────
    const legacyLang = localStorage.getItem('kvadrato-language')
    const legacyAppearance = localStorage.getItem('kvadrato-appearance')
    const legacyTheme = localStorage.getItem('kvadrato-theme')

    let migrated = { ...DEFAULTS }

    if (legacyLang && VALID_LANGUAGES.includes(legacyLang)) {
      migrated.language = legacyLang
    }

    if (legacyAppearance) {
      try {
        const parsed = JSON.parse(legacyAppearance)
        if (VALID_THEMES.includes(parsed.theme)) migrated.theme = parsed.theme
        let font = parsed.font
        if (FONT_MIGRATION[font]) font = FONT_MIGRATION[font]
        if (VALID_FONTS.includes(font)) migrated.font = font
      } catch { /* ignore */ }
    } else if (legacyTheme && VALID_THEMES.includes(legacyTheme)) {
      migrated.theme = legacyTheme
    }

    // Persist unified and clean up legacy
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
    localStorage.removeItem('kvadrato-language')
    localStorage.removeItem('kvadrato-appearance')
    localStorage.removeItem('kvadrato-theme')

    return migrated
  } catch {
    return { ...DEFAULTS }
  }
}

function savePreferences(prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

/**
 * Apply all preferences to the DOM synchronously.
 * Safe to call before React mounts (from main.jsx bootstrap).
 */
export function applyPreferencesToDOM(prefs) {
  const root = document.documentElement

  // Language
  root.lang = prefs.language || 'hr'

  // Theme
  if (prefs.theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  } else {
    root.classList.toggle('dark', prefs.theme === 'dark')
  }

  // Font
  root.setAttribute('data-font', prefs.font || 'inter')
}

/**
 * Bootstrap: load + apply preferences before React renders.
 * Call this synchronously in main.jsx before createRoot().
 */
export function bootstrapPreferences() {
  const prefs = loadPreferences()
  applyPreferencesToDOM(prefs)
  return prefs
}

export function UIPreferencesProvider({ initialPrefs, children }) {
  const [prefs, setPrefs] = useState(() => initialPrefs || loadPreferences())

  const setLanguage = useCallback((lang) => {
    if (!VALID_LANGUAGES.includes(lang)) return
    setPrefs((prev) => {
      const next = { ...prev, language: lang }
      savePreferences(next)
      return next
    })
  }, [])

  const setTheme = useCallback((theme) => {
    if (!VALID_THEMES.includes(theme)) return
    setPrefs((prev) => {
      const next = { ...prev, theme }
      savePreferences(next)
      return next
    })
  }, [])

  const setFont = useCallback((font) => {
    if (!VALID_FONTS.includes(font)) return
    setPrefs((prev) => {
      const next = { ...prev, font }
      savePreferences(next)
      return next
    })
  }, [])

  // Apply DOM effects on every change
  useEffect(() => {
    applyPreferencesToDOM(prefs)
  }, [prefs])

  // Listen for OS preference changes when in 'system' theme mode
  useEffect(() => {
    if (prefs.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      document.documentElement.classList.toggle('dark', mq.matches)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [prefs.theme])

  const ctx = useMemo(() => ({
    language: prefs.language,
    theme: prefs.theme,
    font: prefs.font,
    setLanguage,
    setTheme,
    setFont,
  }), [prefs.language, prefs.theme, prefs.font, setLanguage, setTheme, setFont])

  return (
    <UIPreferencesContext.Provider value={ctx}>
      {children}
    </UIPreferencesContext.Provider>
  )
}

export function useUIPreferences() {
  const ctx = useContext(UIPreferencesContext)
  if (!ctx) throw new Error('useUIPreferences must be used within UIPreferencesProvider')
  return ctx
}
