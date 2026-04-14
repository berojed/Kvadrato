import { supabase } from '@/lib/supabase'

// Buyer inquiries go through the send-property-inquiry Edge Function.
// DB insert is mandatory first; email via Resend is secondary.
// Structured responses: { status: 'success'|'partial'|'error', stored, emailSent }
// Buyer contact data is resolved server-side; frontend only sends listingId + content.

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
    return { data: null, error: { message: error.message || 'SEND_FAILED' } }
  }

  // Function returned an error-status response (status: 'error')
  if (data?.status === 'error') {
    if (import.meta.env.DEV) console.error('[messages] sendMessage server error:', data.error)
    return { data: null, error: { message: data.error || 'SEND_FAILED' } }
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

  return { data, error: null }
}

// Uses live table columns: buyer_id, seller_id, listing_id, content, notes, timestamp
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

// Fetches prior messages for a buyer-seller-listing triple, newest first.
export async function getBuyerMessageHistory({ buyerId, sellerId, listingId }) {
  if (import.meta.env.DEV) {
    console.log('[messages] getBuyerMessageHistory:', { buyerId, sellerId, listingId })
  }

  const { data, error } = await supabase
    .from('message')
    .select('content, timestamp')
    .eq('buyer_id', buyerId)
    .eq('seller_id', sellerId)
    .eq('listing_id', listingId)
    .order('timestamp', { ascending: false })

  if (error && import.meta.env.DEV) {
    console.error('[messages] getBuyerMessageHistory greška:', error.message)
  }

  return { data: data ?? [], error }
}
