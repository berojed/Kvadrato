-- Add optional buyer contact fields and share flags to public.user.
-- Phone remains canonical in phone_number table; these are supplementary.
-- Idempotent: safe to re-run.

ALTER TABLE public."user" ADD COLUMN IF NOT EXISTS whatsapp_contact TEXT;
ALTER TABLE public."user" ADD COLUMN IF NOT EXISTS messenger_contact TEXT;
ALTER TABLE public."user" ADD COLUMN IF NOT EXISTS other_contact_label TEXT;
ALTER TABLE public."user" ADD COLUMN IF NOT EXISTS other_contact_value TEXT;
ALTER TABLE public."user" ADD COLUMN IF NOT EXISTS share_whatsapp BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public."user" ADD COLUMN IF NOT EXISTS share_messenger BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public."user" ADD COLUMN IF NOT EXISTS share_other BOOLEAN NOT NULL DEFAULT FALSE;
