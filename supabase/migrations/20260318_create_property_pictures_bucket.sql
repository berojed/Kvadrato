-- Create public storage bucket for property pictures
-- Organised as: properties/<property_id>/<filename>
-- Max 10 MB per file, images only.
-- Idempotent: safe to re-run.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-pictures',
  'property-pictures',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Public read
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Allow public read on property-pictures') THEN
    CREATE POLICY "Allow public read on property-pictures"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'property-pictures');
  END IF;
END $$;

-- Authenticated upload
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Allow authenticated upload on property-pictures') THEN
    CREATE POLICY "Allow authenticated upload on property-pictures"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'property-pictures' AND auth.role() = 'authenticated');
  END IF;
END $$;

-- Authenticated update
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Allow authenticated update on property-pictures') THEN
    CREATE POLICY "Allow authenticated update on property-pictures"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'property-pictures' AND auth.role() = 'authenticated');
  END IF;
END $$;

-- Authenticated delete
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Allow authenticated delete on property-pictures') THEN
    CREATE POLICY "Allow authenticated delete on property-pictures"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'property-pictures' AND auth.role() = 'authenticated');
  END IF;
END $$;
