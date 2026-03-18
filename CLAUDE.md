# Kvadrato – Project Context

## Overview
Real estate marketplace for the Croatian market built with **React 18 + Vite + Tailwind CSS + Supabase**.

## Tech Stack
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS + custom CSS utility classes
- **Backend**: Supabase (PostgreSQL + Auth)
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

## Database Schema (Supabase)
- `listing` → listing_type (SALE/RENT), price_amount, currency_id, status_id, seller_id, property_id
- `property` → title, description, bedrooms, bathrooms, area_size, property_type_id, location_id, seller_id
- `location` → city, state_region, country, postal_code
- `property_type` → type_name (Stan, Kuća, Vila, Poslovni prostor, Zemljište, Garaža)
- `property_details` → year_built, total_floors, furnishing_type_id, heating_type_id, property_condition_id
- `image` → url, is_primary, sort_order, property_id
- `property_address` → street_address, floor_number, unit_number
- `model3d` → url, description, property_id
- `visit_request` → buyer_id, listing_id, requested_datetime, status, notes
- `favorite` → user_id, listing_id

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
- **BUYER**: can favorite listings, request visit appointments, cancel own viewings
- **SELLER**: can create/manage listings, confirm/reject/view visit requests

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
- `/seller/dashboard` – Listing management with metrics (active count, upcoming viewings, favorites) and clickable list-style rows with edit/delete actions; client-side pagination
- `/seller/viewings` – Visit request management; upcoming (confirm/reject PENDING) and past sections
- `/seller/add` – Add new listing (uses `AddPropertyPage`)
- `/seller/edit/:id` – Edit existing listing (reuses `AddPropertyPage` in edit mode)
- `/seller/profile` – Seller profile with stats (active/sold/total)
- `/seller/settings` – Seller settings (personal, security, privacy, notifications + theme)

## Seller Flow Key Files
| Area | Path |
|---|---|
| Seller dashboard | `src/pages/seller/SellerDashboardPage.jsx` |
| Seller viewings | `src/pages/seller/SellerViewingsPage.jsx` |
| Seller profile | `src/pages/seller/SellerProfilePage.jsx` |
| Seller settings | `src/pages/seller/SellerSettingsPage.jsx` |
| Add/Edit property | `src/pages/seller/AddPropertyPage.jsx` |
| Sellers service | `src/services/sellers.js` |

## UI Patterns
- **Dashboard listings**: Clickable horizontal list rows (thumbnail left, info center, price/status/actions right); rows navigate to listing detail, edit/delete use `stopPropagation`
- **Seller favorites count**: Two-step query — fetch seller `listing_id`s, then count `favorite` rows via `in()` filter (avoids join ambiguity)
- **Viewings pages**: Upcoming / past split; ViewingRow component with thumbnail, property link, date/time, status badge, action buttons
- **Settings pages**: Desktop sidebar (224px) + content panel; mobile horizontal tab selector
- **Dark mode**: `darkMode: 'class'` in Tailwind config; ThemeContext with localStorage persistence (`kvadrato-theme`); `.dark` class on `<html>`

## 3D Viewer
- Model-driven camera system: model is auto-centered at origin, then GLTF nodes are indexed for room resolution
- Room navigation priority: 1) GLTF node name match → 2) 3D volume fallback → 3) legacy 2D zone (backward compat)
- **Room config contract** (current): each room defines `nodeNames` (string[]) and `volume: [xMin, yMin, zMin, xMax, yMax, zMax]` in normalized 0–1 space relative to model bounding box. Optional hints: `facing: [dx, dz]` (XZ pull direction), `eyeHeight` (fraction of room height, default 0.38), `pullFactor` (0–0.9, default 0.55)
- **Volume-based camera placement**: camera is placed at `pullFactor × half-span` along the facing axis (always inside the volume), looking at the room's horizontal center at eye level. No absolute coordinates stored.
- **`interiorY` vertical override**: optional `interiorY: [yMin, yMax]` (0–1 normalized) decouples usable floor-to-ceiling height from the coarser `volume` Y bounds. Use when the model bounding box includes roof/structural space above the room interior (e.g., upper-floor rooms whose `volume` yMax reaches into the roof ridge). X/Z placement always comes from `volume`; Y always comes from `interiorY` when present, otherwise from `volume`. Camera Y is clamped inside the resolved interior band.
- **Per-room calibration**: only rooms that exhibit incorrect placement should be given explicit `eyeHeight` and `pullFactor` overrides. Working rooms (living room, kitchen) are left without overrides to avoid regressions. Upper-floor rooms currently use `interiorY: [0.52, 0.78]`, `eyeHeight: 0.22–0.24`, `pullFactor: 0.25–0.28`.
- **Coordinate space**: room volumes are resolved in the centered model coordinate space (`scene.position.sub(center)` applied once on load). No additional world/local remapping is applied; `modelTransform` is identity for the current asset.
- Node-matched rooms still support legacy `height` / `distance` / `yawBias` hints
- Overview camera is computed from scene bounds or overridden via config `overview` field
- Room transitions use smooth lerp interpolation for both camera position and OrbitControls target
- Room mode uses tighter OrbitControls constraints (derived from room radius); overview mode uses scene-wide constraints
- Graceful fallback: unresolved rooms stay in overview instead of jumping to broken positions
- Config file: `src/lib/property3dConfig.js`, viewer: `src/components/ui/Property3DViewerModal.jsx`
- Draco-compressed GLB models supported via `useGLTF(url, true)` + local decoder at `/draco/`
- Current test model: "Realistic House (With Interior)" by Blender Studio™ (CC BY 4.0, Sketchfab)
  - 322 nodes, 198 meshes, 17 materials, 18 textures (resized to 512px), Draco-compressed → 4.3MB GLB
  - Architectural model (walls, doors, windows, stairs, roof) — no room-specific node names
  - All room navigation uses volume fallback exclusively (yMin/yMax distinguish ground vs upper floor)
  - Supabase Storage: `property-models/properties/a1000000-0000-0000-0000-000000000008/model.glb`

## Search Notes
- Search currently queries `property.title` and `location.city` (both via two merged queries)
- PostgREST `!inner` join is used when filtering nested tables
- Two-query merge approach is used for OR-style search (title OR city)

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
- **3D model source of truth**: `property."3d_model_url"` column only. The `model3d` join in `getListingById` is legacy and unused by the UI.

## Corrected Data Flows
- **Listing access pattern**: `listing → property → location / image / property_details`
- **Currency**: selected as `currency(currency_name, symbol)` in public queries; pass full `listing.currency` object to `formatPrice()` (not `currency_code`).
- **Status**: use `status_code` (not `status_name`) everywhere — in filters, guards, and `getSellerStats`.
- **Auth email vs profile email**: `auth.users.email` is the login identifier and must never be edited through `public.user`. Profile pages display `user?.email` (from auth session) as read-only. `updateUserProfile` strips `email` before updating.
- **Buyer-only guard pattern**: `const ownerId = listing.seller_id ?? listing.seller?.user_id; const isOwnListing = !!(user?.id && ownerId && user.id === ownerId); const canBuyerAct = isBuyer && !isOwnListing`. Always use canonical `listing.seller_id` (FK column, returned via `select('*')`) as the primary ownership signal; the joined `seller.user_id` is only a fallback.
- **Self-interaction protection — three layers**: (1) UI: `canBuyerAct` hides/disables buyer CTAs; own-listing state shows "Vlasnik ste ovog oglasa." (2) Service: `createVisitRequest` and `sendMessage` fetch `listing.seller_id` and return an error if caller is the owner; `sendMessage` also derives `recipientId` from the listing row, ignoring caller input. (3) DB: RLS INSERT policies on `visit_request` and `message` enforce the same rule at query time.

## Known Issues and Fixes Applied
- **Seller edit auth race** (FIXED): `AuthContext.getSession` now awaits `fetchProfile` before `setLoading(false)`, so ProtectedRoute holds the spinner until both user and profile are ready.
- **Registration email-confirm branch** (FIXED): When `data.session` is null (email confirmation required), `setNeedsEmailConfirm(true)` now fires correctly and the confirm UI is shown.
- **Dead settings toggles** (FIXED): Non-functional action buttons and notification toggles are now disabled with `cursor-not-allowed` / `pointer-events-none` and a "Uskoro dostupno" indicator.
- **Draco CDN dependency** (FIXED): 3D viewer now uses local `/draco/` decoder (copied from `node_modules/three/examples/jsm/libs/draco/gltf/`) via `useGLTF.setDecoderPath('/draco/')`.
- **Category routing mismatch** (FIXED): HomePage category links now pass Croatian DB values (`Stan`, `Kuća`, `Poslovni prostor`, `Zemljište`) matching `property_type.type_name`.
- **Visit notes not persisted** (FIXED): `createVisitRequest` now accepts and inserts `notes` field.
- **getMessages over-returning** (FIXED): `getMessages` now scopes to the specific `otherUserId` conversation pair when provided.
- **model3d canonical source** (FIXED): `getListingById` now reads `model3dUrl` from the `model3d` relation first, falling back to legacy `property."3d_model_url"`. `model3d` table has a `UNIQUE(property_id)` constraint enforcing 1:1. Service helpers `upsertPropertyModel` / `removePropertyModel` handle seller upload/removal.
- **Property types standardized** (FIXED): DB and frontend restricted to `Stan`, `Kuća`, `Poslovni prostor`. Deprecated types (`Vila`, `Garaža`, `Zemljište`) remapped and deleted; original values preserved in `property.legacy_property_type_name`.
- **Seller buyer action cards** (FIXED): `PropertyDetailPage` no longer renders `Zakaži pregled` or `Pošalji poruku` cards for any authenticated seller. Cards remain visible for guests (with login prompt) and buyers.
- **Login role intent** (FIXED): `LoginPage` has a buyer/seller toggle that routes after sign-in — seller intent goes to `/seller/dashboard`, buyer intent to `/`. Real permissions are unchanged; `ProtectedRoute` still enforces actual role.
- **Nekretnine hidden for guests** (FIXED): Header hides the `Nekretnine` nav link for unauthenticated users in both desktop and mobile nav.
- **Homepage autocomplete** (FIXED): Hero search input has debounced autocomplete via `getSearchSuggestions`, querying `location` (city, state_region) and `property_address` (street_address). Zemljište category removed.

## Important Patterns
- **Never hardcode numeric DB IDs** for roles, currencies, or statuses. Fetch from DB (`getRoles()`, `getCurrencies()`, `getListingStatuses()`) or use code-based lookups.
- **Never update `public.user.email`** directly — it diverges from `auth.users.email`. `updateUserProfile` strips email from updates.
- **Keep all Supabase queries in `src/services/`** — never add `.from()` calls in components or hooks.
- **Use `<Link>` not `<a>`** for all internal navigation (SPA routing, no full-page reload).
- **Gate debug logging**: all `console.log` / `console.warn` / `console.error` in services and context files must be wrapped in `if (import.meta.env.DEV)`.
- **Draco decoder path**: `useGLTF.setDecoderPath('/draco/')` is set at module level in `Property3DViewerModal.jsx`. The `public/draco/` directory is populated by `prebuild` script from `node_modules/three/examples/jsm/libs/draco/gltf/`.
- **3D model canonical source**: `model3d` relation is canonical; `property."3d_model_url"` is a legacy migration fallback only. Use `upsertPropertyModel(propertyId, file)` and `removePropertyModel(propertyId)` for seller upload/removal. `model3d` has a `UNIQUE(property_id)` constraint.
- **Standardized property types**: only `Stan`, `Kuća`, `Poslovni prostor` exist in `property_type`. `getPropertyTypes()` is restricted to these three. Deprecated values are remapped; originals preserved in `property.legacy_property_type_name`.
- **Seller exclusion from buyer CTAs**: `isSeller` check (not just `isOwnListing`) gates the entire visit and message card blocks in `PropertyDetailPage`. Guests still see login prompts; buyers still see forms.
- **Homepage autocomplete**: `getSearchSuggestions(query)` queries `location` and `property_address` tables with `ilike`, deduplicates, and returns max 6 suggestions. Called from `HeroSection` with 300ms debounce. No external search service needed.
