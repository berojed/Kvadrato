import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()

  const from = location.state?.from?.pathname ?? '/'

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return // sprječava dvostruki submit
    setLoading(true)
    setError(null)

    console.log('[LoginPage] Pokušaj prijave:', form.email)

    const { data, error: err } = await signIn(form)
    setLoading(false)

    if (err) {
      console.error('[LoginPage] Prijava neuspješna:', err.message)

      // Korisniku prilagođene poruke
      const msg =
        err.message === 'Invalid login credentials'
          ? 'Neispravni podaci za prijavu. Provjeri email i lozinku.'
          : err.message === 'Email not confirmed'
          ? 'Email adresa nije potvrđena. Provjeri inbox za link za potvrdu.'
          : err.message.includes('rate')
          ? 'Previše pokušaja prijave. Pričekaj par minuta.'
          : `Greška: ${err.message}`

      setError(msg)
    } else {
      console.log('[LoginPage] Prijava uspješna, redirect na:', from)
      navigate(from, { replace: true })
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Link to="/" className="text-sm text-gray-500 hover:text-black transition-colors">
            ← Kvadrato
          </Link>
          <h1 className="text-2xl font-bold mt-6 mb-1">Dobrodošao natrag</h1>
          <p className="text-sm text-gray-500">Prijavi se na svoj račun</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">E-mail</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="input"
              placeholder="ime@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Lozinka</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="input pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-3">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? (
              <span className="flex items-center gap-2 justify-center">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Prijavljivanje…
              </span>
            ) : (
              'Prijavi se'
            )}
          </button>
        </form>

        <p className="text-sm text-center text-gray-500 mt-6">
          Nemaš račun?{' '}
          <Link to="/auth/register" className="text-black font-medium hover:underline">
            Registriraj se
          </Link>
        </p>
      </div>
    </div>
  )
}