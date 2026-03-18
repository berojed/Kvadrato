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

-- Drop existing insert policy
DROP POLICY IF EXISTS "Korisnik šalje poruke" ON message;
DROP POLICY IF EXISTS "User can send messages" ON message;
DROP POLICY IF EXISTS "message_insert"         ON message;

-- New policy: sender must be auth user; if listing_id is set, sender must not
-- be the listing's owner
CREATE POLICY "Korisnik šalje poruke"
  ON message
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      listing_id IS NULL
      OR auth.uid() != (
        SELECT seller_id FROM listing WHERE listing_id = message.listing_id
      )
    )
  );
