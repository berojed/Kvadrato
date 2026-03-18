-- ─── Migration: normalize model3d as canonical 3D model source ──────────────
-- Adds created_at to model3d if missing, enforces 1:1 per property with a
-- UNIQUE constraint, and backfills rows from the legacy property."3d_model_url"
-- column for properties that already have a URL but no model3d row.
-- The legacy column is kept for backward-compatible rollout; app reads are
-- switched to model3d first with fallback to the legacy column.

-- Add created_at column if not present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'model3d' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE model3d ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Enforce 1:1 relationship: at most one model per property
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'model3d_property_id_unique'
  ) THEN
    ALTER TABLE model3d ADD CONSTRAINT model3d_property_id_unique UNIQUE (property_id);
  END IF;
END $$;

-- Backfill model3d rows from legacy property."3d_model_url" column.
-- Only inserts where a URL exists on the property but no model3d row yet.
-- If both exist, the existing model3d.url wins (not overwritten).
INSERT INTO model3d (property_id, url, created_at)
SELECT p.property_id, p."3d_model_url", NOW()
FROM property p
WHERE p."3d_model_url" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM model3d m WHERE m.property_id = p.property_id
  );
