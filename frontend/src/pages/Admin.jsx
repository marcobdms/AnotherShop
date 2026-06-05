/**
 * Admin.jsx — Panel de administración
 * Ruta: /admin
 * Auth: contraseña fija comparada en frontend (Marco23.)
 */

import { useState, useEffect, useCallback } from 'react'
import { adminFetchProducts, adminToggleDisponible, formatPrice } from '../api/catalog'

const ADMIN_PASSWORD = 'Marco23.'

// ── Estilos específicos de Admin (login y toggle) ───────────────────────────────
const css = `
  .adm-login {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--white);
    font-family: var(--font);
  }
  .adm-login__card {
    width: 320px;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .adm-login__brand {
    font-size: var(--size-xs);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    font-weight: 500;
    color: var(--black);
    margin-bottom: 0.25rem;
  }
  .adm-login__title {
    font-size: var(--size-sm);
    color: var(--grey-400);
    letter-spacing: 0.08em;
    font-weight: 300;
  }
  .adm-login__divider {
    height: 1px;
    background: var(--grey-200);
    margin: 0.25rem 0;
  }
  .adm-login__input {
    width: 100%;
    border: 1px solid var(--grey-200);
    padding: 0.85rem 1rem;
    font-family: var(--font);
    font-size: var(--size-sm);
    color: var(--black);
    background: var(--white);
    outline: none;
    transition: border-color 200ms ease;
    letter-spacing: 0.05em;
  }
  .adm-login__input:focus { border-color: var(--black); }
  .adm-login__input::placeholder { color: var(--grey-400); letter-spacing: 0.05em; }
  .adm-login__btn {
    width: 100%;
    background: var(--black);
    color: var(--white);
    border: none;
    padding: 0.85rem 1rem;
    font-family: var(--font);
    font-size: var(--size-xs);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    cursor: pointer;
    transition: opacity 200ms ease;
  }
  .adm-login__btn:hover:not(:disabled) { opacity: 0.75; }
  .adm-login__btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .adm-login__error {
    font-size: var(--size-xs);
    color: #c0392b;
    letter-spacing: 0.08em;
    text-align: center;
  }

  .adm-header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--white);
    border-bottom: 1px solid var(--grey-200);
    padding: 1.25rem var(--gap);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .adm-header__brand {
    font-size: var(--size-xs);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    font-weight: 500;
  }
  .adm-header__right {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }
  .adm-header__badge {
    font-size: var(--size-xs);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--grey-400);
  }
  .adm-header__logout {
    font-size: var(--size-xs);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--grey-600);
    border-bottom: 1px solid transparent;
    padding-bottom: 1px;
    transition: color 200ms ease, border-color 200ms ease;
    cursor: pointer;
    background: none;
    border-top: none;
    border-left: none;
    border-right: none;
    font-family: var(--font);
  }
  .adm-header__logout:hover { color: var(--black); border-bottom-color: var(--black); }

  /* Search Bar */
  .adm-search {
    margin: 2rem auto 2.5rem auto; /* Añadido margin-bottom para separar de la imagen */
    padding: 0 var(--gap);
    max-width: 1200px;
    width: 100%;
  }
  .adm-search__input {
    width: 100%;
    max-width: 400px;
    padding: 0.85rem 1rem;
    font-family: var(--font);
    font-size: var(--size-sm);
    color: var(--black);
    border: 1px solid var(--grey-200);
    outline: none;
    transition: border-color 200ms ease;
  }
  .adm-search__input:focus {
    border-color: var(--black);
  }
  .adm-search__input::placeholder {
    color: var(--grey-400);
    letter-spacing: 0.05em;
  }

  /* Toggle Switcher */
  .adm-toggle-container {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--grey-200);
  }
  .adm-toggle-label-text {
    font-size: var(--size-xs);
    color: var(--grey-400);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 0.8rem;
    display: block;
  }
  .adm-toggle {
    position: relative;
    width: 54px;
    height: 30px;
    cursor: pointer;
    display: inline-block;
  }
  .adm-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }
  .adm-toggle__track {
    position: absolute;
    inset: 0;
    background: var(--grey-200);
    border-radius: 30px;
    transition: background 250ms ease;
  }
  .adm-toggle input:checked + .adm-toggle__track {
    background: #22c55e;
  }
  .adm-toggle__thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 24px;
    height: 24px;
    background: var(--white);
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0,0,0,0.18);
    transition: transform 250ms ease;
    pointer-events: none;
  }
  .adm-toggle input:checked ~ .adm-toggle__thumb {
    transform: translateX(24px);
  }

  /* Historial Dropdown */
  .adm-history {
    position: absolute;
    top: 3.5rem;
    right: 1.5rem;
    width: 320px;
    background: var(--white);
    border: 1px solid var(--grey-200);
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    z-index: 100;
    max-height: 400px;
    overflow-y: auto;
    font-family: var(--font);
  }
  .adm-history__header {
    padding: 1rem;
    border-bottom: 1px solid var(--grey-200);
    font-size: var(--size-xs);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--black);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .adm-history__close {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--grey-400);
  }
  .adm-history__close:hover { color: var(--black); }
  .adm-history__list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .adm-history__item {
    padding: 1rem;
    border-bottom: 1px solid var(--grey-200);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  .adm-history__text {
    font-size: var(--size-sm);
    color: var(--grey-600);
    line-height: 1.4;
  }
  .adm-history__undo {
    background: none;
    border: 1px solid var(--grey-200);
    padding: 0.25rem 0.5rem;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .adm-history__undo:hover {
    background: var(--grey-100);
    border-color: var(--black);
  }
  .adm-history__empty {
    padding: 2rem 1rem;
    text-align: center;
    font-size: var(--size-sm);
    color: var(--grey-400);
  }

  /* Toast */
  .adm-toast {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 500;
    padding: 0.85rem 1.25rem;
    font-family: var(--font);
    font-size: var(--size-xs);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    border: 1px solid;
    animation: adm-slide-in 0.2s ease;
    max-width: 280px;
    background: var(--white);
  }
  .adm-toast.success { border-color: #22c55e; color: #16a34a; }
  .adm-toast.error   { border-color: #c0392b; color: #c0392b; }

  @keyframes adm-slide-in {
    from { transform: translateY(8px); opacity: 0; }
    to   { transform: translateY(0);   opacity: 1; }
  }
`

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800)
    return () => clearTimeout(t)
  }, [onDone])
  return <div className={`adm-toast ${type}`}>{msg}</div>
}

// ── Login Screen ───────────────────────────────────────────────────────────────
function LoginScreen({ onAuth }) {
  const [pwd, setPwd] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = () => {
    if (pwd === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_auth', '1')
      onAuth()
    } else {
      setError('Contraseña incorrecta')
      setPwd('')
    }
  }

  return (
    <div className="adm-login">
      <div className="adm-login__card">
        <div>
          <p className="adm-login__brand">Another NPC Shop</p>
          <p className="adm-login__title">Panel de administración</p>
        </div>
        <div className="adm-login__divider" />
        <input
          className="adm-login__input"
          type="password"
          placeholder="Contraseña"
          value={pwd}
          onChange={e => { setPwd(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoFocus
        />
        <button
          className="adm-login__btn"
          onClick={handleSubmit}
          disabled={!pwd}
        >
          Acceder
        </button>
        {error && <p className="adm-login__error">{error}</p>}
      </div>
    </div>
  )
}

// ── Admin Panel (Contenedor Principal) ─────────────────────────────────────────
function AdminPanel({ onLogout }) {
  const [productos, setProductos] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [toast, setToast] = useState(null)
  const [error, setError] = useState(null)

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type, key: Date.now() })
  }, [])

  useEffect(() => {
    adminFetchProducts()
      .then(data => {
        setProductos(data)
        setError(null)
      })
      .catch(e => {
        showToast(e.message, 'error')
        setError(e.message)
      })
      .finally(() => setLoading(false))
  }, [showToast])

  const handleToggle = useCallback(async (producto, nuevoEstado) => {
    try {
      await adminToggleDisponible(producto.id, nuevoEstado)
      setProductos(prev =>
        prev.map(p => p.id === producto.id ? { ...p, disponible: nuevoEstado } : p)
      )
      // Si el producto seleccionado es el que acabamos de togglear, lo actualizamos también
      setSelectedProduct(prev => prev && prev.id === producto.id ? { ...prev, disponible: nuevoEstado } : prev)
      
      const accionText = nuevoEstado ? 'disponible' : 'agotada'
      
      setHistory(prev => [
        {
          id: Date.now(),
          productoId: producto.id,
          nombre: producto.nombre,
          estadoAnterior: !nuevoEstado,
          nuevoEstado: nuevoEstado,
          mensaje: `${producto.nombre} marcada como ${accionText}`,
        },
        ...prev
      ])

      showToast(`${producto.nombre} — ${accionText}`, 'success')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }, [showToast])

  const handleUndo = useCallback(async (itemHistorial) => {
    try {
      await adminToggleDisponible(itemHistorial.productoId, itemHistorial.estadoAnterior)
      setProductos(prev =>
        prev.map(p => p.id === itemHistorial.productoId ? { ...p, disponible: itemHistorial.estadoAnterior } : p)
      )
      setSelectedProduct(prev => prev && prev.id === itemHistorial.productoId ? { ...prev, disponible: itemHistorial.estadoAnterior } : prev)
      
      setHistory(prev => prev.filter(h => h.id !== itemHistorial.id))
      
      showToast(`Deshecho: ${itemHistorial.nombre}`, 'success')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }, [showToast])

  // Filtrar catálogo por ID o Nombre
  const listaFiltrada = productos.filter(p => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (p.id && p.id.toLowerCase().includes(term)) || 
           (p.nombre && p.nombre.toLowerCase().includes(term))
  })

  // Ordenar catálogo: agotados al final (igual que producción)
  const lista = [...listaFiltrada].sort((a, b) => {
    if (a.disponible === b.disponible) return 0;
    return a.disponible ? -1 : 1;
  });

  return (
    <>
      <header className="adm-header" style={{ position: 'relative' }}>
        <span className="adm-header__brand">Another NPC Shop</span>
        <div className="adm-header__right">
          <button className="adm-header__logout" onClick={() => setShowHistory(!showHistory)}>
            Cambios ({history.length})
          </button>
          <button className="adm-header__logout" onClick={onLogout}>Salir</button>
        </div>
        
        {showHistory && (
          <div className="adm-history">
            <div className="adm-history__header">
              <span>Cambios</span>
              <button className="adm-history__close" onClick={() => setShowHistory(false)}>✕</button>
            </div>
            {history.length === 0 ? (
              <div className="adm-history__empty">No hay cambios recientes</div>
            ) : (
              <ul className="adm-history__list">
                {history.map(h => (
                  <li key={h.id} className="adm-history__item">
                    <span className="adm-history__text">{h.mensaje}</span>
                    <button className="adm-history__undo" onClick={() => handleUndo(h)}>
                      Deshacer
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </header>

      {loading ? (
        <div className="page-state">Cargando catálogo…</div>
      ) : error ? (
        <main className="catalog-page" style={{ paddingTop: '2rem' }}>
          <div className="no-results" style={{ color: '#c0392b' }}>
            <p>Error de conexión con el servidor: {error}</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--grey-400)' }}>
              Asegúrate de que VITE_API_URL y VITE_ADMIN_TOKEN estén configurados correctamente en Vercel.
            </p>
          </div>
        </main>
      ) : selectedProduct ? (
        // VISTA: DETALLE DE PRODUCTO (Clon del diseño de producción)
        <main className="product-page">
          <div className={`product-page__img-wrap ${!selectedProduct.disponible ? 'sold-out' : ''}`}>
            <img
              src={selectedProduct.imagen}
              alt={selectedProduct.nombre}
              onError={e => { e.target.style.visibility = 'hidden' }}
            />
            {!selectedProduct.disponible && <div className="sold-out-overlay">Agotado</div>}
          </div>

          <div className="product-page__info">
            <button className="product-page__back" onClick={() => setSelectedProduct(null)}>
              ← Volver al catálogo
            </button>

            <h1 className="product-page__name">{selectedProduct.nombre}</h1>
            <p className="product-page__price">{formatPrice(selectedProduct.precio)}</p>
            <p className="product-page__description">{selectedProduct.descripcion}</p>

            <div className="product-page__sizes">
              <span className="product-page__sizes-label">Tallas registradas</span>
              <div className="product-page__sizes-row">
                {selectedProduct.tallas.map(t => {
                  const availableSizesText = (selectedProduct.descripcion || '').toUpperCase();
                  const isAvailable = new RegExp('\\b' + t + '\\b', 'i').test(availableSizesText);
                  return (
                    <button
                      key={t}
                      disabled
                      className={`size-tag ${isAvailable ? 'size-tag--available' : 'size-tag--unavailable'}`}
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* TOGGLE SWITCH - Reemplaza los botones de pago de producción */}
            <div className="adm-toggle-container">
              <span className="adm-toggle-label-text">¿Está disponible este artículo?</span>
              <label className="adm-toggle" aria-label="Disponible">
                <input
                  type="checkbox"
                  checked={selectedProduct.disponible}
                  onChange={() => handleToggle(selectedProduct, !selectedProduct.disponible)}
                />
                <span className="adm-toggle__track" />
                <span className="adm-toggle__thumb" />
              </label>
            </div>
          </div>
        </main>
      ) : (
        // VISTA: CATÁLOGO (Clon del diseño de producción)
        <main className="catalog-page" style={{ paddingTop: '0' }}>
          <div className="adm-search">
            <input
              type="text"
              className="adm-search__input"
              placeholder="Buscar por ID o Nombre..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {lista.length > 0 ? (
            <div className="product-grid">
              {lista.map(p => (
                <article
                  key={p.id}
                  className="product-card"
                  onClick={() => setSelectedProduct(p)}
                  role="button"
                  tabIndex={0}
                >
                  <div className={`product-card__img-wrap ${!p.disponible ? 'sold-out' : ''}`}>
                    <img
                      src={p.imagen}
                      alt={p.nombre}
                      loading="lazy"
                      onError={e => { e.target.style.visibility = 'hidden' }}
                    />
                    {!p.disponible && <div className="sold-out-overlay">Agotado</div>}
                  </div>
                  <div className="product-card__info">
                    <p className="product-card__name">{p.nombre}</p>
                    {p.disponible
                      ? <p className="product-card__price">{formatPrice(p.precio)}</p>
                      : <p className="product-card__unavailable">No disponible</p>
                    }
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="no-results">
              <p>Sin productos en el catálogo.</p>
            </div>
          )}
        </main>
      )}

      {toast && (
        <Toast
          key={toast.key}
          msg={toast.msg}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function Admin() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem('admin_auth') === '1'
  )

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth')
    setAuthed(false)
  }

  return (
    <>
      <style>{css}</style>
      {authed
        ? <AdminPanel onLogout={handleLogout} />
        : <LoginScreen onAuth={() => setAuthed(true)} />
      }
    </>
  )
}