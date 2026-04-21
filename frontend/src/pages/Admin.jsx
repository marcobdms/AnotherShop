/**
 * Admin.jsx — Panel de administración del catálogo
 * Ruta: /admin
 * Auth: token guardado en sessionStorage (se borra al cerrar la pestaña)
 */

import { useState, useEffect, useCallback } from 'react'
import {
  adminFetchProducts,
  adminCreateProduct,
  adminUpdateProduct,
  adminToggleDisponible,
  adminDeleteProduct,
  adminFetchMeta,
  adminUpdateMeta,
  formatPrice,
} from '../api/catalog'

// ── Constantes ─────────────────────────────────────────────────────────────────
const TALLAS_OPCIONES = ['XS', 'S', 'M', 'L', 'XL']
const GENEROS_OPCIONES = ['mujer', 'hombre', 'unisex']

const PRODUCTO_VACIO = {
  nombre: '',
  precio: '',
  categoria: 'sin_categoria',
  genero: 'mujer',
  tallas: ['XS', 'S', 'M', 'L'],
  imagen: '',
  descripcion: '',
  disponible: true,
  marca: '',
}

// ── Estilos ────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #0a0a0f;
    --surface:   #111118;
    --surface2:  #1a1a24;
    --border:    #2a2a3a;
    --accent:    #7c6aff;
    --accent2:   #ff6a6a;
    --success:   #4ade80;
    --text:      #e8e8f0;
    --muted:     #6b6b80;
    --mono:      'Space Mono', monospace;
    --sans:      'DM Sans', sans-serif;
  }

  body { background: var(--bg); color: var(--text); font-family: var(--sans); }

  .admin-wrap {
    min-height: 100vh;
    background: var(--bg);
    font-family: var(--sans);
  }

  /* ── Login ── */
  .login-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(ellipse at 50% 0%, #1a1030 0%, var(--bg) 70%);
  }
  .login-card {
    width: 340px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 40px 32px;
  }
  .login-card h1 {
    font-family: var(--mono);
    font-size: 13px;
    letter-spacing: 0.15em;
    color: var(--accent);
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .login-card p {
    font-size: 13px;
    color: var(--muted);
    margin-bottom: 28px;
  }
  .login-card input {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
    color: var(--text);
    font-family: var(--mono);
    font-size: 13px;
    outline: none;
    margin-bottom: 12px;
    transition: border-color 0.2s;
  }
  .login-card input:focus { border-color: var(--accent); }
  .login-card input::placeholder { color: var(--muted); }
  .btn-primary {
    width: 100%;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 12px;
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .btn-primary:hover { opacity: 0.85; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .error-msg {
    font-size: 12px;
    color: var(--accent2);
    margin-top: 8px;
    text-align: center;
  }

  /* ── Header ── */
  .admin-header {
    border-bottom: 1px solid var(--border);
    padding: 0 32px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--surface);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .admin-header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .admin-logo {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.18em;
    color: var(--accent);
    text-transform: uppercase;
  }
  .admin-badge {
    font-family: var(--mono);
    font-size: 10px;
    padding: 3px 8px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--muted);
    letter-spacing: 0.1em;
  }
  .tab-bar {
    display: flex;
    gap: 4px;
  }
  .tab-btn {
    background: none;
    border: none;
    padding: 6px 14px;
    border-radius: 6px;
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    cursor: pointer;
    transition: all 0.15s;
  }
  .tab-btn.active {
    background: var(--surface2);
    color: var(--text);
    border: 1px solid var(--border);
  }
  .tab-btn:hover:not(.active) { color: var(--text); }
  .btn-logout {
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 14px;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--muted);
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-logout:hover { border-color: var(--accent2); color: var(--accent2); }

  /* ── Main content ── */
  .admin-main { padding: 28px 32px; max-width: 1400px; }

  /* ── Toolbar ── */
  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .search-input {
    flex: 1;
    min-width: 200px;
    max-width: 320px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 9px 14px;
    color: var(--text);
    font-family: var(--sans);
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s;
  }
  .search-input:focus { border-color: var(--accent); }
  .search-input::placeholder { color: var(--muted); }
  .filter-select {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 9px 12px;
    color: var(--text);
    font-family: var(--sans);
    font-size: 13px;
    outline: none;
    cursor: pointer;
  }
  .stats {
    margin-left: auto;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--muted);
  }
  .btn-new {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 9px 18px;
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    transition: opacity 0.2s;
    white-space: nowrap;
  }
  .btn-new:hover { opacity: 0.85; }

  /* ── Tabla ── */
  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  thead th {
    background: var(--surface);
    padding: 11px 14px;
    text-align: left;
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  tbody tr {
    border-bottom: 1px solid var(--border);
    transition: background 0.1s;
  }
  tbody tr:last-child { border-bottom: none; }
  tbody tr:hover { background: var(--surface); }
  td {
    padding: 11px 14px;
    vertical-align: middle;
  }
  .td-id {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--muted);
    width: 48px;
  }
  .td-nombre { max-width: 240px; }
  .td-nombre span {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
  }
  .td-precio {
    font-family: var(--mono);
    font-size: 12px;
    white-space: nowrap;
  }
  .td-genero {
    font-size: 12px;
    color: var(--muted);
    text-transform: capitalize;
  }
  .badge-disponible {
    display: inline-block;
    padding: 3px 9px;
    border-radius: 20px;
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    border: none;
    transition: opacity 0.2s;
  }
  .badge-disponible:hover { opacity: 0.75; }
  .badge-si { background: rgba(74,222,128,0.15); color: var(--success); border: 1px solid rgba(74,222,128,0.3); }
  .badge-no { background: rgba(255,106,106,0.12); color: var(--accent2); border: 1px solid rgba(255,106,106,0.25); }

  .td-actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .btn-edit, .btn-delete {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 5px 12px;
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .btn-edit { color: var(--text); }
  .btn-edit:hover { border-color: var(--accent); color: var(--accent); }
  .btn-delete { color: var(--muted); }
  .btn-delete:hover { border-color: var(--accent2); color: var(--accent2); }

  /* ── Modal ── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 20px;
  }
  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    width: 100%;
    max-width: 560px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 28px;
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }
  .modal-title {
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .btn-close {
    background: none;
    border: none;
    color: var(--muted);
    font-size: 20px;
    cursor: pointer;
    line-height: 1;
    transition: color 0.15s;
  }
  .btn-close:hover { color: var(--text); }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-group.full { grid-column: 1 / -1; }
  label {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .form-input, .form-select, .form-textarea {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    color: var(--text);
    font-family: var(--sans);
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s;
  }
  .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: var(--accent); }
  .form-textarea { resize: vertical; min-height: 72px; }
  .form-select { cursor: pointer; }

  .tallas-grid {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .talla-chip {
    padding: 6px 12px;
    border-radius: 6px;
    font-family: var(--mono);
    font-size: 11px;
    cursor: pointer;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--muted);
    transition: all 0.15s;
    user-select: none;
  }
  .talla-chip.selected {
    background: rgba(124,106,255,0.2);
    border-color: var(--accent);
    color: var(--accent);
  }

  .toggle-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
  }
  .toggle {
    width: 42px;
    height: 24px;
    background: var(--border);
    border-radius: 12px;
    cursor: pointer;
    position: relative;
    transition: background 0.2s;
    border: none;
    flex-shrink: 0;
  }
  .toggle.on { background: var(--accent); }
  .toggle::after {
    content: '';
    position: absolute;
    width: 18px;
    height: 18px;
    background: #fff;
    border-radius: 50%;
    top: 3px;
    left: 3px;
    transition: transform 0.2s;
  }
  .toggle.on::after { transform: translateX(18px); }
  .toggle-label { font-size: 13px; color: var(--text); }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
  }
  .btn-cancel {
    background: none;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 20px;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--muted);
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-cancel:hover { border-color: var(--text); color: var(--text); }
  .btn-save {
    background: var(--accent);
    border: none;
    border-radius: 8px;
    padding: 10px 24px;
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #fff;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .btn-save:hover { opacity: 0.85; }
  .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Toast ── */
  .toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 300;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.06em;
    animation: slideIn 0.2s ease;
    max-width: 320px;
  }
  .toast.success {
    background: rgba(74,222,128,0.15);
    border: 1px solid rgba(74,222,128,0.4);
    color: var(--success);
  }
  .toast.error {
    background: rgba(255,106,106,0.12);
    border: 1px solid rgba(255,106,106,0.35);
    color: var(--accent2);
  }
  @keyframes slideIn {
    from { transform: translateY(10px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  /* ── Meta form ── */
  .meta-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 28px;
    max-width: 520px;
  }
  .meta-card h2 {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 22px;
  }

  /* ── Confirm overlay ── */
  .confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 250;
  }
  .confirm-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 28px;
    width: 320px;
    text-align: center;
  }
  .confirm-card p { font-size: 14px; margin-bottom: 8px; }
  .confirm-card small { font-size: 12px; color: var(--muted); display: block; margin-bottom: 22px; }
  .confirm-actions { display: flex; gap: 10px; justify-content: center; }
  .btn-confirm-delete {
    background: rgba(255,106,106,0.15);
    border: 1px solid rgba(255,106,106,0.35);
    border-radius: 8px;
    padding: 9px 20px;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--accent2);
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .btn-confirm-delete:hover { opacity: 0.8; }

  /* ── Loading ── */
  .loading-row td {
    text-align: center;
    padding: 48px;
    color: var(--muted);
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.1em;
  }
`

// ── Componente Toast ───────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])
  return <div className={`toast ${type}`}>{msg}</div>
}

// ── Componente Modal Producto ──────────────────────────────────────────────────
function ProductoModal({ producto, onSave, onClose, saving }) {
  const [form, setForm] = useState(
    producto
      ? {
          nombre: producto.nombre,
          precio: producto.precio,
          categoria: producto.categoria,
          genero: producto.genero,
          tallas: [...producto.tallas],
          imagen: producto.imagen,
          descripcion: producto.descripcion,
          disponible: producto.disponible,
          marca: producto.marca || '',
        }
      : { ...PRODUCTO_VACIO }
  )

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleTalla = (t) =>
    set('tallas', form.tallas.includes(t) ? form.tallas.filter(x => x !== t) : [...form.tallas, t])

  const handleSave = () => {
    const payload = { ...form, precio: parseFloat(form.precio) || 0 }
    onSave(payload)
  }

  const isNew = !producto

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{isNew ? 'Nuevo producto' : `Editando #${producto.id}`}</span>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="form-grid">
          <div className="form-group full">
            <label>Nombre</label>
            <input className="form-input" value={form.nombre} onChange={e => set('nombre', e.target.value)} />
          </div>

          <div className="form-group">
            <label>Precio (€)</label>
            <input className="form-input" type="number" step="0.01" value={form.precio} onChange={e => set('precio', e.target.value)} />
          </div>

          <div className="form-group">
            <label>Género</label>
            <select className="form-select" value={form.genero} onChange={e => set('genero', e.target.value)}>
              {GENEROS_OPCIONES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div className="form-group full">
            <label>Imagen (ruta o URL)</label>
            <input className="form-input" value={form.imagen} placeholder="/images/093.jpg" onChange={e => set('imagen', e.target.value)} />
          </div>

          <div className="form-group full">
            <label>Descripción / color / talla exacta</label>
            <textarea className="form-textarea" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
          </div>

          <div className="form-group">
            <label>Marca</label>
            <input className="form-input" value={form.marca} placeholder="Abercrombie…" onChange={e => set('marca', e.target.value)} />
          </div>

          <div className="form-group">
            <label>Categoría</label>
            <input className="form-input" value={form.categoria} onChange={e => set('categoria', e.target.value)} />
          </div>

          <div className="form-group full">
            <label>Tallas disponibles</label>
            <div className="tallas-grid">
              {TALLAS_OPCIONES.map(t => (
                <span
                  key={t}
                  className={`talla-chip ${form.tallas.includes(t) ? 'selected' : ''}`}
                  onClick={() => toggleTalla(t)}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="form-group full">
            <label>Disponibilidad</label>
            <div className="toggle-wrap">
              <button
                className={`toggle ${form.disponible ? 'on' : ''}`}
                onClick={() => set('disponible', !form.disponible)}
              />
              <span className="toggle-label">{form.disponible ? 'Disponible' : 'No disponible'}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="btn-save" onClick={handleSave} disabled={saving || !form.nombre}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente Tab Productos ───────────────────────────────────────────────────
function TabProductos({ token, onToast }) {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroDisp, setFiltroDisp] = useState('todos')
  const [modal, setModal] = useState(null) // null | { modo: 'crear' | 'editar', producto? }
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null) // { id, nombre }

  const load = useCallback(async () => {
    try {
      const data = await adminFetchProducts(token)
      setProductos(data)
    } catch (e) {
      onToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [token, onToast])

  useEffect(() => { load() }, [load])

  const filtered = productos.filter(p => {
    const matchSearch = p.nombre.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search)
    const matchDisp =
      filtroDisp === 'todos' ? true :
      filtroDisp === 'si' ? p.disponible :
      !p.disponible
    return matchSearch && matchDisp
  })

  const disponibles = productos.filter(p => p.disponible).length

  const handleToggle = async (p) => {
    try {
      await adminToggleDisponible(token, p.id, !p.disponible)
      setProductos(prev => prev.map(x => x.id === p.id ? { ...x, disponible: !x.disponible } : x))
    } catch (e) {
      onToast(e.message, 'error')
    }
  }

  const handleSave = async (form) => {
    setSaving(true)
    try {
      if (modal.modo === 'crear') {
        const nuevo = await adminCreateProduct(token, form)
        setProductos(prev => [...prev, nuevo])
        onToast(`Producto #${nuevo.id} creado`, 'success')
      } else {
        const updated = await adminUpdateProduct(token, modal.producto.id, form)
        setProductos(prev => prev.map(x => x.id === updated.id ? updated : x))
        onToast('Cambios guardados', 'success')
      }
      setModal(null)
    } catch (e) {
      onToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await adminDeleteProduct(token, confirm.id)
      setProductos(prev => prev.filter(x => x.id !== confirm.id))
      onToast(`Producto #${confirm.id} eliminado`, 'success')
      setConfirm(null)
    } catch (e) {
      onToast(e.message, 'error')
    }
  }

  return (
    <>
      <div className="admin-main">
        <div className="toolbar">
          <input
            className="search-input"
            placeholder="Buscar por nombre o ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="filter-select" value={filtroDisp} onChange={e => setFiltroDisp(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="si">Disponibles</option>
            <option value="no">No disponibles</option>
          </select>
          <span className="stats">{disponibles}/{productos.length} disponibles · {filtered.length} mostrados</span>
          <button className="btn-new" onClick={() => setModal({ modo: 'crear' })}>+ Nuevo</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Precio</th>
                <th>Género</th>
                <th>Tallas</th>
                <th>Disponible</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="loading-row"><td colSpan={7}>Cargando catálogo…</td></tr>
              ) : filtered.length === 0 ? (
                <tr className="loading-row"><td colSpan={7}>Sin resultados</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id}>
                  <td className="td-id">{p.id}</td>
                  <td className="td-nombre"><span title={p.nombre}>{p.nombre}</span></td>
                  <td className="td-precio">{formatPrice(p.precio)}</td>
                  <td className="td-genero">{p.genero}</td>
                  <td style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{p.tallas.join(', ')}</td>
                  <td>
                    <button
                      className={`badge-disponible ${p.disponible ? 'badge-si' : 'badge-no'}`}
                      onClick={() => handleToggle(p)}
                      title="Click para cambiar"
                    >
                      {p.disponible ? 'Sí' : 'No'}
                    </button>
                  </td>
                  <td>
                    <div className="td-actions">
                      <button className="btn-edit" onClick={() => setModal({ modo: 'editar', producto: p })}>Editar</button>
                      <button className="btn-delete" onClick={() => setConfirm({ id: p.id, nombre: p.nombre })}>Borrar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <ProductoModal
          producto={modal.producto}
          onSave={handleSave}
          onClose={() => setModal(null)}
          saving={saving}
        />
      )}

      {confirm && (
        <div className="confirm-overlay">
          <div className="confirm-card">
            <p>¿Eliminar producto?</p>
            <small>#{confirm.id} — {confirm.nombre}</small>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setConfirm(null)}>Cancelar</button>
              <button className="btn-confirm-delete" onClick={handleDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Componente Tab Meta ────────────────────────────────────────────────────────
function TabMeta({ token, onToast }) {
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    adminFetchMeta(token)
      .then(setForm)
      .catch(e => onToast(e.message, 'error'))
  }, [token, onToast])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await adminUpdateMeta(token, form)
      onToast('Meta actualizada', 'success')
    } catch (e) {
      onToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!form) return <div className="admin-main" style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>Cargando…</div>

  return (
    <div className="admin-main">
      <div className="meta-card">
        <h2>Datos de la tienda</h2>
        <div className="form-grid">
          {[
            { k: 'marca', label: 'Marca' },
            { k: 'moneda', label: 'Moneda' },
            { k: 'whatsapp', label: 'WhatsApp' },
            { k: 'whatsapp_mensaje', label: 'Mensaje WhatsApp' },
            { k: 'paypal', label: 'PayPal' },
            { k: 'recargo_paypal', label: 'Texto recargo PayPal' },
          ].map(({ k, label }) => (
            <div key={k} className={`form-group ${['whatsapp_mensaje', 'recargo_paypal'].includes(k) ? 'full' : ''}`}>
              <label>{label}</label>
              <input className="form-input" value={form[k] || ''} onChange={e => set(k, e.target.value)} />
            </div>
          ))}
        </div>
        <div className="modal-footer" style={{ marginTop: 20 }}>
          <button className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem('admin_token') || '')
  const [inputToken, setInputToken] = useState('')
  const [authError, setAuthError] = useState('')
  const [logging, setLogging] = useState(false)
  const [tab, setTab] = useState('productos')
  const [toast, setToast] = useState(null)

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type, key: Date.now() })
  }, [])

  const handleLogin = async () => {
    if (!inputToken.trim()) return
    setLogging(true)
    setAuthError('')
    try {
      // Verificamos el token intentando cargar los productos
      await adminFetchProducts(inputToken.trim())
      sessionStorage.setItem('admin_token', inputToken.trim())
      setToken(inputToken.trim())
    } catch (e) {
      setAuthError('Token incorrecto o backend no disponible')
    } finally {
      setLogging(false)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('admin_token')
    setToken('')
    setInputToken('')
  }

  return (
    <>
      <style>{css}</style>
      <div className="admin-wrap">
        {!token ? (
          <div className="login-screen">
            <div className="login-card">
              <h1>Another NPC Shop</h1>
              <p>Panel de administración</p>
              <input
                type="password"
                placeholder="Admin token"
                value={inputToken}
                onChange={e => setInputToken(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
              <button className="btn-primary" onClick={handleLogin} disabled={logging || !inputToken}>
                {logging ? 'Verificando…' : 'Acceder'}
              </button>
              {authError && <p className="error-msg">{authError}</p>}
            </div>
          </div>
        ) : (
          <>
            <header className="admin-header">
              <div className="admin-header-left">
                <span className="admin-logo">Another NPC Shop</span>
                <span className="admin-badge">Admin</span>
                <div className="tab-bar">
                  <button className={`tab-btn ${tab === 'productos' ? 'active' : ''}`} onClick={() => setTab('productos')}>Productos</button>
                  <button className={`tab-btn ${tab === 'meta' ? 'active' : ''}`} onClick={() => setTab('meta')}>Tienda</button>
                </div>
              </div>
              <button className="btn-logout" onClick={handleLogout}>Salir</button>
            </header>

            {tab === 'productos' && <TabProductos token={token} onToast={showToast} />}
            {tab === 'meta' && <TabMeta token={token} onToast={showToast} />}
          </>
        )}

        {toast && (
          <Toast
            key={toast.key}
            msg={toast.msg}
            type={toast.type}
            onDone={() => setToast(null)}
          />
        )}
      </div>
    </>
  )
}