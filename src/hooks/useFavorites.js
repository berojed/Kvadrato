import { useState, useEffect, useCallback } from 'react'
import { getFavorites, addFavorite, removeFavorite } from '@/services/favorites'
import { useAuth } from '@/context/AuthContext'

export function useFavorites() {
  const { user, isAuthenticated, isBuyer } = useAuth()
  const [favorites, setFavorites] = useState([])
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchFavorites = useCallback(async () => {
    if (!isAuthenticated || !user) return

    setLoading(true)
    const { data, error: err } = await getFavorites(user.id)
    if (!err) {
      setFavorites(data)
      setFavoriteIds(new Set(data.map((f) => f.listing_id)))
    }
    setError(err?.message ?? null)
    setLoading(false)
  }, [user, isAuthenticated])

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  const toggleFavorite = useCallback(
    async (listingId) => {
      if (!isAuthenticated || !user || !isBuyer) return { error: 'Nedostupno' }

      const currentlyFav = favoriteIds.has(listingId)

      // Optimistic update.
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        if (currentlyFav) {
          next.delete(listingId)
        } else {
          next.add(listingId)
        }
        return next
      })

      let result
      if (currentlyFav) {
        result = await removeFavorite(user.id, listingId)
        if (result.error) {
          // Revert on error.
          setFavoriteIds((prev) => new Set([...prev, listingId]))
        } else {
          setFavorites((prev) => prev.filter((f) => f.listing_id !== listingId))
        }
      } else {
        result = await addFavorite(user.id, listingId)
        if (result.error) {
          // Revert on error.
          setFavoriteIds((prev) => {
            const next = new Set(prev)
            next.delete(listingId)
            return next
          })
        } else {
          fetchFavorites()
        }
      }

      return result
    },
    [user, isAuthenticated, isBuyer, favoriteIds, fetchFavorites]
  )

  return {
    favorites,
    favoriteIds,
    loading,
    error,
    toggleFavorite,
    isFavorite: (id) => favoriteIds.has(id),
    refetch: fetchFavorites,
  }
}
