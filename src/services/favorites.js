import { supabase } from '@/lib/supabase'

// Favorites are listing-scoped, not property-scoped.

export async function getFavorites(userId) {
  if (import.meta.env.DEV) console.log('[favorites] getFavorites za:', userId)

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
    if (import.meta.env.DEV) console.error('[favorites] getFavorites greška:', error.message)
  } else {
    if (import.meta.env.DEV) console.log('[favorites] Dohvaćeno favorita:', data?.length)
  }

  return { data: data ?? [], error }
}

export async function addFavorite(userId, listingId) {
  if (import.meta.env.DEV) console.log('[favorites] addFavorite:', { userId, listingId })

  const { data, error } = await supabase
    .from('favorite')
    .insert({ user_id: userId, listing_id: listingId })
    .select()
    .single()

  if (error) {
    if (import.meta.env.DEV) console.error('[favorites] addFavorite greška:', error.message)
  }

  return { data, error }
}

export async function removeFavorite(userId, listingId) {
  if (import.meta.env.DEV) console.log('[favorites] removeFavorite:', { userId, listingId })

  const { error } = await supabase
    .from('favorite')
    .delete()
    .eq('user_id', userId)
    .eq('listing_id', listingId)

  if (error) {
    if (import.meta.env.DEV) console.error('[favorites] removeFavorite greška:', error.message)
  }

  return { error }
}

