/**
 * InventoryModal.jsx — Gestión de inventario por producto
 * Modal que permite gestionar variantes de color y stock por talla.
 * Reutiliza los estilos admin existentes (adm-*).
 */
import { useState, useEffect, useCallback } from 'react'
import { adminFetchInventory, adminSaveInventory } from '../api/catalog'

// Tallas globales (las mismas que en filtros)
const TALLAS_GLOBALES = ['XS', 'S', 'M', 'L', 'XL']

// Colores predefinidos para el picker rápido
const COLORES_RAPIDOS = [
  { nombre: 'Negro', hex: '#000000' },
  { nombre: 'Blanco', hex: '#FFFFFF' },
  { nombre: 'Marrón', hex: '#8B4513' },
  { nombre: 'Azul', hex: '#1E3A5F' },
  { nombre: 'Rojo', hex: '#C0392B' },
  { nombre: 'Verde', hex: '#2D6A4F' },
  { nombre: 'Rosa', hex: '#E8A0BF' },
  { nombre: 'Gris', hex: '#808080' },
  { nombre: 'Beige', hex: '#D4B896' },
  { nombre: 'Naranja', hex: '#E67E22' },
]

function normalizeSku(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function generateSkus(productId, variantes) {
  const skus = []
  for (const v of variantes) {
    const colorNorm = normalizeSku(v.color)
    for (const [talla, stock] of Object.entries(v.tallas || {})) {
      if (stock > 0) {
        skus.push(`${productId}-${colorNorm}-${talla}`)
      }
    }
  }
  return skus
}

// ── Estilos del modal ─────────────────────────────────────────────────────────
const modalCss = `
  .adm-inv-overlay {
    position: fixed;
    inset: 0;
    z-index: 400;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: adm-inv-fade-in 0.2s ease;
    padding: 1rem;
  }
  @keyframes adm-inv-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .adm-inv-modal {
    background: var(--white);
    width: 100%;
    max-width: 620px;
    max-height: 85vh;
    overflow-y: auto;
    border: 1px solid var(--grey-200);
    font-family: var(--font);
    animation: adm-inv-slide 0.25s ease;
  }
  @keyframes adm-inv-slide {
    from { transform: translateY(12px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .adm-inv-header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--grey-200);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    position: sticky;
    top: 0;
    background: var(--white);
    z-index: 10;
  }
  .adm-inv-header__info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .adm-inv-header__id {
    font-size: var(--size-xs);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--grey-400);
  }
  .adm-inv-header__name {
    font-size: var(--size-sm);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 500;
    color: var(--black);
  }
  .adm-inv-close {
    background: none;
    border: none;
    font-size: 1.2rem;
    color: var(--grey-400);
    cursor: pointer;
    padding: 0.25rem;
    transition: color 200ms ease;
    flex-shrink: 0;
  }
  .adm-inv-close:hover { color: var(--black); }

  .adm-inv-body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Color card */
  .adm-inv-color {
    border: 1px solid var(--grey-200);
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .adm-inv-color__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .adm-inv-color__label {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: var(--size-sm);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 500;
  }
  .adm-inv-color__swatch {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1px solid var(--grey-200);
    flex-shrink: 0;
  }
  .adm-inv-color__delete {
    font-size: var(--size-xs);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #c0392b;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0.25rem 0.5rem;
    transition: opacity 200ms ease;
    font-family: var(--font);
  }
  .adm-inv-color__delete:hover { opacity: 0.6; }

  /* Tallas grid */
  .adm-inv-tallas {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 0.5rem;
  }
  .adm-inv-talla {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    align-items: center;
  }
  .adm-inv-talla__label {
    font-size: var(--size-xs);
    letter-spacing: 0.1em;
    color: var(--grey-400);
    text-transform: uppercase;
  }
  .adm-inv-talla__input {
    width: 100%;
    text-align: center;
    padding: 0.5rem;
    border: 1px solid var(--grey-200);
    font-family: var(--font);
    font-size: var(--size-sm);
    color: var(--black);
    outline: none;
    transition: border-color 200ms ease;
    background: var(--white);
  }
  .adm-inv-talla__input:focus { border-color: var(--black); }
  .adm-inv-talla__input--zero {
    color: var(--grey-400);
    background: var(--grey-100);
  }

  /* Add color form */
  .adm-inv-add {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    padding-top: 0.5rem;
    border-top: 1px solid var(--grey-200);
  }
  .adm-inv-add__quick {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    width: 100%;
    margin-bottom: 0.5rem;
  }
  .adm-inv-add__chip {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.65rem;
    border: 1px solid var(--grey-200);
    cursor: pointer;
    font-size: 0.6rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-family: var(--font);
    color: var(--grey-600);
    background: var(--white);
    transition: border-color 200ms ease, color 200ms ease;
  }
  .adm-inv-add__chip:hover { border-color: var(--black); color: var(--black); }
  .adm-inv-add__chip-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid var(--grey-300);
    flex-shrink: 0;
  }
  .adm-inv-add__input {
    flex: 1;
    min-width: 120px;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--grey-200);
    font-family: var(--font);
    font-size: var(--size-xs);
    letter-spacing: 0.08em;
    color: var(--black);
    outline: none;
    transition: border-color 200ms ease;
  }
  .adm-inv-add__input:focus { border-color: var(--black); }
  .adm-inv-add__input::placeholder { color: var(--grey-400); }
  .adm-inv-add__hex {
    width: 36px;
    height: 36px;
    border: 1px solid var(--grey-200);
    cursor: pointer;
    padding: 0;
    background: none;
  }
  .adm-inv-add__btn {
    padding: 0.5rem 1rem;
    background: var(--white);
    border: 1px solid var(--grey-200);
    font-family: var(--font);
    font-size: var(--size-xs);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    color: var(--black);
    transition: background 200ms ease, border-color 200ms ease;
  }
  .adm-inv-add__btn:hover { background: var(--grey-100); border-color: var(--black); }

  /* SKU display */
  .adm-inv-skus {
    padding-top: 0.75rem;
    border-top: 1px solid var(--grey-200);
  }
  .adm-inv-skus__title {
    font-size: var(--size-xs);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--grey-400);
    margin-bottom: 0.5rem;
  }
  .adm-inv-skus__list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .adm-inv-sku-tag {
    font-size: 0.6rem;
    letter-spacing: 0.08em;
    padding: 0.2rem 0.5rem;
    background: var(--grey-100);
    color: var(--grey-600);
    border: 1px solid var(--grey-200);
    font-family: var(--font);
  }

  /* Footer save */
  .adm-inv-footer {
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--grey-200);
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    bottom: 0;
    background: var(--white);
  }
  .adm-inv-footer__stock {
    font-size: var(--size-xs);
    letter-spacing: 0.1em;
    color: var(--grey-400);
  }
  .adm-inv-footer__stock strong {
    color: var(--black);
    font-weight: 600;
  }
  .adm-inv-save {
    background: var(--black);
    color: var(--white);
    border: none;
    padding: 0.65rem 1.5rem;
    font-family: var(--font);
    font-size: var(--size-xs);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    cursor: pointer;
    transition: opacity 200ms ease;
  }
  .adm-inv-save:hover { opacity: 0.8; }
  .adm-inv-save:disabled { opacity: 0.35; cursor: not-allowed; }

  .adm-inv-empty {
    text-align: center;
    padding: 2rem 1rem;
    color: var(--grey-400);
    font-size: var(--size-sm);
    letter-spacing: 0.08em;
  }
`

export default function InventoryModal({ product, onClose, onSaved }) {
  const [variantes, setVariantes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newColorName, setNewColorName] = useState('')
  const [newColorHex, setNewColorHex] = useState('#000000')
  const [dirty, setDirty] = useState(false)

  // Cargar inventario
  useEffect(() => {
    adminFetchInventory(product.id)
      .then(data => {
        setVariantes(data.variantes || [])
      })
      .catch(() => {
        setVariantes([])
      })
      .finally(() => setLoading(false))
  }, [product.id])

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const addColor = useCallback((nombre, hex) => {
    if (!nombre.trim()) return
    // Verificar que no exista ya
    const exists = variantes.some(v => v.color.toLowerCase() === nombre.trim().toLowerCase())
    if (exists) return

    const tallasInit = {}
    TALLAS_GLOBALES.forEach(t => { tallasInit[t] = 0 })

    setVariantes(prev => [...prev, { color: nombre.trim(), hex: hex || '#000000', tallas: tallasInit }])
    setNewColorName('')
    setNewColorHex('#000000')
    setDirty(true)
  }, [variantes])

  const removeColor = useCallback((index) => {
    setVariantes(prev => prev.filter((_, i) => i !== index))
    setDirty(true)
  }, [])

  const updateStock = useCallback((colorIndex, talla, value) => {
    const numValue = Math.max(0, parseInt(value) || 0)
    setVariantes(prev => {
      const updated = [...prev]
      updated[colorIndex] = {
        ...updated[colorIndex],
        tallas: { ...updated[colorIndex].tallas, [talla]: numValue }
      }
      return updated
    })
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await adminSaveInventory(product.id, variantes)
      setDirty(false)
      if (onSaved) onSaved()
    } catch (e) {
      console.error('Error guardando inventario:', e)
    } finally {
      setSaving(false)
    }
  }, [product.id, variantes, onSaved])

  const skus = generateSkus(product.id, variantes)
  const totalStock = variantes.reduce(
    (acc, v) => acc + Object.values(v.tallas || {}).reduce((a, b) => a + b, 0),
    0
  )

  // Colores rápidos que aún no se han usado
  const availableQuickColors = COLORES_RAPIDOS.filter(
    c => !variantes.some(v => v.color.toLowerCase() === c.nombre.toLowerCase())
  )

  return (
    <>
      <style>{modalCss}</style>
      <div className="adm-inv-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div className="adm-inv-modal">
          {/* Header */}
          <div className="adm-inv-header">
            <div className="adm-inv-header__info">
              <span className="adm-inv-header__id">Gestionar inventario — {product.id}</span>
              <span className="adm-inv-header__name">{product.nombre}</span>
            </div>
            <button className="adm-inv-close" onClick={onClose}>✕</button>
          </div>

          {/* Body */}
          <div className="adm-inv-body">
            {loading ? (
              <div className="adm-inv-empty">Cargando inventario…</div>
            ) : (
              <>
                {/* Color cards */}
                {variantes.length === 0 && (
                  <div className="adm-inv-empty">
                    Sin variantes de color. Añade un color para comenzar.
                  </div>
                )}

                {variantes.map((v, ci) => (
                  <div key={ci} className="adm-inv-color">
                    <div className="adm-inv-color__header">
                      <span className="adm-inv-color__label">
                        <span
                          className="adm-inv-color__swatch"
                          style={{ background: v.hex }}
                        />
                        {v.color}
                      </span>
                      <button
                        className="adm-inv-color__delete"
                        onClick={() => removeColor(ci)}
                      >
                        Eliminar
                      </button>
                    </div>

                    <div className="adm-inv-tallas">
                      {TALLAS_GLOBALES.map(talla => {
                        const stock = v.tallas?.[talla] ?? 0
                        return (
                          <div key={talla} className="adm-inv-talla">
                            <span className="adm-inv-talla__label">{talla}</span>
                            <input
                              type="number"
                              min="0"
                              className={`adm-inv-talla__input ${stock === 0 ? 'adm-inv-talla__input--zero' : ''}`}
                              value={stock}
                              onChange={(e) => updateStock(ci, talla, e.target.value)}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Add color */}
                <div className="adm-inv-add">
                  {availableQuickColors.length > 0 && (
                    <div className="adm-inv-add__quick">
                      {availableQuickColors.map(c => (
                        <button
                          key={c.nombre}
                          className="adm-inv-add__chip"
                          onClick={() => addColor(c.nombre, c.hex)}
                        >
                          <span className="adm-inv-add__chip-dot" style={{ background: c.hex }} />
                          {c.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    type="text"
                    className="adm-inv-add__input"
                    placeholder="Nombre del color..."
                    value={newColorName}
                    onChange={e => setNewColorName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addColor(newColorName, newColorHex) }}
                  />
                  <input
                    type="color"
                    className="adm-inv-add__hex"
                    value={newColorHex}
                    onChange={e => setNewColorHex(e.target.value)}
                    title="Color hex"
                  />
                  <button
                    className="adm-inv-add__btn"
                    onClick={() => addColor(newColorName, newColorHex)}
                    disabled={!newColorName.trim()}
                  >
                    + Añadir
                  </button>
                </div>

                {/* SKUs */}
                {skus.length > 0 && (
                  <div className="adm-inv-skus">
                    <p className="adm-inv-skus__title">SKUs generados ({skus.length})</p>
                    <div className="adm-inv-skus__list">
                      {skus.map(sku => (
                        <span key={sku} className="adm-inv-sku-tag">{sku}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="adm-inv-footer">
            <span className="adm-inv-footer__stock">
              Stock total: <strong>{totalStock}</strong> · {variantes.length} color{variantes.length !== 1 ? 'es' : ''}
            </span>
            <button
              className="adm-inv-save"
              onClick={handleSave}
              disabled={saving || !dirty}
            >
              {saving ? 'Guardando...' : 'Guardar inventario'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
