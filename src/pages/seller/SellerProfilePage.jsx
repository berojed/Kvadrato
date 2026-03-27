import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getUserProfile,
  updateUserProfile,
  upsertPhoneNumber,
  uploadAvatar,
  removeAvatar,
  getSellerStats,
  getSellerContactsCount,
} from '@/services/sellers'
import { User, Save, Camera, Trash2, Mail, Phone, CheckCircle, AlertCircle } from 'lucide-react'
import { useI18n } from '@/context/I18nContext'

export default function SellerProfilePage() {
  const { user, refetchProfile, updateAuthEmail } = useAuth()
  const { t, locale } = useI18n()
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [contacts, setContacts] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Avatar
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef(null)

  // Email change state
  const [emailEditing, setEmailEditing] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMsg, setEmailMsg] = useState(null)

  // Phone editing state
  const [phoneEditing, setPhoneEditing] = useState(false)
  const [phoneForm, setPhoneForm] = useState({ code: '+385', number: '' })
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [phoneMsg, setPhoneMsg] = useState(null)

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
  })

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    const [profileRes, statsRes, contactsRes] = await Promise.all([
      getUserProfile(user.id),
      getSellerStats(user.id),
      getSellerContactsCount(user.id),
    ])
    if (profileRes.data) {
      setProfile(profileRes.data)
      const phone = Array.isArray(profileRes.data.phone_number)
        ? profileRes.data.phone_number[0]
        : profileRes.data.phone_number
      setPhoneForm({
        code: phone?.phone_country_code ?? '+385',
        number: phone?.phone_number ?? '',
      })
      setForm({
        first_name: profileRes.data.first_name ?? '',
        last_name: profileRes.data.last_name ?? '',
      })
    }
    if (statsRes.stats) setStats(statsRes.stats)
    setContacts(contactsRes.count ?? 0)
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

    // Save profile fields
    const result = await updateUserProfile(user.id, {
      first_name: form.first_name,
      last_name: form.last_name,
    })

    setSaving(false)
    if (result.error) {
      setError(result.error.message)
    } else {
      setProfile(result.data)
      if (refetchProfile) refetchProfile()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  // Email change handler
  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    if (!newEmail.trim() || newEmail === user?.email) return

    setEmailSaving(true)
    setEmailMsg(null)

    const { error: emailErr } = await updateAuthEmail(newEmail.trim())
    setEmailSaving(false)

    if (emailErr) {
      setEmailMsg({ type: 'error', text: emailErr.message })
    } else {
      setEmailMsg({
        type: 'success',
        text: t('profile.emailConfirmSent'),
      })
      setEmailEditing(false)
      setNewEmail('')
    }
  }

  // Phone change handler
  const handlePhoneSubmit = async (e) => {
    e.preventDefault()
    if (!phoneForm.number.trim()) return

    setPhoneSaving(true)
    setPhoneMsg(null)

    const { error: phoneErr } = await upsertPhoneNumber(user.id, phoneForm.code, phoneForm.number.trim())
    setPhoneSaving(false)

    if (phoneErr) {
      setPhoneMsg({ type: 'error', text: phoneErr.message })
    } else {
      setPhoneMsg({ type: 'success', text: t('profile.phoneSaved') })
      setPhoneEditing(false)
      setTimeout(() => setPhoneMsg(null), 4000)
    }
  }

  // Avatar handlers
  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Validate
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError(t('profile.formatError'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t('profile.maxSizeError'))
      return
    }
    setAvatarUploading(true)
    setError(null)
    const { url, error: upErr } = await uploadAvatar(user.id, file)
    setAvatarUploading(false)
    if (upErr) {
      setError(upErr.message)
    } else if (url) {
      setProfile((p) => ({ ...p, avatar_url: url }))
      if (refetchProfile) refetchProfile()
    }
  }

  const handleAvatarRemove = async () => {
    setAvatarUploading(true)
    const { error: rmErr } = await removeAvatar(user.id)
    setAvatarUploading(false)
    if (rmErr) setError(rmErr.message)
    else {
      setProfile((p) => ({ ...p, avatar_url: null }))
      if (refetchProfile) refetchProfile()
    }
  }

  const fullName = [form.first_name, form.last_name].filter(Boolean).join(' ')
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(locale, { year: 'numeric', month: 'long' })
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
        <h1 className="text-3xl font-bold mb-1">{t('profile.sellerTitle')}</h1>
        <p className="text-sm text-gray-500">{t('profile.sellerSubtitle')}</p>
      </div>

      {/* Identity block with avatar */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative group flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : form.first_name ? (
                <span className="text-xl font-semibold">{form.first_name.charAt(0)}</span>
              ) : (
                <User size={24} />
              )}
            </div>
            {/* Avatar overlay */}
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-gray-700 hover:bg-white"
                title={t('profile.changeAvatar')}
              >
                <Camera size={12} />
              </button>
              {profile?.avatar_url && (
                <button
                  onClick={handleAvatarRemove}
                  disabled={avatarUploading}
                  className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-red-500 hover:bg-white"
                  title={t('profile.removeAvatar')}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarSelect}
            />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-lg">{fullName || t('common.user')}</div>
            <div className="text-sm text-gray-500">{user?.email}</div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
              <span className="text-orange-600 font-medium">{t('roles.seller')}</span>
              {memberSince && (
                <>
                  <span>·</span>
                  <span>{t('common.memberSince', { date: memberSince })}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Seller stats summary — expanded */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="card p-4 text-center">
            <div className="text-xl font-bold">{stats.active}</div>
            <div className="text-xs text-gray-500 mt-0.5">{t('profile.statsActive')}</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-xl font-bold">{stats.sold + (stats.rented ?? 0)}</div>
            <div className="text-xs text-gray-500 mt-0.5">{t('profile.statsCompleted')}</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-xl font-bold">{contacts}</div>
            <div className="text-xs text-gray-500 mt-0.5">{t('profile.statsContacts')}</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-xl font-bold">{stats.totalListings}</div>
            <div className="text-xs text-gray-500 mt-0.5">{t('profile.statsTotal')}</div>
          </div>
        </div>
      )}

      {/* Editable personal info + contact form */}
      <div className="card p-6 mb-6">
        <h2 className="text-sm font-semibold mb-4">{t('profile.personalDataAndContact')}</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('profile.firstName')}</label>
              <input name="first_name" type="text" value={form.first_name} onChange={handleChange} className="input" placeholder="Marko" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('profile.lastName')}</label>
              <input name="last_name" type="text" value={form.last_name} onChange={handleChange} className="input" placeholder="Marković" />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</div>
          )}

          {success && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
              {t('profile.profileSaved')}
            </div>
          )}

          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('common.saving')}
              </span>
            ) : (
              <>
                <Save size={14} />
                {t('profile.saveChanges')}
              </>
            )}
          </button>
        </form>
      </div>

      {/* ── Email section ──────────────────────────────────────────────────── */}
      <div className="card p-6 mb-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Mail size={14} className="text-gray-400" />
          {t('profile.emailSection')}
        </h2>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{user?.email}</div>
            <p className="text-xs text-gray-400 mt-0.5">
              {t('profile.emailChangeNote')}
            </p>
          </div>
          {!emailEditing && (
            <button
              onClick={() => {
                setEmailEditing(true)
                setNewEmail('')
                setEmailMsg(null)
              }}
              className="btn btn-secondary text-xs flex-shrink-0"
            >
              {t('common.change')}
            </button>
          )}
        </div>

        {emailEditing && (
          <form onSubmit={handleEmailSubmit} className="mt-4 space-y-3">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="input"
              placeholder="nova.adresa@email.com"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={emailSaving || !newEmail.trim() || newEmail === user?.email}
                className="btn btn-primary text-xs"
              >
                {emailSaving ? t('common.saving') : t('profile.sendConfirm')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmailEditing(false)
                  setNewEmail('')
                }}
                className="btn btn-secondary text-xs"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        )}

        {emailMsg && (
          <div
            className={`mt-3 text-sm rounded-lg p-3 flex items-start gap-2 ${
              emailMsg.type === 'success'
                ? 'text-green-700 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
                : 'text-red-600 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
            }`}
          >
            {emailMsg.type === 'success' ? (
              <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            )}
            {emailMsg.text}
          </div>
        )}
      </div>

      {/* ── Phone section ──────────────────────────────────────────────────── */}
      <div className="card p-6 mb-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Phone size={14} className="text-gray-400" />
          {t('profile.phoneSection')}
        </h2>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">
              {phoneForm.number
                ? `${phoneForm.code} ${phoneForm.number}`
                : <span className="italic text-gray-400">{t('profile.notAdded')}</span>}
            </div>
          </div>
          {!phoneEditing && (
            <button
              onClick={() => { setPhoneEditing(true); setPhoneMsg(null) }}
              className="btn btn-secondary text-xs flex-shrink-0"
            >
              {phoneForm.number ? t('common.change') : t('common.add')}
            </button>
          )}
        </div>

        {phoneEditing && (
          <form onSubmit={handlePhoneSubmit} className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                value={phoneForm.code}
                onChange={(e) => setPhoneForm((f) => ({ ...f, code: e.target.value }))}
                className="input"
                placeholder="+385"
              />
              <input
                type="tel"
                value={phoneForm.number}
                onChange={(e) => setPhoneForm((f) => ({ ...f, number: e.target.value }))}
                className="input col-span-2"
                placeholder="91 234 5678"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={phoneSaving || !phoneForm.number.trim()}
                className="btn btn-primary text-xs"
              >
                {phoneSaving ? t('common.saving') : t('common.save')}
              </button>
              <button
                type="button"
                onClick={() => setPhoneEditing(false)}
                className="btn btn-secondary text-xs"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        )}

        {phoneMsg && (
          <div
            className={`mt-3 text-sm rounded-lg p-3 flex items-start gap-2 ${
              phoneMsg.type === 'success'
                ? 'text-green-700 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
                : 'text-red-600 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
            }`}
          >
            {phoneMsg.type === 'success' ? (
              <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            )}
            {phoneMsg.text}
          </div>
        )}
      </div>

    </div>
  )
}
