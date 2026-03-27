import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { UIPreferencesProvider, bootstrapPreferences } from '@/context/UIPreferencesContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { I18nProvider } from '@/context/I18nContext'

// Apply saved preferences to DOM before first paint — avoids flash of wrong theme/font/lang
const initialPrefs = bootstrapPreferences()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UIPreferencesProvider initialPrefs={initialPrefs}>
      <ThemeProvider>
        <I18nProvider>
          <App />
        </I18nProvider>
      </ThemeProvider>
    </UIPreferencesProvider>
  </StrictMode>,
)
