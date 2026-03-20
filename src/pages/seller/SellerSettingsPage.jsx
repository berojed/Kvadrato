import { useState } from 'react'
import { Shield, Sun, Moon, Monitor, CheckCircle, AlertCircle } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'

const SECTIONS = [
  { id: 'security', label: 'Prijava i sigurnost', Icon: Shield },
  { id: 'appearance', label: 'Izgled', Icon: Sun },
]

const THEME_OPTIONS = [
  { value: 'light', label: 'Svijetla', Icon: Sun },
  { value: 'dark', label: 'Tamna', Icon: Moon },
  { value: 'system', label: 'Sustav', Icon: Monitor },
]

function SecuritySection() {
  const { updateAuthPassword } = useAuth()
  const [pwEditing, setPwEditing] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    if (newPw.length < 6) {
      setPwMsg({ type: 'error', text: 'Lozinka mora imati najmanje 6 znakova.' })
      return
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'error', text: 'Lozinke se ne podudaraju.' })
      return
    }

    setPwSaving(true)
    setPwMsg(null)

    const { error } = await updateAuthPassword(newPw)
    setPwSaving(false)

    if (error) {
      setPwMsg({ type: 'error', text: error.message })
    } else {
      setPwMsg({ type: 'success', text: 'Lozinka je uspješno promijenjena.' })
      setPwEditing(false)
      setNewPw('')
      setConfirmPw('')
      setTimeout(() => setPwMsg(null), 4000)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Prijava na račun i sigurnost</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Upravljajte pristupom i sigurnošću vašeg računa
      </p>

      <div className="card p-5 space-y-4">
        {/* Password */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Lozinka</div>
              <div className="text-sm text-gray-500">{'••••••••'}</div>
            </div>
            {!pwEditing && (
              <button
                onClick={() => { setPwEditing(true); setPwMsg(null) }}
                className="text-xs font-medium text-accent hover:text-accent/80 transition-colors ml-4 flex-shrink-0"
              >
                Promijeni
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
                placeholder="Nova lozinka (min. 6 znakova)"
                autoFocus
              />
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="input"
                placeholder="Potvrdite novu lozinku"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pwSaving || !newPw || !confirmPw}
                  className="btn btn-primary text-xs"
                >
                  {pwSaving ? 'Spremanje…' : 'Spremi lozinku'}
                </button>
                <button
                  type="button"
                  onClick={() => { setPwEditing(false); setNewPw(''); setConfirmPw('') }}
                  className="btn btn-secondary text-xs"
                >
                  Odustani
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
          <div className="text-sm font-medium">Dvofaktorska autentifikacija</div>
          <div className="text-sm text-gray-500">Isključeno</div>
        </div>

        {/* Devices — static display */}
        <div className="border-t border-border pt-4">
          <div className="text-sm font-medium">Prijavljeni uređaji</div>
          <div className="text-sm text-gray-500">1 aktivan uređaj</div>
        </div>
      </div>
    </div>
  )
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme()

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Izgled</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Odaberite temu aplikacije
      </p>

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-4">Tema</h3>
        <div className="flex gap-2">
          {THEME_OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border rounded transition-colors ${
                theme === value
                  ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                  : 'border-border bg-transparent text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function SellerSettingsPage() {
  const [activeSection, setActiveSection] = useState('security')

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
        <h1 className="text-3xl font-bold mb-1">Postavke</h1>
        <p className="text-sm text-gray-500">Upravljajte postavkama računa i aplikacije</p>
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
