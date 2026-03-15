import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, ArrowRight, Home, Building2, Landmark, Warehouse, Plus, BarChart3, Eye, MessageSquare, Calendar } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuth } from '@/context/AuthContext'

const CATEGORIES = [
  { type: 'apartment', label: 'Stanovi', icon: Building2, description: 'Moderni gradski stanovi' },
  { type: 'house', label: 'Kuće', icon: Home, description: 'Obiteljske kuće i vile' },
  { type: 'commercial', label: 'Poslovni prostori', icon: Landmark, description: 'Uredi i lokali' },
  { type: 'land', label: 'Zemljišta', icon: Warehouse, description: 'Građevinsko i poljoprivredno' },
]

const STATS = [
  { value: '1.200+', label: 'Aktivnih oglasa' },
  { value: '450+', label: 'Zadovoljnih kupaca' },
  { value: '80+', label: 'Verificiranih prodavača' },
  { value: '5 god.', label: 'Iskustva na tržištu' },
]

/* ────────────────────────────────────────────
   HERO — prikazuje se SVIMA (gost, buyer, seller)
   ali s različitim CTA-ovima
   ──────────────────────────────────────────── */
function HeroSection({ isAuthenticated, isSeller, isBuyer }) {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e) => {
    e.preventDefault()
    navigate(`/properties${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}`)
  }

  return (
    <section className="relative overflow-hidden bg-black text-white">
      <div className="container py-24 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="max-w-3xl"
        >
          <div className="text-xs font-medium uppercase tracking-widest text-gray-400 mb-6">
            {isSeller ? 'Dashboard prodavača' : 'Marketplace nekretnina'}
          </div>

          {isSeller ? (
            <>
              <h1 className="text-5xl md:text-7xl font-bold leading-tight text-white mb-6">
                Upravljaj<br />
                <span className="text-accent">svojim</span> oglasima.
              </h1>
              <p className="text-lg text-gray-400 mb-10 max-w-xl leading-relaxed">
                Objavi nekretnine, prati preglede i upravljaj upitima kupaca — sve na jednom mjestu.
              </p>
              <div className="flex gap-3">
                <Link to="/seller/add" className="btn btn-primary">
                  <Plus size={16} />
                  Dodaj nekretninu
                </Link>
                <Link to="/seller/dashboard" className="btn btn-ghost text-white border-white/20 hover:bg-white/10">
                  <BarChart3 size={16} />
                  Dashboard
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-5xl md:text-7xl font-bold leading-tight text-white mb-6">
                Pronađi<br />
                <span className="text-accent">savršen</span> prostor.
              </h1>
              <p className="text-lg text-gray-400 mb-10 max-w-xl leading-relaxed">
                Pregledaj tisuće nekretnina, filtriraj po željama i kontaktiraj prodavača direktno.
                Jednostavno, brzo, pouzdano.
              </p>

              <form onSubmit={handleSearch} className="flex gap-2 max-w-lg">
                <div className="flex-1 relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Grad, adresa, kvart…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-gray-500 rounded px-4 py-3 pl-10 outline-none focus:border-white/50 transition-colors text-sm"
                  />
                </div>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn btn-primary"
                >
                  Pretraži
                </motion.button>
              </form>
            </>
          )}
        </motion.div>
      </div>

      {/* Decorative grid */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────
   SELLER QUICK ACTIONS — samo za prodavače
   ──────────────────────────────────────────── */
function SellerQuickActions() {
  const actions = [
    { to: '/seller/add', icon: Plus, label: 'Dodaj nekretninu', desc: 'Kreiraj novi oglas s fotografijama i 3D modelom' },
    { to: '/seller/dashboard', icon: BarChart3, label: 'Pregled statistike', desc: 'Prati preglede, klikove i interes kupaca' },
    { to: '/seller/dashboard', icon: MessageSquare, label: 'Upiti kupaca', desc: 'Odgovori na poruke zainteresiranih kupaca' },
    { to: '/seller/dashboard', icon: Calendar, label: 'Razgledanja', desc: 'Upravljaj zahtjevima za razgledanje' },
  ]

  return (
    <section className="section">
      <div className="container">
        <div className="mb-10">
          <div className="text-xs font-medium uppercase tracking-widest text-gray-400 mb-2">
            Brze akcije
          </div>
          <h2 className="text-3xl font-bold">Što želiš napraviti?</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {actions.map((action, i) => (
            <motion.div
              key={action.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              viewport={{ once: true }}
            >
              <Link
                to={action.to}
                className="group block border border-border rounded p-6 hover:border-black transition-all hover:shadow-sm"
              >
                <action.icon size={24} className="mb-4 text-gray-400 group-hover:text-accent transition-colors" />
                <h3 className="font-semibold text-black mb-1">{action.label}</h3>
                <p className="text-xs text-gray-500">{action.desc}</p>
                <div className="mt-4 flex items-center gap-1 text-xs font-medium text-gray-400 group-hover:text-black transition-colors">
                  Otvori <ArrowRight size={12} />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────
   BUYER CATEGORIES — samo za kupce i goste
   ──────────────────────────────────────────── */
function BuyerCategories() {
  return (
    <section className="section">
      <div className="container">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="text-xs font-medium uppercase tracking-widest text-gray-400 mb-2">
              Kategorije
            </div>
            <h2 className="text-3xl font-bold">Što tražiš?</h2>
          </div>
          <Link
            to="/properties"
            className="hidden md:flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black transition-colors"
          >
            Sve nekretnine <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {CATEGORIES.map((cat, i) => (
            <motion.div
              key={cat.type}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              viewport={{ once: true }}
            >
              <Link
                to={`/properties?propertyType=${cat.type}`}
                className="group block border border-border rounded p-6 hover:border-black transition-all hover:shadow-sm"
              >
                <cat.icon size={24} className="mb-4 text-gray-400 group-hover:text-accent transition-colors" />
                <h3 className="font-semibold text-black mb-1">{cat.label}</h3>
                <p className="text-xs text-gray-500">{cat.description}</p>
                <div className="mt-4 flex items-center gap-1 text-xs font-medium text-gray-400 group-hover:text-black transition-colors">
                  Pregledaj <ArrowRight size={12} />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────
   MAIN HOME PAGE
   ──────────────────────────────────────────── */
export default function HomePage() {
  const { isAuthenticated, isSeller, isBuyer } = useAuth()

  return (
    <div>
      {/* Hero — svi vide, ali različit sadržaj */}
      <HeroSection
        isAuthenticated={isAuthenticated}
        isSeller={isSeller}
        isBuyer={isBuyer}
      />

      {/* Stats — svi vide */}
      <section className="border-b border-border">
        <div className="container py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-black">{stat.value}</div>
                <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Role-specifični sadržaj */}
      {isSeller ? (
        // SELLER vidi brze akcije
        <SellerQuickActions />
      ) : (
        // BUYER i GOST vide kategorije
        <BuyerCategories />
      )}

      {/* CTA za registraciju — samo za GOSTE (neprijavljene) */}
      {!isAuthenticated && (
        <section className="bg-gray-100">
          <div className="container py-20">
            <div className="max-w-2xl mx-auto text-center">
              <div className="text-xs font-medium uppercase tracking-widest text-gray-400 mb-4">
                Pridruži se
              </div>
              <h2 className="text-3xl font-bold mb-4">Kupuješ ili prodaješ?</h2>
              <p className="text-gray-500 mb-8">
                Registriraj se besplatno i pristupi svim funkcionalnostima platforme.
              </p>
              <div className="flex gap-3 justify-center">
                <Link to="/auth/register" className="btn btn-primary btn-lg">
                  Registriraj se
                </Link>
                <Link to="/auth/login" className="btn btn-secondary btn-lg">
                  Prijavi se
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}