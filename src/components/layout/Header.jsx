import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Menu, X, Heart, User, LogOut, Home, Plus, LayoutDashboard, Calendar, Settings } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

export default function Header() {
  const { user, profile, isAuthenticated, isSeller, isBuyer, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const handleSignOut = async (e) => {
    e?.stopPropagation()
    setUserMenuOpen(false)
    setMobileOpen(false)
    try {
      await signOut()
      navigate('/')
    } catch (err) {
      console.error('signOut greška:', err)
    }
  }

  // Dinamički linkovi ovisno o roli
  const navLinks = [
    { to: '/properties', label: 'Nekretnine' },
    { to: '/favorites', label: 'Omiljene', buyerOnly: true },
    { to: '/my-viewings', label: 'Moja razgledavanja', buyerOnly: true },
    { to: '/seller/dashboard', label: 'Moji oglasi', sellerOnly: true },
  ]

  const displayName =
    profile?.first_name
      ? `${profile.first_name} ${profile.last_name || ''}`.trim()
      : user?.email?.split('@')[0]

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border">
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-semibold text-xl tracking-tight">
            <div className="w-7 h-7 bg-black rounded-sm flex items-center justify-center">
              <span className="text-white text-xs font-bold">K</span>
            </div>
            <span>Kvadrato</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => {
              if (link.buyerOnly && (!isAuthenticated || !isBuyer)) return null
              if (link.sellerOnly && (!isAuthenticated || !isSeller)) return null
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    cn(
                      'text-sm font-medium transition-colors',
                      isActive ? 'text-black' : 'text-gray-500 hover:text-black'
                    )
                  }
                >
                  {link.label}
                </NavLink>
              )
            })}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {/* Samo seller vidi "Dodaj oglas" */}
                {isSeller && (
                  <Link to="/seller/add" className="btn btn-secondary btn-sm">
                    <Plus size={14} />
                    Dodaj oglas
                  </Link>
                )}

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-black transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <User size={14} />
                    </div>
                    <span className="hidden lg:block max-w-[120px] truncate">
                      {displayName}
                    </span>
                    {/* Role badge */}
                    <span
                      className={cn(
                        'hidden lg:inline-block text-[10px] font-medium px-1.5 py-0.5 rounded',
                        isSeller
                          ? 'bg-orange-50 text-orange-600'
                          : 'bg-blue-50 text-blue-600'
                      )}
                    >
                      {isSeller ? 'Prodavač' : 'Kupac'}
                    </span>
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-border rounded shadow-lg py-1 z-50">
                      <div className="px-4 py-2 border-b border-border">
                        <div className="text-sm font-medium truncate">{displayName}</div>
                        <div className="text-xs text-gray-400 truncate">{user?.email}</div>
                      </div>

                      <Link
                        to="/profile"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <User size={14} />
                        Profil
                      </Link>

                      <Link
                        to="/settings"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Settings size={14} />
                        Postavke
                      </Link>

                      {isSeller && (
                        <>
                          <Link
                            to="/seller/dashboard"
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <LayoutDashboard size={14} />
                            Dashboard
                          </Link>
                          <Link
                            to="/seller/add"
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <Home size={14} />
                            Dodaj nekretninu
                          </Link>
                        </>
                      )}

                      <div className="divider my-1" />
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut size={14} />
                        Odjava
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/auth/login" className="btn btn-ghost btn-sm">
                  Prijava
                </Link>
                <Link to="/auth/register" className="btn btn-primary btn-sm">
                  Registracija
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-gray-700"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border py-4 space-y-1">
            <Link
              to="/properties"
              className="block px-2 py-2.5 text-sm font-medium text-gray-700 hover:text-black"
              onClick={() => setMobileOpen(false)}
            >
              Nekretnine
            </Link>

            {isAuthenticated && isBuyer && (
              <>
                <Link
                  to="/favorites"
                  className="block px-2 py-2.5 text-sm font-medium text-gray-700 hover:text-black"
                  onClick={() => setMobileOpen(false)}
                >
                  Omiljene
                </Link>
                <Link
                  to="/my-viewings"
                  className="block px-2 py-2.5 text-sm font-medium text-gray-700 hover:text-black"
                  onClick={() => setMobileOpen(false)}
                >
                  Moja razgledavanja
                </Link>
              </>
            )}

            {isAuthenticated && isSeller && (
              <>
                <Link
                  to="/seller/dashboard"
                  className="block px-2 py-2.5 text-sm font-medium text-gray-700 hover:text-black"
                  onClick={() => setMobileOpen(false)}
                >
                  Moji oglasi
                </Link>
                <Link
                  to="/seller/add"
                  className="block px-2 py-2.5 text-sm font-medium text-gray-700 hover:text-black"
                  onClick={() => setMobileOpen(false)}
                >
                  Dodaj nekretninu
                </Link>
              </>
            )}

            {isAuthenticated && (
              <>
                <Link
                  to="/profile"
                  className="block px-2 py-2.5 text-sm font-medium text-gray-700 hover:text-black"
                  onClick={() => setMobileOpen(false)}
                >
                  Profil
                </Link>
                <button
                  onClick={handleSignOut}
                  className="block w-full text-left px-2 py-2.5 text-sm font-medium text-red-600"
                >
                  Odjava
                </button>
              </>
            )}

            {!isAuthenticated && (
              <div className="flex gap-2 pt-2">
                <Link
                  to="/auth/login"
                  className="btn btn-secondary btn-sm flex-1 text-center"
                  onClick={() => setMobileOpen(false)}
                >
                  Prijava
                </Link>
                <Link
                  to="/auth/register"
                  className="btn btn-primary btn-sm flex-1 text-center"
                  onClick={() => setMobileOpen(false)}
                >
                  Registracija
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Overlay za zatvaranje user menua */}
      {userMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
      )}
    </header>
  )
}