-- Enable RLS on listing table and add ownership-based policies
ALTER TABLE listing ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read listings (public browse)
CREATE POLICY listing_select_all ON listing FOR SELECT USING (true);

-- Allow authenticated sellers to insert their own listings
CREATE POLICY listing_insert_own ON listing FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

-- Allow owning seller to update their own listings (including status changes)
CREATE POLICY listing_update_own ON listing FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- Allow owning seller to delete their own listings
CREATE POLICY listing_delete_own ON listing FOR DELETE
  USING (auth.uid() = seller_id);
