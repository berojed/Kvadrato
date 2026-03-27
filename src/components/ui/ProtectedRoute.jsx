import { Navigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'

/**
 * Zaštita ruta po autentifikaciji i roli.
 *
 * Primjeri korištenja:
 *   <ProtectedRoute>              – samo prijavljeni korisnici
 *   <ProtectedRoute role="BUYER"> – samo kupci
 *   <ProtectedRoute role="SELLER"> – samo prodavači
 */
export default function ProtectedRoute({ children, role }) {
  const { isAuthenticated, loading, profile, isSeller, isBuyer } = useAuth()
  const { t } = useI18n()
  const location = useLocation()

  // Dok se auth učitava, prikaži spinner
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
      </div>
    )
  }

  // Nije prijavljen → redirect na početnu stranicu
  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  // Missing profile/role — data integrity issue, not a normal role mismatch
  if (role && !profile) {
    return (
      <div className="container py-24 text-center">
        <h2 className="text-xl font-bold mb-2">{t('errors.profileNotFound')}</h2>
        <p className="text-gray-500 mb-6">{t('errors.profileNotFoundDesc')}</p>
        <Link to="/auth/login" className="btn btn-secondary">{t('nav.signIn')}</Link>
      </div>
    )
  }

  // Provjera role (ako je specificirana)
  if (role === 'SELLER' && !isSeller) {
    return (
      <div className="container py-24 text-center">
        <h2 className="text-xl font-bold mb-2">{t('errors.accessRestricted')}</h2>
        <p className="text-gray-500 mb-6">{t('errors.sellerOnly')}</p>
        <Link to="/" className="btn btn-secondary">{t('nav.home')}</Link>
      </div>
    )
  }

  if (role === 'BUYER' && !isBuyer) {
    return (
      <div className="container py-24 text-center">
        <h2 className="text-xl font-bold mb-2">{t('errors.accessRestricted')}</h2>
        <p className="text-gray-500 mb-6">{t('errors.buyerOnly')}</p>
        <Link to="/" className="btn btn-secondary">{t('nav.home')}</Link>
      </div>
    )
  }

  return children
}