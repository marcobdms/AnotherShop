/**
 * FilterChips.jsx
 * ─────────────────────────────────────────────────────────────
 * Barra de filtros + buscador integrado.
 * El buscador está oculto por defecto; un botón "BUSCAR" lo despliega
 * con animación. El input tiene exactamente el mismo estilo que los chips.
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
 * ─────────────────────────────────────────────────────────────
 */
import { useState, useRef, useEffect } from 'react'

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
  const [searchOpen, setSearchOpen] = useState(false)
  const inputRef = useRef(null)

  function toggle(actual, valor, setter) {
    setter(actual === valor ? null : valor)
  }

  function toggleSearch() {
    const next = !searchOpen
    setSearchOpen(next)
    if (!next) onSearch('')   // limpiar al cerrar
  }

  // Focus automático al abrir el input
  useEffect(() => {
    if (searchOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [searchOpen])

  return (
    <div className="filters">
      {/* Fila 1: Género */}
      <div className="filters__row">
        <span className="filters__label">Género</span>
        {generos.map(g => (
          <button
            key={g}
            className={`filter-chip ${activeGenero === g ? 'active' : ''}`}
            onClick={() => toggle(activeGenero, g, onGenero)}
          >
            {g}
          </button>
        ))}
        {activeGenero && (
          <button className="filter-chip" onClick={() => onGenero(null)}>✕</button>
        )}
      </div>

      {/* Fila 2: Talla */}
      <div className="filters__row">
        <span className="filters__label">Talla</span>
        {tallas.map(t => (
          <button
            key={t}
            className={`filter-chip ${activeTalla === t ? 'active' : ''}`}
            onClick={() => toggle(activeTalla, t, onTalla)}
          >
            {t}
          </button>
        ))}
        {activeTalla && (
          <button className="filter-chip" onClick={() => onTalla(null)}>✕</button>
        )}
      </div>

      {/* Fila 3: Buscador */}
      <div className="filters__row">
        <span className="filters__label">Buscar</span>
        <button
          className={`filter-chip ${searchOpen ? 'active' : ''}`}
          onClick={toggleSearch}
          aria-expanded={searchOpen}
          aria-label="Abrir buscador"
        >
          {/* Lupa SVG */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ display: 'block' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>

        {/* Input expandible */}
        <div className={`filter-search ${searchOpen ? 'filter-search--open' : ''}`}>
          <input
            ref={inputRef}
            type="text"
            className="filter-search__input"
            placeholder="Nombre o referencia..."
            value={searchTerm}
            onChange={e => onSearch(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && toggleSearch()}
          />
          {searchTerm && (
            <button
              className="filter-search__clear"
              onClick={() => { onSearch(''); inputRef.current?.focus() }}
              aria-label="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
