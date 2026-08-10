import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  adminFetchProducts,
  adminToggleProductAvailability,
  formatPrice,
} from './api/catalog'
import { CrmSkeleton } from './CrmChrome'

const css = `
  .admin-catalog {
    max-width: 1260px;
    margin: 0 auto;
    padding: 1.5rem;
  }

  .admin-catalog__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
  }

  .admin-catalog__left {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .admin-catalog__count,
  .admin-catalog__meta,
  .admin-catalog__status {
    color: var(--grey-400);
    font-size: var(--size-xs);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .admin-catalog__search {
    width: min(360px, 100%);
    border: 1px solid var(--grey-200);
    background: var(--white);
    color: var(--black);
    font-family: var(--font);
    font-size: var(--size-sm);
    padding: 0.7rem 0.75rem;
    outline: none;
  }

  .admin-catalog__search:focus {
    border-color: var(--black);
  }

  .admin-catalog__status {
    color: var(--grey-500);
  }

  .admin-catalog__status--error {
    color: #b91c1c;
  }

  .admin-catalog__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 1.25rem;
  }

  .admin-product {
    min-width: 0;
    border: 1px solid var(--grey-200);
    background: var(--white);
    display: flex;
    flex-direction: column;
    animation: admin-product-enter 220ms ease-out both;
  }

  .admin-product--off {
    color: var(--grey-400);
  }

  .admin-product__image {
    position: relative;
    aspect-ratio: 3 / 4;
    background: var(--grey-100);
    overflow: hidden;
  }

  .admin-product__image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 180ms ease;
  }

  .admin-product--off .admin-product__image img {
    opacity: 0.34;
  }

  .admin-product__badge {
    position: absolute;
    left: 0.65rem;
    top: 0.65rem;
    padding: 0.28rem 0.45rem;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid var(--grey-200);
    color: var(--black);
    font-size: 0.58rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .admin-product--off .admin-product__badge {
    color: #b91c1c;
  }

  .admin-product__body {
    padding: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .admin-product__ref {
    color: var(--grey-400);
    font-size: var(--size-xs);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .admin-product__name {
    min-height: 2.1rem;
    color: var(--black);
    font-size: var(--size-sm);
    line-height: 1.35;
  }

  .admin-product__price {
    color: var(--grey-600);
    font-size: var(--size-xs);
    letter-spacing: 0.08em;
  }

  .admin-product__toggle-row {
    margin-top: 0.45rem;
    padding-top: 0.65rem;
    border-top: 1px solid var(--grey-200);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .admin-product__toggle-label {
    color: var(--grey-500);
    font-size: var(--size-xs);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .admin-toggle {
    position: relative;
    width: 46px;
    height: 26px;
    flex: 0 0 auto;
    cursor: pointer;
  }

  .admin-toggle input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }

  .admin-toggle__track {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: var(--grey-200);
    transition: background 180ms ease;
  }

  .admin-toggle input:checked + .admin-toggle__track {
    background: #22c55e;
  }

  .admin-toggle__thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 999px;
    background: var(--white);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
    transition: transform 180ms ease;
    pointer-events: none;
  }

  .admin-toggle input:checked ~ .admin-toggle__thumb {
    transform: translateX(20px);
  }

  .admin-toggle input:focus-visible + .admin-toggle__track {
    outline: 2px solid var(--black);
    outline-offset: 2px;
  }

  .admin-toggle input:disabled + .admin-toggle__track {
    opacity: 0.45;
  }

  .admin-catalog__empty {
    min-height: 32vh;
    display: grid;
    place-items: center;
    color: var(--grey-400);
    font-size: var(--size-sm);
  }

  .admin-catalog__toast {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    z-index: 90;
    border: 1px solid var(--grey-200);
    background: var(--white);
    color: var(--black);
    padding: 0.85rem 1rem;
    font-size: var(--size-xs);
    letter-spacing: 0.08em;
  }

  .admin-catalog__toast--error {
    border-color: #fecaca;
    color: #b91c1c;
  }

  @keyframes admin-product-enter {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @media (max-width: 640px) {
    .admin-catalog {
      padding: 1rem;
    }

    .admin-catalog__grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .admin-product__body {
      padding: 0.65rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .admin-product {
      animation: none;
    }

    .admin-product__image img,
    .admin-toggle__track,
    .admin-toggle__thumb {
      transition: none;
    }
  }
`

function safePrice(value) {
  return formatPrice(Number(value || 0))
}

export default function AdminCatalog({ active = true, catalogRevision = 0, usuario, onCatalogChanged }) {
  const [productos, setProductos] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadedRevision, setLoadedRevision] = useState(null)
  const [updatingIds, setUpdatingIds] = useState([])
  const [status, setStatus] = useState('')
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'success') => {
    const key = Date.now()
    setToast({ message, type, key })
    window.setTimeout(() => {
      setToast(current => (current?.key === key ? null : current))
    }, 2400)
  }, [])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setStatus('')
    try {
      const data = await adminFetchProducts()
      setProductos(data)
      setLoadedRevision(catalogRevision)
    } catch (error) {
      setStatus(error.message)
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [catalogRevision, showToast])

  useEffect(() => {
    if (!active || loadedRevision === catalogRevision) return
    loadProducts()
  }, [active, catalogRevision, loadedRevision, loadProducts])

  const lista = useMemo(() => {
    const term = search.trim().toLowerCase()
    return productos
      .filter(producto => {
        if (!term) return true
        return (
          String(producto.id || '').toLowerCase().includes(term) ||
          String(producto.nombre || '').toLowerCase().includes(term)
        )
      })
      .sort((a, b) => {
        if (a.disponible === b.disponible) return String(a.nombre || '').localeCompare(String(b.nombre || ''))
        return a.disponible ? -1 : 1
      })
  }, [productos, search])

  const updatingSet = useMemo(() => new Set(updatingIds), [updatingIds])
  const disponibles = productos.filter(producto => producto.disponible).length

  async function handleToggle(producto) {
    const nextDisponible = !producto.disponible
    setUpdatingIds(ids => [...ids, producto.id])
    setProductos(current => current.map(item => (
      item.id === producto.id ? { ...item, disponible: nextDisponible } : item
    )))

    try {
      const updated = await adminToggleProductAvailability(producto.id, nextDisponible, usuario)
      setProductos(current => current.map(item => (
        item.id === producto.id ? { ...item, ...updated } : item
      )))
      onCatalogChanged?.()
      showToast(`${producto.nombre} ${nextDisponible ? 'activo' : 'oculto'}`)
    } catch (error) {
      setProductos(current => current.map(item => (
        item.id === producto.id ? { ...item, disponible: producto.disponible } : item
      )))
      showToast(error.message, 'error')
    } finally {
      setUpdatingIds(ids => ids.filter(id => id !== producto.id))
    }
  }

  return (
    <>
      <style>{css}</style>
      <main className="admin-catalog">
        <div className="admin-catalog__head">
          <div className="admin-catalog__left">
            <span className="admin-catalog__count">Admin ({productos.length})</span>
            <input
              className="admin-catalog__search"
              type="search"
              placeholder="Buscar REF o nombre..."
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>
          <span className={`admin-catalog__status${status ? ' admin-catalog__status--error' : ''}`}>
            {status || `${disponibles} activos / ${productos.length - disponibles} ocultos`}
          </span>
        </div>

        {loading && productos.length === 0 ? (
          <CrmSkeleton rows={12} variant="admin" />
        ) : lista.length === 0 ? (
          <div className="admin-catalog__empty">
            {search ? 'Sin resultados.' : 'No hay productos en el catálogo.'}
          </div>
        ) : (
          <section className="admin-catalog__grid" aria-label="Catálogo de producción">
            {lista.map(producto => {
              const updating = updatingSet.has(producto.id)
              return (
                <article
                  key={producto.id}
                  className={`admin-product${producto.disponible ? '' : ' admin-product--off'}`}
                >
                  <div className="admin-product__image">
                    {producto.imagen && (
                      <img
                        src={producto.imagen}
                        alt={producto.nombre}
                        loading="lazy"
                        onError={event => { event.currentTarget.style.visibility = 'hidden' }}
                      />
                    )}
                    <span className="admin-product__badge">
                      {producto.disponible ? 'Activo' : 'Oculto'}
                    </span>
                  </div>
                  <div className="admin-product__body">
                    <span className="admin-product__ref">{producto.id}</span>
                    <p className="admin-product__name">{producto.nombre}</p>
                    <p className="admin-product__price">{safePrice(producto.precio)}</p>
                    <div className="admin-product__toggle-row">
                      <span className="admin-product__toggle-label">
                        {updating ? 'Guardando' : 'Disponible'}
                      </span>
                      <label className="admin-toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(producto.disponible)}
                          disabled={updating}
                          onChange={() => handleToggle(producto)}
                          aria-label={`${producto.disponible ? 'Ocultar' : 'Activar'} ${producto.nombre}`}
                        />
                        <span className="admin-toggle__track" />
                        <span className="admin-toggle__thumb" />
                      </label>
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </main>

      {toast && (
        <div className={`admin-catalog__toast admin-catalog__toast--${toast.type}`}>
          {toast.message}
        </div>
      )}
    </>
  )
}
