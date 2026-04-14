import { useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useProperties } from '@/hooks/useProperties'
import { useFavorites } from '@/hooks/useFavorites'
import { useI18n } from '@/context/I18nContext'
import PropertyCard from '@/components/ui/PropertyCard'
import PropertyFilters, { PropertySearchBar } from '@/components/ui/PropertyFilters'

export default function PropertiesPage() {
  const { t } = useI18n()
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

  // Sync URL params on mount and whenever searchParams change
  useEffect(() => {
    const search = searchParams.get('search') ?? ''
    const propertyType = searchParams.get('propertyType') ?? ''
    updateFilters({ search, propertyType })
  }, [searchParams])

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">{t('property.title')}</h1>
        <p className="text-sm text-gray-500">
          {t('property.subtitle')}
        </p>
      </div>

      <div className="mb-6">
        <PropertySearchBar filters={filters} onFiltersChange={updateFilters} />
      </div>

      <div className="flex gap-8">
        <aside className="hidden md:block w-56 flex-shrink-0">
          <div className="sticky top-24">
            <PropertyFilters
              filters={filters}
              onFiltersChange={updateFilters}
              onReset={resetFilters}
              totalCount={totalCount}
            />
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <details className="md:hidden mb-6 card p-4">
            <summary className="text-sm font-medium cursor-pointer select-none">
              {t('property.filters')}
            </summary>
            <div className="mt-4">
              <PropertyFilters
                filters={filters}
                onFiltersChange={updateFilters}
                onReset={resetFilters}
                totalCount={totalCount}
              />
            </div>
          </details>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-6">
              {t('property.errorFetching')}: {error}
            </div>
          )}

          {loading && properties.length === 0 ? (
            <div className="flex items-center justify-center py-24">
              <div className="spinner" />
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-24">
              <h3 className="text-lg font-semibold mb-2">{t('property.noResults')}</h3>
              <p className="text-sm text-gray-500 mb-6">
                {t('property.noResultsHint')}
              </p>
              <button onClick={resetFilters} className="btn btn-secondary">
                {t('property.resetFilters')}
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {properties.map((listing) => (
                  <PropertyCard
                    key={listing.listing_id}
                    listing={listing}
                    onToggleFavorite={toggleFavorite}
                    isFavorited={isFavorite(listing.listing_id)}
                  />
                ))}
              </div>

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
                        {t('property.loadingMore')}
                      </>
                    ) : (
                      t('property.loadMore')
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
