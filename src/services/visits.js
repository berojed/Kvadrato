import { supabase } from '@/lib/supabase'

/**
 * ─── NAPOMENA O SHEMI ───
 * Tablica: visit_request
 *   request_id (SERIAL PK)
 *   requested_datetime (TIMESTAMPTZ)
 *   status ('PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REJECTED')
 *   buyer_id → user(user_id)
 *   listing_id → listing(listing_id)
 */

/**
 * Kreira zahtjev za posjet nekretnini
 */
export async function createVisitRequest({ buyerId, listingId, requestedDatetime }) {
  console.log('[visits] createVisitRequest:', { buyerId, listingId })

  const { data, error } = await supabase
    .from('visit_request')
    .insert({
      buyer_id: buyerId,
      listing_id: listingId,
      requested_datetime: requestedDatetime,
      status: 'PENDING',
    })
    .select()
    .single()

  if (error) {
    console.error('[visits] createVisitRequest greška:', error.message)
  }

  return { data, error }
}

/**
 * Dohvaća zahtjeve za posjet za kupca
 */
export async function getVisitRequestsByBuyer(buyerId) {
  console.log('[visits] getVisitRequestsByBuyer:', buyerId)

  const { data, error } = await supabase
    .from('visit_request')
    .select(`
      *,
      listing(
        listing_id, listing_type, price_amount,
        property(
          title, description,
          location(city, state_region),
          image(url, is_primary)
        )
      )
    `)
    .eq('buyer_id', buyerId)
    .order('requested_datetime', { ascending: true })

  if (error) {
    console.error('[visits] getVisitRequestsByBuyer greška:', error.message)
  }

  return { data: data ?? [], error }
}

/**
 * Dohvaća zahtjeve za posjet za prodavačeve oglase
 */
export async function getVisitRequestsBySeller(sellerId) {
  console.log('[visits] getVisitRequestsBySeller:', sellerId)

  const { data, error } = await supabase
    .from('visit_request')
    .select(`
      *,
      buyer:user!visit_request_buyer_id_fkey(first_name, last_name, email),
      listing!inner(
        listing_id, listing_type,
        property(title, location(city))
      )
    `)
    .eq('listing.seller_id', sellerId)
    .order('requested_datetime', { ascending: false })

  if (error) {
    console.error('[visits] getVisitRequestsBySeller greška:', error.message)
  }

  return { data: data ?? [], error }
}

/**
 * Ažurira status zahtjeva za posjet
 */
export async function updateVisitStatus(requestId, status) {
  console.log('[visits] updateVisitStatus:', requestId, '→', status)

  const { data, error } = await supabase
    .from('visit_request')
    .update({ status })
    .eq('request_id', requestId)
    .select()
    .single()

  if (error) {
    console.error('[visits] updateVisitStatus greška:', error.message)
  }

  return { data, error }
}