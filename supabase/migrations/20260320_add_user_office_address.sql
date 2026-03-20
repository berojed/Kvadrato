-- Add office_address column to public.user for seller business address
ALTER TABLE public."user" ADD COLUMN IF NOT EXISTS office_address TEXT DEFAULT NULL;
