import { useState, useEffect } from 'react'
import { User, Shield, Eye, Bell, Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'
import { getUserProfile } from '@/services/sellers'

const SECTIONS = [
  { id: 'personal', label: 'Osobni podaci', Icon: User },
  { id: 'security', label: 'Prijava i sigurnost', Icon: Shield },
  { id: 'privacy', label: 'Privatnost', Icon: Eye },
  { id: 'notifications', label: 'Obavijesti', Icon: Bell },
]

const THEME_OPTIONS = [
  { value: 'light', label: 'Svijetla', Icon: Sun },
  { value: 'dark', label: 'Tamna', Icon: Moon },
  { value: 'system', label: 'Sustav', Icon: Monitor },
]

function SettingRow({ label, value, placeholder, action }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
          {value || <span className="italic text-gray-400">{placeholder}</span>}
        </div>
      </div>
      {action && (
        <button
          disabled
          className="text-xs font-medium text-gray-300 cursor-not-allowed ml-4 flex-shrink-0"
          title="Uskoro dostupno"
        >
          {action}
        </button>
      )}
    </div>
  )
}

function PersonalSection({ profile, userEmail }) {
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
  const phone = profile?.phone_number?.[0]
  const phoneDisplay = phone ? `${phone.phone_country_code} ${phone.phone_number}` : null

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Osobni podaci</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Podaci koji se prikazuju na vašim oglasima i profilu
      </p>
      <div className="card p-0">
        <div className="px-5">
          <SettingRow label="Ime i prezime" value={fullName} placeholder="Nije dodano" action="Uredi" />
          <SettingRow label="E-mail adresa" value={userEmail} action="Uredi" />
          <SettingRow label="Telefonski broj" value={phoneDisplay} placeholder="Nije dodano" action={phoneDisplay ? 'Uredi' : 'Dodaj'} />
          <SettingRow label="Adresa ureda" value={null} placeholder="Nije dodano" action="Dodaj" />
        </div>
      </div>
    </div>
  )
}

function SecuritySection() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Prijava na račun i sigurnost</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Upravljajte pristupom i sigurnošću vašeg računa
      </p>
      <div className="card p-0">
        <div className="px-5">
          <SettingRow label="Lozinka" value="••••••••" action="Promijeni" />
          <SettingRow label="Dvofaktorska autentifikacija" value="Isključeno" action="Postavi" />
          <SettingRow label="Prijavljeni uređaji" value="1 aktivan uređaj" />
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-3">
        Promjena lozinke i dvofaktorska autentifikacija bit će dostupni uskoro.
      </p>
    </div>
  )
}

function PrivacySection() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Privatnost</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Kontrolirajte vidljivost vaših podataka na oglasima
      </p>
      <div className="card p-0">
        <div className="px-5">
          <SettingRow label="Vidljivost profila" value="Javni profil" action="Uredi" />
          <SettingRow label="Prikaži e-mail na oglasima" value="Da" action="Uredi" />
          <SettingRow label="Prikaži telefonski broj na oglasima" value="Da" action="Uredi" />
          <SettingRow label="Prikaži ime na oglasima" value="Da" action="Uredi" />
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-3">
        Postavke privatnosti su trenutno u razvoju.
      </p>
    </div>
  )
}

function NotificationsSection() {
  const { theme, setTheme } = useTheme()

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Obavijesti</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Upravljajte obavijestima i izgledom aplikacije
      </p>

      <div className="card p-5 mb-4">
        <h3 className="text-sm font-semibold mb-4">E-mail obavijesti</h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between pointer-events-none opacity-60">
            <span className="text-sm text-gray-700 dark:text-gray-300">Novi zahtjevi za razgledavanje</span>
            <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full relative">
              <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm" />
            </div>
          </label>
          <label className="flex items-center justify-between pointer-events-none opacity-60">
            <span className="text-sm text-gray-700 dark:text-gray-300">Nove poruke od kupaca</span>
            <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full relative">
              <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm" />
            </div>
          </label>
          <label className="flex items-center justify-between pointer-events-none opacity-60">
            <span className="text-sm text-gray-700 dark:text-gray-300">Tjedni izvještaj o oglasima</span>
            <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full relative">
              <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm" />
            </div>
          </label>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-2">E-mail obavijesti dostupne uskoro.</p>

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-4">Tema i izgled</h3>
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
  const { user } = useAuth()
  const [activeSection, setActiveSection] = useState('personal')
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (!user) return
    getUserProfile(user.id).then(({ data }) => {
      if (data) setProfile(data)
    })
  }, [user])

  const renderSection = () => {
    switch (activeSection) {
      case 'personal':
        return <PersonalSection profile={profile} userEmail={user?.email} />
      case 'security':
        return <SecuritySection />
      case 'privacy':
        return <PrivacySection />
      case 'notifications':
        return <NotificationsSection />
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
