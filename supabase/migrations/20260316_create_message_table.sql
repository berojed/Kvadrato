-- 20260316_create_message_table.sql
-- Message table for buyer-to-seller property inquiries.
-- Matches the live schema: buyer_id, seller_id, listing_id, content, notes, timestamp.
-- Idempotent: safe to run on databases that already have this table.
--
-- DESIGN NOTE on `notes` column:
-- The `notes` column stores a JSON snapshot of buyer contact info at inquiry time.
-- This is an INTENTIONAL audit/compliance pattern, NOT redundant data:
--   - Buyer may change phone/email/name AFTER sending the inquiry
--   - Seller's email (sent via Resend) contains the contact info that was current
--   - The snapshot preserves exactly what was shared, for dispute resolution
--   - Only opted-in contacts (share_whatsapp, share_messenger, share_other) are included
-- This column should NOT be removed. It serves as an immutable event record.

CREATE TABLE IF NOT EXISTS public.message (
  message_id   SERIAL PRIMARY KEY,
  content      TEXT NOT NULL,
  "timestamp"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  buyer_id     UUID NOT NULL REFERENCES auth.users(id),
  seller_id    UUID NOT NULL REFERENCES auth.users(id),
  listing_id   UUID NOT NULL REFERENCES public.listing(listing_id) ON DELETE CASCADE,
  notes        TEXT,
  CONSTRAINT chk_buyer_not_seller CHECK (buyer_id <> seller_id)
);

ALTER TABLE public.message ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'message' AND policyname = 'Korisnik vidi vlastite poruke'
  ) THEN
    CREATE POLICY "Korisnik vidi vlastite poruke"
      ON public.message FOR SELECT
      USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'message' AND policyname = 'Korisnik salje poruke'
  ) THEN
    CREATE POLICY "Korisnik salje poruke"
      ON public.message FOR INSERT
      WITH CHECK (auth.uid() = buyer_id);
  END IF;
END $$;
