-- Drop unused description column from model3d table.
-- Column was never populated or rendered in UI.
ALTER TABLE public.model3d DROP COLUMN IF EXISTS description;
