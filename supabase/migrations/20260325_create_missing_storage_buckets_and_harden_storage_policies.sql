-- Create missing storage buckets (profile-images, property-models)
-- and harden write policies across all three buckets.
-- Idempotent: safe to re-run.

-- ============================================================
-- 1. profile-images bucket
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-images',
  'profile-images',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "profile-images: public read" ON storage.objects;
CREATE POLICY "profile-images: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-images');

-- Owner-scoped INSERT: user can only upload to users/<their uid>/...
DROP POLICY IF EXISTS "profile-images: owner insert" ON storage.objects;
CREATE POLICY "profile-images: owner insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Owner-scoped UPDATE
DROP POLICY IF EXISTS "profile-images: owner update" ON storage.objects;
CREATE POLICY "profile-images: owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'profile-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Owner-scoped DELETE
DROP POLICY IF EXISTS "profile-images: owner delete" ON storage.objects;
CREATE POLICY "profile-images: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'profile-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- ============================================================
-- 2. property-models bucket
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-models',
  'property-models',
  true,
  104857600,  -- 100 MB (3D models can be large)
  ARRAY['model/gltf-binary', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "property-models: public read" ON storage.objects;
CREATE POLICY "property-models: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-models');

-- Authenticated INSERT (ownership enforced at service layer)
DROP POLICY IF EXISTS "property-models: authenticated insert" ON storage.objects;
CREATE POLICY "property-models: authenticated insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'property-models'
    AND auth.role() = 'authenticated'
  );

-- Authenticated UPDATE
DROP POLICY IF EXISTS "property-models: authenticated update" ON storage.objects;
CREATE POLICY "property-models: authenticated update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'property-models'
    AND auth.role() = 'authenticated'
  );

-- Authenticated DELETE
DROP POLICY IF EXISTS "property-models: authenticated delete" ON storage.objects;
CREATE POLICY "property-models: authenticated delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'property-models'
    AND auth.role() = 'authenticated'
  );

-- ============================================================
-- 3. property-pictures bucket (already exists)
--    Replace broad authenticated policies with same pattern
--    for consistency. Keep public read.
-- ============================================================

-- Drop legacy policies from the original migration
DROP POLICY IF EXISTS "Allow public read on property-pictures" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload on property-pictures" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update on property-pictures" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete on property-pictures" ON storage.objects;

-- Public read
DROP POLICY IF EXISTS "property-pictures: public read" ON storage.objects;
CREATE POLICY "property-pictures: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-pictures');

-- Authenticated INSERT (ownership enforced at service layer)
DROP POLICY IF EXISTS "property-pictures: authenticated insert" ON storage.objects;
CREATE POLICY "property-pictures: authenticated insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'property-pictures'
    AND auth.role() = 'authenticated'
  );

-- Authenticated UPDATE
DROP POLICY IF EXISTS "property-pictures: authenticated update" ON storage.objects;
CREATE POLICY "property-pictures: authenticated update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'property-pictures'
    AND auth.role() = 'authenticated'
  );

-- Authenticated DELETE
DROP POLICY IF EXISTS "property-pictures: authenticated delete" ON storage.objects;
CREATE POLICY "property-pictures: authenticated delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'property-pictures'
    AND auth.role() = 'authenticated'
  );
