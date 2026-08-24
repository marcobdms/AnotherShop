/**
 * Catalog.jsx — Página de catálogo
 *
 * Consume el catálogo compartido por useCatalog:
 *   GET /api/catalog → { productos, filtros, meta }
 */
import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFavorites } from '../hooks/useFavorites'
import { useCatalog } from '../hooks/useCatalog'
import ProductCard from '../components/ProductCard'
import FilterChips from '../components/FilterChips'
import Footer from '../components/Footer'
import { getProductBrandLabel } from '../utils/brand'

function hasSize(producto, tallaSeleccionada) {
  const talla = String(tallaSeleccionada).trim().toUpperCase()
  const tallas = producto.variante_tallas && typeof producto.variante_tallas === 'object'
    ? Object.keys(producto.variante_tallas)
    : (producto.tallas || [])

  return tallas.some((valor) => String(valor).trim().toUpperCase() === talla)
}

export default function Catalog({ onReady }) {
  const { catalog, loading, error } = useCatalog()
  const productos = catalog?.productos ?? []
  const filtros = catalog?.filtros ?? { tallas: [], generos: [] }
  const meta = catalog?.meta ?? { marca: 'ANOTHER NPC SHOP' }
  const [favToast,  setFavToast]  = useState(null)
  // Leemos el valor una vez: así no se pierde antes de restaurar el scroll.
  const savedScroll = useRef(sessionStorage.getItem('catalog-scroll'))
  const didRestoreScroll = useRef(false)
  const noFade = savedScroll.current !== null

  const [searchParams, setSearchParams] = useSearchParams()
  const activeGenero = searchParams.get('genero')
  const activeTalla  = searchParams.get('talla')
  const [searchTerm, setSearchTerm] = useState('')
  const [showTopBtn, setShowTopBtn] = useState(false)

  const { user } = useAuth()
  const { isFavorite, toggleFavorite } = useFavorites(user)

  const showFavToast = useCallback((msg) => {
    setFavToast({ msg, key: Date.now() })
  }, [])

  useEffect(() => {
    if (!favToast) return
    const t = setTimeout(() => setFavToast(null), 2200)
    return () => clearTimeout(t)
  }, [favToast])

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

  // La restauración ocurre antes de pintar el grid; de esta forma nunca se ve
  // el salto al scroll guardado. Avisamos al layout después para revelar toda
  // la ruta (nav, cinta y catálogo) en el mismo frame.
  useLayoutEffect(() => {
    if (loading || didRestoreScroll.current) return

    didRestoreScroll.current = true

    if (savedScroll.current !== null) {
      window.scrollTo({ top: Number(savedScroll.current), behavior: 'auto' })
      sessionStorage.removeItem('catalog-scroll')
      onReady?.()
    }
  }, [loading, onReady])

  const handleFavoriteClick = async (producto) => {
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
      (p.ref && p.ref.toLowerCase().includes(term)) ||
      (p.nombre && p.nombre.toLowerCase().includes(term)) ||
      getProductBrandLabel(p).toLowerCase().includes(term)
    )
  }

  if (activeGenero) {
    lista = lista.filter(p => p.genero === activeGenero || p.genero === 'unisex')
  }
  if (activeTalla) {
    lista = lista.filter((producto) => hasSize(producto, activeTalla))
  }

  lista.sort((a, b) => {
    if (a.disponible === b.disponible) return 0
    return a.disponible ? -1 : 1
  })

  return (
    <>
      <main className={`catalog-page${noFade ? ' catalog-page--no-fade' : ''}`} id="catalogo">
        <section className="catalog-heading" aria-labelledby="catalog-title">
          <h1 id="catalog-title">Catalogo</h1>
          <p>Piezas seleccionadas. Esenciales para todos los dias.</p>
        </section>

        <div className="catalog-layout">
          <FilterChips
            generos={filtros.generos}
            tallas={filtros.tallas}
            activeGenero={activeGenero}
            activeTalla={activeTalla}
            onGenero={setActiveGenero}
            onTalla={setActiveTalla}
            searchTerm={searchTerm}
            onSearch={setSearchTerm}
            productCount={lista.length}
            showTopButton={showTopBtn}
            onBackToTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            notchMessage={favToast?.msg || ''}
          />

          <div className="catalog-main">
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
          </div>
        </div>

      </main>

      <Footer marca={meta.marca} />
    </>
  )
}
