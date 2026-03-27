-- Harden visit_request RLS: scope reads and writes to the owning buyer or listing seller.

-- 1. Enable RLS (idempotent)
ALTER TABLE visit_request ENABLE ROW LEVEL SECURITY;

-- 2. Drop any existing policies
DROP POLICY IF EXISTS visit_request_buyer_select  ON visit_request;
DROP POLICY IF EXISTS visit_request_seller_select ON visit_request;
DROP POLICY IF EXISTS visit_request_buyer_insert  ON visit_request;
DROP POLICY IF EXISTS visit_request_buyer_update  ON visit_request;
DROP POLICY IF EXISTS visit_request_seller_update ON visit_request;

-- 3. SELECT – buyers see their own requests
CREATE POLICY visit_request_buyer_select ON visit_request
  FOR SELECT
  USING (auth.uid() = buyer_id);

-- 4. SELECT – sellers see requests targeting their listings
CREATE POLICY visit_request_seller_select ON visit_request
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM listing
      WHERE listing.listing_id = visit_request.listing_id
        AND listing.seller_id = auth.uid()
    )
  );

-- 5. INSERT – buyers can create requests as themselves
CREATE POLICY visit_request_buyer_insert ON visit_request
  FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- 6. UPDATE – buyers can update their own requests (e.g. cancel)
CREATE POLICY visit_request_buyer_update ON visit_request
  FOR UPDATE
  USING (auth.uid() = buyer_id)
  WITH CHECK (auth.uid() = buyer_id);

-- 7. UPDATE – sellers can update requests for their own listings (e.g. confirm/reject)
CREATE POLICY visit_request_seller_update ON visit_request
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM listing
      WHERE listing.listing_id = visit_request.listing_id
        AND listing.seller_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listing
      WHERE listing.listing_id = visit_request.listing_id
        AND listing.seller_id = auth.uid()
    )
  );
