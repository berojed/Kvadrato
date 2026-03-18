import { supabase } from '@/lib/supabase'

/**
 * ─── NAPOMENA O SHEMI ───
 * Ova usluga zahtijeva sljedeću tablicu u Supabase bazi:
 *
 * CREATE TABLE message (
 *   message_id  SERIAL PRIMARY KEY,
 *   sender_id   UUID NOT NULL REFERENCES auth.users(id),
 *   recipient_id UUID NOT NULL REFERENCES auth.users(id),
 *   listing_id  INTEGER REFERENCES listing(listing_id),
 *   content     TEXT NOT NULL,
 *   is_read     BOOLEAN DEFAULT FALSE,
 *   created_at  TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- RLS politike (Row Level Security):
 * ALTER TABLE message ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Korisnik vidi vlastite poruke"
 *   ON message FOR SELECT
 *   USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
 *
 * CREATE POLICY "Korisnik šalje poruke"
 *   ON message FOR INSERT
 *   WITH CHECK (auth.uid() = sender_id);
 */

/**
 * Šalje poruku prodavaču za određeni oglas
 */
export async function sendMessage({ senderId, recipientId, listingId, content }) {
  if (import.meta.env.DEV) console.log('[messages] sendMessage:', { senderId, listingId })

  // When a listingId is provided, derive the canonical recipient from the
  // listing's seller_id and reject if sender is the listing owner.
  // This prevents self-messaging and avoids trusting the caller's recipientId.
  let resolvedRecipientId = recipientId
  if (listingId) {
    const { data: listingRow, error: ownerErr } = await supabase
      .from('listing')
      .select('seller_id')
      .eq('listing_id', listingId)
      .single()

    if (ownerErr) {
      if (import.meta.env.DEV) console.error('[messages] sendMessage – provjera vlasnika neuspješna:', ownerErr.message)
      return { data: null, error: ownerErr }
    }
    if (listingRow.seller_id === senderId) {
      if (import.meta.env.DEV) console.warn('[messages] sendMessage – odbijeno: prodavač ne može slati poruke za vlastiti oglas')
      return { data: null, error: { message: 'Prodavač ne može slati poruke za vlastiti oglas.' } }
    }
    resolvedRecipientId = listingRow.seller_id
  }

  const { data, error } = await supabase
    .from('message')
    .insert({
      sender_id: senderId,
      recipient_id: resolvedRecipientId,
      listing_id: listingId,
      content: content.trim(),
    })
    .select()
    .single()

  if (error && import.meta.env.DEV) console.error('[messages] sendMessage greška:', error.message)

  return { data, error }
}

/**
 * Dohvaća sve poruke između dva korisnika za određeni oglas
 */
export async function getMessages({ userId, otherUserId, listingId }) {
  if (import.meta.env.DEV) console.log('[messages] getMessages:', { userId, otherUserId, listingId })

  let query = supabase
    .from('message')
    .select(`
      *,
      sender:sender_id(user_id, first_name, last_name),
      recipient:recipient_id(user_id, first_name, last_name)
    `)
    .eq('listing_id', listingId)

  if (otherUserId) {
    query = query.or(
      `and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`
    )
  } else {
    query = query.or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
  }

  query = query.order('created_at', { ascending: true })
  const { data, error } = await query

  if (error && import.meta.env.DEV) console.error('[messages] getMessages greška:', error.message)
  return { data: data ?? [], error }
}
