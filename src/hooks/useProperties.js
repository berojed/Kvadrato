import { useState, useEffect, useCallback } from 'react'
import { getListings } from '../services/properties'

const DEFAULT_FILTERS = {
  search: '',
  propertyType: '',
  listingType: '',
  minPrice: null,
  maxPrice: null,
  minBedrooms: null,
  stateRegion: '',
  city: '',
  sortBy: 'date_listed',
  sortOrder: 'desc',
}

/**
 * Hook za dohvaćanje i filtriranje nekretnina
 */
export function useProperties(initialFilters = {}) {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, ...initialFilters })

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
    setFilters(DEFAULT_FILTERS)
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
