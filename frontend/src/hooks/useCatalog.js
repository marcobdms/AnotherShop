/**
 * useCatalog.js — Hook de datos
 * Carga el catálogo completo una vez y lo cachea en memoria.
 * Los componentes consumen esto, no llaman fetch directamente.
 */

import { useState, useEffect } from 'react'
import { fetchCatalog } from '../api/catalog'

// Caché en módulo (persiste entre renders, se borra al recargar página)
let _cache = null

export function useCatalog() {
  const [catalog, setCatalog] = useState(_cache)
  const [loading, setLoading] = useState(!_cache)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (_cache) return  // ya tenemos datos

    fetchCatalog()
      .then(data => {
        _cache = data
        setCatalog(data)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { catalog, loading, error }
}
