/**
 * FilterChips.jsx — Panel de filtros
 *
 * Desktop: sidebar vertical con secciones (género, talla, búsqueda)
 * Mobile:  botón "FILTROS" que abre un drawer desde abajo
 *
 * Props:
 *   generos       string[]
 *   tallas        string[]
 *   activeGenero  string | null
 *   activeTalla   string | null
 *   onGenero      (val: string | null) => void
 *   onTalla       (val: string | null) => void
 *   searchTerm    string
 *   onSearch      (val: string) => void
 */
import { useState, useRef, useEffect } from 'react'

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  )
}

// Panel de filtros — reutilizado en sidebar desktop y drawer mobile
function FiltersPanel({ generos, tallas, activeGenero, activeTalla, onGenero, onTalla, searchTerm, onSearch, onClear }) {
  const inputRef = useRef(null)
  const hasActiveFilters = activeGenero || activeTalla || searchTerm

  function toggle(actual, valor, setter) {
    setter(actual === valor ? null : valor)
  }

  return (
    <>
      {/* GÉNERO */}
      {generos.length > 0 && (
        <div className="catalog-section">
          <p className="catalog-section__title">Género</p>
          <div className="filter-radio-list">
            {generos.map(g => (
              <button
                key={g}
                className={`filter-radio ${activeGenero === g ? 'filter-radio--active' : ''}`}
                onClick={() => toggle(activeGenero, g, onGenero)}
                aria-pressed={activeGenero === g}
              >
                <span className="filter-radio__dot" aria-hidden="true" />
                <span className="filter-radio__label">{g}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TALLA */}
      {tallas.length > 0 && (
        <div className="catalog-section">
          <p className="catalog-section__title">Talla</p>
          <div className="filter-chips-row">
            {tallas.map(t => (
              <button
                key={t}
                className={`filter-chip ${activeTalla === t ? 'active' : ''}`}
                onClick={() => toggle(activeTalla, t, onTalla)}
                aria-pressed={activeTalla === t}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* BUSCAR */}
      <div className="catalog-section">
        <p className="catalog-section__title">Buscar</p>
        <div className="sidebar-search">
          <span className="sidebar-search__icon"><SearchIcon /></span>
          <input
            ref={inputRef}
            type="text"
            className="sidebar-search__input"
            placeholder="Nombre o referencia..."
            value={searchTerm}
            onChange={e => onSearch(e.target.value)}
          />
          {searchTerm && (
            <button
              className="sidebar-search__clear"
              onClick={() => { onSearch(''); inputRef.current?.focus() }}
              aria-label="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* LIMPIAR FILTROS */}
      {hasActiveFilters && (
        <button className="sidebar-clear" onClick={onClear}>
          Limpiar filtros
        </button>
      )}
    </>
  )
}

export default function FilterChips({
  generos,
  tallas,
  activeGenero,
  activeTalla,
  onGenero,
  onTalla,
  searchTerm,
  onSearch,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Cerrar drawer con Escape
  useEffect(() => {
    if (!drawerOpen) return
    const handler = (e) => { if (e.key === 'Escape') setDrawerOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [drawerOpen])

  // Bloquear scroll al abrir drawer
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  function handleClear() {
    onGenero(null)
    onTalla(null)
    onSearch('')
    setDrawerOpen(false)
  }

  const hasActiveFilters = activeGenero || activeTalla || searchTerm
  const activeCount = [activeGenero, activeTalla, searchTerm ? 'q' : null].filter(Boolean).length

  return (
    <>
      {/* ── Desktop: sidebar (visible via CSS en ≥641px) ── */}
      <aside className="catalog-sidebar">
        <FiltersPanel
          generos={generos}
          tallas={tallas}
          activeGenero={activeGenero}
          activeTalla={activeTalla}
          onGenero={onGenero}
          onTalla={onTalla}
          searchTerm={searchTerm}
          onSearch={onSearch}
          onClear={handleClear}
        />
      </aside>

      {/* ── Mobile: botón + drawer (visible via CSS en ≤640px) ── */}
      <button
        className="filter-toggle-btn"
        onClick={() => setDrawerOpen(true)}
        aria-haspopup="dialog"
      >
        <FilterIcon />
        Filtros{activeCount > 0 ? ` (${activeCount})` : ''}
      </button>

      <div
        className={`filter-drawer ${drawerOpen ? 'filter-drawer--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Filtros"
      >
        <div
          className="filter-drawer__backdrop"
          onClick={() => setDrawerOpen(false)}
        />
        <div className="filter-drawer__panel">
          <div className="filter-drawer__header">
            <span className="filter-drawer__header-title">Filtros</span>
            <button
              className="filter-drawer__close"
              onClick={() => setDrawerOpen(false)}
              aria-label="Cerrar filtros"
            >
              ✕
            </button>
          </div>

          <FiltersPanel
            generos={generos}
            tallas={tallas}
            activeGenero={activeGenero}
            activeTalla={activeTalla}
            onGenero={onGenero}
            onTalla={onTalla}
            searchTerm={searchTerm}
            onSearch={onSearch}
            onClear={handleClear}
          />
        </div>
      </div>
    </>
  )
}
