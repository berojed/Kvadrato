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
    async (propertyId) => {
      if (!isAuthenticated || !user || !isBuyer) return { error: 'Nedostupno' }

      const currentlyFav = favoriteIds.has(propertyId)

      // Optimistic update.
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        if (currentlyFav) {
          next.delete(propertyId)
        } else {
          next.add(propertyId)
        }
        return next
      })

      let result
      if (currentlyFav) {
        result = await removeFavorite(user.id, propertyId)
        if (result.error) {
          // Revert on error.
          setFavoriteIds((prev) => new Set([...prev, propertyId]))
        } else {
          setFavorites((prev) => prev.filter((f) => f.listing_id !== propertyId))
        }
      } else {
        result = await addFavorite(user.id, propertyId)
        if (result.error) {
          // Revert on error.
          setFavoriteIds((prev) => {
            const next = new Set(prev)
            next.delete(propertyId)
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
