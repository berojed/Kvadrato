import { supabase } from '@/lib/supabase'

/**
 * ─── NAPOMENA O SHEMI ───
 * Nema zasebne "sellers" tablice!
 * Prodavač = korisnik iz "user" tablice s role_code = 'SELLER'.
 * Profil prodavača je isti kao i profil bilo kojeg korisnika.
 */

/**
 * Dohvaća profil korisnika (bilo kupac ili prodavač)
 */
export async function getUserProfile(userId) {
  if (import.meta.env.DEV) console.log('[sellers] getUserProfile:', userId)

  const { data, error } = await supabase
    .from('user')
    .select(`
      *,
      role(role_id, role_code),
      phone_number(phone_id, phone_country_code, phone_number)
    `)
    .eq('user_id', userId)
    .single()

  if (error && import.meta.env.DEV) {
    console.error('[sellers] getUserProfile greška:', error.message)
  }

  return { data, error }
}

/**
 * Ažurira profil korisnika
 */
export async function updateUserProfile(userId, updates) {
  if (import.meta.env.DEV) console.log('[sellers] updateUserProfile:', userId)
  const { email: _ignored, ...safeUpdates } = updates
  const { data, error } = await supabase
    .from('user')
    .update(safeUpdates)
    .eq('user_id', userId)
    .select()
    .single()
  if (error && import.meta.env.DEV) console.error('[sellers] updateUserProfile greška:', error.message)
  return { data, error }
}

/**
 * Dodaje telefonski broj korisniku
 */
export async function addPhoneNumber(userId, countryCode, phoneNumber) {
  if (import.meta.env.DEV) console.log('[sellers] addPhoneNumber za:', userId)

  const { data, error } = await supabase
    .from('phone_number')
    .insert({
      user_id: userId,
      phone_country_code: countryCode,
      phone_number: phoneNumber,
    })
    .select()
    .single()

  if (error && import.meta.env.DEV) {
    console.error('[sellers] addPhoneNumber greška:', error.message)
  }

  return { data, error }
}

/**
 * Upsert telefon: ažurira prvi postojeći ili kreira novi.
 * Tretira prvi phone_number red za korisnika kao kanonski.
 */
export async function upsertPhoneNumber(userId, countryCode, phoneNumber) {
  if (import.meta.env.DEV) console.log('[sellers] upsertPhoneNumber za:', userId)

  // Try to find existing phone row
  const { data: existing } = await supabase
    .from('phone_number')
    .select('phone_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (existing?.phone_id) {
    // Update existing
    const { data, error } = await supabase
      .from('phone_number')
      .update({
        phone_country_code: countryCode,
        phone_number: phoneNumber,
      })
      .eq('phone_id', existing.phone_id)
      .select()
      .single()

    if (error && import.meta.env.DEV) console.error('[sellers] upsertPhoneNumber update greška:', error.message)
    return { data, error }
  }

  // No existing row — insert
  return addPhoneNumber(userId, countryCode, phoneNumber)
}

/**
 * Upload avatar image to Supabase Storage and persist URL in public.user.
 * Canonical path: users/<userId>/avatar.<ext>
 * Overwrites existing avatar on re-upload.
 */
export async function uploadAvatar(userId, file) {
  if (import.meta.env.DEV) console.log('[sellers] uploadAvatar za:', userId)

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `users/${userId}/avatar.${ext}`

  // Upload (upsert = overwrite if exists)
  const { error: uploadErr } = await supabase.storage
    .from('profile-images')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadErr) {
    if (import.meta.env.DEV) console.error('[sellers] uploadAvatar upload greška:', uploadErr.message)
    return { url: null, error: uploadErr }
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('profile-images')
    .getPublicUrl(path)

  const publicUrl = urlData?.publicUrl
  if (!publicUrl) {
    return { url: null, error: { message: 'Nije moguće dohvatiti URL slike.' } }
  }

  // Append cache-bust to force browser refresh after overwrite
  const avatarUrl = `${publicUrl}?t=${Date.now()}`

  // Persist URL in user profile
  const { error: updateErr } = await supabase
    .from('user')
    .update({ avatar_url: avatarUrl })
    .eq('user_id', userId)

  if (updateErr) {
    if (import.meta.env.DEV) console.error('[sellers] uploadAvatar update greška:', updateErr.message)
    return { url: avatarUrl, error: updateErr }
  }

  return { url: avatarUrl, error: null }
}

/**
 * Remove avatar: delete from Storage and clear avatar_url in profile.
 */
export async function removeAvatar(userId) {
  if (import.meta.env.DEV) console.log('[sellers] removeAvatar za:', userId)

  // List files in user's avatar folder to find the current avatar
  const { data: files } = await supabase.storage
    .from('profile-images')
    .list(`users/${userId}`)

  if (files?.length) {
    const paths = files.map((f) => `users/${userId}/${f.name}`)
    await supabase.storage.from('profile-images').remove(paths)
  }

  // Clear avatar_url in profile
  const { error } = await supabase
    .from('user')
    .update({ avatar_url: null })
    .eq('user_id', userId)

  if (error && import.meta.env.DEV) console.error('[sellers] removeAvatar greška:', error.message)
  return { error }
}

/**
 * Ažurira ulogu korisnika (npr. BUYER → SELLER)
 */
export async function updateUserRole(userId, roleId) {
  if (import.meta.env.DEV) console.log('[sellers] updateUserRole:', userId, '→ roleId:', roleId)

  const { data, error } = await supabase
    .from('user')
    .update({ role_id: roleId })
    .eq('user_id', userId)
    .select('*, role(role_code)')
    .single()

  if (error && import.meta.env.DEV) {
    console.error('[sellers] updateUserRole greška:', error.message)
  }

  return { data, error }
}

/**
 * Broji jedinstvene kupce koji su kontaktirali prodavača (distinct buyer_id iz message tablice).
 */
export async function getSellerContactsCount(sellerId) {
  if (import.meta.env.DEV) console.log('[sellers] getSellerContactsCount:', sellerId)

  const { data, error } = await supabase
    .from('message')
    .select('buyer_id')
    .eq('seller_id', sellerId)

  if (error) {
    if (import.meta.env.DEV) console.error('[sellers] getSellerContactsCount greška:', error.message)
    return { count: 0, error }
  }

  const uniqueBuyers = new Set((data ?? []).map((m) => m.buyer_id))
  return { count: uniqueBuyers.size, error: null }
}

/**
 * Dohvaća statistike prodavača (broj oglasa, aktivnih, itd.)
 */
export async function getSellerStats(sellerId) {
  if (import.meta.env.DEV) console.log('[sellers] getSellerStats:', sellerId)

  const { data, error, count } = await supabase
    .from('listing')
    .select('listing_id, status_id, listing_status(status_code)', { count: 'exact' })
    .eq('seller_id', sellerId)

  if (error) {
    if (import.meta.env.DEV) console.error('[sellers] getSellerStats greška:', error.message)
    return { stats: null, error }
  }

  const stats = {
    totalListings: count ?? 0,
    active: data?.filter(l => l.listing_status?.status_code === 'ACTIVE').length ?? 0,
    sold: data?.filter(l => l.listing_status?.status_code === 'SOLD').length ?? 0,
    rented: data?.filter(l => l.listing_status?.status_code === 'RENTED').length ?? 0,
  }

  return { stats, error: null }
}

/**
 * Dohvaća sve role iz tablice role
 */
export async function getRoles() {
  const { data, error } = await supabase
    .from('role')
    .select('role_id, role_code')
  if (error && import.meta.env.DEV) console.error('[sellers] getRoles greška:', error.message)
  return { data: data ?? [], error }
}