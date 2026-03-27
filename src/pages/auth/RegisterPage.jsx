import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { getRoles } from '@/services/sellers'
import { Eye, EyeOff, Home, Search } from 'lucide-react'

const ROLES_BASE = [
  { id: 1, code: 'BUYER', labelKey: 'auth.roleBuyer', descKey: 'auth.roleBuyerDesc', icon: Search },
  { id: 2, code: 'SELLER', labelKey: 'auth.roleSeller', descKey: 'auth.roleSellerDesc', icon: Home },
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const { t } = useI18n()

  const ROLES = ROLES_BASE.map((r) => ({
    ...r,
    label: t(r.labelKey),
    description: t(r.descKey),
  }))

  const [step, setStep] = useState(1)
  const [roleMap, setRoleMap] = useState({})
  const [selectedRole, setSelectedRole] = useState(null)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false)

  useEffect(() => {
    getRoles().then(({ data }) => {
      if (data) {
        const map = {}
        data.forEach(r => { map[r.role_code] = r.role_id })
        setRoleMap(map)
      }
    })
  }, [])

  const handleRoleSelect = (role) => {
    setSelectedRole(role)
    setStep(2)
  }

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return // sprječava dvostruki submit
    setError(null)

    if (form.password !== form.confirmPassword) {
      setError(t('auth.passwordsNoMatch'))
      return
    }
    if (form.password.length < 6) {
      setError(t('auth.passwordTooShort'))
      return
    }

    setLoading(true)
    if (import.meta.env.DEV) console.log('[RegisterPage] Pokušaj registracije:', form.email, '| Rola:', selectedRole.code)

    const { data, error: err } = await signUp({
      email: form.email,
      password: form.password,
      firstName: form.firstName,
      lastName: form.lastName,
      roleId: roleMap[selectedRole.code] ?? selectedRole.id,
    })

    setLoading(false)

    if (err) {
      if (import.meta.env.DEV) console.error('[RegisterPage] Registracija neuspješna:', err.message)
      const msg =
        err.message.includes('already registered')
          ? t('auth.alreadyRegistered')
          : err.message.includes('rate')
            ? t('auth.tooManyRegAttempts')
            : err.message.includes('valid email')
              ? t('auth.invalidEmail')
              : `${t('common.error')}: ${err.message}`
      setError(msg)
      return
    }

    // Uspješna registracija — samo provjeri sesiju
    if (data?.session) {
      setSuccess(true)
      setTimeout(() => navigate('/', { replace: true }), 1500)
    } else {
      setSuccess(true)
      setNeedsEmailConfirm(true)
      // no auto-redirect — let user read the confirm message
    }
  }

  /* ─── Success screen ─── */
  if (success) {
    // Ako email confirm nije potreban, kratka poruka pa redirect
    if (!needsEmailConfirm) {
      return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <div className="text-center max-w-sm">
            <h2 className="text-xl font-bold mb-2">{t('auth.accountCreated')}</h2>
            <p className="text-sm text-gray-500">{t('common.redirecting')}</p>
          </div>
        </div>
      )
    }

    // Ako email confirm jest potreban
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-bold mb-2">{t('auth.checkEmail')}</h2>
          <p className="text-sm text-gray-500 mb-6">
            {t('auth.confirmEmailSent')}{' '}
            <strong className="text-black">{form.email}</strong>.
            {' '}{t('auth.checkInbox')}
          </p>
          <Link to="/auth/login" className="btn btn-primary">
            {t('auth.goToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  /* ─── Korak 1: Odabir role ─── */
  if (step === 1) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <Link to="/" className="text-sm text-gray-500 hover:text-black transition-colors">
              {t('auth.backToKvadrato')}
            </Link>
            <h1 className="text-2xl font-bold mt-6 mb-1">{t('auth.createAccount')}</h1>
            <p className="text-sm text-gray-500">{t('auth.howUseKvadrato')}</p>
          </div>

          <div className="space-y-3">
            {ROLES.map((role) => (
              <button
                key={role.id}
                onClick={() => handleRoleSelect(role)}
                className="w-full text-left border border-border rounded p-5 hover:border-black transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-black group-hover:text-white transition-all">
                    <role.icon size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm mb-0.5">{role.label}</div>
                    <div className="text-xs text-gray-500">{role.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <p className="text-sm text-center text-gray-500 mt-6">
            {t('auth.hasAccount')}{' '}
            <Link to="/auth/login" className="text-black font-medium hover:underline">
              {t('auth.signInButton')}
            </Link>
          </p>
        </div>
      </div>
    )
  }

  /* ─── Korak 2: Forma ─── */
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <button
            onClick={() => setStep(1)}
            className="text-sm text-gray-500 hover:text-black transition-colors"
          >
            {t('auth.backStep')}
          </button>
          <h1 className="text-2xl font-bold mt-6 mb-2">{t('auth.createAccount')}</h1>
          <span className="badge badge-muted">{selectedRole?.label}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('auth.firstName')}</label>
              <input name="firstName" type="text" required value={form.firstName} onChange={handleChange} className="input" placeholder="Ana" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('auth.lastName')}</label>
              <input name="lastName" type="text" required value={form.lastName} onChange={handleChange} className="input" placeholder="Horvat" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('auth.email')}</label>
            <input name="email" type="email" required autoComplete="email" value={form.email} onChange={handleChange} className="input" placeholder="ime@email.com" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('auth.password')}</label>
            <div className="relative">
              <input name="password" type={showPassword ? 'text' : 'password'} required autoComplete="new-password" value={form.password} onChange={handleChange} className="input pr-10" placeholder={t('auth.minChars')} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('auth.confirmPassword')}</label>
            <input name="confirmPassword" type={showPassword ? 'text' : 'password'} required autoComplete="new-password" value={form.confirmPassword} onChange={handleChange} className="input" placeholder="••••••••" />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? (
              <span className="flex items-center gap-2 justify-center">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('auth.creatingAccount')}
              </span>
            ) : (
              t('auth.registerButton')
            )}
          </button>
        </form>

        <p className="text-sm text-center text-gray-500 mt-6">
          {t('auth.hasAccount')}{' '}
          <Link to="/auth/login" className="text-black font-medium hover:underline">
            {t('auth.signInButton')}
          </Link>
        </p>
      </div>
    </div>
  )
}