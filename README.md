# Kvadrato – Marketplace nekretnina

Web aplikacija za tržište nekretnina za hrvatsko tržište. Podržava pregled oglasa, filtriranje, omiljene, zakazivanje razgledavanja, slanje upita prodavatelju, interaktivni 3D prikaz nekretnine i kartografski prikaz lokacije. Razvijena je u **React + Vite + Tailwind CSS** uz **Supabase** kao cjeloviti backend (PostgreSQL, Auth, Storage, Edge Functions).

---

## Tech Stack

| Kategorija | Tehnologija |
|---|---|
| Framework | React 18 (JavaScript) |
| Build tool | Vite 6 |
| Stilovi | Tailwind CSS 3 + prilagođene CSS klase |
| Routing | React Router v7 |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Forme | Nativni kontrolirani inputi (bez form biblioteke) |
| Ikone | Lucide React |
| Datumi | date-fns (dinamičko učitavanje `hr` / `en` lokala) |
| 3D viewer | three.js, @react-three/fiber, @react-three/drei (Draco kompresija) |
| Karta | Leaflet + react-leaflet + OpenStreetMap/Nominatim |
| i18n | Prilagođeni React Context (`I18nContext`) + JSON rječnici |
| Email | Resend API (pozvan iz Supabase Edge Function) |
| Hosting | Vercel |

---

## Struktura projekta

```
kvadrato/
├── public/
│   ├── data/
│   │   └── hr-location-index.json      # Statički indeks hrvatskih lokacija (autocomplete)
│   └── draco/                          # Draco dekoder za 3D GLB modele
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.jsx              # Navigacija, auth stanje, mobile menu
│   │   │   └── Footer.jsx
│   │   ├── property/
│   │   │   └── Viewer3DErrorBoundary.jsx
│   │   ├── settings/
│   │   │   └── AccountSettingsContent.jsx   # Zajednički UI za postavke (Security + Appearance)
│   │   └── ui/
│   │       ├── PropertyCard.jsx
│   │       ├── PropertyFilters.jsx
│   │       ├── PropertyLocationPicker.jsx   # Leaflet marker picker (read/write)
│   │       ├── Property3DViewerModal.jsx    # 3D modal s room preset navigacijom
│   │       ├── CalendarPicker.jsx
│   │       ├── TimeSlotPicker.jsx
│   │       └── ProtectedRoute.jsx           # Auth + role gating
│   ├── context/
│   │   ├── AuthContext.jsx             # Supabase sesija + profil, useAuth()
│   │   ├── UIPreferencesContext.jsx    # Jedinstveni izvor: jezik, tema, font
│   │   ├── ThemeContext.jsx            # Thin adapter (theme + font)
│   │   └── I18nContext.jsx             # Thin adapter (language + t())
│   ├── hooks/
│   │   ├── useProperties.js            # Dohvat + filtriranje + paginacija
│   │   └── useFavorites.js             # Toggle favorita s optimističkim ažuriranjem
│   ├── lib/
│   │   ├── supabase.js                 # Supabase client singleton
│   │   ├── utils.js                    # cn(), formatPrice(), formatDate()
│   │   ├── geocoding.js                # Nominatim geokodiranje (samo centriranje karte)
│   │   ├── locationAutocomplete.js     # Klijentski autocomplete iz statičkog indeksa
│   │   └── croatianLocations.js
│   ├── locales/
│   │   ├── hr.json                     # Hrvatski rječnik (zadani)
│   │   └── en.json                     # Engleski rječnik
│   ├── pages/
│   │   ├── HomePage.jsx
│   │   ├── PropertiesPage.jsx
│   │   ├── PropertyDetailPage.jsx
│   │   ├── FavoritesPage.jsx
│   │   ├── MyViewingsPage.jsx
│   │   ├── ProfilePage.jsx
│   │   ├── SettingsPage.jsx
│   │   ├── auth/
│   │   │   ├── LoginPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   └── seller/
│   │       ├── SellerDashboardPage.jsx
│   │       ├── SellerProfilePage.jsx
│   │       ├── SellerSettingsPage.jsx
│   │       ├── SellerViewingsPage.jsx
│   │       ├── SellerPropertyDetailPage.jsx
│   │       ├── AddPropertyPage.jsx          # Koristi se i za edit (`/seller/edit/:id`)
│   │       └── Seller3DConfigPage.jsx       # Spremanje kamera-preseta po prostoriji
│   ├── services/
│   │   ├── properties.js               # Dohvat / kreiranje / uređivanje oglasa
│   │   ├── favorites.js
│   │   ├── visits.js                   # Zahtjevi za razgledavanje
│   │   ├── messages.js                 # Invoke Edge Function + povijest poruka
│   │   ├── sellers.js                  # Prodavatelj profil, avatar, telefon, metrike
│   │   └── model3dRooms.js             # CRUD nad `property_3d_room`
│   ├── App.jsx                         # Router + layout
│   └── main.jsx                        # UI preferences bootstrap prije mounta
├── supabase/
│   └── functions/
│       └── send-property-inquiry/      # Deno Edge Function: DB insert + Resend email
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
└── vercel.json                         # SPA rewrite (/(.*) → /index.html)
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

1. Na [supabase.com](https://supabase.com) kreiraj novi projekt.
2. U **Storage** kreiraj tri bucketa:
   - `property-pictures` (javno čitanje)
   - `property-models` (javno čitanje; GLB modeli)
   - `profile-images` (javno čitanje; avatari)
3. Za funkciju slanja upita prodavatelju postavi tajne:
   ```bash
   supabase secrets set RESEND_API_KEY=...
   supabase secrets set RESEND_FROM_EMAIL=noreply@tvoja-domena
   ```
4. Deploy Edge Function:
   ```bash
   supabase functions deploy send-property-inquiry
   ```

### 3. Environment varijable

Kreiraj `.env.local` u korijenu projekta:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-or-publishable-key>
```

Vrijednosti se nalaze u: **Supabase Dashboard → Project Settings → API**.

### 4. Pokretanje dev servera

```bash
npm run dev
```

Aplikacija je dostupna na `http://localhost:5173`.

### 5. Produkcijski build

```bash
npm run build
npm run preview
```

---

## Rute aplikacije

| Ruta | Stranica |
|---|---|
| `/` | Početna stranica |
| `/properties` | Lista nekretnina + filteri |
| `/properties/:id` | Javni detaljni prikaz nekretnine |
| `/auth/login` | Prijava (BUYER / SELLER toggle) |
| `/auth/register` | Registracija |
| `/profile` | Profil kupca |
| `/settings` | Postavke kupca (Security + Appearance) |
| `/favorites` | Omiljene nekretnine (BUYER) |
| `/my-viewings` | Zahtjevi za razgledavanje kupca (BUYER) |
| `/seller/dashboard` | Upravljanje oglasima i metrike (SELLER) |
| `/seller/profile` | Profil prodavatelja (SELLER) |
| `/seller/settings` | Postavke prodavatelja (SELLER) |
| `/seller/viewings` | Pregled i potvrda zahtjeva za razgledavanje (SELLER) |
| `/seller/add` | Dodavanje novog oglasa (SELLER) |
| `/seller/edit/:id` | Uređivanje postojećeg oglasa (SELLER) |
| `/seller/3d-config/:id` | Konfiguracija kamera-preseta 3D modela (SELLER) |
| `/my_properties` | Alias za seller dashboard (SELLER) |
| `/my_properties/:id` | Vlasnički detaljni prikaz sa upravljanjem statusom (SELLER) |

---

## Deploy / Live aplikacija

Aplikacija je deployana na **Vercel**. Svaki push na `main` granu automatski pokreće novi build.

- **Live URL:** <https://kvadrato-theta.vercel.app/>

Produkcijska instanca služi kao demo za testiranje i prikaz funkcionalnosti rada.

---

## UI / UX pristup

- **Stilovi:** Tailwind CSS utility-first klase + skup prilagođenih CSS komponenti (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.card`, `.input`, `.badge`, `.divider`, `.spinner`, `.container`) definiranih u `src/index.css`.
- **Tema:** Svjetla / tamna / sistemska — `UIPreferencesContext` upravlja klasom `dark` na `<html>` elementu.
- **Tipografija:** Pet fontova (Inter, System UI, Nunito Sans, Source Sans 3, DM Sans) učitanih preko Google Fonts; primjena kroz CSS varijablu `--font-family`.
- **i18n:** Hrvatski (zadani) i engleski jezik, prebacivanje u *Postavke → Izgled*. Svi UI stringovi idu kroz `t()` iz `useI18n()`; rječnici u `src/locales/*.json`.
- **Perzistencija preferencija:** Tema, font i jezik pohranjuju se u `localStorage` pod ključem `kvadrato-ui-preferences` i primjenjuju se sinkrono u `main.jsx` prije mount-a Reacta (nema FOUC-a).
- **Ikone:** Lucide React (`>20` mjesta upotrebe u aplikaciji).
- **Karta:** Leaflet + OpenStreetMap tileovi; `PropertyLocationPicker` radi i u interaktivnom i u read-only modu.
- **3D prikaz:** Three.js + React Three Fiber; GLB modeli s Draco kompresijom; preset-vođena navigacija po prostorijama (spremljena od strane prodavatelja).

---

## Korisni linkovi

- [React](https://react.dev)
- [Vite](https://vitejs.dev)
- [React Router](https://reactrouter.com)
- [Tailwind CSS](https://tailwindcss.com)
- [Supabase](https://supabase.com/docs)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [three.js](https://threejs.org/docs)
- [React Three Fiber](https://r3f.docs.pmnd.rs)
- [Leaflet](https://leafletjs.com)
- [react-leaflet](https://react-leaflet.js.org)
- [Lucide Icons](https://lucide.dev)
- [date-fns](https://date-fns.org/docs/Getting-Started)
- [Resend](https://resend.com/docs)
