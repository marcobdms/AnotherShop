/**
 * FilterChips.jsx
 * ─────────────────────────────────────────────────────────────
 * LISTO PARA STITCH: UI de filtros sin lógica interna.
 * Recibe el estado de fuera y llama callbacks.
 * Props:
 *   generos     string[]
 *   tallas      string[]
 *   activeGenero  string | null
 *   activeTalla   string | null
 *   onGenero    (val: string | null) => void
 *   onTalla     (val: string | null) => void
 * ─────────────────────────────────────────────────────────────
 */
export default function FilterChips({
  generos,
  tallas,
  activeGenero,
  activeTalla,
  onGenero,
  onTalla,
}) {
  function toggle(actual, valor, setter) {
    setter(actual === valor ? null : valor)
  }

  return (
    <div className="filters">
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
    </div>
  )
}
