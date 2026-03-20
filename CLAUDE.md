# Kvadrato – Project Context

## Overview
Real estate marketplace for the Croatian market built with **React 18 + Vite + Tailwind CSS + Supabase**.

## Tech Stack
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS + custom CSS utility classes
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions + Storage)
- **Routing**: React Router v7
- **Forms**: react-hook-form + Zod validation
- **Icons**: Lucide React
- **Date handling**: date-fns with Croatian locale (`hr`)
- **Language**: Croatian UI labels, English code

## Key File Paths
| Area | Path |
|---|---|
| Property filters UI | `src/components/ui/PropertyFilters.jsx` |
| Property card | `src/components/ui/PropertyCard.jsx` |
| Calendar picker | `src/components/ui/CalendarPicker.jsx` |
| Time slot picker | `src/components/ui/TimeSlotPicker.jsx` |
| Listings page | `src/pages/PropertiesPage.jsx` |
| Listing detail page | `src/pages/PropertyDetailPage.jsx` |
| Properties service (Supabase) | `src/services/properties.js` |
| Visits service | `src/services/visits.js` |
| Auth context | `src/context/AuthContext.jsx` |
| useProperties hook | `src/hooks/useProperties.js` |
| Supabase client | `src/lib/supabase.js` |
| Utils (cn, formatPrice) | `src/lib/utils.js` |
| Location autocomplete | `src/lib/locationAutocomplete.js` |
| Static location data | `public/data/hr-location-index.json` |
| Edge Function: inquiry | `supabase/functions/send-property-inquiry/index.ts` |
| Geocoding helper (Nominatim) | `src/lib/geocoding.js` |
| Seller listing detail | `src/pages/seller/SellerPropertyDetailPage.jsx` |
| Property location picker | `src/components/ui/PropertyLocationPicker.jsx` |

## Database Schema (Supabase)
- `role` → role_id (int PK), role_code (varchar) — NO `role_name` column
- `listing` → listing_id (uuid), listing_type (SALE/RENT), price_amount, date_listed, expiration_date, seller_id (uuid FK → auth.users), property_id (uuid FK), currency_id, status_id
- `property` → property_id (uuid), title, description, bedrooms, bathrooms, area_size, address_id, property_type_id, location_id, unit_id, 3d_model_url, latitude (DOUBLE PRECISION, nullable), longitude (DOUBLE PRECISION, nullable) — NO `seller_id` (ownership lives on `listing`). CHECK: coordinates must be both present or both null.
- `location` → city, state_region, country, postal_code
- `property_type` → type_name (Stan, Kuća, Poslovni prostor)
- `property_details` → year_built, total_floors, furnishing_type_id, heating_type_id, property_condition_id
- `image` → url, is_primary, sort_order, property_id
- `property_address` → street_address, floor_number, unit_number
- `model3d` → url, description, property_id (UNIQUE constraint → 1:1)
- `visit_request` → buyer_id, listing_id, requested_datetime, status, notes
- `favorite` → user_id, listing_id
- `message` → message_id (serial PK), content (text), timestamp (timestamptz), buyer_id (uuid FK), seller_id (uuid FK), listing_id (uuid FK), notes (text) — CHECK: buyer_id ≠ seller_id
- `phone_number` → user_id, phone_country_code, phone_number

## Custom CSS Classes (defined in index.css / Tailwind config)
- `.card` – white card with border + rounded corners
- `.btn`, `.btn-primary`, `.btn-secondary` – button styles
- `.badge`, `.badge-primary`, `.badge-muted` – tag/badge styles
- `.input` – input/textarea styles
- `.divider` – horizontal divider line
- `.spinner` – loading spinner
- `--accent` CSS variable for brand accent color

## Data Access Conventions
- Listings fetched with nested Supabase joins: `listing → property → location / image / property_details`
- Access pattern: `listing.property.title`, `listing.property.location.city`, `listing.property.image[]`
- Property details: `listing.property.property_details.{year_built, total_floors, furnishing_type.furnishing_name, heating_type.heating_name, property_condition.condition_name}`
- Primary image: find `is_primary === true`, fallback to lowest `sort_order`

## User Roles
- **BUYER**: can favorite listings, request visit appointments, cancel own viewings, send email inquiries to sellers
- **SELLER**: can create/manage listings, confirm/reject/view visit requests, receive inquiry emails

## Route Structure

### Public Routes
- `/` – Home
- `/properties` – Listings browse
- `/properties/:id` – Listing detail
- `/auth/login`, `/auth/register` – Auth pages

### Buyer Routes (ProtectedRoute role="BUYER")
- `/favorites` – Saved listings
- `/my-viewings` – Buyer's visit requests (cancel enabled for PENDING)
- `/profile` – Buyer profile (editable name/email)
- `/settings` – Buyer settings (personal, security, privacy, notifications + theme)

### Seller Routes (ProtectedRoute role="SELLER")
- `/seller/dashboard` – Listing management with metrics (active count, upcoming viewings, contacts) and clickable list-style rows with edit/delete actions; client-side pagination
- `/my_properties` – Alias for seller dashboard (same component)
- `/my_properties/:id` – Seller-only listing detail with status management (`SellerPropertyDetailPage`)
- `/seller/viewings` – Visit request management; upcoming (confirm/reject PENDING) and past sections
- `/seller/add` – Add new listing (uses `AddPropertyPage`)
- `/seller/edit/:id` – Edit existing listing (reuses `AddPropertyPage` in edit mode)
- `/seller/profile` – Seller profile with avatar, phone, business contact, stats, quick actions
- `/seller/settings` – Seller settings (personal, security, privacy, notifications + theme)

## Seller Flow Key Files
| Area | Path |
|---|---|
| Seller dashboard | `src/pages/seller/SellerDashboardPage.jsx` |
| Seller viewings | `src/pages/seller/SellerViewingsPage.jsx` |
| Seller profile | `src/pages/seller/SellerProfilePage.jsx` |
| Seller settings | `src/pages/seller/SellerSettingsPage.jsx` |
| Add/Edit property | `src/pages/seller/AddPropertyPage.jsx` |
| Seller listing detail | `src/pages/seller/SellerPropertyDetailPage.jsx` |
| Sellers service | `src/services/sellers.js` |

## UI Patterns
- **Dashboard listings**: Clickable horizontal list rows (thumbnail left, info center, price/status/actions right); rows navigate to `/my_properties/:id` (seller detail), edit/delete use `stopPropagation`
- **Seller favorites count**: Two-step query — fetch seller `listing_id`s, then count `favorite` rows via `in()` filter (avoids join ambiguity)
- **Viewings pages**: Upcoming / past split; ViewingRow component with thumbnail, property link, date/time, status badge, action buttons
- **Settings pages**: Desktop sidebar (224px) + content panel; mobile horizontal tab selector
- **Dark mode**: `darkMode: 'class'` in Tailwind config; ThemeContext with localStorage persistence (`kvadrato-theme`); `.dark` class on `<html>`

## 3D Viewer
- **Two runtime modes**: standardized (default) and legacy compatibility
  - **Standardized mode** (no per-property config): auto-center, normalize scale to ~10 units, derive overview camera from bounds, auto-detect rooms from GLTF node names, fall back to overview-only when detection yields nothing
  - **Legacy mode** (property has entry in `property3dConfig.js`): use hardcoded volumes, overview overrides, and room groups as-is — no scale normalization applied
- Model-driven camera system: model is auto-centered at origin, then GLTF nodes are indexed for room resolution
- **Auto room detection**: `ROOM_DETECT_PATTERNS` matches node names against common patterns (living, kitchen, bedroom, bathroom, stair, etc.) in Croatian/English/German. Matched nodes become room groups shown in the navigation panel.
- Room navigation priority: 1) GLTF node name match → 2) 3D volume fallback → 3) legacy 2D zone → 4) stay in overview (graceful)
- **Room config contract** (legacy): each room defines `nodeNames` (string[]) and `volume: [xMin, yMin, zMin, xMax, yMax, zMax]` in normalized 0–1 space. Optional hints: `facing`, `eyeHeight`, `pullFactor`, `interiorY`
- **Volume-based camera placement**: camera at `pullFactor × half-span` along facing axis, looking at room center at eye level
- **`interiorY` vertical override**: decouples usable floor-to-ceiling Y from volume bounds (for upper-floor rooms with roof geometry)
- Overview camera is computed from scene bounds or overridden via config `overview` field
- Room transitions use smooth lerp interpolation for both camera position and OrbitControls target
- Room mode uses tighter OrbitControls constraints; overview mode uses scene-wide constraints
- Graceful fallback: unresolved rooms stay in overview instead of jumping to broken positions
- Config file: `src/lib/property3dConfig.js` (compatibility fallback only), viewer: `src/components/ui/Property3DViewerModal.jsx`
- Draco-compressed GLB models supported via `useGLTF(url, true)` + local decoder at `/draco/`
- Current test model: "Realistic House (With Interior)" by Blender Studio™ (CC BY 4.0, Sketchfab)
  - Uses legacy config mode because it has no room-level node names
  - Supabase Storage: `property-models/properties/a1000000-0000-0000-0000-000000000008/model.glb`

## Search Notes
- Homepage autocomplete uses a static 140-entry Croatia-wide location index (`public/data/hr-location-index.json`), lazy-loaded and cached client-side by `src/lib/locationAutocomplete.js`. Zero DB round-trips per keystroke.
- Property listings search queries `property.title` and `location.city` via two merged Supabase queries
- PostgREST `!inner` join is used when filtering nested tables

## Buyer Inquiry Workflow
- **Flow**: PropertyDetailPage inquiry form → `sendMessage()` → `supabase.functions.invoke('send-property-inquiry')` → Edge Function validates buyer, rejects self-contact, inserts into `message` table (mandatory, first), sends email via Resend (secondary, second)
- **Execution order**: validate auth → insert message (MANDATORY) → send email (SECONDARY). If insert fails, entire action fails. If email fails after insert, returns partial result.
- **No seller inbox**: Messaging is one-way email notification with audit log. No conversation UI.
- **Live `message` table schema**: `message_id` (serial PK), `content` (text), `timestamp` (timestamptz), `buyer_id` (uuid FK), `seller_id` (uuid FK), `listing_id` (uuid FK), `notes` (text). Constraint: `buyer_id <> seller_id`. RLS: buyers can insert as themselves; both parties can read.
- **Contact snapshot**: Buyer name, email, phone serialized as JSON in `message.notes` for audit trail
- **Structured responses from Edge Function**:
  - `{ status: 'success', stored: true, emailSent: true }` → full success (DB + email)
  - `{ status: 'partial', stored: true, emailSent: false, warning: '...' }` → stored but email failed
  - `{ status: 'error', stored: false, emailSent: false, error: '...' }` → full failure
- **Frontend 3-state UI**: full success (green checkmark, "email sent"), partial (amber warning, "saved but email not sent"), error (red error message)
- **Secrets**: `RESEND_API_KEY` and `RESEND_FROM_EMAIL` must be set via `supabase secrets set` for email delivery
- **CORS**: Every Edge Function response (OPTIONS preflight, success, and error) must include `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods: POST, OPTIONS`, and `Access-Control-Allow-Headers`.
- **Seller email resolution**: Uses `public.user.email` directly (not `auth.admin.getUserById`) because the function runs with an anon-key client
- **Inquiry UI**: Property page inquiry card contains only a message textarea, submit button, and status text. No redundant buyer contact/phone block.

## Profile System
- **Profile data**: `public.user` (first_name, last_name, avatar_url, role_id, created_at)
- **Auth email**: `auth.users.email` is the source of truth. `updateAuthEmail()` in AuthContext wraps `supabase.auth.updateUser({ email })`. Supabase sends confirmation to new address; old email stays active until confirmed.
- **Phone**: `phone_number` table with `upsertPhoneNumber()` — first existing row is canonical, updated in-place
- **Avatar**: Supabase Storage bucket `profile-images`, canonical path `users/<userId>/avatar.<ext>`. `uploadAvatar()` uploads with upsert, persists public URL (+cache-bust) in `public.user.avatar_url`. `removeAvatar()` clears both.
- **ProfilePage**: Card-based layout with avatar upload overlay, editable name/phone, email change with confirmation flow, settings shortcut

## Environment Variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Mentorship Preference
The user is an informatics student learning real-world development.
**After every response, always include a "Teachable Points" section** that:
- Highlights the key concepts used in that session's work
- Briefly explains how each concept is applied in real-world professional development
- Keeps explanations concise but practical

## Stable Architecture Overview
- **Language**: React/Vite JavaScript (not TypeScript)
- **Role gating**: depends on two sources: `auth.users` session (from Supabase Auth) + `public.user` profile row (joined with `role` table). `ProtectedRoute` must NOT render role-gated children until both resolve — `AuthContext.getSession` awaits `fetchProfile` before `setLoading(false)`.
- **Public browse**: must only return listings with `listing_status.status_code = 'ACTIVE'`. Use `listing_status!inner` join + `.eq('listing_status.status_code', 'ACTIVE')` filter in `getListings`.
- **Buyer-only actions**: favorite, visit request, message — all require `isBuyer && !isOwnListing`. Never show these to sellers or unauthenticated users.
- **3D model source of truth**: `model3d` relation is canonical; `property."3d_model_url"` is a legacy migration fallback.
- **3D viewer standardization**: new models should work without per-property config. `property3dConfig.js` is compatibility fallback only.

## Corrected Data Flows
- **Listing access pattern**: `listing → property → location / image / property_details`
- **Currency**: selected as `currency(currency_name, symbol)` in public queries; pass full `listing.currency` object to `formatPrice()` (not `currency_code`).
- **Status**: use `status_code` (not `status_name`) everywhere — in filters, guards, and `getSellerStats`.
- **Auth email vs profile email**: `auth.users.email` is the login identifier and must never be edited through `public.user`. Email edits go through `updateAuthEmail()` in AuthContext which wraps `supabase.auth.updateUser({ email })`. `updateUserProfile` strips `email` before updating.
- **Buyer-only guard pattern**: `const ownerId = listing.seller_id ?? listing.seller?.user_id; const isOwnListing = !!(user?.id && ownerId && user.id === ownerId); const canBuyerAct = isBuyer && !isOwnListing`. Always use canonical `listing.seller_id` (FK column, returned via `select('*')`) as the primary ownership signal; the joined `seller.user_id` is only a fallback.
- **Self-interaction protection — three layers**: (1) UI: `canBuyerAct` hides/disables buyer CTAs; own-listing state shows "Vlasnik ste ovog oglasa." (2) Service/Edge Function: `createVisitRequest` validates ownership client-side; `send-property-inquiry` Edge Function validates buyer role and listing ownership server-side. (3) DB: RLS INSERT policies on `visit_request` and `message` enforce the same rule at query time.

## Known Issues and Fixes Applied
- **Seller edit auth race** (FIXED): `AuthContext.getSession` now awaits `fetchProfile` before `setLoading(false)`, so ProtectedRoute holds the spinner until both user and profile are ready.
- **Registration email-confirm branch** (FIXED): When `data.session` is null (email confirmation required), `setNeedsEmailConfirm(true)` now fires correctly and the confirm UI is shown.
- **Settings pages restructured** (FIXED): Both `SettingsPage` (buyer) and `SellerSettingsPage` have only two sections: Security (working password change via `updateAuthPassword`) and Appearance (theme toggle). Removed: Personal data, Privacy, Notifications sections and all placeholder "uskoro dostupno" text.
- **Seller profile office_address** (FIXED): `office_address` column added to `public.user` (TEXT, nullable). Managed via SellerProfilePage form. No service changes needed (`SELECT *` + spread).
- **Auth password change** (FIXED): `updateAuthPassword(newPassword)` added to AuthContext. Wraps `supabase.auth.updateUser({ password })`. No current password required when session is active.
- **Draco CDN dependency** (FIXED): 3D viewer now uses local `/draco/` decoder (copied from `node_modules/three/examples/jsm/libs/draco/gltf/`) via `useGLTF.setDecoderPath('/draco/')`.
- **Category routing mismatch** (FIXED): HomePage category links now pass Croatian DB values (`Stan`, `Kuća`, `Poslovni prostor`, `Zemljište`) matching `property_type.type_name`.
- **Visit notes not persisted** (FIXED): `createVisitRequest` now accepts and inserts `notes` field.
- **getMessages over-returning** (FIXED): `getMessages` now scopes to the specific `otherUserId` conversation pair when provided.
- **model3d canonical source** (FIXED): `getListingById` now reads `model3dUrl` from the `model3d` relation first, falling back to legacy `property."3d_model_url"`. `model3d` table has a `UNIQUE(property_id)` constraint enforcing 1:1. Service helpers `upsertPropertyModel` / `removePropertyModel` handle seller upload/removal. Auto-heal: `getListingById` and `getSellerListingById` call `backfillModel3dIfNeeded()` when no model3d row exists — checks storage for orphaned files and creates the missing DB row.
- **Property types standardized** (FIXED): DB and frontend restricted to `Stan`, `Kuća`, `Poslovni prostor`. Deprecated types (`Vila`, `Garaža`, `Zemljište`) remapped and deleted; original values preserved in `property.legacy_property_type_name`.
- **Seller buyer action cards** (FIXED): `PropertyDetailPage` no longer renders `Zakaži pregled` or `Pošalji poruku` cards for any authenticated seller. Cards remain visible for guests (with login prompt) and buyers.
- **Login role validation** (FIXED): `LoginPage` has a buyer/seller toggle. After sign-in, `signIn()` returns profile with `role.role_code`. If role doesn't match selected intent, user is immediately signed out with descriptive error. On match, routes to role-appropriate page.
- **Nekretnine hidden for guests** (FIXED): Header hides the `Nekretnine` nav link for unauthenticated users in both desktop and mobile nav.
- **Homepage autocomplete** (FIXED): Uses static Croatia-wide location index (`public/data/hr-location-index.json`) loaded once and cached client-side. No DB queries on keystroke.
- **Messaging via Edge Function** (FIXED): Buyer inquiries go through `send-property-inquiry` Edge Function. DB insert is mandatory and first; email is secondary. Function returns structured `success`/`partial`/`error` responses. Frontend shows 3-state UI (success/warning/error). Live `message` table uses `buyer_id`/`seller_id` columns (not `sender_id`/`recipient_id`).
- **Profile avatar upload** (FIXED): `ProfilePage` supports avatar upload/remove via Supabase Storage. Images stored at `profile-images/users/<userId>/avatar.<ext>` with URL in `public.user.avatar_url`.
- **Phone upsert** (FIXED): `upsertPhoneNumber` finds and updates the first existing `phone_number` row, or inserts a new one. Prevents duplicate rows per save.
- **Google Maps iframe removed** (FIXED): Public and seller detail pages now use Leaflet exclusively. `PropertyLocationPicker` in `readOnly` mode with `ReadOnlyGeocoder` for properties without saved coordinates. No Google Maps dependency remains.
- **Status management moved to seller route** (FIXED): `PropertyDetailPage` no longer has status management UI. Status changes live on `/my_properties/:id` (`SellerPropertyDetailPage`) with `getSellerListingById` (seller-scoped fetch) and `updateListingStatus`.
- **Geocoding helper renamed** (FIXED): `src/lib/googleMaps.js` renamed to `src/lib/geocoding.js` to match actual Nominatim/OSM architecture.
- **Seller profile upgraded** (FIXED): `SellerProfilePage` now includes avatar upload/remove, phone editing, `business_contact` field, 4-stat summary (active, completed, contacts, total), and quick action grid.

## Important Patterns
- **Never hardcode numeric DB IDs** for roles, currencies, or statuses. Fetch from DB (`getRoles()`, `getCurrencies()`, `getListingStatuses()`) or use code-based lookups.
- **Role table contract**: `role` has only `role_id` and `role_code`. There is NO `role_name` column. Never select `role_name`.
- **Seller ownership lives on `listing.seller_id`**, NOT on `property`. The `property` table has no `seller_id` column. `createPropertyAndListing` writes `seller_id` only to the `listing` insert. If listing creation fails, orphaned property and address rows are cleaned up.
- **Compensating cleanup**: Multi-step creation flows (address → property → listing) must delete earlier rows if a later step fails, to prevent orphaned data.
- **Never update `public.user.email`** directly — it diverges from `auth.users.email`. `updateUserProfile` strips email from updates.
- **Keep all Supabase queries in `src/services/`** — never add `.from()` calls in components or hooks.
- **Use `<Link>` not `<a>`** for all internal navigation (SPA routing, no full-page reload).
- **Gate debug logging**: all `console.log` / `console.warn` / `console.error` in services and context files must be wrapped in `if (import.meta.env.DEV)`.
- **Draco decoder path**: `useGLTF.setDecoderPath('/draco/')` is set at module level in `Property3DViewerModal.jsx`. The `public/draco/` directory is populated by `prebuild` script from `node_modules/three/examples/jsm/libs/draco/gltf/`.
- **3D model canonical source**: `model3d` relation is canonical; `property."3d_model_url"` is a legacy migration fallback only. Use `upsertPropertyModel(propertyId, file)` and `removePropertyModel(propertyId)` for seller upload/removal. `model3d` has a `UNIQUE(property_id)` constraint.
- **Standardized property types**: only `Stan`, `Kuća`, `Poslovni prostor` exist in `property_type`. `getPropertyTypes()` is restricted to these three. Deprecated values are remapped; originals preserved in `property.legacy_property_type_name`.
- **Seller exclusion from buyer CTAs**: `isSeller` check (not just `isOwnListing`) gates the entire visit and message card blocks in `PropertyDetailPage`. Guests still see login prompts; buyers still see forms.
- **Homepage autocomplete**: Uses static `public/data/hr-location-index.json` loaded by `src/lib/locationAutocomplete.js`. Single lazy fetch on first keystroke, then in-memory filtering. Max 6 suggestions, prefix-first ranking with Croatian locale sort. No external search service or DB query needed.
- **Buyer inquiry via Edge Function**: `sendMessage` in `messages.js` calls `supabase.functions.invoke('send-property-inquiry')`. Never insert into `message` table directly from client code. Edge Function inserts first (mandatory), then emails (secondary). Service parses structured `status` field, not just `error` presence. Frontend distinguishes full success, partial (stored but email failed), and error states.
- **Buyer contact resolution is server-side**: The Edge Function fetches buyer phone (from `phone_number` table) and optional contacts (WhatsApp, Messenger, other — from `public.user` columns) on the server. The frontend does NOT pass `buyerPhone` or contact data in the request body. Only opted-in contacts (`share_whatsapp`, `share_messenger`, `share_other` = true) are included in the email and stored `notes` snapshot. Phone number is **required** — the function returns a 400 error if the buyer has no phone.
- **Buyer contact columns on `public.user`**: `whatsapp_contact`, `messenger_contact`, `other_contact_label`, `other_contact_value` (all TEXT, nullable), plus `share_whatsapp`, `share_messenger`, `share_other` (BOOLEAN, default false). Managed via ProfilePage UI.
- **Seller business contact on `public.user`**: `business_contact` (TEXT, nullable). Free-form field for agency name, business phone, website, etc. Managed via SellerProfilePage.
- **Seller office address on `public.user`**: `office_address` (TEXT, nullable). Physical office/business address. Managed via SellerProfilePage.
- **Message table column names**: Live table uses `buyer_id`/`seller_id` (not `sender_id`/`recipient_id`) and `timestamp` (not `created_at`). All service queries must use the live column names.
- **Profile avatars**: Use `uploadAvatar(userId, file)` and `removeAvatar(userId)` from `sellers.js`. Storage bucket: `profile-images`, canonical path: `users/<userId>/avatar.<ext>`.
- **Property image uploads**: `createPropertyAndListing` accepts `imageFiles` (File[]), uploads each to `property-pictures` Storage bucket at `properties/<property_id>/<index>.<ext>`, then inserts public URLs into the `image` table. First image is `is_primary: true`. Bucket is public with authenticated-only write policies. Max 10 MB per file, JPEG/PNG/WebP only. The old URL-based `imageUrls` parameter is removed.
- **Property image editing**: Edit mode uses `addPropertyImages(propertyId, files)` to upload new images (auto-assigns `sort_order` after existing max) and `removePropertyImage(imageId)` to delete individual images (removes from DB + best-effort Storage cleanup). If the primary image is deleted, the next image by `sort_order` is auto-promoted.
- **Phone editing**: Use `upsertPhoneNumber(userId, code, number)` — finds first existing row for user and updates, or inserts new. Do not call `addPhoneNumber` directly for profile editing.
- **Auth email updates**: Use `updateAuthEmail(newEmail)` from AuthContext, never write to `public.user.email`.
- **3D viewer property config**: `property3dConfig.js` is compatibility fallback only. New models should rely on standardized auto-detection. Only add config entries for models that cannot be handled automatically.
- **Seller dashboard metric — Ostvareno kontakata**: Counts DISTINCT `buyer_id` from `message` rows where `seller_id = currentSellerId`. Uses `getSellerContactsCount()` in `sellers.js`. Not the same as total messages — it's unique buyers who contacted.
- **Property coordinates**: `property.latitude` and `property.longitude` are the canonical saved location. Address text is for geocoding/centering only. Coordinates are nullable at the DB level (backward-compatible) but required in the seller form for create/edit. CHECK constraint enforces both-or-none.
- **Seller location picker flow**: Address + city geocode → recenter map (debounced 500ms). Seller clicks map → marker placed → `latitude`/`longitude` emitted. Changing street address or city clears saved coordinates — seller must re-click to confirm. Edit mode loads saved coordinates as initial marker.
- **Map system (unified Leaflet/OSM)**: All maps use `leaflet` + `react-leaflet@4` via `PropertyLocationPicker`. Seller add/edit uses interactive mode (click-to-place, draggable marker). All detail pages use `readOnly` mode — if saved coordinates exist, a static marker is placed; otherwise, `ReadOnlyGeocoder` attempts to center the map from the address. No Google Maps dependency. No paid API keys.
- **Leaflet marker rules**: Click sets marker, drag refines marker position, saved `latitude`/`longitude` always drive marker position. Marker-required validation runs at submit time.
- **Seller listing detail separation**: Public detail page (`/properties/:id`) is read-only for all users — no status management. Seller-owned listing management lives at `/my_properties/:id` (`SellerPropertyDetailPage`) with status dropdown, edit link, and listing info card. Dashboard rows link to `/my_properties/:id`, not `/properties/:id`.
- **Property images in Storage**: All property images live in `property-pictures` Supabase Storage bucket. Organized as `properties/<property_id>/<index>.jpg`. The `image.url` column stores the full public URL. Bucket is public for reads, authenticated for writes.
- **Listing status management**: Seller can change `listing.status_id` on the seller detail page (`/my_properties/:id`) using a dropdown of dynamic options from `listing_status` table. Protected at three levels: (1) UI: visible only to owning seller, (2) Service: `updateListingStatus()` verifies seller ownership and status validity, (3) DB: RLS policies on `listing` enforce `auth.uid() = seller_id` for UPDATE.
- **Property details (1:1)**: `property_details` has UNIQUE on `property_id`. Seller form requires `condition_id`, `heating_id`, `furnishing_id`; `year_built` and `total_floors` are optional. Lookups fetched dynamically via `getFurnishingTypes()`, `getHeatingTypes()`, `getPropertyConditions()`. Upsert on edit (`onConflict: 'property_id'`).
- **Amenities (many-to-many)**: `property_amenity` join table with composite PK `(property_id, amenity_id)`. All amenities fetched via `getAmenities()` and rendered as checkboxes on seller form. On edit, existing rows are deleted and replaced. Displayed as badge list on detail pages.
- **Seller address input (manual)**: Seller form uses three manual text inputs — street, house number, city. No autocomplete, no Nominatim dependency. `streetAddress` is built as `street + houseNumber` at submit. Location resolved via `resolveLocationId({ city })`. Map pin is placed manually by clicking the map.
- **Location resolution**: `resolveLocationId({ city, stateRegion, postalCode, country })` finds or creates a `location` row at submit time. Matches on `(city, country)`. This replaces the old manual location dropdown.
- **Listing RLS policies**: `listing` table has RLS enabled with four policies: `listing_select_all` (public read), `listing_insert_own` (seller inserts own), `listing_update_own` (seller updates own), `listing_delete_own` (seller deletes own).
- **message.notes is an audit snapshot (NOT redundant)**: The `notes` column stores a JSON snapshot of buyer contact info at inquiry time. This is intentional — buyer may change phone/email after sending, but the seller's email record must preserve what was shared. Only opted-in contacts are included. This column must NOT be removed; it serves as an immutable event record for compliance.
- **model3d auto-heal pattern**: `backfillModel3dIfNeeded(propertyId)` checks if a property has a model file in `property-models` storage but no `model3d` DB row. If found, it creates the row with the correct public URL. Called lazily from `getListingById` / `getSellerListingById` when `model3dUrl` resolves to null. Safe to call multiple times (idempotent).
