import { supabase } from '@/lib/supabase'

/**
 * ─── NAPOMENA O TOKU ───
 * Buyer inquiries are sent via the `send-property-inquiry` Edge Function.
 * The function validates the buyer, rejects self-contact, inserts into the
 * `message` table FIRST (mandatory), then sends email via Resend (secondary).
 *
 * The client calls `supabase.functions.invoke()` — no direct table inserts.
 *
 * Edge Function returns structured responses:
 *   - { status: 'success', stored: true, emailSent: true }     → full success
 *   - { status: 'partial', stored: true, emailSent: false, warning }  → stored, email failed
 *   - { status: 'error',   stored: false, emailSent: false, error }   → full failure
 */

/**
 * Šalje upit prodavaču za određeni oglas putem Edge Function.
 *
 * Buyer contact data (phone, WhatsApp, Messenger, etc.) is resolved server-side
 * from the buyer's profile — not supplied by the frontend.
 *
 * @param {Object} params
 * @param {string} params.senderId    – buyer user id (for local validation)
 * @param {string} params.recipientId – seller user id (ignored by function, derived from listing)
 * @param {string} params.listingId   – listing id (UUID)
 * @param {string} params.content     – inquiry message text
 *
 * @returns {{ data: { status: string, stored: boolean, emailSent: boolean, warning?: string } | null, error: { message: string } | null }}
 */
export async function sendMessage({ senderId, recipientId, listingId, content }) {
  if (import.meta.env.DEV) console.log('[messages] sendMessage via Edge Function:', { senderId, listingId })

  const { data, error } = await supabase.functions.invoke('send-property-inquiry', {
    body: {
      listingId,
      content: content.trim(),
    },
  })

  // Network / transport error (function unreachable, CORS failure, etc.)
  if (error) {
    if (import.meta.env.DEV) console.error('[messages] sendMessage transport error:', error.message)
    return { data: null, error: { message: error.message || 'Slanje upita nije uspjelo.' } }
  }

  // Function returned an error-status response (status: 'error')
  if (data?.status === 'error') {
    if (import.meta.env.DEV) console.error('[messages] sendMessage server error:', data.error)
    return { data: null, error: { message: data.error || 'Slanje upita nije uspjelo.' } }
  }

  // Legacy compatibility: if function returned { error: '...' } without status field
  if (data?.error && !data?.status) {
    if (import.meta.env.DEV) console.error('[messages] sendMessage legacy error:', data.error)
    return { data: null, error: { message: data.error } }
  }

  if (import.meta.env.DEV) {
    console.log('[messages] sendMessage result:', {
      status: data?.status,
      stored: data?.stored,
      emailSent: data?.emailSent,
    })
    if (data?.warning) console.warn('[messages] Email warning:', data.warning)
  }

  // Return structured data for the UI to distinguish success vs partial
  return { data, error: null }
}

/**
 * Dohvaća sve poruke između dva korisnika za određeni oglas.
 * Uses live table columns: buyer_id, seller_id, listing_id, content, notes, timestamp
 */
export async function getMessages({ userId, otherUserId, listingId }) {
  if (import.meta.env.DEV) console.log('[messages] getMessages:', { userId, otherUserId, listingId })

  let query = supabase
    .from('message')
    .select(`
      *,
      buyer:buyer_id(user_id, first_name, last_name),
      seller:seller_id(user_id, first_name, last_name)
    `)
    .eq('listing_id', listingId)

  if (otherUserId) {
    query = query.or(
      `and(buyer_id.eq.${userId},seller_id.eq.${otherUserId}),and(buyer_id.eq.${otherUserId},seller_id.eq.${userId})`
    )
  } else {
    query = query.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
  }

  query = query.order('timestamp', { ascending: true })
  const { data, error } = await query

  if (error && import.meta.env.DEV) console.error('[messages] getMessages greška:', error.message)
  return { data: data ?? [], error }
}
