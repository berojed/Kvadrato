import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getUserProfile, updateUserProfile, getSellerStats } from '@/services/sellers'
import { User, Save, Settings, ChevronRight, BarChart2 } from 'lucide-react'

export default function SellerProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
  })

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    const [profileRes, statsRes] = await Promise.all([
      getUserProfile(user.id),
      getSellerStats(user.id),
    ])
    if (profileRes.data) {
      setProfile(profileRes.data)
      setForm({
        first_name: profileRes.data.first_name ?? '',
        last_name: profileRes.data.last_name ?? '',
        email: profileRes.data.email ?? user.email ?? '',
      })
    } else {
      setForm((f) => ({ ...f, email: user.email ?? '' }))
    }
    if (statsRes.stats) setStats(statsRes.stats)
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
      // email intentionally omitted — auth email is the source of truth
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
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('hr-HR', { year: 'numeric', month: 'long' })
    : null

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="container py-10 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Profil prodavača</h1>
        <p className="text-sm text-gray-500">Vaši osobni podaci i pregled aktivnosti</p>
      </div>

      {/* Identity block */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 flex-shrink-0">
            {form.first_name ? (
              <span className="text-xl font-semibold">{form.first_name.charAt(0)}</span>
            ) : (
              <User size={24} />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-lg">{fullName || 'Korisnik'}</div>
            <div className="text-sm text-gray-500">{user?.email}</div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
              <span className="text-orange-600 font-medium">Prodavač</span>
              {memberSince && (
                <>
                  <span>·</span>
                  <span>Član od {memberSince}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Seller stats summary */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card p-4 text-center">
            <div className="text-xl font-bold">{stats.active}</div>
            <div className="text-xs text-gray-500 mt-0.5">Aktivnih</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-xl font-bold">{stats.sold}</div>
            <div className="text-xs text-gray-500 mt-0.5">Prodano</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-xl font-bold">{stats.totalListings}</div>
            <div className="text-xs text-gray-500 mt-0.5">Ukupno</div>
          </div>
        </div>
      )}

      {/* Editable personal info form */}
      <div className="card p-6 mb-6">
        <h2 className="text-sm font-semibold mb-4">Osobni podaci</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Ime</label>
              <input name="first_name" type="text" value={form.first_name} onChange={handleChange} className="input" placeholder="Marko" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Prezime</label>
              <input name="last_name" type="text" value={form.last_name} onChange={handleChange} className="input" placeholder="Marković" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">E-mail</label>
              <input
                type="email"
                value={user?.email ?? ''}
                readOnly
                className="input bg-gray-50 cursor-not-allowed text-gray-500"
              />
              <p className="text-xs text-gray-400 mt-1">E-mail se mijenja kroz sigurnosne postavke.</p>
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

      {/* Settings entry point */}
      <Link to="/seller/settings" className="card p-5 flex items-center gap-4 hover:border-gray-400 dark:hover:border-gray-500 transition-colors group">
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
          <Settings size={18} className="text-gray-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">Postavke</div>
          <div className="text-xs text-gray-500">Sigurnost, privatnost, obavijesti i izgled</div>
        </div>
        <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
      </Link>
    </div>
  )
}
