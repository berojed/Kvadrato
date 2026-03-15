import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getUserProfile, updateUserProfile } from '@/services/sellers'
import { getVisitRequestsByBuyer } from '@/services/visits'
import { useFavorites } from '@/hooks/useFavorites'
import { User, Save, Heart, Calendar, Settings, Shield, ChevronRight } from 'lucide-react'

export default function ProfilePage() {
  const { user, isBuyer } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
  })

  // Buyer-specific counts
  const { favorites } = useFavorites()
  const [viewingCounts, setViewingCounts] = useState({ upcoming: 0, past: 0 })

  useEffect(() => {
    if (!user) return
    loadProfile()
  }, [user])

  useEffect(() => {
    if (!user || !isBuyer) return

    const loadViewingCounts = async () => {
      const { data } = await getVisitRequestsByBuyer(user.id)
      if (data) {
        const now = new Date()
        const upcoming = data.filter(
          (v) => v.status !== 'CANCELLED' && v.status !== 'REJECTED' && new Date(v.requested_datetime) >= now
        ).length
        const past = data.filter(
          (v) => v.status === 'CANCELLED' || v.status === 'REJECTED' || new Date(v.requested_datetime) < now
        ).length
        setViewingCounts({ upcoming, past })
      }
    }

    loadViewingCounts()
  }, [user, isBuyer])

  const loadProfile = async () => {
    setLoading(true)
    const { data } = await getUserProfile(user.id)
    if (data) {
      setProfile(data)
      setForm({
        first_name: data.first_name ?? '',
        last_name: data.last_name ?? '',
        email: data.email ?? user.email ?? '',
      })
    } else {
      setForm((f) => ({ ...f, email: user.email ?? '' }))
    }
    setLoading(false)
  }

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    const result = await updateUserProfile(user.id, {
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
    })

    setSaving(false)
    if (result.error) {
      setError(result.error.message)
    } else {
      setProfile(result.data)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  const fullName = [form.first_name, form.last_name].filter(Boolean).join(' ')

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Profil</h1>
        <p className="text-sm text-gray-500">Upravljajte svojim računom i postavkama</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column — Personal info form */}
        <div className="lg:col-span-2 space-y-8">
          {/* Personal information */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Osobni podaci</h2>
            <div className="card p-6">
              {/* Avatar */}
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                  {form.first_name ? (
                    <span className="text-xl font-semibold">{form.first_name.charAt(0)}</span>
                  ) : (
                    <User size={24} />
                  )}
                </div>
                <div>
                  <div className="font-semibold">{fullName || 'Korisnik'}</div>
                  <div className="text-sm text-gray-500">{user?.email}</div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Ime</label>
                    <input name="first_name" type="text" value={form.first_name} onChange={handleChange} className="input" placeholder="Marko" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Prezime</label>
                    <input name="last_name" type="text" value={form.last_name} onChange={handleChange} className="input" placeholder="Marković" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">E-mail</label>
                    <input name="email" type="email" value={form.email} onChange={handleChange} className="input" />
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</div>
                )}

                {success && (
                  <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
                    Profil je uspješno spremljen!
                  </div>
                )}

                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Spremanje…
                    </span>
                  ) : (
                    <>
                      <Save size={14} />
                      Spremi promjene
                    </>
                  )}
                </button>
              </form>
            </div>
          </section>

          {/* Account management */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Upravljanje računom</h2>
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Shield size={16} className="text-gray-600" />
                </div>
                <div>
                  <div className="text-sm font-medium">Sigurnost računa</div>
                  <div className="text-xs text-gray-500">Promijenite lozinku ili upravljajte pristupom</div>
                </div>
              </div>
              <p className="text-xs text-gray-400">Promjena lozinke i dvofaktorska autentifikacija dolaze uskoro.</p>
            </div>
          </section>
        </div>

        {/* Right column — Quick links */}
        <div className="space-y-4">
          {/* Saved properties */}
          {isBuyer && (
            <Link to="/favorites" className="card p-5 flex items-center gap-4 hover:border-gray-300 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                <Heart size={18} className="text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">Omiljene nekretnine</div>
                <div className="text-xs text-gray-500">
                  {favorites.length} {favorites.length === 1 ? 'nekretnina' : 'nekretnina'} spremljeno
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
            </Link>
          )}

          {/* Viewing requests overview */}
          {isBuyer && (
            <Link to="/my-viewings" className="card p-5 flex items-center gap-4 hover:border-gray-300 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Calendar size={18} className="text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">Razgledavanja</div>
                <div className="text-xs text-gray-500">
                  {viewingCounts.upcoming} nadolazećih · {viewingCounts.past} prošlih
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
            </Link>
          )}

          {/* Settings link */}
          <Link to="/settings" className="card p-5 flex items-center gap-4 hover:border-gray-300 transition-colors group">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Settings size={18} className="text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">Postavke</div>
              <div className="text-xs text-gray-500">Tema, obavijesti, jezik</div>
            </div>
            <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  )
}
