-- Add latitude/longitude to property for precise map-based location
ALTER TABLE property ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE property ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Enforce both-or-none: coordinates must be complete or entirely absent
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_coordinates_both_or_none'
  ) THEN
    ALTER TABLE property ADD CONSTRAINT chk_coordinates_both_or_none
      CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL));
  END IF;
END $$;
