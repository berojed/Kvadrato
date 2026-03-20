import { useState, useRef, useEffect } from 'react'
import { getLocationSuggestions } from '@/lib/locationAutocomplete'
import { Link, useNavigate } from 'react-router-dom'
import { Search, ArrowRight, Home, Building2, Landmark, MapPin, Plus, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuth } from '@/context/AuthContext'

const CATEGORIES = [
  { type: 'Stan',             label: 'Stanovi',           icon: Building2, description: 'Moderni gradski stanovi' },
  { type: 'Kuća',             label: 'Kuće',              icon: Home,      description: 'Obiteljske kuće i vile' },
  { type: 'Poslovni prostor', label: 'Poslovni prostori', icon: Landmark,  description: 'Uredi i lokali' },
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
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchQuery(value)
    clearTimeout(debounceRef.current)
    if (value.trim().length >= 2) {
      debounceRef.current = setTimeout(async () => {
        const results = await getLocationSuggestions(value)
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
      }, 300)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion.label)
    setShowSuggestions(false)
    navigate(`/properties?search=${encodeURIComponent(suggestion.label)}`)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setShowSuggestions(false)
    navigate(`/properties${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}`)
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Background image with overlay */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2000&q=80"
          alt=""
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 via-gray-900/70 to-gray-900/90" />
      </div>

      <div className="container relative py-24 md:py-36">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="max-w-3xl"
        >
          {isSeller ? (
            <>
              <h1 className="text-5xl md:text-7xl font-bold leading-[1.08] text-white mb-6">
                Upravljaj<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-orange-400">svojim</span> oglasima.
              </h1>
              <p className="text-lg text-gray-300 mb-10 max-w-xl leading-relaxed font-light">
                Objavi nekretnine, prati preglede i upravljaj upitima kupaca — sve na jednom mjestu.
              </p>
              <div className="flex gap-3">
                <Link to="/seller/add" className="btn btn-primary btn-lg">
                  <Plus size={16} />
                  Dodaj nekretninu
                </Link>
                <Link to="/seller/dashboard" className="btn btn-ghost text-white border border-white/15 hover:bg-white/10 rounded-xl">
                  <BarChart3 size={16} />
                  Dashboard
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-5xl md:text-7xl font-bold leading-[1.08] text-white mb-6">
                Pronađi<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-orange-400">savršen</span> prostor.
              </h1>
              <p className="text-lg text-gray-300 mb-10 max-w-xl leading-relaxed font-light">
                Pregledaj tisuće nekretnina, filtriraj po željama i kontaktiraj prodavača direktno.
                Jednostavno, brzo, pouzdano.
              </p>

              <form onSubmit={handleSearch} className="flex gap-2 max-w-lg">
                <div className="flex-1 relative" ref={containerRef}>
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                  <input
                    type="text"
                    placeholder="Grad ili mjesto…"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    autoComplete="off"
                    className="w-full bg-white/10 backdrop-blur-md border border-white/15 text-white placeholder-gray-400 rounded-xl px-4 py-3.5 pl-11 outline-none focus:border-white/40 focus:bg-white/15 transition-all text-sm"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-soft-xl border border-gray-100 overflow-hidden z-50">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(s) }}
                          className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
                        >
                          <MapPin size={12} className="text-gray-400 flex-shrink-0" />
                          <span className="flex-1 truncate">{s.label}</span>
                          {s.sublabel && (
                            <span className="text-xs text-gray-400 flex-shrink-0">{s.sublabel}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn btn-primary rounded-xl px-6"
                >
                  Pretraži
                </motion.button>
              </form>
            </>
          )}
        </motion.div>
      </div>

      {/* Soft decorative glow */}
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
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
                className="group block border border-gray-100 rounded-2xl p-6 hover:border-gray-200 transition-all hover:shadow-soft-md bg-white"
              >
                <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center mb-4 group-hover:bg-orange-100 transition-colors">
                  <cat.icon size={22} className="text-accent" />
                </div>
                <h3 className="font-semibold text-black mb-1">{cat.label}</h3>
                <p className="text-xs text-gray-500 font-light">{cat.description}</p>
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-gray-400 group-hover:text-accent transition-colors">
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
      <section className="border-b border-gray-100">
        <div className="container py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-black tracking-tight">{stat.value}</div>
                <div className="text-xs text-gray-400 mt-1.5 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Role-specifični sadržaj */}
      {!isSeller && <BuyerCategories />}

      {/* CTA za registraciju — samo za GOSTE (neprijavljene) */}
      {!isAuthenticated && (
        <section className="bg-gradient-to-b from-gray-50 to-white">
          <div className="container py-24">
            <div className="max-w-2xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent mb-4 bg-orange-50 px-3 py-1.5 rounded-full">
                Pridruži se
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Kupuješ ili prodaješ?</h2>
              <p className="text-gray-500 mb-10 font-light text-lg">
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