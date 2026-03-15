import { Settings, Monitor, Bell, Globe } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Postavke</h1>
        <p className="text-sm text-gray-500">Upravljajte postavkama aplikacije</p>
      </div>

      <div className="max-w-xl space-y-6">
        {/* Theme / Color mode */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
              <Monitor size={16} className="text-gray-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Tema i izgled</h3>
              <p className="text-xs text-gray-500">Prilagodite izgled aplikacije</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex-1 py-2.5 text-xs font-medium border border-black bg-black text-white rounded transition-colors">
              Svijetla
            </button>
            <button className="flex-1 py-2.5 text-xs font-medium border border-border bg-white text-gray-600 rounded hover:border-gray-400 transition-colors">
              Tamna
            </button>
            <button className="flex-1 py-2.5 text-xs font-medium border border-border bg-white text-gray-600 rounded hover:border-gray-400 transition-colors">
              Sustav
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
              <Bell size={16} className="text-gray-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Obavijesti</h3>
              <p className="text-xs text-gray-500">Upravljajte obavijestima</p>
            </div>
          </div>
          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-700">E-mail obavijesti o novim nekretninama</span>
              <div className="w-9 h-5 bg-gray-200 rounded-full relative">
                <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm" />
              </div>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-700">Obavijesti o statusu razgledavanja</span>
              <div className="w-9 h-5 bg-gray-200 rounded-full relative">
                <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm" />
              </div>
            </label>
          </div>
        </div>

        {/* Language */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
              <Globe size={16} className="text-gray-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Jezik</h3>
              <p className="text-xs text-gray-500">Odaberite jezik sučelja</p>
            </div>
          </div>
          <select className="select" defaultValue="hr" disabled>
            <option value="hr">Hrvatski</option>
            <option value="en">English</option>
          </select>
          <p className="text-xs text-gray-400 mt-2">Dodatni jezici dolaze uskoro</p>
        </div>
      </div>
    </div>
  )
}
