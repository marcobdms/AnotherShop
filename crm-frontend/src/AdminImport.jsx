/**
 * AdminImport.jsx — Importador masivo de productos
 * Ruta: /import
 * Tabla editable tipo spreadsheet para crear/actualizar productos en bloque.
 */
import { useState, useCallback, useEffect, Fragment, useMemo } from 'react'
import { adminUploadImage, adminExportFull, adminSyncAll } from './api/catalog'
import { CrmSkeleton } from './CrmChrome'

const TALLAS = ['XS', 'S', 'M', 'L', 'XL']
const GENEROS = ['mujer', 'hombre', 'unisex']

const COLORES_PRESET = [
  { nombre: 'Negro',   hex: '#000000' },
  { nombre: 'Blanco',  hex: '#FFFFFF' },
  { nombre: 'Marrón',  hex: '#8B4513' },
  { nombre: 'Azul',    hex: '#1E3A5F' },
  { nombre: 'Rojo',    hex: '#C0392B' },
  { nombre: 'Verde',   hex: '#2D6A4F' },
  { nombre: 'Rosa',    hex: '#E8A0BF' },
  { nombre: 'Gris',    hex: '#808080' },
  { nombre: 'Beige',   hex: '#D4B896' },
  { nombre: 'Naranja', hex: '#E67E22' },
  { nombre: 'Crema',   hex: '#FFFDD0' },
  { nombre: 'Camel',   hex: '#C19A6B' },
]

function makeRow(overrides = {}) {
  return {
    _id: crypto.randomUUID(),
    _productId: null, // identidad interna; no se muestra ni se usa como REF
    ref: '',
    nombre: '',
    color: '',
    hex: '#888888',
    talla: 'M',
    stock: 1,
    precio_coste: '',
    margen: 2,
    precio_venta: '',
    genero: 'mujer',
    imagen: '',
    imagen2: '',
    _imgPreview: null,   // URL local (blob) para preview de drag-drop
    _imgPreview2: null,
    disponible: true,
    ...overrides,
  }
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const css = `
  .imp-page {
    min-height: calc(100vh - 64px);
    background: var(--white);
    font-family: var(--font);
    display: flex;
    flex-direction: column;
  }

  .imp-page--drop .imp-header,
  .imp-page--drop .imp-stats,
  .imp-table-wrap--ready {
    animation: imp-soft-enter 320ms ease-out both;
  }

  .imp-page--drop .imp-stats {
    animation-delay: 40ms;
  }

  .imp-table-wrap--ready {
    animation-delay: 90ms;
  }

  .imp-drop-picker {
    animation: imp-soft-enter 260ms ease-out both;
  }

  .imp-drop-picker__content {
    animation: imp-drop-content-enter 340ms ease-out both;
  }

  /* Header */
  .imp-header {
    position: sticky;
    top: 0;
    z-index: 200;
    background: var(--white);
    border-bottom: 1px solid var(--grey-200);
    padding: 1rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .imp-header__left {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }
  .imp-header__brand {
    font-size: var(--size-xs);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    font-weight: 500;
    color: var(--black);
    text-decoration: none;
  }
  .imp-header__title {
    font-size: var(--size-xs);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--grey-400);
  }
  .imp-header__right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .imp-btn {
    padding: 0.55rem 1.1rem;
    font-family: var(--font);
    font-size: var(--size-xs);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 200ms ease;
    border-radius: 3px;
    white-space: nowrap;
  }
  .imp-btn--outline {
    background: var(--white);
    border: 1px solid var(--grey-200);
    color: var(--grey-600);
  }
  .imp-btn--outline:hover { border-color: var(--black); color: var(--black); }
  .imp-btn--primary {
    background: var(--black);
    border: 1px solid var(--black);
    color: var(--white);
  }
  .imp-btn--primary:hover { opacity: 0.8; }
  .imp-btn--primary:disabled { opacity: 0.35; cursor: not-allowed; }
  .imp-btn--danger {
    background: var(--white);
    border: 1px solid #fecaca;
    color: #c0392b;
  }
  .imp-btn--danger:hover { background: #fff5f5; border-color: #c0392b; }

  /* Stats bar */
  .imp-stats {
    display: flex;
    align-items: center;
    gap: 2rem;
    padding: 0.6rem 1.5rem;
    background: var(--grey-100);
    border-bottom: 1px solid var(--grey-200);
    flex-wrap: wrap;
  }
  .imp-stat {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--size-xs);
    letter-spacing: 0.08em;
    color: var(--grey-600);
  }
  .imp-stat strong { color: var(--black); font-weight: 600; }

  /* Table wrapper */
  .imp-table-wrap {
    flex: 1;
    overflow-x: auto;
    padding: 1.5rem;
  }

  /* Table */
  .imp-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 1100px;
    font-size: var(--size-xs);
  }
  .imp-table thead th {
    text-align: left;
    padding: 0.6rem 0.75rem;
    background: var(--grey-100);
    border: 1px solid var(--grey-200);
    font-size: 0.6rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--grey-600);
    white-space: nowrap;
    font-weight: 500;
    position: sticky;
    top: 0;
  }
  .imp-table tbody tr {
    transition: background 150ms ease;
  }
  .imp-table tbody tr:hover { background: #fafafa; }
  .imp-table tbody tr.imp-row--new {
    background: #f0fdf4;
  }
  .imp-table tbody tr.imp-row--new:hover { background: #dcfce7; }
  .imp-table td {
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--grey-200);
    vertical-align: middle;
  }

  /* Cell inputs */
  .imp-cell-input {
    width: 100%;
    padding: 0.35rem 0.5rem;
    border: 1px solid transparent;
    background: transparent;
    font-family: var(--font);
    font-size: var(--size-xs);
    color: var(--black);
    outline: none;
    transition: border-color 150ms ease, background 150ms ease;
    letter-spacing: 0.02em;
  }
  .imp-cell-input:focus {
    border-color: var(--black);
    background: var(--white);
    border-radius: 2px;
  }
  .imp-cell-input::placeholder { color: var(--grey-400); }
  .imp-cell-select {
    width: 100%;
    padding: 0.35rem 0.4rem;
    border: 1px solid transparent;
    background: transparent;
    font-family: var(--font);
    font-size: var(--size-xs);
    color: var(--black);
    outline: none;
    cursor: pointer;
    appearance: auto;
  }
  .imp-cell-select:focus { border-color: var(--black); border-radius: 2px; }

  /* Color cell */
  .imp-color-cell {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .imp-color-swatch {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1px solid var(--grey-200);
    flex-shrink: 0;
    cursor: pointer;
  }
  .imp-color-input {
    width: 0;
    height: 0;
    opacity: 0;
    position: absolute;
  }

  /* Image cell */
  .imp-img-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .imp-img-thumb {
    width: 44px;
    height: 44px;
    object-fit: cover;
    background: var(--grey-100);
    border: 1px solid var(--grey-200);
    flex-shrink: 0;
    display: block;
  }
  .imp-img-placeholder {
    width: 44px;
    height: 44px;
    background: var(--grey-100);
    border: 1.5px dashed var(--grey-200);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.55rem;
    color: var(--grey-400);
    flex-shrink: 0;
    cursor: pointer;
    transition: border-color 150ms ease, background 150ms ease;
    text-align: center;
    line-height: 1.3;
  }
  .imp-img-placeholder:hover,
  .imp-img-placeholder.drag-over {
    border-color: var(--black);
    background: var(--grey-100);
  }
  .imp-img-placeholder.drag-over { background: #e8f5e9; border-color: #22c55e; }
  .imp-img-drop-wrap {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }
  .imp-img-drop-wrap input[type=file] {
    display: none;
  }
  .imp-img-drop-label {
    font-size: 0.55rem;
    color: var(--grey-400);
    letter-spacing: 0.04em;
    cursor: pointer;
    text-align: center;
    line-height: 1.3;
    max-width: 60px;
  }
  .imp-img-drop-label:hover { color: var(--black); }

  /* Botón ✕ para borrar imagen ya cargada */
  .imp-img-clear {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgba(192, 57, 43, 0.92);
    color: #fff;
    border: none;
    cursor: pointer;
    font-size: 0.55rem;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    padding: 0;
    z-index: 10;
    opacity: 0;
    transition: opacity 150ms ease;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  }
  .imp-img-drop-wrap:hover .imp-img-clear {
    opacity: 1;
  }

  /* Color selector — swatches compact inline */
  .imp-color-selector {
    display: flex;
    flex-wrap: nowrap;
    gap: 2px;
    align-items: center;
    overflow-x: auto;
    max-width: 130px;
    scrollbar-width: none;
  }
  .imp-color-selector::-webkit-scrollbar { display: none; }
  .imp-color-swatch-btn {
    width: 14px;
    height: 14px;
    border-radius: 2px;
    border: 1.5px solid transparent;
    cursor: pointer;
    padding: 0;
    transition: border-color 100ms ease;
    flex-shrink: 0;
  }
  .imp-color-swatch-btn:hover { border-color: var(--grey-400); }
  .imp-color-swatch-btn.selected { border-color: var(--black); }
  .imp-color-swatch-btn--none {
    background: linear-gradient(135deg, #f5f5f5 40%, #ccc 40%);
    border-color: var(--grey-200);
  }
  .imp-color-name {
    font-size: 0.55rem;
    color: var(--grey-400);
    letter-spacing: 0.04em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 130px;
  }

  /* Toggle cell */
  .imp-toggle {
    position: relative;
    width: 38px;
    height: 22px;
    display: inline-block;
    cursor: pointer;
  }
  .imp-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
  .imp-toggle__track {
    position: absolute;
    inset: 0;
    background: var(--grey-200);
    border-radius: 22px;
    transition: background 200ms ease;
  }
  .imp-toggle input:checked + .imp-toggle__track { background: #22c55e; }
  .imp-toggle__thumb {
    position: absolute;
    top: 2px; left: 2px;
    width: 18px; height: 18px;
    background: var(--white);
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    transition: transform 200ms ease;
    pointer-events: none;
  }
  .imp-toggle input:checked ~ .imp-toggle__thumb { transform: translateX(16px); }

  /* Delete row */
  .imp-row-del {
    background: none;
    border: none;
    color: var(--grey-400);
    cursor: pointer;
    font-size: 1rem;
    padding: 0 0.25rem;
    transition: color 150ms ease;
    line-height: 1;
  }
  .imp-row-del:hover { color: #c0392b; }

  /* Add row */
  .imp-add-row {
    margin-top: 0.75rem;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }

  /* JSON panel */
  .imp-json-panel {
    border-top: 1px solid var(--grey-200);
    padding: 1.5rem;
    background: var(--grey-100);
  }
  .imp-json-panel__title {
    font-size: var(--size-xs);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--grey-400);
    margin-bottom: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .imp-json-box {
    background: #1a1a2e;
    color: #e2e8f0;
    padding: 1rem;
    font-family: 'Courier New', monospace;
    font-size: 0.7rem;
    line-height: 1.6;
    max-height: 280px;
    overflow-y: auto;
    border-radius: 4px;
    white-space: pre;
    word-break: break-all;
    user-select: all;
  }

  /* Result toast area */
  .imp-result {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 500;
    padding: 1rem 1.5rem;
    font-family: var(--font);
    font-size: var(--size-xs);
    letter-spacing: 0.08em;
    border: 1px solid;
    max-width: 320px;
    background: var(--white);
    animation: imp-slide 0.25s ease;
  }
  .imp-result--ok { border-color: #22c55e; color: #16a34a; }
  .imp-result--err { border-color: #c0392b; color: #c0392b; }
  @keyframes imp-slide {
    from { transform: translateY(8px); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
  }

  /* JSON Paste Modal */
  .imp-paste-overlay {
    position: fixed;
    inset: 0;
    z-index: 600;
    background: rgba(0,0,0,0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    animation: imp-slide 0.2s ease;
  }
  .imp-paste-modal {
    background: var(--white);
    width: 100%;
    max-width: 640px;
    border: 1px solid var(--grey-200);
    display: flex;
    flex-direction: column;
    max-height: 90vh;
  }
  .imp-paste-header {
    padding: 1.1rem 1.4rem;
    border-bottom: 1px solid var(--grey-200);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .imp-paste-header__title {
    font-size: var(--size-xs);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-weight: 500;
    color: var(--black);
  }
  .imp-paste-close {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.1rem;
    color: var(--grey-400);
    padding: 0.2rem;
    transition: color 150ms ease;
  }
  .imp-paste-close:hover { color: var(--black); }
  .imp-paste-body {
    padding: 1.2rem 1.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
    overflow-y: auto;
  }
  .imp-paste-hint {
    font-size: 0.65rem;
    letter-spacing: 0.05em;
    color: var(--grey-400);
    line-height: 1.5;
  }
  .imp-paste-hint code {
    background: var(--grey-100);
    padding: 0.1rem 0.3rem;
    font-size: 0.65rem;
    border-radius: 2px;
    color: var(--grey-600);
  }
  .imp-paste-textarea {
    width: 100%;
    min-height: 260px;
    padding: 0.75rem;
    font-family: 'Courier New', monospace;
    font-size: 0.7rem;
    line-height: 1.5;
    border: 1px solid var(--grey-200);
    outline: none;
    resize: vertical;
    color: var(--black);
    background: var(--white);
    transition: border-color 150ms ease;
    box-sizing: border-box;
  }
  .imp-paste-textarea:focus { border-color: var(--black); }
  .imp-paste-textarea.error { border-color: #c0392b; }
  .imp-paste-error {
    font-size: 0.65rem;
    color: #c0392b;
    letter-spacing: 0.04em;
  }
  .imp-paste-footer {
    padding: 1rem 1.4rem;
    border-top: 1px solid var(--grey-200);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .imp-paste-count {
    font-size: var(--size-xs);
    color: var(--grey-400);
    letter-spacing: 0.06em;
  }
  .imp-paste-count strong { color: var(--black); }

  /* Empty state */
  .imp-empty {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--grey-400);
    font-size: var(--size-sm);
    letter-spacing: 0.08em;
  }

  /* REF group header row */
  .imp-group-header td {
    background: var(--grey-100);
    padding: 0.35rem 0.75rem;
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--grey-600);
    font-weight: 600;
    border-top: 2px solid var(--grey-200);
  }

  @media (max-width: 768px) {
    .imp-header { padding: 0.85rem 1rem; }
    .imp-table-wrap { padding: 1rem; }
    .imp-stats { padding: 0.5rem 1rem; gap: 1rem; }
  }

  @keyframes imp-soft-enter {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes imp-drop-content-enter {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .imp-page--drop .imp-header,
    .imp-page--drop .imp-stats,
    .imp-table-wrap--ready,
    .imp-drop-picker,
    .imp-drop-picker__content {
      animation: none;
    }
  }
`

// ── Componente ────────────────────────────────────────────────────────────────
export default function AdminImport({ active = true, catalogRevision = 0, usuario, onCatalogChanged }) {
  const authedUser = usuario
  const [rows, setRows] = useState([])
  const [selectedDrop, setSelectedDrop] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [showJson, setShowJson] = useState(false)

  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState(null)

  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [isImported, setIsImported] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [dropImagesReady, setDropImagesReady] = useState(false)
  const [loadedRevision, setLoadedRevision] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  // ── Carga inicial (Mirror del catálogo) ─────────────────────────────────────
  useEffect(() => {
    if (!active || !authedUser || loadedRevision === catalogRevision) return

    async function loadCatalog() {
      setLoadingInitial(true)
      try {
        const data = await adminExportFull()
        const initialRows = []
        
        data.productos.forEach(p => {
          const pRef = p.ref || p.id
          const pDrop = p.drop || 'Drop 1'
          const invEntry = data.inventario[p.id]
          
          if (!invEntry || !invEntry.variantes || invEntry.variantes.length === 0) {
            // Producto sin variantes
            initialRows.push(makeRow({
              _productId: p.id,
              ref: pRef,
              nombre: p.nombre,
              precio_venta: (p.precio ?? 0).toString(),
              precio_coste: (p.precio_coste ?? 0).toString(),
              margen: ((p.precio ?? 0) / (p.precio_coste || 1)).toFixed(2),
              genero: p.genero,
              imagen: p.imagen || (p.imagenes && p.imagenes[0]) || '',
              imagen2: (p.imagenes && p.imagenes[1]) || '',
              disponible: p.disponible !== false,
              _drop: pDrop,
              color: '',
              hex: '#888888',
              talla: '',
              stock: 0
            }))
          } else {
            // Producto con variantes
            invEntry.variantes.forEach(v => {
              const color = v.color || ''
              const hex = v.hex || '#000000'
              
              if (!v.tallas || Object.keys(v.tallas).length === 0) {
                // Color sin tallas específicas
                initialRows.push(makeRow({
                  _productId: p.id,
                  ref: pRef,
                  nombre: p.nombre,
                  precio_venta: (p.precio ?? 0).toString(),
                  precio_coste: (p.precio_coste ?? 0).toString(),
                  margen: ((p.precio ?? 0) / (p.precio_coste || 1)).toFixed(2),
                  genero: p.genero,
                  imagen: p.imagen || (p.imagenes && p.imagenes[0]) || '',
                  imagen2: (p.imagenes && p.imagenes[1]) || '',
                  disponible: p.disponible !== false,
                  _drop: pDrop,
                  color,
                  hex,
                  talla: '',
                  stock: 0
                }))
              } else {
                // Tallas para este color
                Object.entries(v.tallas).forEach(([talla, stock]) => {
                  initialRows.push(makeRow({
                    _productId: p.id,
                    ref: pRef,
                    nombre: p.nombre,
                    precio_venta: (p.precio ?? 0).toString(),
                    precio_coste: (p.precio_coste ?? 0).toString(),
                    margen: ((p.precio ?? 0) / (p.precio_coste || 1)).toFixed(2),
                    genero: p.genero,
                    imagen: p.imagen || (p.imagenes && p.imagenes[0]) || '',
                    imagen2: (p.imagenes && p.imagenes[1]) || '',
                    disponible: p.disponible !== false,
                    _drop: pDrop,
                    color,
                    hex,
                    talla,
                    stock: stock
                  }))
                })
              }
            })
          }
        })
        
        setRows(initialRows)
        setHasChanges(false)
        setLoadedRevision(catalogRevision)
      } catch (e) {
        console.error("Error al cargar el catálogo:", e)
        alert("Error cargando el catálogo global.")
      } finally {
        setLoadingInitial(false)
      }
    }
    loadCatalog()
  }, [active, authedUser, catalogRevision, loadedRevision])

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const updateRow = useCallback((id, field, value) => {
    setIsImported(false)
    setHasChanges(true)
    setRows(prev => prev.map(r => {
      if (r._id !== id) return r
      const updated = { ...r, [field]: value }
      // Auto-calcular precio_venta cuando cambia coste o margen
      if (field === 'precio_coste' || field === 'margen') {
        const coste = parseFloat(field === 'precio_coste' ? value : r.precio_coste) || 0
        const margen = parseFloat(field === 'margen' ? value : r.margen) || 1
        if (coste > 0) updated.precio_venta = (coste * margen).toFixed(2)
      }
      return updated
    }))
  }, [])

  const deleteRow = useCallback((id) => {
    if (!window.confirm('¿Seguro que quieres borrar esta fila? Se eliminará de la tienda al sincronizar.')) return
    setIsImported(false)
    setHasChanges(true)
    setRows(prev => prev.filter(r => r._id !== id))
  }, [])

  const addRow = useCallback((template = {}) => {
    setIsImported(false)
    setHasChanges(true)
    setRows(prev => {
      // Heredar ref/nombre/genero/precio de la última fila visible si no se pasa template
      const lastVisible = [...prev].reverse().find(r => r._drop === selectedDrop)
      const last = lastVisible || prev[prev.length - 1]
      return [...prev, makeRow({
        _drop: selectedDrop || 'Drop 1',
        ref: template.ref ?? last?.ref ?? '',
        nombre: template.nombre ?? last?.nombre ?? '',
        genero: template.genero ?? last?.genero ?? 'mujer',
        precio_coste: template.precio_coste ?? last?.precio_coste ?? '',
        margen: template.margen ?? last?.margen ?? 2,
        precio_venta: template.precio_venta ?? last?.precio_venta ?? '',
        imagen: template.imagen ?? last?.imagen ?? '',
        ...template,
      })]
    })
  }, [selectedDrop])

  const clearAll = () => {
    if (!window.confirm(`¿Vaciar tabla de ${selectedDrop}? Los productos de este drop se borrarán al sincronizar.`)) return
    setIsImported(false)
    setHasChanges(true)
    setRows(prev => prev.filter(r => r._drop !== selectedDrop))
  }

  // ── JSON → Rows ──────────────────────────────────────────────────────────────
  // Acepta el formato que exporta "Ver JSON":
  // [{ref, nombre, precio, precio_coste, genero, imagen, disponible, variantes:[{color,hex,tallas:{XS:0,...}}]}]
  function jsonToRows(jsonText) {
    let parsed
    try {
      parsed = JSON.parse(jsonText)
    } catch (e) {
      throw new Error('JSON inválido: ' + e.message)
    }
    if (!Array.isArray(parsed)) throw new Error('El JSON debe ser un array de productos [ {...}, ... ]')

    const newRows = []
    for (const prod of parsed) {
      const ref = String(prod.ref || prod.id || '').trim()
      const nombre = String(prod.nombre || '').trim()
      const precio_coste = prod.precio_coste ?? prod.coste ?? ''
      const precio_venta = prod.precio ?? prod.precio_venta ?? ''
      const genero = prod.genero || 'mujer'
      const imagen = prod.imagen || ''
      const disponible = prod.disponible !== false
      const margen = precio_coste && precio_venta
        ? Math.round((parseFloat(precio_venta) / parseFloat(precio_coste)) * 10) / 10
        : 2

      const variantes = Array.isArray(prod.variantes) ? prod.variantes : []

      if (variantes.length === 0) {
        // Sin variantes — una fila base sin color
        newRows.push(makeRow({ ref, nombre, precio_coste, precio_venta, margen, genero, imagen, disponible, color: '', hex: '#000000', stock: 0 }))
      } else {
        for (const v of variantes) {
          const color = String(v.color || '').trim()
          const hex = v.hex || '#000000'
          const tallas = v.tallas || {}
          const tallasKeys = Object.keys(tallas)
          if (tallasKeys.length === 0) {
            newRows.push(makeRow({ ref, nombre, precio_coste, precio_venta, margen, genero, imagen, disponible, color, hex, stock: 0 }))
          } else {
            for (const [talla, stock] of Object.entries(tallas)) {
              newRows.push(makeRow({ ref, nombre, precio_coste, precio_venta, margen, genero, imagen, disponible, color, hex, talla, stock: stock || 0 }))
            }
          }
        }
      }
    }

    if (newRows.length === 0) throw new Error('El JSON no contiene productos válidos')
    return newRows
  }

  function handlePasteImport() {
    setPasteError(null)
    try {
      const newRows = jsonToRows(pasteText).map(r => ({ ...r, _drop: selectedDrop || 'Drop 1' }))
      setIsImported(false)
      setHasChanges(true)
      setRows(prev => {
        // Si la tabla solo tiene filas de este drop y están vacías, reemplazarlas
        const dropRows = prev.filter(r => r._drop === selectedDrop)
        const otherRows = prev.filter(r => r._drop !== selectedDrop)
        const soloVacia = dropRows.length === 1 && !dropRows[0].ref && !dropRows[0].nombre
        return soloVacia ? [...otherRows, ...newRows] : [...prev, ...newRows]
      })
      setShowPaste(false)
      setPasteText('')
    } catch (e) {
      setPasteError(e.message)
    }
  }

  // Preview count for paste modal
  let pastePreviewCount = 0
  try { pastePreviewCount = jsonToRows(pasteText).length } catch {}

  // ── Agrupar por REF para stats ──────────────────────────────────────────────

  // ── Convertir filas a estructura de productos para importar ─────────────────
  function rowsToProductos() {
    // PRIMERA PASADA: construir un mapa nombre → ref (del drop 1 prioritariamente)
    // Para que si Drop 2 tiene el mismo nombre use el mismo ref del Drop 1
    const nombreToRef = {}
    rows.forEach(r => {
      const nombre = r.nombre.trim()
      const ref = r.ref.trim()
      if (nombre && ref && !nombreToRef[nombre]) {
        nombreToRef[nombre] = ref
      }
    })

    // SEGUNDA PASADA: agrupar por (nombre + color)
    // Clave compuesta: mismo nombre + mismo color → mismo producto (misma entrada)
    // mismo nombre + diferente color → producto diferente (entrada distinta)
    const byNombreColor = {}
    rows.forEach(r => {
      const nombre = r.nombre.trim()
      if (!nombre) return

      const colorKey = r.color.trim() || 'Único'
      // La clave única es nombre + color (insensible a mayúsculas para evitar duplicados)
      const groupKey = `${nombre.toLowerCase()}:::${colorKey.toLowerCase()}`

      if (!byNombreColor[groupKey]) {
        // Resolver qué ref usar: priorizar el ref del drop 1 si existe con ese nombre
        const resolvedRef = nombreToRef[nombre] || r.ref.trim() || nombre

        byNombreColor[groupKey] = {
          id: r._productId || undefined,
          ref: resolvedRef,
          nombre,
          precio: parseFloat(r.precio_venta) || 0,
          precio_coste: parseFloat(r.precio_coste) || 0,
          genero: r.genero,
          imagen: r.imagen,
          imagen2: r.imagen2 || '',
          disponible: r.disponible,
          drop: r._drop || 'Drop 1', // forzar valor válido siempre
          _colorMap: {
            [colorKey]: { color: colorKey, hex: r.hex, tallas: {} }
          },
        }
      }

      const prod = byNombreColor[groupKey]

      // Actualizar imagen si viene definida en esta fila
      if (r.imagen) prod.imagen = r.imagen
      if (r.imagen2) prod.imagen2 = r.imagen2
      // Si alguna fila dice disponible=true, el producto está disponible (true gana)
      if (r.disponible === true) prod.disponible = true


      if (!prod._colorMap[colorKey]) {
        prod._colorMap[colorKey] = { color: colorKey, hex: r.hex, tallas: {} }
      }
      if (r.talla) {
        prod._colorMap[colorKey].tallas[r.talla] = (prod._colorMap[colorKey].tallas[r.talla] || 0) + (parseInt(r.stock) || 0)
      }
    })

    return Object.values(byNombreColor).map(p => {
      const variantes = Object.values(p._colorMap)
      const { _colorMap, ...rest } = p
      // Construir array de imagenes: [imagen, imagen2] filtrando vacíos
      const imagenes = [rest.imagen, rest.imagen2].filter(Boolean)
      const { imagen2, ...restClean } = rest
      return { ...restClean, imagenes, variantes }
    })
  }

  const jsonPreview = JSON.stringify(rowsToProductos(), null, 2)

  // ── Sync (Sobrescribir global) ──────────────────────────────────────────────
  const handleImport = async () => {
    const productos = rowsToProductos()
    if (!hasChanges && isImported) return
    if (productos.length === 0 && rows.length > 0) return
    
    if (!window.confirm("¡ATENCIÓN!\n\nEsto sobrescribirá TODO el catálogo y el inventario fusionando este Drop con los demás.\nCualquier producto borrado de este Drop desaparecerá de la tienda permanentemente.\n\n¿Estás seguro de sincronizar?")) {
      return
    }

    setImporting(true)
    try {
      const res = await adminSyncAll(productos, authedUser)
      let msg = `✓ Sincronización exitosa: ${res.creados} creados, ${res.actualizados} actualizados`
      if (res.eliminados > 0) msg += `, ${res.eliminados} eliminados`
      setResult({ ok: true, msg })
      setIsImported(true)
      setHasChanges(false)
      onCatalogChanged?.()
      setTimeout(() => setResult(null), 5000)
    } catch (e) {
      setResult({ ok: false, msg: `Error: ${e.message}` })
      setTimeout(() => setResult(null), 6000)
    } finally {
      setImporting(false)
    }
  }

  const productosValidos = rowsToProductos().filter(p => p.nombre && p.ref)

  const visibleRows = useMemo(() => rows.filter(r => {
    if (r._drop !== selectedDrop) return false
    if (!searchTerm.trim()) return true
    const term = searchTerm.trim().toLowerCase()
    return (
      (r.ref && r.ref.toLowerCase().includes(term)) ||
      (r.nombre && r.nombre.toLowerCase().includes(term)) ||
      (r.color && r.color.toLowerCase().includes(term))
    )
  }), [rows, searchTerm, selectedDrop])
  const visibleRefsUnicos = [...new Set(visibleRows.map(r => r.ref).filter(Boolean))]
  const visibleStock = visibleRows.reduce((acc, r) => acc + (parseInt(r.stock) || 0), 0)
  const visibleImageSignature = useMemo(() => [
    ...new Set(
      visibleRows
        .flatMap(row => [row._imgPreview || row.imagen, row._imgPreview2 || row.imagen2])
        .filter(Boolean)
    ),
  ].join('\n'), [visibleRows])

  // ── Render ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active || !selectedDrop || loadingInitial) {
      setDropImagesReady(false)
      return
    }

    const imageUrls = visibleImageSignature ? visibleImageSignature.split('\n') : []

    if (imageUrls.length === 0) {
      setDropImagesReady(true)
      return
    }

    let cancelled = false
    setDropImagesReady(false)

    Promise.all(
      imageUrls.map(src => new Promise(resolve => {
        const img = new Image()
        img.onload = resolve
        img.onerror = resolve
        img.src = src
      }))
    ).then(() => {
      if (!cancelled) setDropImagesReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [active, loadingInitial, selectedDrop, visibleImageSignature])

  if (!selectedDrop) {
    return (
      <div className="imp-drop-picker" style={{
        minHeight: 'calc(100vh - 64px)',
        background: 'var(--white)',
        fontFamily: "'Inter', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}>
        <style>{css}</style>

        {/* Back to catalog */}
        <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem' }}>
          <a
            href="/clientes"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '0.65rem',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--grey-400)',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'color 200ms ease',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--black)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--grey-400)'}
          >
            ← CRM
          </a>
        </div>

        <div className="imp-drop-picker__content" style={{ textAlign: 'center', maxWidth: 520 }}>
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.6rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--grey-400)',
            marginBottom: '1rem',
          }}>
            Gestor de inventario
          </p>
          <h1 style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '1.6rem',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--black)',
            marginBottom: '0.75rem',
          }}>
            ¿Qué colección quieres editar?
          </h1>
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.8rem',
            color: 'var(--grey-400)',
            letterSpacing: '0.03em',
            marginBottom: '3rem',
            lineHeight: 1.6,
          }}>
            Los cambios se aplican únicamente a la colección seleccionada.<br/>
            Al sincronizar, ambas colecciones se fusionan en el catálogo global.
          </p>

          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { label: 'Drop 1', sub: 'Primera vuelta', drop: 'Drop 1' },
              { label: 'Drop 2', sub: 'Segunda vuelta', drop: 'Drop 2' },
            ].map(({ label, sub, drop }) => (
              <button
                key={drop}
                onClick={() => setSelectedDrop(drop)}
                style={{
                  width: 200,
                  height: 160,
                  borderRadius: '3px',
                  border: '1.5px solid var(--grey-200)',
                  background: 'var(--white)',
                  cursor: 'pointer',
                  transition: 'border-color 200ms ease, box-shadow 200ms ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontFamily: "'Inter', sans-serif",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--black)'
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--grey-200)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <span style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: 'var(--black)',
                }}>
                  {label}
                </span>
                <span style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '0.65rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--grey-400)',
                }}>
                  {sub}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="imp-page imp-page--drop">
      <style>{css}</style>

      {/* Header */}
      <header className="imp-header">
        <div className="imp-header__left">
          <button className="imp-header__brand" onClick={() => setSelectedDrop(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            ← Drops
          </button>
          <span className="imp-header__title">Sincronización · {selectedDrop}</span>
        </div>
        <div className="imp-header__right">
          <button className="imp-btn imp-btn--outline" onClick={() => setShowPaste(true)}>
            ↓ Pegar JSON
          </button>
          <button className="imp-btn imp-btn--outline" onClick={() => setShowJson(v => !v)}>
            {showJson ? 'Ocultar JSON' : 'Ver JSON (Todo)'}
          </button>
          <button className="imp-btn imp-btn--outline" onClick={clearAll}>
            Limpiar este drop
          </button>
          <button
            className="imp-btn imp-btn--primary"
            onClick={handleImport}
            disabled={importing || (!hasChanges && !isImported) || (productosValidos.length === 0 && rows.length > 0)}
            style={{ 
              background: (!hasChanges && !isImported) ? 'var(--grey-300)' : '#000', 
              color: (!hasChanges && !isImported) ? 'var(--grey-500)' : '#fff', 
              borderColor: (!hasChanges && !isImported) ? 'var(--grey-300)' : '#000' 
            }}
          >
            {isImported ? '✓ Sincronizado' : importing ? 'Sincronizando...' : (!hasChanges ? 'Sin cambios' : `Sincronizar todo (${productosValidos.length})`)}
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="imp-stats">
        <div className="imp-stat">Filas ({selectedDrop}): <strong>{rows.filter(r => r._drop === selectedDrop).length}</strong></div>
        <div className="imp-stat">REFs únicos: <strong>{visibleRefsUnicos.length}</strong></div>
        <div className="imp-stat">Stock total: <strong>{visibleStock}</strong></div>
        <div className="imp-stat">Total tienda: <strong>{productosValidos.length} productos</strong></div>
        <div style={{ marginLeft: 'auto' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar REF, nombre o color..."
            style={{
              padding: '0.35rem 0.6rem',
              fontSize: '0.65rem',
              letterSpacing: '0.04em',
              border: '1px solid var(--grey-200)',
              fontFamily: 'var(--font)',
              width: 200,
              outline: 'none',
              color: 'var(--black)',
              background: searchTerm ? 'var(--white)' : 'var(--grey-100)',
              transition: 'border-color 150ms ease',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--black)'}
            onBlur={e => e.target.style.borderColor = 'var(--grey-200)'}
          />
        </div>
      </div>

      {/* Table */}
      {/* Loader inicial */}
      {loadingInitial || !dropImagesReady ? (
        <div className="imp-table-wrap imp-table-wrap--ready">
          <CrmSkeleton rows={14} variant="import" />
        </div>
      ) : (
        <div className="imp-table-wrap">
          <table className="imp-table">
          <thead>
            <tr>
              <th style={{ width: 44 }}>Foto</th>
              <th style={{ minWidth: 180 }}>Nombre producto</th>
              <th style={{ width: 110 }}>REF</th>
              <th style={{ width: 120 }}>Color</th>
              <th style={{ width: 70 }}>Talla</th>
              <th style={{ width: 60 }}>Stock</th>
              <th style={{ width: 90 }}>Coste €</th>
              <th style={{ width: 70 }}>Margen ×</th>
              <th style={{ width: 90 }}>Precio venta €</th>
              <th style={{ width: 80 }}>Género</th>
              <th style={{ width: 130 }}>Imagen (ruta)</th>
              <th style={{ width: 52 }}>Activo</th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={13} style={{ textAlign: 'center', padding: '3rem', color: 'var(--grey-500)' }}>
                  No hay productos en {selectedDrop}. Añade uno o pega un JSON.
                </td>
              </tr>
            )}
            {visibleRows.map((row, idx) => {
              const prevRef = idx > 0 ? visibleRows[idx - 1].ref : null
              const showGroupHeader = row.ref && row.ref !== prevRef
              return (
                <Fragment key={`rowwrap-${row._id}`}>
                  {showGroupHeader && (
                    <tr key={`grp-${row.ref}`} className="">
                      <td colSpan={13} className="" style={{
                        background: 'var(--grey-100)',
                        padding: '0.3rem 0.75rem',
                        fontSize: '0.6rem',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'var(--grey-600)',
                        fontWeight: 600,
                        borderTop: '2px solid var(--grey-200)',
                      }}>
                        REF {row.ref} — {row.nombre || '(sin nombre)'}
                      </td>
                    </tr>
                  )}
                  <tr key={row._id} className={row.ref && row.nombre ? 'imp-row--new' : ''}>
                    {/* Foto preview */}
                    <td>
                      {row.imagen ? (
                        <img
                          src={row.imagen}
                          alt=""
                          className="imp-img-thumb"
                          onError={e => { e.target.style.display = 'none' }}
                        />
                      ) : (
                        <div className="imp-img-placeholder">?</div>
                      )}
                    </td>

                    {/* Nombre */}
                    <td>
                      <input
                        className="imp-cell-input"
                        value={row.nombre}
                        onChange={e => updateRow(row._id, 'nombre', e.target.value)}
                        placeholder="Nombre del producto"
                      />
                    </td>

                    {/* REF */}
                    <td>
                      <input
                        className="imp-cell-input"
                        value={row.ref}
                        onChange={e => updateRow(row._id, 'ref', e.target.value)}
                        placeholder="REF-001"
                        style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                      />
                    </td>

                    {/* Color — select dropdown */}
                    <td style={{ minWidth: 100 }}>
                      <select
                        className="imp-cell-select"
                        value={row.color}
                        onChange={e => {
                          const nombre = e.target.value
                          const preset = COLORES_PRESET.find(c => c.nombre === nombre)
                          updateRow(row._id, 'color', nombre)
                          updateRow(row._id, 'hex', preset ? preset.hex : '#888888')
                        }}
                      >
                        <option value="">— Sin color —</option>
                        {COLORES_PRESET.map(c => (
                          <option key={c.nombre} value={c.nombre}>{c.nombre}</option>
                        ))}
                      </select>
                    </td>

                    {/* Talla */}
                    <td>
                      <select
                        className="imp-cell-select"
                        value={row.talla}
                        onChange={e => updateRow(row._id, 'talla', e.target.value)}
                      >
                        {TALLAS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>

                    {/* Stock */}
                    <td>
                      <input
                        className="imp-cell-input"
                        type="number"
                        min="0"
                        value={row.stock}
                        onChange={e => updateRow(row._id, 'stock', e.target.value)}
                        style={{ textAlign: 'center' }}
                      />
                    </td>

                    {/* Coste */}
                    <td>
                      <input
                        className="imp-cell-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.precio_coste}
                        onChange={e => updateRow(row._id, 'precio_coste', e.target.value)}
                        placeholder="0.00"
                        style={{ textAlign: 'right' }}
                      />
                    </td>

                    {/* Margen */}
                    <td>
                      <input
                        className="imp-cell-input"
                        type="number"
                        min="1"
                        step="0.1"
                        value={row.margen}
                        onChange={e => updateRow(row._id, 'margen', e.target.value)}
                        style={{ textAlign: 'center' }}
                      />
                    </td>

                    {/* Precio venta */}
                    <td>
                      <input
                        className="imp-cell-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.precio_venta}
                        onChange={e => updateRow(row._id, 'precio_venta', e.target.value)}
                        placeholder="0.00"
                        style={{ textAlign: 'right', fontWeight: row.precio_venta ? 500 : 400 }}
                      />
                    </td>

                    {/* Género */}
                    <td>
                      <select
                        className="imp-cell-select"
                        value={row.genero}
                        onChange={e => updateRow(row._id, 'genero', e.target.value)}
                      >
                        {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </td>

                    {/* Imagen 1 + Imagen 2 — drag & drop */}
                    <td style={{ width: 130 }}>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
                        {/* Foto 1 */}
                        {/* Foto 1 */}
                        <div className="imp-img-drop-wrap">
                          {(row._imgPreview || row.imagen) && (
                            <button
                              className="imp-img-clear"
                              title="Quitar imagen 1"
                              onClick={e => {
                                e.preventDefault()
                                e.stopPropagation()
                                updateRow(row._id, 'imagen', '')
                                updateRow(row._id, '_imgPreview', null)
                              }}
                            >✕</button>
                          )}
                          <label
                            className={`imp-img-placeholder${row._dragOver ? ' drag-over' : ''}`}
                            style={row._imgPreview || row.imagen ? { border: 'none', background: 'transparent', padding: 0 } : {}}
                            onDragOver={e => { e.preventDefault(); updateRow(row._id, '_dragOver', true) }}
                            onDragLeave={() => updateRow(row._id, '_dragOver', false)}
                            onDrop={async e => {
                              e.preventDefault()
                              updateRow(row._id, '_dragOver', false)
                              const file = e.dataTransfer.files[0]
                              if (!file || !file.type.startsWith('image/')) return
                              const blobUrl = URL.createObjectURL(file)
                              const ext = file.name.split('.').pop() || 'jpg'
                              const refClean = (row.ref || 'img').replace(/[^a-zA-Z0-9-_]/g, '-')
                              updateRow(row._id, '_imgPreview', blobUrl)
                              try {
                                const renamedFile = new File([file], `${refClean}.${ext}`, { type: file.type })
                                const res = await adminUploadImage(renamedFile)
                                updateRow(row._id, 'imagen', res.url)
                              } catch (err) {
                                updateRow(row._id, '_imgPreview', null)
                                alert('Error subiendo la imagen: ' + err.message)
                              }
                            }}
                            title="Foto 1 (principal)"
                          >
                            {(row._imgPreview || row.imagen) ? (
                              <img src={row._imgPreview || row.imagen} alt="" className="imp-img-thumb" onError={e => { e.target.style.opacity = '0.3' }} />
                            ) : (
                              <span style={{ textAlign: 'center', lineHeight: 1.3, fontSize: '0.55rem' }}>↓<br/>foto 1</span>
                            )}
                            <input type="file" accept="image/*" onChange={async e => {
                              const file = e.target.files[0]
                              if (!file) return
                              const blobUrl = URL.createObjectURL(file)
                              const ext = file.name.split('.').pop() || 'jpg'
                              const refClean = (row.ref || 'img').replace(/[^a-zA-Z0-9-_]/g, '-')
                              updateRow(row._id, '_imgPreview', blobUrl)
                              try {
                                const renamedFile = new File([file], `${refClean}.${ext}`, { type: file.type })
                                const res = await adminUploadImage(renamedFile)
                                updateRow(row._id, 'imagen', res.url)
                              } catch (err) {
                                updateRow(row._id, '_imgPreview', null)
                                alert('Error subiendo la imagen: ' + err.message)
                              }
                              e.target.value = ''
                            }} />
                          </label>
                        </div>
                        {/* Foto 2 */}
                        <div className="imp-img-drop-wrap">
                          {(row._imgPreview2 || row.imagen2) && (
                            <button
                              className="imp-img-clear"
                              title="Quitar imagen 2"
                              onClick={e => {
                                e.preventDefault()
                                e.stopPropagation()
                                updateRow(row._id, 'imagen2', '')
                                updateRow(row._id, '_imgPreview2', null)
                              }}
                            >✕</button>
                          )}
                          <label
                            className={`imp-img-placeholder${row._dragOver2 ? ' drag-over' : ''}`}
                            style={row._imgPreview2 || row.imagen2 ? { border: 'none', background: 'transparent', padding: 0 } : {}}
                            onDragOver={e => { e.preventDefault(); updateRow(row._id, '_dragOver2', true) }}
                            onDragLeave={() => updateRow(row._id, '_dragOver2', false)}
                            onDrop={async e => {
                              e.preventDefault()
                              updateRow(row._id, '_dragOver2', false)
                              const file = e.dataTransfer.files[0]
                              if (!file || !file.type.startsWith('image/')) return
                              const blobUrl = URL.createObjectURL(file)
                              const ext = file.name.split('.').pop() || 'jpg'
                              const refClean = (row.ref || 'img').replace(/[^a-zA-Z0-9-_]/g, '-')
                              updateRow(row._id, '_imgPreview2', blobUrl)
                              try {
                                const renamedFile = new File([file], `${refClean}_2.${ext}`, { type: file.type })
                                const res = await adminUploadImage(renamedFile)
                                updateRow(row._id, 'imagen2', res.url)
                              } catch (err) {
                                updateRow(row._id, '_imgPreview2', null)
                                alert('Error subiendo la imagen 2: ' + err.message)
                              }
                            }}
                            title="Foto 2 (carrusel)"
                          >
                            {(row._imgPreview2 || row.imagen2) ? (
                              <img src={row._imgPreview2 || row.imagen2} alt="" className="imp-img-thumb" onError={e => { e.target.style.opacity = '0.3' }} />
                            ) : (
                              <span style={{ textAlign: 'center', lineHeight: 1.3, fontSize: '0.55rem' }}>+<br/>foto 2</span>
                            )}
                            <input type="file" accept="image/*" onChange={async e => {
                              const file = e.target.files[0]
                              if (!file) return
                              const blobUrl = URL.createObjectURL(file)
                              const ext = file.name.split('.').pop() || 'jpg'
                              const refClean = (row.ref || 'img').replace(/[^a-zA-Z0-9-_]/g, '-')
                              updateRow(row._id, '_imgPreview2', blobUrl)
                              try {
                                const renamedFile = new File([file], `${refClean}_2.${ext}`, { type: file.type })
                                const res = await adminUploadImage(renamedFile)
                                updateRow(row._id, 'imagen2', res.url)
                              } catch (err) {
                                updateRow(row._id, '_imgPreview2', null)
                                alert('Error subiendo la imagen 2: ' + err.message)
                              }
                              e.target.value = ''
                            }} />
                          </label>
                        </div>
                      </div>
                    </td>

                    {/* Disponible */}
                    <td style={{ textAlign: 'center' }}>
                      <label className="imp-toggle">
                        <input
                          type="checkbox"
                          checked={row.disponible}
                          onChange={e => updateRow(row._id, 'disponible', e.target.checked)}
                        />
                        <span className="imp-toggle__track" />
                        <span className="imp-toggle__thumb" />
                      </label>
                    </td>

                    {/* Delete */}
                    <td style={{ textAlign: 'center' }}>
                      <button className="imp-row-del" onClick={() => deleteRow(row._id)} title="Eliminar fila">
                        ✕
                      </button>
                    </td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>

        {/* Add row controls */}
        <div className="imp-add-row">
          <button className="imp-btn imp-btn--outline" onClick={() => addRow()}>
            + Añadir fila
          </button>
          <button className="imp-btn imp-btn--outline" onClick={() => {
            // Añadir una fila por cada talla con el mismo REF/color del último
            const last = visibleRows[visibleRows.length - 1]
            if (!last) return
            const restantes = TALLAS.filter(t => t !== last.talla)
            restantes.forEach(talla => addRow({ ...last, talla, _id: undefined, stock: 0 }))
          }}>
            + Resto de tallas
          </button>
        </div>
        </div>
      )}


      {/* JSON Preview panel */}
      {showJson && (
        <div className="imp-json-panel">
          <div className="imp-json-panel__title">
            <span>JSON generado ({productosValidos.length} productos)</span>
            <button
              className="imp-btn imp-btn--outline"
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.6rem' }}
              onClick={() => navigator.clipboard.writeText(jsonPreview)}
            >
              Copiar
            </button>
          </div>
          <div className="imp-json-box">{jsonPreview}</div>
        </div>
      )}

      {/* Result toast */}
      {result && (
        <div className={`imp-result ${result.ok ? 'imp-result--ok' : 'imp-result--err'}`}>
          {result.msg}
        </div>
      )}

      {/* Paste JSON Modal */}
      {showPaste && (
        <div
          className="imp-paste-overlay"
          onClick={e => { if (e.target === e.currentTarget) { setShowPaste(false); setPasteError(null) } }}
        >
          <div className="imp-paste-modal">
            <div className="imp-paste-header">
              <span className="imp-paste-header__title">Pegar JSON de productos</span>
              <button className="imp-paste-close" onClick={() => { setShowPaste(false); setPasteError(null) }}>✕</button>
            </div>

            <div className="imp-paste-body">
              <p className="imp-paste-hint">
                Pega el JSON generado por tu agente de IA. Formato aceptado:<br />
                <code>[{"{"}"ref":"REF-001","nombre":"...","precio":20,"precio_coste":10,"genero":"mujer","variantes":[{"{"}"color":"Negro","hex":"#000000","tallas":{"{"}"S":2,"M":1{"}"}{"}"}{"}"}]{"}"}]</code><br /><br />
                Las filas se <strong>añaden</strong> a la tabla — nunca se borran las existentes.
                Si la tabla está vacía, se reemplaza la fila en blanco.
              </p>

              <textarea
                className={`imp-paste-textarea${pasteError ? ' error' : ''}`}
                value={pasteText}
                onChange={e => { setPasteText(e.target.value); setPasteError(null) }}
                placeholder={'[\n  {\n    "ref": "REF-001",\n    "nombre": "Camiseta algodón",\n    "precio": 20,\n    "precio_coste": 10,\n    "genero": "mujer",\n    "variantes": [\n      { "color": "Negro", "hex": "#000000", "tallas": { "S": 2, "M": 1 } }\n    ]\n  }\n]'}
                spellCheck={false}
                autoFocus
              />

              {pasteError && (
                <div className="imp-paste-error">⚠ {pasteError}</div>
              )}
            </div>

            <div className="imp-paste-footer">
              <span className="imp-paste-count">
                {pasteText.trim()
                  ? pastePreviewCount > 0
                    ? <><strong>{pastePreviewCount}</strong> fila{pastePreviewCount !== 1 ? 's' : ''} detectada{pastePreviewCount !== 1 ? 's' : ''}</>
                    : 'JSON no válido aún'
                  : 'Pega el JSON arriba'
                }
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="imp-btn imp-btn--outline"
                  onClick={() => { setShowPaste(false); setPasteError(null); setPasteText('') }}
                >
                  Cancelar
                </button>
                <button
                  className="imp-btn imp-btn--primary"
                  onClick={handlePasteImport}
                  disabled={!pasteText.trim() || pastePreviewCount === 0}
                >
                  Añadir {pastePreviewCount > 0 ? `${pastePreviewCount} filas` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
