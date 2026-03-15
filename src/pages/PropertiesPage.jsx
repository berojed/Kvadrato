import { useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useProperties } from '@/hooks/useProperties'
import { useFavorites } from '@/hooks/useFavorites'
import PropertyCard from '@/components/ui/PropertyCard'
import PropertyFilters from '@/components/ui/PropertyFilters'

export default function PropertiesPage() {
  const [searchParams] = useSearchParams()

  const initialFilters = {
    search: searchParams.get('search') ?? '',
    propertyType: searchParams.get('propertyType') ?? '',
  }

  const {
    properties,
    loading,
    error,
    totalCount,
    hasMore,
    filters,
    updateFilters,
    resetFilters,
    loadMore,
  } = useProperties(initialFilters)

  const { toggleFavorite, isFavorite } = useFavorites()

  // Sync URL params na mount
  useEffect(() => {
    const search = searchParams.get('search')
    const propertyType = searchParams.get('propertyType')
    if (search || propertyType) {
      updateFilters({
        search: search ?? '',
        propertyType: propertyType ?? '',
      })
    }
  }, [])

  return (
    <div className="container py-10">
      {/* Page title */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Nekretnine</h1>
        <p className="text-sm text-gray-500">
          Pregledaj i filtriraj dostupne nekretnine
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8">
        <PropertyFilters
          filters={filters}
          onFiltersChange={updateFilters}
          onReset={resetFilters}
          totalCount={totalCount}
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-6">
          Greška pri dohvaćanju nekretnina: {error}
        </div>
      )}

      {/* Grid */}
      {loading && properties.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <div className="spinner" />
        </div>
      ) : properties.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-4xl mb-4">🏠</div>
          <h3 className="text-lg font-semibold mb-2">Nema rezultata</h3>
          <p className="text-sm text-gray-500 mb-6">
            Pokušaj promijeniti filtere ili pretragu
          </p>
          <button onClick={resetFilters} className="btn btn-secondary">
            Resetiraj filtere
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {properties.map((listing) => (
              <PropertyCard
                key={listing.listing_id}
                listing={listing}
                onToggleFavorite={toggleFavorite}
                isFavorited={isFavorite(listing.listing_id)}
              />
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="text-center mt-10">
              <button
                onClick={loadMore}
                disabled={loading}
                className="btn btn-secondary"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Učitavanje…
                  </>
                ) : (
                  'Učitaj još'
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
