-- Drop unused seller profile columns from public.user.
-- business_contact and office_address were removed from SellerProfilePage UI.
ALTER TABLE public."user" DROP COLUMN IF EXISTS business_contact;
ALTER TABLE public."user" DROP COLUMN IF EXISTS office_address;
