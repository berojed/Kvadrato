-- ─── Migration: standardize property_type to three canonical values ───────────
-- Canonical types: Stan, Kuća, Poslovni prostor
-- Lossy mapping: Vila → Kuća, Garaža → Poslovni prostor, Zemljište → Poslovni prostor
-- Original type name is preserved in property.legacy_property_type_name before remap.

-- Step 1: Add legacy column for lossless preservation
ALTER TABLE property ADD COLUMN IF NOT EXISTS legacy_property_type_name TEXT;

-- Step 2: Backfill legacy name from current property_type
UPDATE property p
SET legacy_property_type_name = pt.type_name
FROM property_type pt
WHERE p.property_type_id = pt.property_type_id
  AND p.legacy_property_type_name IS NULL;

-- Step 3: Ensure the three canonical rows exist
INSERT INTO property_type (type_name)
VALUES ('Stan'), ('Kuća'), ('Poslovni prostor')
ON CONFLICT (type_name) DO NOTHING;

-- Step 4a: Remap Vila → Kuća
UPDATE property
SET property_type_id = (SELECT property_type_id FROM property_type WHERE type_name = 'Kuća')
WHERE property_type_id IN (
  SELECT property_type_id FROM property_type WHERE type_name = 'Vila'
);

-- Step 4b: Remap Garaža and Zemljište → Poslovni prostor
UPDATE property
SET property_type_id = (
  SELECT property_type_id FROM property_type WHERE type_name = 'Poslovni prostor'
)
WHERE property_type_id IN (
  SELECT property_type_id FROM property_type WHERE type_name IN ('Garaža', 'Zemljište')
);

-- Step 5: Delete deprecated type rows (only after all references are remapped)
DELETE FROM property_type WHERE type_name NOT IN ('Stan', 'Kuća', 'Poslovni prostor');

-- Step 6: Add constraint so only the three canonical values can be inserted
ALTER TABLE property_type DROP CONSTRAINT IF EXISTS property_type_name_allowed;
ALTER TABLE property_type ADD CONSTRAINT property_type_name_allowed
  CHECK (type_name IN ('Stan', 'Kuća', 'Poslovni prostor'));
