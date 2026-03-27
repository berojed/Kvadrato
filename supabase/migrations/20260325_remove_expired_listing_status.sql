-- Remap any listings using EXPIRED status to INACTIVE, then delete the deprecated row.
-- Idempotent: safe to re-run if the status is already gone.

DO $$
DECLARE
  v_expired_id INT;
  v_inactive_id INT;
BEGIN
  SELECT status_id INTO v_expired_id
    FROM listing_status
   WHERE status_code = 'EXPIRED';

  IF v_expired_id IS NULL THEN
    RAISE NOTICE 'EXPIRED status already removed — nothing to do.';
    RETURN;
  END IF;

  SELECT status_id INTO v_inactive_id
    FROM listing_status
   WHERE status_code = 'INACTIVE';

  IF v_inactive_id IS NULL THEN
    RAISE EXCEPTION 'INACTIVE status not found — cannot remap EXPIRED listings.';
  END IF;

  -- Remap dependent listings
  UPDATE listing
     SET status_id = v_inactive_id
   WHERE status_id = v_expired_id;

  -- Delete the deprecated status row
  DELETE FROM listing_status
   WHERE status_id = v_expired_id;

  RAISE NOTICE 'EXPIRED status removed. Affected listings remapped to INACTIVE.';
END $$;
