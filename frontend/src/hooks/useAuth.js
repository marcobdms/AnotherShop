/**
 * useAuth.js — Hook de sesión de Supabase
 * Expone: { user, loading, signIn, signUp, signOut }
 * user es null si no hay sesión activa.
 */
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Sesión inicial (recarga de página)
    supabase.auth.getSession().then(({ data: { session } }) => {
      const next = session?.user ?? null
      setUser(prev => (prev && next && prev.id === next.id ? prev : next))
      setLoading(false)
    })

    // Escucha cambios de sesión (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // Al volver a la pestana Supabase re-emite la sesion con un objeto `user`
        // nuevo aunque sea la misma persona. Se conserva la referencia anterior
        // para no relanzar la carga de favoritos y el resumen no parpadee.
        const next = session?.user ?? null
        setUser(prev => (prev && next && prev.id === next.id ? prev : next))
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }

  async function signUp(email, password) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { user, loading, signIn, signUp, signOut }
}
