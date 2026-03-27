import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Menu, X, User, LogOut, Settings } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { cn } from '@/lib/utils'

export default function Header() {
  const { user, profile, isAuthenticated, isSeller, isBuyer, signOut } = useAuth()
  const { t } = useI18n()
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
      if (import.meta.env.DEV) console.error('signOut error:', err)
    }
  }

  const navLinks = [
    { to: '/properties', label: t('nav.properties'), authRequired: true },
    { to: '/favorites', label: t('nav.favorites'), buyerOnly: true },
    { to: '/my-viewings', label: t('nav.myViewings'), buyerOnly: true },
    { to: '/seller/dashboard', label: t('nav.myListings'), sellerOnly: true },
    { to: '/seller/viewings', label: t('nav.viewings'), sellerOnly: true },
  ]

  const displayName =
    profile?.first_name
      ? `${profile.first_name} ${profile.last_name || ''}`.trim()
      : user?.email?.split('@')[0]

  const profileLink = isSeller ? '/seller/profile' : '/profile'
  const settingsLink = isSeller ? '/seller/settings' : '/settings'

  return (
    <header className="sticky top-0 z-50 bg-[var(--color-background)]/80 backdrop-blur-xl border-b border-[var(--color-border)]">
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 font-bold text-xl tracking-tight">
            <div className="w-8 h-8 bg-gradient-to-br from-accent to-orange-500 rounded-lg flex items-center justify-center shadow-soft-sm">
              <span className="text-white text-sm font-bold">K</span>
            </div>
            <span>Kvadrato</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => {
              if (link.authRequired && !isAuthenticated) return null
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
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-black transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center">
                    <User size={14} className="text-gray-500" />
                  </div>
                  <span className="hidden lg:block max-w-[120px] truncate">
                    {displayName}
                  </span>
                  <span
                    className={cn(
                      'hidden lg:inline-block text-[10px] font-medium px-1.5 py-0.5 rounded',
                      isSeller
                        ? 'bg-orange-50 text-orange-600'
                        : 'bg-blue-50 text-blue-600'
                    )}
                  >
                    {isSeller ? t('roles.seller') : t('roles.buyer')}
                  </span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl shadow-soft-lg py-1.5 z-50">
                    <div className="px-4 py-2.5 border-b border-[var(--color-border)]">
                      <div className="text-sm font-semibold truncate">{displayName}</div>
                      <div className="text-xs text-gray-400 truncate">{user?.email}</div>
                    </div>

                    <Link
                      to={profileLink}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <User size={14} />
                      {t('nav.profile')}
                    </Link>

                    <Link
                      to={settingsLink}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Settings size={14} />
                      {t('nav.settings')}
                    </Link>

                    <div className="divider my-1" />
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={14} />
                      {t('nav.signOut')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/auth/login" className="btn btn-ghost btn-sm">
                  {t('nav.signIn')}
                </Link>
                <Link to="/auth/register" className="btn btn-primary btn-sm">
                  {t('nav.register')}
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
            {isAuthenticated && (
              <Link
                to="/properties"
                className="block px-2 py-2.5 text-sm font-medium text-gray-700 hover:text-black"
                onClick={() => setMobileOpen(false)}
              >
                {t('nav.properties')}
              </Link>
            )}

            {isAuthenticated && isBuyer && (
              <>
                <Link
                  to="/favorites"
                  className="block px-2 py-2.5 text-sm font-medium text-gray-700 hover:text-black"
                  onClick={() => setMobileOpen(false)}
                >
                  {t('nav.favorites')}
                </Link>
                <Link
                  to="/my-viewings"
                  className="block px-2 py-2.5 text-sm font-medium text-gray-700 hover:text-black"
                  onClick={() => setMobileOpen(false)}
                >
                  {t('nav.myViewings')}
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
                  {t('nav.myListings')}
                </Link>
                <Link
                  to="/seller/viewings"
                  className="block px-2 py-2.5 text-sm font-medium text-gray-700 hover:text-black"
                  onClick={() => setMobileOpen(false)}
                >
                  {t('nav.viewings')}
                </Link>
              </>
            )}

            {isAuthenticated && (
              <>
                <Link
                  to={profileLink}
                  className="block px-2 py-2.5 text-sm font-medium text-gray-700 hover:text-black"
                  onClick={() => setMobileOpen(false)}
                >
                  {t('nav.profile')}
                </Link>
                <button
                  onClick={handleSignOut}
                  className="block w-full text-left px-2 py-2.5 text-sm font-medium text-red-600"
                >
                  {t('nav.signOut')}
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
                  {t('nav.signIn')}
                </Link>
                <Link
                  to="/auth/register"
                  className="btn btn-primary btn-sm flex-1 text-center"
                  onClick={() => setMobileOpen(false)}
                >
                  {t('nav.register')}
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {userMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
      )}
    </header>
  )
}
