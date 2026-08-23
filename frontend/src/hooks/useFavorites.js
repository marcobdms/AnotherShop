import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const LOCAL_FAVORITES_KEY = 'anothernpcshop:favorites'
const FAVORITES_UPDATED_EVENT = 'favorites-updated'

function readLocalFavorites() {
  if (typeof window === 'undefined') return new Set()

  try {
    const raw = window.localStorage.getItem(LOCAL_FAVORITES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [])
  } catch (error) {
    console.warn('[useFavorites] No se pudieron leer favoritos locales:', error)
    return new Set()
  }
}

function writeLocalFavorites(favorites) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(
    LOCAL_FAVORITES_KEY,
    JSON.stringify([...favorites]),
  )
  window.dispatchEvent(new Event(FAVORITES_UPDATED_EVENT))
}

export function useFavorites(user) {
  const [favorites, setFavorites] = useState(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setFavorites(readLocalFavorites())
      setLoading(false)
      return
    }

    setLoading(true)
    supabase
      .from('favorites')
      .select('product_id')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (error) {
          console.error('[useFavorites] Error cargando favoritos:', error.message, error.details)
        } else if (data) {
          setFavorites(new Set(data.map(r => r.product_id)))
        }
      })
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (user || typeof window === 'undefined') return

    function syncLocalFavorites() {
      setFavorites(readLocalFavorites())
    }

    window.addEventListener('storage', syncLocalFavorites)
    window.addEventListener(FAVORITES_UPDATED_EVENT, syncLocalFavorites)
    return () => {
      window.removeEventListener('storage', syncLocalFavorites)
      window.removeEventListener(FAVORITES_UPDATED_EVENT, syncLocalFavorites)
    }
  }, [user])

  const isFavorite = useCallback(
    (productId) => favorites.has(productId),
    [favorites],
  )

  const toggleFavorite = useCallback(async (productId) => {
    if (!productId) return false

    const alreadyFav = favorites.has(productId)

    setFavorites(prev => {
      const next = new Set(prev)
      alreadyFav ? next.delete(productId) : next.add(productId)
      return next
    })

    if (!user) {
      const next = new Set(favorites)
      alreadyFav ? next.delete(productId) : next.add(productId)
      writeLocalFavorites(next)
      return !alreadyFav
    }

    if (alreadyFav) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId)

      if (error) {
        console.error('[useFavorites] Error al eliminar favorito:', error.message)
        setFavorites(prev => { const next = new Set(prev); next.add(productId); return next })
        return false
      }
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, product_id: productId })

      if (error) {
        console.error('[useFavorites] Error al insertar favorito:', error.message)
        setFavorites(prev => { const next = new Set(prev); next.delete(productId); return next })
        return false
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(FAVORITES_UPDATED_EVENT))
    }

    return !alreadyFav
  }, [user, favorites])

  return { favorites, loading, isFavorite, toggleFavorite }
}
