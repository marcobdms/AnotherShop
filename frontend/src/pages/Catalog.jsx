/**
 * Catalog.jsx — Página de catálogo
 *
 * Consume:
 *   GET /api/products  → lista minimal { id, nombre, precio, imagen, disponible }
 *   GET /api/filters   → { tallas, generos }
 *   GET /api/meta      → { marca, ... }
 */
import { useState, useEffect } from 'react'
import { fetchProducts, fetchFilters, fetchMeta } from '../api/catalog'
import ProductCard from '../components/ProductCard'
import FilterChips from '../components/FilterChips'
import Footer from '../components/Footer'

export default function Catalog() {
  const [productos, setProductos] = useState([])
  const [filtros,   setFiltros]   = useState({ tallas: [], generos: [] })
  const [meta,      setMeta]      = useState({ marca: 'ANOTHER NPC SHOP' })
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  const [activeGenero, setActiveGenero] = useState(null)
  const [activeTalla,  setActiveTalla]  = useState(null)

  useEffect(() => {
    // Los tres fetch en paralelo — no bloqueamos uno por el otro
    Promise.all([fetchProducts(), fetchFilters(), fetchMeta()])
      .then(([prods, fils, met]) => {
        setProductos(prods)
        setFiltros(fils)
        setMeta(met)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page-state">cargando.</div>
  if (error)   return <div className="page-state">error: {error}</div>

  // Filtrado en cliente (rápido, sin llamada extra al backend)
  let lista = productos
  if (activeGenero) {
    lista = lista.filter(p => p.genero === activeGenero || p.genero === 'unisex')
  }
  if (activeTalla) {
    lista = lista.filter(p => p.tallas?.includes(activeTalla))
  }

  return (
    <>
      <main className="catalog-page">
        <FilterChips
          generos={filtros.generos}
          tallas={filtros.tallas}
          activeGenero={activeGenero}
          activeTalla={activeTalla}
          onGenero={setActiveGenero}
          onTalla={setActiveTalla}
        />

        {lista.length > 0 ? (
          <div className="product-grid">
            {lista.map(p => (
              <ProductCard key={p.id} producto={p} />
            ))}
          </div>
        ) : (
          <div className="no-results">
            <p>Sin resultados.</p>
            <button onClick={() => { setActiveGenero(null); setActiveTalla(null) }}>
              Limpiar filtros
            </button>
          </div>
        )}
      </main>
      <Footer marca={meta.marca} />
    </>
  )
}
