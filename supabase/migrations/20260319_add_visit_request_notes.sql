-- Add optional notes column to visit_request.
-- Buyers can include a message when requesting a property viewing.
ALTER TABLE visit_request ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;
