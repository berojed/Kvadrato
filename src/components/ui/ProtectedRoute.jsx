import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

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
  const location = useLocation()

  // Dok se auth učitava, prikaži spinner
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
      </div>
    )
  }

  // Nije prijavljen → redirect na login
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  // Provjera role (ako je specificirana)
  if (role === 'SELLER' && !isSeller) {
    return (
      <div className="container py-24 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold mb-2">Pristup ograničen</h2>
        <p className="text-gray-500 mb-6">Ova stranica je dostupna samo prodavačima.</p>
        <a href="/" className="btn btn-secondary">← Početna</a>
      </div>
    )
  }

  if (role === 'BUYER' && !isBuyer) {
    return (
      <div className="container py-24 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold mb-2">Pristup ograničen</h2>
        <p className="text-gray-500 mb-6">Ova stranica je dostupna samo kupcima.</p>
        <a href="/" className="btn btn-secondary">← Početna</a>
      </div>
    )
  }

  return children
}