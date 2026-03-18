-- Add nullable 3D model URL column to property table
-- Quoted identifier required because column name starts with a digit
ALTER TABLE property
  ADD COLUMN IF NOT EXISTS "3d_model_url" TEXT DEFAULT NULL;

COMMENT ON COLUMN property."3d_model_url"
  IS 'Public URL to a .glb/.gltf 3D model file stored in Supabase Storage';
