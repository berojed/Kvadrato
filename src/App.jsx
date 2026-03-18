import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ProtectedRoute from '@/components/ui/ProtectedRoute'

// Pages
import HomePage from '@/pages/HomePage'
import PropertiesPage from '@/pages/PropertiesPage'
import PropertyDetailPage from '@/pages/PropertyDetailPage'
import FavoritesPage from '@/pages/FavoritesPage'
import MyViewingsPage from '@/pages/MyViewingsPage'
import ProfilePage from '@/pages/ProfilePage'
import SettingsPage from '@/pages/SettingsPage'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'

// Seller pages
import SellerDashboardPage from '@/pages/seller/SellerDashboardPage'
import SellerProfilePage from '@/pages/seller/SellerProfilePage'
import SellerSettingsPage from '@/pages/seller/SellerSettingsPage'
import SellerViewingsPage from '@/pages/seller/SellerViewingsPage'
import AddPropertyPage from '@/pages/seller/AddPropertyPage'

// 404
function NotFoundPage() {
  return (
    <div className="container py-24 text-center">
      <div className="text-5xl font-bold mb-4">404</div>
      <p className="text-gray-500 mb-6">Stranica nije pronađena.</p>
      <Link to="/" className="btn btn-secondary">← Početna</Link>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-1">
            <Routes>
              {/* Javne rute */}
              <Route path="/" element={<HomePage />} />
              <Route path="/properties" element={<PropertiesPage />} />
              <Route path="/properties/:id" element={<PropertyDetailPage />} />
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/register" element={<RegisterPage />} />

              {/* Zaštićene rute – bilo koji prijavljeni korisnik */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />

              {/* Samo BUYER */}
              <Route
                path="/favorites"
                element={
                  <ProtectedRoute role="BUYER">
                    <FavoritesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/favorites/:id"
                element={
                  <ProtectedRoute role="BUYER">
                    <PropertyDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-viewings"
                element={
                  <ProtectedRoute role="BUYER">
                    <MyViewingsPage />
                  </ProtectedRoute>
                }
              />

              {/* Samo SELLER */}
              <Route
                path="/seller/dashboard"
                element={
                  <ProtectedRoute role="SELLER">
                    <SellerDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/seller/profile"
                element={
                  <ProtectedRoute role="SELLER">
                    <SellerProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/seller/settings"
                element={
                  <ProtectedRoute role="SELLER">
                    <SellerSettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/seller/viewings"
                element={
                  <ProtectedRoute role="SELLER">
                    <SellerViewingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/seller/add"
                element={
                  <ProtectedRoute role="SELLER">
                    <AddPropertyPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/seller/edit/:id"
                element={
                  <ProtectedRoute role="SELLER">
                    <AddPropertyPage />
                  </ProtectedRoute>
                }
              />

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}