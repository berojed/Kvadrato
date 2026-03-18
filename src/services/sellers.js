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
      role(role_id, role_code, role_name),
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
 * Broji koliko su puta oglasi prodavača dodani u omiljene.
 * Dva koraka: dohvati listing_id-eve prodavača, zatim broji favorite.
 */
export async function getSellerFavoritesCount(sellerId) {
  if (import.meta.env.DEV) console.log('[sellers] getSellerFavoritesCount:', sellerId)

  // 1. Dohvati sve listing ID-eve prodavača
  const { data: listings, error: listErr } = await supabase
    .from('listing')
    .select('listing_id')
    .eq('seller_id', sellerId)

  if (listErr) {
    if (import.meta.env.DEV) console.error('[sellers] getSellerFavoritesCount listings greška:', listErr.message)
    return { count: 0, error: listErr }
  }

  const ids = (listings ?? []).map((l) => l.listing_id)
  if (ids.length === 0) return { count: 0, error: null }

  // 2. Broji favorite za te listing-e
  const { count, error } = await supabase
    .from('favorite')
    .select('*', { count: 'exact', head: true })
    .in('listing_id', ids)

  if (error) {
    if (import.meta.env.DEV) console.error('[sellers] getSellerFavoritesCount greška:', error.message)
    return { count: 0, error }
  }

  return { count: count ?? 0, error: null }
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
    .select('role_id, role_code, role_name')
  if (error && import.meta.env.DEV) console.error('[sellers] getRoles greška:', error.message)
  return { data: data ?? [], error }
}