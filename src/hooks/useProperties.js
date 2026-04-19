import { useState, useEffect, useCallback } from 'react'
import { getListings } from '../services/properties'

export const DEFAULT_PROPERTY_FILTERS = {
  search: '',
  propertyType: '',
  listingType: '',
  minPrice: null,
  maxPrice: null,
  minBedrooms: null,
  minBathrooms: null,
  minSize: null,
  maxSize: null,
  stateRegion: '',
  city: '',
  sortBy: 'date_listed',
  sortOrder: 'desc',
}

/**
 * Hook for fetching and filtering properties with pagination and error handling.
 */
export function useProperties(initialFilters = {}) {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [filters, setFilters] = useState({ ...DEFAULT_PROPERTY_FILTERS, ...initialFilters })

  const pageSize = 12

  const fetchProperties = useCallback(
    async (currentPage = 0, currentFilters = filters) => {
      setLoading(true)
      setError(null)

      const { data, error: err, totalCount: count, hasMore: more } = await getListings({
        ...currentFilters,
        page: currentPage,
        pageSize,
      })

      if (err) {
        setError(err.message)
      } else {
        if (currentPage === 0) {
          setProperties(data)
        } else {
          setProperties((prev) => [...prev, ...data])
        }
        setTotalCount(count)
        setHasMore(more)
      }

      setLoading(false)
    },
    [filters]
  )

  useEffect(() => {
    setPage(0)
    fetchProperties(0, filters)
  }, [filters])

  const updateFilters = useCallback((newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_PROPERTY_FILTERS)
  }, [])

  const loadMore = useCallback(() => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchProperties(nextPage, filters)
  }, [page, filters, fetchProperties])

  return {
    properties,
    loading,
    error,
    totalCount,
    hasMore,
    filters,
    updateFilters,
    resetFilters,
    loadMore,
    refetch: () => fetchProperties(0, filters),
  }
}
