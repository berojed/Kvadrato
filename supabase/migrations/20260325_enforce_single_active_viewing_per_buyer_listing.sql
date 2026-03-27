-- Migration: Enforce single active viewing per buyer + listing
-- A buyer may only have one PENDING or CONFIRMED visit_request per listing.
-- This migration:
--   1. Resolves any existing duplicate active rows by cancelling all but the
--      newest (highest request_id) per (buyer_id, listing_id) pair.
--   2. Creates a partial unique index that prevents future duplicates.
-- Safe to re-run (idempotent).

-- ─── Step 1: Resolve existing duplicates ─────────────────────────────────────
-- For every (buyer_id, listing_id) pair that has more than one active row,
-- mark all but the single row with the highest request_id as CANCELLED.
UPDATE visit_request AS vr
SET    status = 'CANCELLED'
WHERE  status IN ('PENDING', 'CONFIRMED')
  AND  request_id NOT IN (
    -- Keep exactly one active row per (buyer_id, listing_id) — the newest one.
    SELECT DISTINCT ON (buyer_id, listing_id) request_id
    FROM   visit_request
    WHERE  status IN ('PENDING', 'CONFIRMED')
    ORDER  BY buyer_id, listing_id, request_id DESC
  );

-- ─── Step 2: Partial unique index ────────────────────────────────────────────
-- Prevents INSERT or UPDATE from creating a second active row for the same
-- (buyer_id, listing_id) pair.  The partial predicate limits scope to rows
-- that are still PENDING or CONFIRMED so that cancelled/rejected history is
-- unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS uq_visit_request_active_per_buyer_listing
  ON visit_request (buyer_id, listing_id)
  WHERE status IN ('PENDING', 'CONFIRMED');
