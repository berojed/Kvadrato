import { useState } from 'react'
import { Shield, Sun, Moon, Monitor, CheckCircle, AlertCircle, Globe } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'

const THEME_OPTIONS = [
  { value: 'light', Icon: Sun },
  { value: 'dark', Icon: Moon },
  { value: 'system', Icon: Monitor },
]

const FONT_OPTIONS = [
  { value: 'inter', label: 'Inter' },
  { value: 'system-ui', label: 'System UI' },
  { value: 'nunito-sans', label: 'Nunito Sans' },
  { value: 'source-sans-3', label: 'Source Sans 3' },
  { value: 'dm-sans', label: 'DM Sans' },
]

const LANGUAGE_OPTIONS = [
  { value: 'hr', labelKey: 'settings.languageHr' },
  { value: 'en', labelKey: 'settings.languageEn' },
]

function SecuritySection() {
  const { updateAuthPassword } = useAuth()
  const { t } = useI18n()
  const [pwEditing, setPwEditing] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    if (newPw.length < 6) {
      setPwMsg({ type: 'error', text: t('settings.passwordMinLength') })
      return
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'error', text: t('settings.passwordsNoMatch') })
      return
    }

    setPwSaving(true)
    setPwMsg(null)

    const { error } = await updateAuthPassword(newPw)
    setPwSaving(false)

    if (error) {
      setPwMsg({ type: 'error', text: error.message })
    } else {
      setPwMsg({ type: 'success', text: t('settings.passwordChanged') })
      setPwEditing(false)
      setNewPw('')
      setConfirmPw('')
      setTimeout(() => setPwMsg(null), 4000)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">{t('settings.securityTitle')}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {t('settings.securitySubtitle')}
      </p>

      <div className="card p-5 space-y-4">
        {/* Password */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{t('settings.passwordLabel')}</div>
              <div className="text-sm text-gray-500">{'••••••••'}</div>
            </div>
            {!pwEditing && (
              <button
                onClick={() => { setPwEditing(true); setPwMsg(null) }}
                className="text-xs font-medium text-accent hover:text-accent/80 transition-colors ml-4 flex-shrink-0"
              >
                {t('settings.changePassword')}
              </button>
            )}
          </div>

          {pwEditing && (
            <form onSubmit={handlePasswordSubmit} className="mt-3 space-y-3">
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="input"
                placeholder={t('settings.newPasswordPlaceholder')}
                autoFocus
              />
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="input"
                placeholder={t('settings.confirmPasswordPlaceholder')}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pwSaving || !newPw || !confirmPw}
                  className="btn btn-primary text-xs"
                >
                  {pwSaving ? t('common.saving') : t('settings.savePassword')}
                </button>
                <button
                  type="button"
                  onClick={() => { setPwEditing(false); setNewPw(''); setConfirmPw('') }}
                  className="btn btn-secondary text-xs"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}

          {pwMsg && (
            <div
              className={`mt-3 text-sm rounded-lg p-3 flex items-start gap-2 ${
                pwMsg.type === 'success'
                  ? 'text-green-700 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
                  : 'text-red-600 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
              }`}
            >
              {pwMsg.type === 'success' ? (
                <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              )}
              {pwMsg.text}
            </div>
          )}
        </div>

        {/* 2FA — static display */}
        <div className="border-t border-border pt-4">
          <div className="text-sm font-medium">{t('settings.twoFactor')}</div>
          <div className="text-sm text-gray-500">{t('settings.twoFactorOff')}</div>
        </div>

        {/* Devices — static display */}
        <div className="border-t border-border pt-4">
          <div className="text-sm font-medium">{t('settings.activeDevices')}</div>
          <div className="text-sm text-gray-500">{t('settings.oneActiveDevice')}</div>
        </div>
      </div>
    </div>
  )
}

function AppearanceSection() {
  const { theme, setTheme, font, setFont } = useTheme()
  const { t, language, setLanguage } = useI18n()

  const activeBtn = 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
  const inactiveBtn = 'border-border bg-transparent text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'

  const THEME_LABELS = {
    light: t('settings.themeLight'),
    dark: t('settings.themeDark'),
    system: t('settings.themeSystem'),
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">{t('settings.appearanceTitle')}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {t('settings.appearanceSubtitle')}
      </p>

      <div className="space-y-5">
        {/* Language */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4">{t('settings.languageLabel')}</h3>
          <div className="flex gap-2">
            {LANGUAGE_OPTIONS.map(({ value, labelKey }) => (
              <button
                key={value}
                onClick={() => setLanguage(value)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border rounded transition-colors ${
                  language === value ? activeBtn : inactiveBtn
                }`}
              >
                <Globe size={13} />
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4">{t('settings.themeLabel')}</h3>
          <div className="flex gap-2">
            {THEME_OPTIONS.map(({ value, Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border rounded transition-colors ${
                  theme === value ? activeBtn : inactiveBtn
                }`}
              >
                <Icon size={13} />
                {THEME_LABELS[value]}
              </button>
            ))}
          </div>
        </div>

        {/* Font */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4">{t('settings.fontLabel')}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {FONT_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFont(value)}
                className={`flex items-center justify-center py-2.5 px-3 text-xs font-medium border rounded transition-colors ${
                  font === value ? activeBtn : inactiveBtn
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AccountSettingsContent() {
  const { t } = useI18n()
  const [activeSection, setActiveSection] = useState('security')

  const SECTIONS = [
    { id: 'security', label: t('settings.security'), Icon: Shield },
    { id: 'appearance', label: t('settings.appearance'), Icon: Sun },
  ]

  const renderSection = () => {
    switch (activeSection) {
      case 'security':
        return <SecuritySection />
      case 'appearance':
        return <AppearanceSection />
      default:
        return null
    }
  }

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">{t('settings.title')}</h1>
        <p className="text-sm text-gray-500">{t('settings.subtitle')}</p>
      </div>

      {/* Mobile section selector */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-6 md:hidden">
        {SECTIONS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeSection === id
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-8">
        {/* Desktop sidebar */}
        <nav className="hidden md:block w-56 flex-shrink-0">
          <div className="space-y-1 sticky top-24">
            {SECTIONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  activeSection === id
                    ? 'bg-gray-100 dark:bg-gray-800 text-black dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-black dark:hover:text-white'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content panel */}
        <div className="flex-1 min-w-0">
          {renderSection()}
        </div>
      </div>
    </div>
  )
}
