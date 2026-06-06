/**
 * useFavorites.js — Hook de favoritos del usuario
 * Requiere sesión activa. Sin sesión, todas las operaciones son no-op.
 * Expone: { favorites, loading, isFavorite, toggleFavorite }
 *   favorites  → Set<string> de product_ids
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useFavorites(user) {
  const [favorites, setFavorites] = useState(new Set())
  const [loading, setLoading]     = useState(false)

  // Carga favoritos cuando hay sesión
  useEffect(() => {
    if (!user) {
      setFavorites(new Set())
      return
    }

    setLoading(true)
    supabase
      .from('favorites')
      .select('product_id')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (!error && data) {
          setFavorites(new Set(data.map(r => r.product_id)))
        }
      })
      .finally(() => setLoading(false))
  }, [user])

  const isFavorite = useCallback(
    (productId) => favorites.has(productId),
    [favorites]
  )

  const toggleFavorite = useCallback(async (productId) => {
    if (!user) return false  // sin sesión: el componente debe redirigir a /login

    const alreadyFav = favorites.has(productId)

    // Optimistic update
    setFavorites(prev => {
      const next = new Set(prev)
      alreadyFav ? next.delete(productId) : next.add(productId)
      return next
    })

    if (alreadyFav) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId)

      if (error) {
        // Revertir si falla
        setFavorites(prev => { const next = new Set(prev); next.add(productId); return next })
      }
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, product_id: productId })

      if (error) {
        setFavorites(prev => { const next = new Set(prev); next.delete(productId); return next })
      }
    }

    return !alreadyFav
  }, [user, favorites])

  return { favorites, loading, isFavorite, toggleFavorite }
}
