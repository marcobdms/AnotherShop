/**
 * Catalog.jsx — Página de catálogo
 *
 * Consume el catálogo compartido por useCatalog:
 *   GET /api/catalog → { productos, filtros, meta }
 */
import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFavorites } from '../hooks/useFavorites'
import { useCatalog } from '../hooks/useCatalog'
import ProductCard from '../components/ProductCard'
import FilterChips from '../components/FilterChips'
import Footer from '../components/Footer'
import { getProductBrandLabel } from '../utils/brand'
import { mezclar } from '../utils/shuffle'

function hasSize(producto, tallaSeleccionada) {
  const talla = String(tallaSeleccionada).trim().toUpperCase()
  const tallas = producto.variante_tallas && typeof producto.variante_tallas === 'object'
    ? Object.keys(producto.variante_tallas)
    : (producto.tallas || [])

  return tallas.some((valor) => String(valor).trim().toUpperCase() === talla)
}

const BRAND_ORDER = ['MNG', 'A&F', 'HCO', 'LFTS', 'P&B', 'ZARA']

const SORT_OPTIONS = [
  { value: 'relevancia', label: 'Mejor coincidencia' },
  { value: 'nuevo', label: 'Lo más nuevo' },
]
const DEFAULT_SORT = SORT_OPTIONS[0].value

function dropNumber(producto) {
  const match = String(producto.drop || '').match(/\d+/)
  return match ? Number(match[0]) : 0
}

// Puntaje de coincidencia con la búsqueda; sin búsqueda todos valen 0.
function matchScore(producto, term) {
  if (!term) return 0
  const t = term.toLowerCase()
  if (String(producto.ref || '').toLowerCase() === t || String(producto.id || '').toLowerCase() === t) return 3
  const nombre = String(producto.nombre || '').toLowerCase()
  if (nombre.startsWith(t)) return 2
  if (nombre.includes(t)) return 1
  return 0
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
  const activeMarca  = searchParams.get('marca')
  const sortParam    = searchParams.get('orden')
  const activeSort   = SORT_OPTIONS.some(o => o.value === sortParam) ? sortParam : DEFAULT_SORT
  const [searchTerm, setSearchTerm] = useState('')
  const [showTopBtn, setShowTopBtn] = useState(false)
  // Semilla nueva en cada visita; estable mientras la pagina siga abierta, para
  // que el orden "mejor coincidencia" no sea siempre el mismo (insercion del
  // catalogo) pero tampoco se reordene solo con cada filtro o favorito.
  const [semilla] = useState(() => Math.floor(Math.random() * 2 ** 31))

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

  const setParam = (key, value) => {
    const params = new URLSearchParams(searchParams)
    value ? params.set(key, value) : params.delete(key)
    setSearchParams(params, { replace: true })
  }

  const setActiveGenero = (gen) => setParam('genero', gen)
  const setActiveTalla  = (talla) => setParam('talla', talla)
  const setActiveMarca  = (marca) => setParam('marca', marca)
  const setActiveSort   = (orden) => setParam('orden', orden === DEFAULT_SORT ? null : orden)

  // Marcas presentes en el catálogo, en el orden de las abreviaciones del CRM.
  const marcas = useMemo(() => {
    const present = new Set(productos.map(getProductBrandLabel).filter(Boolean))
    const known = BRAND_ORDER.filter(m => present.has(m))
    const extra = [...present].filter(m => !BRAND_ORDER.includes(m)).sort()
    return [...known, ...extra]
  }, [productos])

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
  if (activeMarca) {
    lista = lista.filter((producto) => getProductBrandLabel(producto) === activeMarca)
  }

  // El catálogo llega en orden de inserción: lo último añadido va al final.
  const position = new Map(productos.map((p, i) => [p, i]))
  // Orden aleatorio (estable durante la visita) para "mejor coincidencia":
  // sin esto siempre se veian en el mismo orden de insercion del catalogo.
  const posicionAleatoria = new Map(mezclar(productos, semilla).map((p, i) => [p, i]))
  lista.sort((a, b) => {
    if (a.disponible !== b.disponible) return a.disponible ? -1 : 1

    if (activeSort === 'nuevo') {
      // Drop más reciente primero y, dentro del drop, lo último que se añadió.
      return (dropNumber(b) - dropNumber(a)) || (position.get(b) - position.get(a))
    }

    // Mejor coincidencia: relevancia de búsqueda y, si empatan, orden aleatorio.
    return (matchScore(b, searchTerm) - matchScore(a, searchTerm)) || (posicionAleatoria.get(a) - posicionAleatoria.get(b))
  })

  const gridKey = [activeGenero, activeTalla, activeMarca, activeSort, searchTerm].join('|')

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
            marcas={marcas}
            activeGenero={activeGenero}
            activeTalla={activeTalla}
            activeMarca={activeMarca}
            onGenero={setActiveGenero}
            onTalla={setActiveTalla}
            onMarca={setActiveMarca}
            sortOptions={SORT_OPTIONS}
            sortValue={activeSort}
            onSort={setActiveSort}
            searchTerm={searchTerm}
            onSearch={setSearchTerm}
            productCount={lista.length}
            showTopButton={showTopBtn}
            onBackToTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            notchMessage={favToast?.msg || ''}
          />

          <div className="catalog-main">
            {lista.length > 0 ? (
              <div className="product-grid" key={gridKey}>
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
                <button onClick={() => {
                  const params = new URLSearchParams(searchParams)
                  ;['genero', 'talla', 'marca'].forEach(k => params.delete(k))
                  setSearchParams(params, { replace: true })
                  setSearchTerm('')
                }}>
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Feedback de favoritos en escritorio (en móvil lo muestra el notch) */}
      {favToast && (
        <div key={favToast.key} className="fav-toast catalog-fav-toast" role="status">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {favToast.msg}
        </div>
      )}

      <Footer marca={meta.marca} />
    </>
  )
}
