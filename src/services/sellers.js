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
  console.log('[sellers] getUserProfile:', userId)

  const { data, error } = await supabase
    .from('user')
    .select(`
      *,
      role(role_id, role_code, role_name),
      phone_number(phone_id, phone_country_code, phone_number)
    `)
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('[sellers] getUserProfile greška:', error.message)
  }

  return { data, error }
}

/**
 * Ažurira profil korisnika
 */
export async function updateUserProfile(userId, updates) {
  console.log('[sellers] updateUserProfile:', userId)

  const { data, error } = await supabase
    .from('user')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('[sellers] updateUserProfile greška:', error.message)
  }

  return { data, error }
}

/**
 * Dodaje telefonski broj korisniku
 */
export async function addPhoneNumber(userId, countryCode, phoneNumber) {
  console.log('[sellers] addPhoneNumber za:', userId)

  const { data, error } = await supabase
    .from('phone_number')
    .insert({
      user_id: userId,
      phone_country_code: countryCode,
      phone_number: phoneNumber,
    })
    .select()
    .single()

  if (error) {
    console.error('[sellers] addPhoneNumber greška:', error.message)
  }

  return { data, error }
}

/**
 * Ažurira ulogu korisnika (npr. BUYER → SELLER)
 */
export async function updateUserRole(userId, roleId) {
  console.log('[sellers] updateUserRole:', userId, '→ roleId:', roleId)

  const { data, error } = await supabase
    .from('user')
    .update({ role_id: roleId })
    .eq('user_id', userId)
    .select('*, role(role_code)')
    .single()

  if (error) {
    console.error('[sellers] updateUserRole greška:', error.message)
  }

  return { data, error }
}

/**
 * Dohvaća statistike prodavača (broj oglasa, aktivnih, itd.)
 */
export async function getSellerStats(sellerId) {
  console.log('[sellers] getSellerStats:', sellerId)

  const { data, error, count } = await supabase
    .from('listing')
    .select('listing_id, status_id, listing_status(status_name)', { count: 'exact' })
    .eq('seller_id', sellerId)

  if (error) {
    console.error('[sellers] getSellerStats greška:', error.message)
    return { stats: null, error }
  }

  const stats = {
    totalListings: count ?? 0,
    active: data?.filter(l => l.listing_status?.status_name === 'ACTIVE').length ?? 0,
    sold: data?.filter(l => l.listing_status?.status_name === 'SOLD').length ?? 0,
    rented: data?.filter(l => l.listing_status?.status_name === 'RENTED').length ?? 0,
  }

  return { stats, error: null }
}