-- Idempotent integrity constraints for property_details and property_amenity.
-- As of 2026-03-19, both constraints already exist:
--   property_details_property_id_key (UNIQUE on property_id)
--   property_amenity_pkey (composite PK on property_id, amenity_id)
-- This migration serves as documentation; the DO blocks are no-ops.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'property_details_property_id_key'
  ) THEN
    ALTER TABLE property_details ADD CONSTRAINT property_details_property_id_key UNIQUE (property_id);
  END IF;
END $$;

-- property_amenity already has composite PK — no action needed.
