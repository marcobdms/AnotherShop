import { useCallback, useEffect, useRef, useState } from 'react'

function SearchIcon({ className = 'catalog-icon' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </svg>
  )
}

function FilterIcon({ className = 'catalog-icon' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h4" />
      <path d="M14 7h6" />
      <circle cx="11" cy="7" r="2" />
      <path d="M4 12h9" />
      <path d="M18 12h2" />
      <circle cx="16" cy="12" r="2" />
      <path d="M4 17h2" />
      <path d="M12 17h8" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg className="catalog-chevron" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 10 5 5 5-5" />
    </svg>
  )
}

function ArrowUpIcon() {
  return (
    <svg className="catalog-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="catalog-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function FavoriteStatusIcon() {
  return (
    <svg className="floating-filter__heart" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function SearchPanel({ searchTerm, onSearch }) {
  const inputRef = useRef(null)

  useEffect(() => {
    const isTouchViewport = window.matchMedia?.('(pointer: coarse)')?.matches
    if (isTouchViewport) return
    inputRef.current?.focus()
  }, [])

  return (
    <div className="catalog-drawer-fields">
      <div className="catalog-section">
        <p className="catalog-section__title">Buscar</p>
        <label className="sidebar-search" htmlFor="catalog-search">
          <span className="sidebar-search__icon"><SearchIcon /></span>
          <input
            id="catalog-search"
            ref={inputRef}
            type="search"
            className="sidebar-search__input"
            placeholder="Nombre, marca o referencia"
            value={searchTerm}
            onChange={e => onSearch(e.target.value)}
          />
          {searchTerm && (
            <button
              className="sidebar-search__clear"
              onClick={() => { onSearch(''); inputRef.current?.focus() }}
              aria-label="Limpiar busqueda"
              type="button"
            >
              x
            </button>
          )}
        </label>
      </div>

      {searchTerm && (
        <button className="sidebar-clear" onClick={() => onSearch('')} type="button">
          Limpiar busqueda
        </button>
      )}
    </div>
  )
}

function FiltersPanel({
  generos,
  tallas,
  activeGenero,
  activeTalla,
  onGenero,
  onTalla,
  onClear,
}) {
  const hasActiveFilters = activeGenero || activeTalla

  function toggle(actual, valor, setter) {
    setter(actual === valor ? null : valor)
  }

  return (
    <div className="catalog-drawer-fields">
      {generos.length > 0 && (
        <div className="catalog-section">
          <p className="catalog-section__title">Genero</p>
          <div className="filter-radio-list">
            {generos.map(g => (
              <button
                key={g}
                className={`filter-radio ${activeGenero === g ? 'filter-radio--active' : ''}`}
                onClick={() => toggle(activeGenero, g, onGenero)}
                aria-pressed={activeGenero === g}
                type="button"
              >
                <span className="filter-radio__dot" aria-hidden="true" />
                <span className="filter-radio__label">{g}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
                type="button"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasActiveFilters && (
        <button className="sidebar-clear" onClick={onClear} type="button">
          Limpiar filtros
        </button>
      )}
    </div>
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
  productCount = 0,
  showTopButton = false,
  onBackToTop,
  notchMessage = '',
}) {
  const [drawerMode, setDrawerMode] = useState(null)
  const [renderedDrawerMode, setRenderedDrawerMode] = useState(null)
  const openFrameRef = useRef(null)
  const drawerOpen = Boolean(drawerMode)
  const drawerVisible = Boolean(drawerMode || renderedDrawerMode)
  const visualDrawerMode = drawerMode || renderedDrawerMode || 'filters'
  const activeFilterCount = [activeGenero, activeTalla].filter(Boolean).length
  const productLabel = `${productCount} producto${productCount === 1 ? '' : 's'}`
  const searchLabel = searchTerm ? searchTerm : 'Buscar prendas'

  const openDrawer = useCallback((mode) => {
    if (openFrameRef.current) {
      cancelAnimationFrame(openFrameRef.current)
      openFrameRef.current = null
    }
    setRenderedDrawerMode(mode)
    if (drawerOpen) {
      setDrawerMode(mode)
      return
    }

    setDrawerMode(null)
    openFrameRef.current = requestAnimationFrame(() => {
      openFrameRef.current = requestAnimationFrame(() => {
        setDrawerMode(mode)
        openFrameRef.current = null
      })
    })
  }, [drawerOpen])

  const closeDrawer = useCallback(() => {
    if (openFrameRef.current) {
      cancelAnimationFrame(openFrameRef.current)
      openFrameRef.current = null
    }
    setDrawerMode(null)
  }, [])

  function handleDrawerTransitionEnd(event) {
    if (event.target !== event.currentTarget) return
    if (event.propertyName !== 'transform' || drawerOpen) return
    setRenderedDrawerMode(null)
  }

  useEffect(() => {
    if (!drawerOpen) return
    const handler = (event) => {
      if (event.key === 'Escape') closeDrawer()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [closeDrawer, drawerOpen])

  useEffect(() => {
    if (drawerOpen || !renderedDrawerMode) return undefined
    const timer = setTimeout(() => setRenderedDrawerMode(null), 420)
    return () => clearTimeout(timer)
  }, [drawerOpen, renderedDrawerMode])

  useEffect(() => (
    () => {
      if (openFrameRef.current) cancelAnimationFrame(openFrameRef.current)
    }
  ), [])

  useEffect(() => {
    document.body.style.overflow = drawerVisible ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerVisible])

  useEffect(() => {
    function openSearchFromHeader() {
      openDrawer('search')
    }

    function handleSearchHash() {
      if (window.location.hash !== '#catalog-search') return
      openDrawer('search')
    }

    handleSearchHash()
    window.addEventListener('catalog-search-open', openSearchFromHeader)
    window.addEventListener('hashchange', handleSearchHash)
    return () => {
      window.removeEventListener('catalog-search-open', openSearchFromHeader)
      window.removeEventListener('hashchange', handleSearchHash)
    }
  }, [openDrawer])

  function handleClearFilters() {
    onGenero(null)
    onTalla(null)
  }

  return (
    <section className="catalog-filter-panel" aria-label="Filtros de catalogo">
      <button
        className={`filter-summary filter-summary--search${searchTerm ? ' filter-summary--active' : ''}`}
        onClick={() => openDrawer('search')}
        aria-haspopup="dialog"
        type="button"
      >
        <span className="filter-summary__label">
          <SearchIcon />
          <strong>{searchLabel}</strong>
        </span>
        <span className="filter-count">
          {productLabel}
          <ChevronIcon />
        </span>
      </button>

      {(activeFilterCount > 0 || searchTerm) && (
        <div className="catalog-active-filters">
          {searchTerm && (
            <button className="catalog-active-tag" onClick={() => onSearch('')} type="button">
              "{searchTerm}" x
            </button>
          )}
          {activeGenero && (
            <button className="catalog-active-tag" onClick={() => onGenero(null)} type="button">
              {activeGenero} x
            </button>
          )}
          {activeTalla && (
            <button className="catalog-active-tag" onClick={() => onTalla(null)} type="button">
              Talla {activeTalla} x
            </button>
          )}
        </div>
      )}

      <aside className="desktop-filter-card" aria-label="Filtros de catalogo">
        <div className="desktop-filter-card__header">
          <span>Filtros</span>
          <strong>{productCount}</strong>
        </div>
        <FiltersPanel
          generos={generos}
          tallas={tallas}
          activeGenero={activeGenero}
          activeTalla={activeTalla}
          onGenero={onGenero}
          onTalla={onTalla}
          onClear={handleClearFilters}
        />
      </aside>

      <div className={`floating-filter${notchMessage ? ' floating-filter--message' : ''}`} aria-label="Acciones de catalogo">
        <div className="floating-filter__normal">
          <button className="floating-filter__main" onClick={() => openDrawer('filters')} type="button">
            <FilterIcon />
            <strong>Mostrar filtros</strong>
            {activeFilterCount > 0 && (
              <span className="floating-filter__badge">{activeFilterCount}</span>
            )}
            <span className="divider" aria-hidden="true" />
            <span>{productCount}</span>
          </button>
          <button
            className={`floating-filter__backtop${showTopButton ? ' floating-filter__backtop--visible' : ''}`}
            onClick={() => onBackToTop?.()}
            aria-label="Volver arriba"
            type="button"
          >
            <ArrowUpIcon />
          </button>
        </div>
        <span className="floating-filter__message" role="status">
          <FavoriteStatusIcon />
          {notchMessage}
        </span>
      </div>

      {drawerVisible && (
        <div
          className={`filter-drawer ${drawerOpen ? 'filter-drawer--open' : ''} ${visualDrawerMode === 'search' ? 'filter-drawer--search' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-hidden={!drawerOpen}
          aria-label={visualDrawerMode === 'search' ? 'Buscar productos' : 'Filtros'}
        >
          <div
            className="filter-drawer__backdrop"
            onClick={closeDrawer}
          />
          <div className="filter-drawer__panel" onTransitionEnd={handleDrawerTransitionEnd}>
            <div className="filter-drawer__header">
              <span className="filter-drawer__header-title">
                {visualDrawerMode === 'search' ? 'Buscar' : 'Filtros'}
              </span>
              <button
                className="filter-drawer__close"
                onClick={closeDrawer}
                aria-label="Cerrar"
                type="button"
              >
                <CloseIcon />
              </button>
            </div>

            {visualDrawerMode === 'search' ? (
              <SearchPanel
                searchTerm={searchTerm}
                onSearch={onSearch}
              />
            ) : (
              <FiltersPanel
                generos={generos}
                tallas={tallas}
                activeGenero={activeGenero}
                activeTalla={activeTalla}
                onGenero={onGenero}
                onTalla={onTalla}
                onClear={handleClearFilters}
              />
            )}
          </div>
        </div>
      )}
    </section>
  )
}
