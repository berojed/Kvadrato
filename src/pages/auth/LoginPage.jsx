import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, signOut } = useAuth()
  const { t } = useI18n()

  const from = location.state?.from?.pathname ?? '/'

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [roleIntent, setRoleIntent] = useState('BUYER')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return // sprječava dvostruki submit
    setLoading(true)
    setError(null)

    if (import.meta.env.DEV) console.log('[LoginPage] Pokušaj prijave:', form.email)

    const { data, profile, error: err } = await signIn(form)
    setLoading(false)

    if (err) {
      if (import.meta.env.DEV) console.error('[LoginPage] Prijava neuspješna:', err.message)

      // Korisniku prilagođene poruke
      const msg =
        err.message === 'Invalid login credentials'
          ? t('auth.invalidCredentials')
          : err.message === 'Email not confirmed'
          ? t('auth.emailNotConfirmed')
          : err.message.includes('rate')
          ? t('auth.tooManyAttempts')
          : `${t('common.error')}: ${err.message}`

      setError(msg)
      return
    }

    // ── Profile/role validation ─────────────────────────────────────────────
    // A valid profile with a role is required for the app to function.
    // If missing, sign out immediately — this is a data integrity issue.
    const actualRole = profile?.role?.role_code
    if (!actualRole) {
      if (import.meta.env.DEV) console.error('[LoginPage] Missing profile or role after sign-in')
      await signOut()
      setError(t('auth.profileNotFound'))
      return
    }

    // Compare the intent the user selected against the actual role stored in DB.
    // If they mismatch, sign out immediately and show a clear error.
    if (actualRole !== roleIntent) {
      if (import.meta.env.DEV) console.warn('[LoginPage] Role mismatch — intent:', roleIntent, '| actual:', actualRole)
      await signOut()
      setError(
        roleIntent === 'SELLER'
          ? t('auth.roleMismatchBuyer')
          : t('auth.roleMismatchSeller')
      )
      return
    }

    // ── Role-aware redirect ──────────────────────────────────────────────────
    // Honour an in-progress navigation (from) first; otherwise route to the
    // role-appropriate home. Real permissions are always enforced by ProtectedRoute.
    if (import.meta.env.DEV) console.log('[LoginPage] Prijava uspješna, intent:', roleIntent, '| actual:', actualRole)
    if (from !== '/') {
      navigate(from, { replace: true })
    } else if (roleIntent === 'SELLER') {
      navigate('/seller/dashboard', { replace: true })
    } else {
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Link to="/" className="text-sm text-gray-500 hover:text-black transition-colors">
            {t('auth.backToKvadrato')}
          </Link>
          <h1 className="text-2xl font-bold mt-6 mb-1">{t('auth.welcomeBack')}</h1>
          <p className="text-sm text-gray-500">{t('auth.signInToAccount')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role intent selector — routing hint only, does not change permissions */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('auth.signInAs')}</label>
            <div className="inline-flex w-full rounded-lg bg-gray-100 p-1">
              {[
                { value: 'BUYER', label: t('roles.buyer') },
                { value: 'SELLER', label: t('roles.seller') },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRoleIntent(opt.value)}
                  className={cn(
                    'flex-1 py-2 text-xs font-medium rounded-md transition-all',
                    roleIntent === opt.value
                      ? 'bg-white text-black shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">{t('auth.roleHint')}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('auth.email')}</label>
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
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('auth.password')}</label>
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
                {t('auth.signingIn')}
              </span>
            ) : (
              t('auth.signInButton')
            )}
          </button>
        </form>

        <p className="text-sm text-center text-gray-500 mt-6">
          {t('auth.noAccount')}{' '}
          <Link to="/auth/register" className="text-black font-medium hover:underline">
            {t('nav.register')}
          </Link>
        </p>
      </div>
    </div>
  )
}