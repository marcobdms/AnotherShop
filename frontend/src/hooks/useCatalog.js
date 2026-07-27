/**
 * useCatalog.js — Hook de datos
 * Carga el catálogo completo una vez y lo cachea en memoria.
 * Los componentes consumen esto, no llaman fetch directamente.
 */

import { useState, useEffect } from 'react'
import { fetchCatalog } from '../api/catalog'

// Caché en módulo (persiste entre renders, se borra al recargar página).
// La promesa también se comparte para que los componentes que montan a la vez
// no disparen varias peticiones al mismo catálogo.
let _cache = null
let _request = null

export function useCatalog() {
  const [catalog, setCatalog] = useState(_cache)
  const [loading, setLoading] = useState(!_cache)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (_cache) return  // ya tenemos datos

    if (!_request) {
      _request = fetchCatalog()
        .then(data => {
          _cache = data
          return data
        })
        .catch(err => {
          // Permite reintentar la carga si la petición falló.
          _request = null
          throw err
        })
    }

    _request
      .then(data => {
        setCatalog(data)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { catalog, loading, error }
}
