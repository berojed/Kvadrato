-- ─── Migration: Harden RLS to prevent self-interaction ───────────────────────
-- Adds/replaces INSERT policies on visit_request and message so that the DB
-- itself blocks an authenticated user from interacting with their own listing,
-- independent of any client-side guards.
-- All statements are idempotent (DROP IF EXISTS before CREATE).

-- ─── visit_request ────────────────────────────────────────────────────────────

-- Make sure RLS is on (safe to run even if already enabled)
ALTER TABLE visit_request ENABLE ROW LEVEL SECURITY;

-- Drop existing insert policy by known names (add more names here if schema evolves)
DROP POLICY IF EXISTS "Kupac može kreirati zahtjev za posjet" ON visit_request;
DROP POLICY IF EXISTS "Buyer can create visit request"        ON visit_request;
DROP POLICY IF EXISTS "visit_request_insert"                  ON visit_request;

-- New policy: authenticated user may insert only as buyer, not as listing owner
CREATE POLICY "Kupac može kreirati zahtjev za posjet"
  ON visit_request
  FOR INSERT
  WITH CHECK (
    auth.uid() = buyer_id
    AND auth.uid() != (
      SELECT seller_id FROM listing WHERE listing_id = visit_request.listing_id
    )
  );

-- ─── message ─────────────────────────────────────────────────────────────────

-- Make sure RLS is on
ALTER TABLE message ENABLE ROW LEVEL SECURITY;

-- Drop existing insert policies by known names
DROP POLICY IF EXISTS "Korisnik šalje poruke"   ON message;
DROP POLICY IF EXISTS "Korisnik salje poruke"   ON message;
DROP POLICY IF EXISTS "User can send messages"  ON message;
DROP POLICY IF EXISTS "message_insert"          ON message;

-- New policy: buyer_id must be auth user; buyer must not be the listing's owner
-- Live schema uses buyer_id/seller_id (not sender_id/recipient_id)
CREATE POLICY "Korisnik salje poruke"
  ON message
  FOR INSERT
  WITH CHECK (
    auth.uid() = buyer_id
    AND (
      listing_id IS NULL
      OR auth.uid() != (
        SELECT seller_id FROM listing WHERE listing_id = message.listing_id
      )
    )
  );
