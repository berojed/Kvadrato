import { supabase } from '@/lib/supabase'

/**
 * ─── NAPOMENA O SHEMI ───
 * Tablica: favorite (user_id, listing_id, favorited_at)
 * Kompozitni PK: (user_id, listing_id)
 * Favorit je vezan za LISTING (oglas), ne za property.
 */

/**
 * Dohvaća omiljene oglase za korisnika
 */
export async function getFavorites(userId) {
  console.log('[favorites] getFavorites za:', userId)

  const { data, error } = await supabase
    .from('favorite')
    .select(`
      user_id,
      listing_id,
      favorited_at,
      listing(
        listing_id, listing_type, price_amount, date_listed,
        currency(currency_name, symbol),
        listing_status(status_code, description),
        property(
          title, description, bedrooms, bathrooms, area_size,
          property_type(type_name),
          location(city, state_region),
          image(url, is_primary, sort_order)
        )
      )
    `)
    .eq('user_id', userId)
    .order('favorited_at', { ascending: false })

  if (error) {
    console.error('[favorites] getFavorites greška:', error.message)
  } else {
    console.log('[favorites] Dohvaćeno favorita:', data?.length)
  }

  return { data: data ?? [], error }
}

/**
 * Dodaje oglas u omiljene
 */
export async function addFavorite(userId, listingId) {
  console.log('[favorites] addFavorite:', { userId, listingId })

  const { data, error } = await supabase
    .from('favorite')
    .insert({ user_id: userId, listing_id: listingId })
    .select()
    .single()

  if (error) {
    console.error('[favorites] addFavorite greška:', error.message)
  }

  return { data, error }
}

/**
 * Uklanja oglas iz omiljenih
 */
export async function removeFavorite(userId, listingId) {
  console.log('[favorites] removeFavorite:', { userId, listingId })

  const { error } = await supabase
    .from('favorite')
    .delete()
    .eq('user_id', userId)
    .eq('listing_id', listingId)

  if (error) {
    console.error('[favorites] removeFavorite greška:', error.message)
  }

  return { error }
}

/**
 * Provjeri je li oglas u omiljenima
 */
export async function isFavorite(userId, listingId) {
  const { data, error } = await supabase
    .from('favorite')
    .select('user_id')
    .eq('user_id', userId)
    .eq('listing_id', listingId)
    .maybeSingle()

  return { isFav: !!data, error }
}

/**
 * Toggle favorit — dodaj ako ne postoji, ukloni ako postoji
 */
export async function toggleFavorite(userId, listingId) {
  const { isFav } = await isFavorite(userId, listingId)

  if (isFav) {
    const { error } = await removeFavorite(userId, listingId)
    return { isFav: false, error }
  } else {
    const { error } = await addFavorite(userId, listingId)
    return { isFav: true, error }
  }
}