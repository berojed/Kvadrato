import { useFavorites } from '@/hooks/useFavorites'
import { useI18n } from '@/context/I18nContext'
import PropertyCard from '@/components/ui/PropertyCard'
import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'

export default function FavoritesPage() {
  const { favorites, loading, toggleFavorite, isFavorite } = useFavorites()
  const { t } = useI18n()

  const listings = favorites.map((f) => f.listing).filter(Boolean)

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">{t('favorites.title')}</h1>
        <p className="text-sm text-gray-500">
          {t('favorites.count', { count: listings.length })}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="spinner" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-24">
          <Heart size={40} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold mb-2">{t('favorites.empty')}</h3>
          <p className="text-sm text-gray-500 mb-6">
            {t('favorites.emptyHint')}
          </p>
          <Link to="/properties" className="btn btn-primary">
            {t('favorites.browse')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {listings.map((listing) => (
            <PropertyCard
              key={listing.listing_id}
              listing={listing}
              linkPrefix="/favorites"
              onToggleFavorite={toggleFavorite}
              isFavorited={isFavorite(listing.listing_id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
