-- Add avatar_url column to public."user" for profile image storage.
-- The actual image lives in Supabase Storage bucket "profile-images"
-- at path: users/<user_id>/avatar.<ext>
-- This column stores the resulting public URL.

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public."user".avatar_url IS
  'Public URL of the user profile image stored in Supabase Storage (profile-images bucket)';
