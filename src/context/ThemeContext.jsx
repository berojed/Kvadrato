import { createContext, useContext, useMemo } from 'react'
import { useUIPreferences } from '@/context/UIPreferencesContext'

const ThemeContext = createContext({
  theme: 'light',
  setTheme: () => {},
  font: 'inter',
  setFont: () => {},
})

export function ThemeProvider({ children }) {
  const { theme, setTheme, font, setFont } = useUIPreferences()

  const ctx = useMemo(() => ({
    theme,
    setTheme,
    font,
    setFont,
  }), [theme, setTheme, font, setFont])

  return (
    <ThemeContext.Provider value={ctx}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
