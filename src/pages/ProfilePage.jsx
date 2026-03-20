import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  getUserProfile,
  updateUserProfile,
  upsertPhoneNumber,
  uploadAvatar,
  removeAvatar,
} from '@/services/sellers'
import {
  User, Save, Settings, ChevronRight, Camera, Trash2,
  Mail, Phone, Shield, CheckCircle, AlertCircle,
  MessageCircle, Globe,
} from 'lucide-react'

export default function ProfilePage() {
  const { user, updateAuthEmail, refetchProfile } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Avatar state
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef(null)

  // Email change state
  const [emailEditing, setEmailEditing] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMsg, setEmailMsg] = useState(null) // { type: 'success'|'error', text }

  // Phone editing state
  const [phoneEditing, setPhoneEditing] = useState(false)
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [phoneMsg, setPhoneMsg] = useState(null)
  const [phoneForm, setPhoneForm] = useState({ code: '+385', number: '' })

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone_country_code: '+385',
    phone_number: '',
    // Optional contact methods
    whatsapp_contact: '',
    messenger_contact: '',
    other_contact_label: '',
    other_contact_value: '',
    share_whatsapp: false,
    share_messenger: false,
    share_other: false,
  })

  useEffect(() => {
    if (!user) return
    loadProfile()
  }, [user])

  const loadProfile = async () => {
    setLoading(true)
    const { data } = await getUserProfile(user.id)
    if (data) {
      setProfile(data)
      const phone = Array.isArray(data.phone_number)
        ? data.phone_number[0]
        : data.phone_number
      setPhoneForm({
        code: phone?.phone_country_code ?? '+385',
        number: phone?.phone_number ?? '',
      })
      setForm({
        first_name: data.first_name ?? '',
        last_name: data.last_name ?? '',
        phone_country_code: phone?.phone_country_code ?? '+385',
        phone_number: phone?.phone_number ?? '',
        whatsapp_contact: data.whatsapp_contact ?? '',
        messenger_contact: data.messenger_contact ?? '',
        other_contact_label: data.other_contact_label ?? '',
        other_contact_value: data.other_contact_value ?? '',
        share_whatsapp: data.share_whatsapp ?? false,
        share_messenger: data.share_messenger ?? false,
        share_other: data.share_other ?? false,
      })
    }
    setLoading(false)
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  // ── Save name + phone ───────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    // Update name + contact preferences
    const { error: nameErr } = await updateUserProfile(user.id, {
      first_name: form.first_name,
      last_name: form.last_name,
      whatsapp_contact: form.whatsapp_contact.trim() || null,
      messenger_contact: form.messenger_contact.trim() || null,
      other_contact_label: form.other_contact_label.trim() || null,
      other_contact_value: form.other_contact_value.trim() || null,
      share_whatsapp: form.share_whatsapp,
      share_messenger: form.share_messenger,
      share_other: form.share_other,
    })

    if (nameErr) {
      setError(nameErr.message)
      setSaving(false)
      return
    }

    await refetchProfile()
    await loadProfile()
    setSaving(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  // ── Avatar handlers ─────────────────────────────────────────────────────
  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Basic validation
    if (!file.type.startsWith('image/')) {
      setError('Odaberite slikovnu datoteku (JPG, PNG, WebP).')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Slika ne smije biti veća od 5 MB.')
      return
    }

    setAvatarUploading(true)
    setError(null)
    const { url, error: upErr } = await uploadAvatar(user.id, file)
    setAvatarUploading(false)

    if (upErr) {
      setError(upErr.message)
    } else {
      setProfile((p) => ({ ...p, avatar_url: url }))
      await refetchProfile()
    }
  }

  const handleAvatarRemove = async () => {
    setAvatarUploading(true)
    const { error: rmErr } = await removeAvatar(user.id)
    setAvatarUploading(false)
    if (rmErr) setError(rmErr.message)
    else {
      setProfile((p) => ({ ...p, avatar_url: null }))
      await refetchProfile()
    }
  }

  // ── Email change ────────────────────────────────────────────────────────
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
        text: 'Link za potvrdu je poslan na novu adresu. Provjerite inbox.',
      })
      setEmailEditing(false)
      setNewEmail('')
    }
  }

  // ── Phone change ───────────────────────────────────────────────────────
  const handlePhoneSubmit = async (e) => {
    e.preventDefault()
    if (!phoneForm.number.trim()) return

    setPhoneSaving(true)
    setPhoneMsg(null)

    const { error: phoneErr } = await upsertPhoneNumber(
      user.id,
      phoneForm.code,
      phoneForm.number.trim()
    )
    setPhoneSaving(false)

    if (phoneErr) {
      setPhoneMsg({ type: 'error', text: phoneErr.message })
    } else {
      setPhoneMsg({ type: 'success', text: 'Telefonski broj je spremljen.' })
      setPhoneEditing(false)
      // Sync main form state
      setForm((f) => ({
        ...f,
        phone_country_code: phoneForm.code,
        phone_number: phoneForm.number.trim(),
      }))
      await refetchProfile()
      setTimeout(() => setPhoneMsg(null), 3000)
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────
  const fullName = [form.first_name, form.last_name].filter(Boolean).join(' ')
  const roleName = profile?.role?.role_code === 'SELLER' ? 'Prodavač' : 'Kupac'
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
        <h1 className="text-3xl font-bold mb-1">Profil</h1>
        <p className="text-sm text-gray-500">Vaši osobni podaci i račun</p>
      </div>

      {/* ── Avatar + Identity card ─────────────────────────────────────────── */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0 group">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : form.first_name ? (
                <span className="text-2xl font-semibold text-gray-500">
                  {form.first_name.charAt(0).toUpperCase()}
                </span>
              ) : (
                <User size={28} />
              )}
            </div>

            {/* Upload overlay */}
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 group-hover:bg-black/40 transition-colors cursor-pointer"
              title="Promijeni sliku"
            >
              <Camera
                size={18}
                className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarSelect}
              className="hidden"
            />

            {/* Uploading indicator */}
            {avatarUploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Identity text */}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-lg">{fullName || 'Korisnik'}</div>
            <div className="text-sm text-gray-500 truncate">{user?.email}</div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
              <span className="inline-flex items-center gap-1">
                <Shield size={10} />
                {roleName}
              </span>
              {memberSince && (
                <>
                  <span>·</span>
                  <span>Član od {memberSince}</span>
                </>
              )}
            </div>
          </div>

          {/* Remove avatar button */}
          {profile?.avatar_url && (
            <button
              onClick={handleAvatarRemove}
              disabled={avatarUploading}
              className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
              title="Ukloni sliku"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Personal info form ─────────────────────────────────────────────── */}
      <div className="card p-6 mb-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <User size={14} className="text-gray-400" />
          Osobni podaci
        </h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Ime
              </label>
              <input
                name="first_name"
                type="text"
                value={form.first_name}
                onChange={handleChange}
                className="input"
                placeholder="Marko"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Prezime
              </label>
              <input
                name="last_name"
                type="text"
                value={form.last_name}
                onChange={handleChange}
                className="input"
                placeholder="Marković"
              />
            </div>
          </div>

          {/* ── Optional contact methods ──────────────────────────────────── */}
          <div className="border-t border-border pt-5 mt-2 space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
                Dodatni kontakti za upite
              </h3>
              <p className="text-xs text-gray-400">
                Opcijski – dijele se s prodavačem samo ako su uključeni.
              </p>
            </div>

            {/* WhatsApp */}
            <div className="flex items-start gap-3">
              <label className="flex items-center gap-2 flex-shrink-0 mt-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="share_whatsapp"
                  checked={form.share_whatsapp}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-accent focus:ring-accent"
                />
                <MessageCircle size={13} className="text-green-600" />
                <span className="text-xs font-medium text-gray-600">WhatsApp</span>
              </label>
              <input
                name="whatsapp_contact"
                type="text"
                value={form.whatsapp_contact}
                onChange={handleChange}
                className="input flex-1"
                placeholder="+385 91 234 5678"
              />
            </div>

            {/* Messenger */}
            <div className="flex items-start gap-3">
              <label className="flex items-center gap-2 flex-shrink-0 mt-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="share_messenger"
                  checked={form.share_messenger}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-accent focus:ring-accent"
                />
                <MessageCircle size={13} className="text-blue-600" />
                <span className="text-xs font-medium text-gray-600">Messenger</span>
              </label>
              <input
                name="messenger_contact"
                type="text"
                value={form.messenger_contact}
                onChange={handleChange}
                className="input flex-1"
                placeholder="facebook.com/marko.markovic"
              />
            </div>

            {/* Other */}
            <div className="flex items-start gap-3">
              <label className="flex items-center gap-2 flex-shrink-0 mt-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="share_other"
                  checked={form.share_other}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-accent focus:ring-accent"
                />
                <Globe size={13} className="text-gray-500" />
                <span className="text-xs font-medium text-gray-600">Ostalo</span>
              </label>
              <div className="flex-1 flex gap-2">
                <input
                  name="other_contact_label"
                  type="text"
                  value={form.other_contact_label}
                  onChange={handleChange}
                  className="input w-28"
                  placeholder="Viber"
                />
                <input
                  name="other_contact_value"
                  type="text"
                  value={form.other_contact_value}
                  onChange={handleChange}
                  className="input flex-1"
                  placeholder="+385 91 234 5678"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="text-sm text-green-700 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle size={14} />
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

      {/* ── Email section ──────────────────────────────────────────────────── */}
      <div className="card p-6 mb-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Mail size={14} className="text-gray-400" />
          E-mail adresa
        </h2>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{user?.email}</div>
            <p className="text-xs text-gray-400 mt-0.5">
              Promjena zahtijeva potvrdu na novoj adresi.
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
              Promijeni
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
                {emailSaving ? 'Slanje…' : 'Pošalji potvrdu'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmailEditing(false)
                  setNewEmail('')
                }}
                className="btn btn-secondary text-xs"
              >
                Odustani
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
          Telefon
        </h2>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">
              {form.phone_number
                ? `${form.phone_country_code} ${form.phone_number}`
                : 'Nije postavljen'}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {form.phone_number
                ? 'Dijeli se s prodavačem kada pošaljete upit.'
                : 'Dodajte broj za kontakt prilikom upita.'}
            </p>
          </div>
          {!phoneEditing && (
            <button
              onClick={() => {
                setPhoneEditing(true)
                setPhoneForm({ code: form.phone_country_code, number: form.phone_number })
                setPhoneMsg(null)
              }}
              className="btn btn-secondary text-xs flex-shrink-0"
            >
              {form.phone_number ? 'Promijeni' : 'Dodaj'}
            </button>
          )}
        </div>

        {phoneEditing && (
          <form onSubmit={handlePhoneSubmit} className="mt-4 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={phoneForm.code}
                onChange={(e) => setPhoneForm((f) => ({ ...f, code: e.target.value }))}
                className="input w-20 text-center"
                placeholder="+385"
              />
              <input
                type="tel"
                value={phoneForm.number}
                onChange={(e) => setPhoneForm((f) => ({ ...f, number: e.target.value }))}
                className="input flex-1"
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
                {phoneSaving ? 'Spremanje…' : 'Spremi'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhoneEditing(false)
                  setPhoneForm({ code: form.phone_country_code, number: form.phone_number })
                }}
                className="btn btn-secondary text-xs"
              >
                Odustani
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

      {/* ── Settings entry point ───────────────────────────────────────────── */}
      <Link
        to="/settings"
        className="card p-5 flex items-center gap-4 hover:border-gray-400 dark:hover:border-gray-500 transition-colors group"
      >
        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <Settings size={18} className="text-gray-600 dark:text-gray-400" />
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
