-- Add business_contact column to public.user for seller contact info
ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS business_contact TEXT;

COMMENT ON COLUMN public."user".business_contact IS 'Poslovni kontakt prodavača (telefon, web, email agencije, itd.)';
