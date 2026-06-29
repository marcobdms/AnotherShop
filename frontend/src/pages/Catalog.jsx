/**
 * Catalog.jsx — Página de catálogo
 *
 * Consume:
 *   GET /api/products  → lista minimal { id, nombre, precio, imagen, disponible }
 *   GET /api/filters   → { tallas, generos }
 *   GET /api/meta      → { marca, ... }
 */
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { fetchProducts, fetchFilters, fetchMeta } from '../api/catalog'
import { useAuth } from '../hooks/useAuth'
import { useFavorites } from '../hooks/useFavorites'
import ProductCard from '../components/ProductCard'
import FilterChips from '../components/FilterChips'
import Footer from '../components/Footer'

// Toast compartido (mismo que en Product.jsx)
function FavToast({ msg, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="fav-toast">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {msg}
    </div>
  )
}

export default function Catalog() {
  const [productos, setProductos] = useState([])
  const [filtros,   setFiltros]   = useState({ tallas: [], generos: [] })
  const [meta,      setMeta]      = useState({ marca: 'ANOTHER NPC SHOP' })
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [favToast,  setFavToast]  = useState(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const activeGenero = searchParams.get('genero')
  const activeTalla  = searchParams.get('talla')
  const [searchTerm, setSearchTerm] = useState('')
  const [showTopBtn, setShowTopBtn] = useState(false)

  const navigate = useNavigate()
  const { user } = useAuth()
  const { isFavorite, toggleFavorite } = useFavorites(user)

  const showFavToast = useCallback((msg) => {
    setFavToast({ msg, key: Date.now() })
  }, [])

  const setActiveGenero = (gen) => {
    const params = new URLSearchParams(searchParams)
    gen ? params.set('genero', gen) : params.delete('genero')
    setSearchParams(params, { replace: true })
  }

  const setActiveTalla = (talla) => {
    const params = new URLSearchParams(searchParams)
    talla ? params.set('talla', talla) : params.delete('talla')
    setSearchParams(params, { replace: true })
  }

  useEffect(() => {
    const handleScroll = () => {
      setShowTopBtn(window.scrollY > window.innerHeight / 2)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    Promise.all([fetchProducts(), fetchFilters(), fetchMeta()])
      .then(([prods, fils, met]) => {
        setProductos(prods)
        setFiltros(fils)
        setMeta(met)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleFavoriteClick = async (producto) => {
    if (!user) {
      navigate('/login')
      return
    }
    const wasAdded = await toggleFavorite(producto.id)
    showFavToast(wasAdded !== false ? 'Añadido a favoritos' : 'Eliminado de favoritos')
  }

  if (loading) return <div className="page-state"></div>
  if (error)   return <div className="page-state">error: {error}</div>

  // Filtrado por buscador, género y talla
  let lista = [...productos]

  if (searchTerm) {
    const term = searchTerm.toLowerCase()
    lista = lista.filter(p =>
      (p.id && p.id.toLowerCase().includes(term)) ||
      (p.nombre && p.nombre.toLowerCase().includes(term))
    )
  }

  if (activeGenero) {
    lista = lista.filter(p => p.genero === activeGenero || p.genero === 'unisex')
  }
  if (activeTalla) {
    lista = lista.filter(p => {
      const availableSizesText = (p.descripcion || '').toUpperCase()
      return new RegExp(`\\b${activeTalla}\\b`, 'i').test(availableSizesText)
    })
  }

  lista.sort((a, b) => {
    if (a.disponible === b.disponible) return 0
    return a.disponible ? -1 : 1
  })

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
          searchTerm={searchTerm}
          onSearch={setSearchTerm}
        />

        {lista.length > 0 ? (
          <div className="product-grid">
            {lista.map(p => (
              <ProductCard
                key={p.variante_color ? `${p.id}-${p.variante_color}` : p.id}
                producto={p}
                isFavorite={isFavorite(p.id)}
                onFavoriteClick={handleFavoriteClick}
              />
            ))}
          </div>
        ) : (
          <div className="no-results">
            <p>Sin resultados.</p>
            <button onClick={() => { setActiveGenero(null); setActiveTalla(null); setSearchTerm('') }}>
              Limpiar filtros
            </button>
          </div>
        )}

        <button
          className={`back-to-top ${showTopBtn ? 'visible' : ''}`}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Volver arriba"
        >
          ↑
        </button>
      </main>

      {/* Toast de favorito */}
      {favToast && (
        <FavToast
          key={favToast.key}
          msg={favToast.msg}
          onDone={() => setFavToast(null)}
        />
      )}

      <Footer marca={meta.marca} />
    </>
  )
}
