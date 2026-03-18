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
- **BUYER**: can favorite listings, request visit appointments
- **SELLER**: can create/manage listings, view visit requests

## Search Notes
- Search currently queries `property.title` and `location.city` (both via two merged queries)
- PostgREST `!inner` join is used when filtering nested tables
- Two-query merge approach is used for OR-style search (title OR city)

## Environment Variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Project Rules

- Prefer small reusable React components
- Use hooks instead of class components
- All data fetching goes through services in `src/services`
- Never access Supabase directly inside components
- Use existing UI utility classes (`card`, `btn`, `badge`, `input`)

## Mentorship Preference
The user is an informatics student learning real-world development.
**After every response, always include a "Teachable Points" section** that:
- Highlights the key concepts used in that session's work
- Briefly explains how each concept is applied in real-world professional development
- Keeps explanations concise but practical
