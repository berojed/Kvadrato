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
 * Dohvaća aktivan (PENDING ili CONFIRMED) zahtjev za posjet za određenog kupca i oglas.
 *
 * @param {string} buyerId
 * @param {string} listingId
 * @returns {{ data: { request_id: number, requested_datetime: string, status: string, notes: string|null } | null, error: object | null }}
 */
export async function getActiveVisitRequest(buyerId, listingId) {
  if (import.meta.env.DEV) console.log('[visits] getActiveVisitRequest:', { buyerId, listingId })

  const { data, error } = await supabase
    .from('visit_request')
    .select('request_id, requested_datetime, status, notes')
    .eq('buyer_id', buyerId)
    .eq('listing_id', listingId)
    .in('status', ['PENDING', 'CONFIRMED'])
    .order('request_id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error && import.meta.env.DEV) console.error('[visits] getActiveVisitRequest greška:', error.message)

  return { data: data ?? null, error }
}

/**
 * Kreira zahtjev za posjet nekretnini
 */
export async function createVisitRequest({ buyerId, listingId, requestedDatetime, notes = null }) {
  if (import.meta.env.DEV) console.log('[visits] createVisitRequest:', { buyerId, listingId })

  // Service-level ownership guard: reject if the buyer is the listing's seller.
  // This is a second line of defence behind the UI canBuyerAct gate.
  const { data: listingRow, error: ownerErr } = await supabase
    .from('listing')
    .select('seller_id')
    .eq('listing_id', listingId)
    .single()

  if (ownerErr) {
    if (import.meta.env.DEV) console.error('[visits] createVisitRequest – provjera vlasnika neuspješna:', ownerErr.message)
    return { data: null, error: ownerErr }
  }
  if (listingRow.seller_id === buyerId) {
    if (import.meta.env.DEV) console.warn('[visits] createVisitRequest – odbijeno: prodavač ne može zakazati vlastiti oglas')
    return { data: null, error: { message: 'SELF_VIEWING_DENIED' } }
  }

  // Pre-check for existing active request to surface a friendly error before
  // the DB unique-index violation can fire.
  const { data: existing, error: activeErr } = await getActiveVisitRequest(buyerId, listingId)
  if (activeErr) {
    if (import.meta.env.DEV) console.error('[visits] createVisitRequest – provjera aktivnog zahtjeva neuspješna:', activeErr.message)
    return { data: null, error: activeErr }
  }
  if (existing) {
    if (import.meta.env.DEV) console.warn('[visits] createVisitRequest – odbijeno: postoji aktivan zahtjev', existing.request_id)
    return { data: null, error: { message: 'DUPLICATE_VISIT_REQUEST' } }
  }

  const { data, error } = await supabase
    .from('visit_request')
    .insert({
      buyer_id: buyerId,
      listing_id: listingId,
      requested_datetime: requestedDatetime,
      status: 'PENDING',
      notes,
    })
    .select()
    .single()

  // Treat unique-index violations (concurrent duplicate) as the same friendly error.
  if (error) {
    if (error.code === '23505') {
      if (import.meta.env.DEV) console.warn('[visits] createVisitRequest – unique constraint narušen (race condition)')
      return { data: null, error: { message: 'DUPLICATE_VISIT_REQUEST' } }
    }
    if (import.meta.env.DEV) console.error('[visits] createVisitRequest greška:', error.message)
  }

  return { data, error }
}

/**
 * Dohvaća zahtjeve za posjet za kupca
 */
export async function getVisitRequestsByBuyer(buyerId) {
  if (import.meta.env.DEV) console.log('[visits] getVisitRequestsByBuyer:', buyerId)

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

  if (error && import.meta.env.DEV) {
    console.error('[visits] getVisitRequestsByBuyer greška:', error.message)
  }

  return { data: data ?? [], error }
}

/**
 * Dohvaća zahtjeve za posjet za prodavačeve oglase
 */
export async function getVisitRequestsBySeller(sellerId) {
  if (import.meta.env.DEV) console.log('[visits] getVisitRequestsBySeller:', sellerId)

  const { data, error } = await supabase
    .from('visit_request')
    .select(`
      *,
      buyer:user!visit_request_buyer_id_fkey(first_name, last_name, email),
      listing!inner(
        listing_id, listing_type,
        property(
          title,
          location(city, state_region),
          image(url, is_primary, sort_order)
        )
      )
    `)
    .eq('listing.seller_id', sellerId)
    .order('requested_datetime', { ascending: false })

  if (error && import.meta.env.DEV) {
    console.error('[visits] getVisitRequestsBySeller greška:', error.message)
  }

  return { data: data ?? [], error }
}

/**
 * Otkazuje zahtjev za posjet (buyer-side).
 * Verifies the request belongs to this buyer before updating.
 */
export async function cancelVisitRequest(requestId, buyerId) {
  if (import.meta.env.DEV) console.log('[visits] cancelVisitRequest:', requestId, 'buyer:', buyerId)

  if (!buyerId) return { data: null, error: { message: 'BUYER_NOT_IDENTIFIED' } }

  // Verify ownership + valid transition
  const { data: req, error: fetchErr } = await supabase
    .from('visit_request')
    .select('request_id, buyer_id, status')
    .eq('request_id', requestId)
    .single()

  if (fetchErr || !req) {
    return { data: null, error: fetchErr || { message: 'REQUEST_NOT_FOUND' } }
  }
  if (req.buyer_id !== buyerId) {
    return { data: null, error: { message: 'ACCESS_DENIED' } }
  }
  if (req.status !== 'PENDING' && req.status !== 'CONFIRMED') {
    return { data: null, error: { message: 'INVALID_STATUS_TRANSITION' } }
  }

  const { data, error } = await supabase
    .from('visit_request')
    .update({ status: 'CANCELLED' })
    .eq('request_id', requestId)
    .eq('buyer_id', buyerId)
    .select()
    .single()

  if (error && import.meta.env.DEV) console.error('[visits] cancelVisitRequest greška:', error.message)
  return { data, error }
}

/**
 * Seller action: confirm or reject a visit request.
 * Verifies the listing belongs to this seller and restricts allowed transitions.
 */
export async function sellerUpdateVisitStatus(requestId, sellerId, newStatus) {
  if (import.meta.env.DEV) console.log('[visits] sellerUpdateVisitStatus:', requestId, '→', newStatus, 'seller:', sellerId)

  if (!sellerId) return { data: null, error: { message: 'SELLER_NOT_IDENTIFIED' } }

  const allowedStatuses = ['CONFIRMED', 'REJECTED']
  if (!allowedStatuses.includes(newStatus)) {
    return { data: null, error: { message: 'INVALID_STATUS' } }
  }

  // Verify the visit request exists and is for a listing this seller owns
  const { data: req, error: fetchErr } = await supabase
    .from('visit_request')
    .select('request_id, status, listing:listing_id(seller_id)')
    .eq('request_id', requestId)
    .single()

  if (fetchErr || !req) {
    return { data: null, error: fetchErr || { message: 'REQUEST_NOT_FOUND' } }
  }
  const listingSellerId = req.listing?.seller_id
  if (listingSellerId !== sellerId) {
    return { data: null, error: { message: 'ACCESS_DENIED' } }
  }
  if (req.status !== 'PENDING') {
    return { data: null, error: { message: 'PENDING_ONLY_UPDATE' } }
  }

  const { data, error } = await supabase
    .from('visit_request')
    .update({ status: newStatus })
    .eq('request_id', requestId)
    .select()
    .single()

  if (error && import.meta.env.DEV) console.error('[visits] sellerUpdateVisitStatus greška:', error.message)
  return { data, error }
}