# Kvadrato – Marketplace nekretnina

Frontend za marketplace nekretnina izrađen u **React + Vite + Tailwind CSS + Supabase**.

## Tech Stack

| Kategorija | Tehnologija |
|---|---|
| Framework | React 18 (JavaScript) |
| Build tool | Vite |
| Stilovi | Tailwind CSS |
| Backend/DB | Supabase (PostgreSQL + Auth + Storage) |
| Routing | React Router v7 |
| Forme | react-hook-form + Zod |
| Animacije | Framer Motion |
| Ikone | Lucide React |
| State | Zustand (za globalni state po potrebi) |

---

## Struktura projekta

```
src/
├── components/
│   ├── layout/
│   │   ├── Header.jsx         # Navigacija s auth stanjem
│   │   └── Footer.jsx
│   └── ui/
│       ├── PropertyCard.jsx   # Kartica nekretnine
│       ├── PropertyFilters.jsx # Filteri za pretragu
│       └── ProtectedRoute.jsx  # HOC za auth rute
├── context/
│   └── AuthContext.jsx        # Supabase auth state (useAuth hook)
├── hooks/
│   ├── useProperties.js       # Fetch + filter + paginate
│   └── useFavorites.js        # Toggle omiljenih s optimistic update
├── lib/
│   ├── supabase.js            # Supabase client singleton
│   └── utils.js               # cn(), formatPrice(), parseImageUrls()…
├── pages/
│   ├── HomePage.jsx
│   ├── PropertiesPage.jsx
│   ├── PropertyDetailPage.jsx
│   ├── FavoritesPage.jsx
│   ├── ProfilePage.jsx
│   ├── auth/
│   │   ├── LoginPage.jsx
│   │   └── RegisterPage.jsx
│   └── seller/
│       ├── SellerDashboardPage.jsx
│       └── AddPropertyPage.jsx
├── services/
│   ├── properties.js          # CRUD za nekretnine
│   ├── favorites.js           # Upravljanje omiljenima
│   ├── visits.js              # Zahtjevi za posjet
│   └── sellers.js             # Profili prodavača
├── App.jsx                    # Router + layout
└── main.jsx
```

---

## Pokretanje projekta

### 1. Kloniranje i instalacija

```bash
git clone <repo-url> kvadrato
cd kvadrato
npm install
```

### 2. Supabase konfiguracija

#### Kreiraj Supabase projekt
1. Idi na [supabase.com](https://supabase.com) → New Project
2. Zapamti lozinku baze podataka

#### Postavi bazu
1. Otvori **SQL Editor** u Supabase dashboardu
2. Kopiraj i pokreni cijeli sadržaj `supabase-schema.sql`

#### Kreiraj Storage buckete
U Supabase dashboardu → **Storage**:
- Novi bucket: `property-images` (javno)
- Novi bucket: `avatars` (javno)

#### `.env` file
```bash
cp .env.example .env
```

Otvori `.env` i popuni:
```
VITE_SUPABASE_URL=https://tvoj-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsIn...
```
Vrijednosti nađeš u: Supabase Dashboard → Project Settings → API

### 3. Pokretanje

```bash
npm run dev
```

App je dostupan na `http://localhost:5173`

---

## Rute aplikacije

| Ruta | Stranica | Zaštićena? |
|---|---|---|
| `/` | Početna stranica | Ne |
| `/properties` | Lista nekretnina + filteri | Ne |
| `/properties/:id` | Detalji nekretnine | Ne |
| `/favorites` | Omiljene nekretnine | ✅ Da |
| `/profile` | Korisnički profil | ✅ Da |
| `/seller/dashboard` | Upravljanje oglasima | ✅ Da |
| `/seller/add` | Dodavanje oglasa | ✅ Da |
| `/auth/login` | Prijava | Ne |
| `/auth/register` | Registracija | Ne |

---

## Design sustav

Boje definirali u `tailwind.config.js` i `src/index.css`:

| Token | Vrijednost | Upotreba |
|---|---|---|
| `primary` | `#000000` | Naslovi, tekst |
| `accent` | `#FF7A00` | Gumbi, CTA, aktivna stanja |
| `background` | `#FFFFFF` | Podloga |
| `foreground` | `#333333` | Tijelo teksta |
| `border` | `#D3D3D3` | Rubovi kartica, inputi |
| `muted` | `#F5F5F5` | Pozadine sekcija |

CSS komponente u `src/index.css`:
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`
- `.input`, `.select`
- `.card`
- `.badge`, `.badge-primary`, `.badge-accent`
- `.container`, `.section`, `.divider`
- `.spinner`

---

## Supabase tablice

| Tablica | Opis |
|---|---|
| `properties` | Nekretnine (naslov, cijena, adresa, slike…) |
| `sellers` | Profili prodavača |
| `favorites` | Veza user ↔ property |
| `property_visit_requests` | Zahtjevi za posjet |

Sve tablice imaju **Row Level Security (RLS)** politike.

---

## TODO / Sljedeći koraci

- [ ] `SellerEditPropertyPage` – uređivanje postojećeg oglasa
- [ ] `SellerVisitRequestsPage` – pregled dolaznih zahtjeva
- [ ] Upload slika direktno u Supabase Storage (umjesto URL-ova)
- [ ] Karta (Leaflet) za prikaz lokacije
- [ ] Filteri putem URL query params (za dijeljenje linka)
- [ ] Optimistički load za property view count
- [ ] Toast notifikacije (Sonner)
- [ ] Infinite scroll umjesto "Učitaj još"

---

## Korisni linkovi

- [Supabase Docs](https://supabase.com/docs)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [React Router v7](https://reactrouter.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [Tailwind CSS](https://tailwindcss.com/)
