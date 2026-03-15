import { useState, useEffect, useCallback } from 'react'
import { getFavorites, addFavorite, removeFavorite, isFavorite } from '@/services/favorites'
import { useAuth } from '@/context/AuthContext'

/**
 * Hook za upravljanje omiljenima
 */
export function useFavorites() {
  const { user, isAuthenticated } = useAuth()
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
      if (!isAuthenticated || !user) return { error: 'Morate se prijaviti' }

      const currentlyFav = favoriteIds.has(propertyId)

      // Optimistički update
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
          // Vrati na staro ako greška
          setFavoriteIds((prev) => new Set([...prev, propertyId]))
        } else {
          setFavorites((prev) => prev.filter((f) => f.listing_id !== propertyId))
        }
      } else {
        result = await addFavorite(user.id, propertyId)
        if (result.error) {
          // Vrati na staro ako greška
          setFavoriteIds((prev) => {
            const next = new Set(prev)
            next.delete(propertyId)
            return next
          })
        } else {
          fetchFavorites() // Refetch za ažurirane podatke
        }
      }

      return result
    },
    [user, isAuthenticated, favoriteIds, fetchFavorites]
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
