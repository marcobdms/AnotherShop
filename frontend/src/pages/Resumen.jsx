/**
 * Resumen.jsx — la cesta antes de pagar.
 *
 * Los favoritos hacen de carrito. Como un favorito no guarda talla ni cantidad,
 * esas dos cosas se eligen aqui (ver useCart) y la talla es obligatoria.
 *
 * Aqui solo se revisa la cesta y los totales. Los datos de contacto (invitado
 * o cuenta, nombre, telefono...) se piden aparte, en /contacto, al pulsar
 * "Comenzar pedido".
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFavorites } from '../hooks/useFavorites'
import { useCatalog } from '../hooks/useCatalog'
import { useCart } from '../hooks/useCart'
import { fetchRates, formatPrice } from '../api/catalog'
import ProductCard from '../components/ProductCard'
import Footer from '../components/Footer'
import TransitionLink from '../components/TransitionLink'
import './Checkout.css'

const formatBs = (value) =>
  `${Number(value).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`

/** Mezcla determinista por semilla (mulberry32 + Fisher-Yates). */
function mezclar(lista, semilla) {
  let estado = semilla >>> 0
  const azar = () => {
    estado = (estado + 0x6d2b79f5) >>> 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const copia = [...lista]
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(azar() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

function IconoPapelera() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 4h4M9 7v12M15 7v12M6 7l1 13h10l1-13" />
    </svg>
  )
}

export default function Resumen() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { favorites, loading: favLoading, toggleFavorite } = useFavorites(user)
  const { catalog, loading: catalogLoading } = useCatalog()
  const cart = useCart(favorites)

  const [tasas, setTasas] = useState(null)

  // Tasa oficial BCV del dia. Si el servicio falla simplemente no se muestra.
  useEffect(() => {
    fetchRates().then(setTasas).catch(() => setTasas(null))
  }, [])

  // Semilla nueva en cada visita; estable mientras la pagina siga abierta, para que
  // las recomendaciones no cambien cada vez que se marca o desmarca una prenda.
  const [semilla] = useState(() => Math.floor(Math.random() * 2 ** 31))

  const recomendaciones = useMemo(() => {
    const productos = catalog?.productos ?? []
    const enCarrito = new Set(cart.lines.map(l => l.id))
    const generos = new Set(cart.lines.map(l => l.producto.genero))
    const mezclados = mezclar(
      productos.filter(p => p.disponible && !enCarrito.has(p.id)),
      semilla,
    )
    // Primero las afines al genero de lo que ya hay en la cesta, luego el resto
    const afines = mezclados.filter(p => generos.has(p.genero))
    const resto = mezclados.filter(p => !generos.has(p.genero))
    return [...afines, ...resto].slice(0, 4)
  }, [catalog, cart.lines, semilla])

  if (authLoading || favLoading || catalogLoading) return <div className="page-state" />

  return (
    <>
      <main className="checkout-page">
        <div className="checkout-layout">
          <section className="checkout-main">
            <h1 className="checkout-title">
              Tu cesta <span>({cart.lines.length} {cart.lines.length === 1 ? 'articulo' : 'articulos'})</span>
            </h1>

            {cart.lines.length === 0 ? (
              <div className="checkout-empty">
                <p>Todavia no has guardado ninguna prenda.</p>
                <TransitionLink to="/catalogo">Explorar catalogo</TransitionLink>
              </div>
            ) : (
              <>
                <ul className="cart-list">
                  {cart.lines.map(line => (
                    <li key={line.id} className={`cart-line${line.agotado ? ' cart-line--out' : ''}`}>
                      <label className="cart-line__check">
                        <input
                          type="checkbox"
                          checked={line.seleccionado && !line.agotado}
                          disabled={line.agotado}
                          onChange={() => cart.toggle(line.id)}
                          aria-label={`Incluir ${line.producto.nombre} en el pago`}
                        />
                      </label>

                      <TransitionLink to={`/producto/${line.id}`} className="cart-line__img">
                        <img src={line.producto.imagen} alt={line.producto.nombre} loading="lazy" />
                      </TransitionLink>

                      <div className="cart-line__info">
                        <p className="cart-line__name">{line.producto.nombre}</p>
                        {line.producto.variante_color && (
                          <p className="cart-line__meta">Color: {line.producto.variante_color}</p>
                        )}

                        {line.agotado ? (
                          <p className="cart-line__warn">Sin stock ahora mismo</p>
                        ) : (
                          <div className="cart-line__controls">
                            <label className="field">
                              <span>Talla</span>
                              <select
                                value={line.talla}
                                onChange={e => cart.setTalla(line.id, e.target.value)}
                              >
                                <option value="">Elegir</option>
                                {line.sizes.map(t => {
                                  const stock = Number(line.producto.variante_tallas?.[t] ?? 0)
                                  return (
                                    <option key={t} value={t} disabled={stock <= 0}>
                                      {t}{stock <= 0 ? ' (sin stock)' : ''}
                                    </option>
                                  )
                                })}
                              </select>
                            </label>

                            <label className="field">
                              <span>Cantidad</span>
                              <select
                                value={line.cantidad}
                                disabled={!line.talla}
                                onChange={e => cart.setCantidad(line.id, e.target.value)}
                              >
                                {Array.from({ length: Math.max(1, line.maxStock) }, (_, i) => i + 1)
                                  .map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                            </label>
                          </div>
                        )}
                      </div>

                      <div className="cart-line__end">
                        <p className="cart-line__price">
                          {formatPrice(Number(line.producto.precio || 0) * line.cantidad)}
                        </p>
                        {/* Quitar del resumen = quitar de favoritos: son la misma lista. */}
                        <button
                          className="cart-line__remove"
                          onClick={() => toggleFavorite(line.id)}
                          title="Quitar del resumen"
                          aria-label={`Quitar ${line.producto.nombre} del resumen`}
                          type="button"
                        >
                          <IconoPapelera />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <p className="checkout-note">
                  No reservamos las prendas: la tuya queda apartada cuando confirmamos tu pago.
                </p>
              </>
            )}
          </section>

          {cart.lines.length > 0 && (
            <aside className="checkout-aside">
              <div className="summary">
                <h2 className="summary__title">Resumen</h2>
                <div className="summary__row">
                  <span>Prendas</span>
                  <span>{cart.selected.length}</span>
                </div>
                <div className="summary__row">
                  <span>Subtotal</span>
                  <span>{formatPrice(cart.total)}</span>
                </div>
                <div className="summary__row summary__row--total">
                  <span>Total</span>
                  <span>{formatPrice(cart.total)}</span>
                </div>

                {cart.faltanTallas && (
                  <p className="summary__error">Elige la talla de cada prenda seleccionada.</p>
                )}

                <button
                  className="btn btn--solid btn--block"
                  disabled={!cart.listo}
                  onClick={() => navigate('/contacto')}
                  type="button"
                >
                  Comenzar pedido
                </button>
              </div>

              {tasas && (
                <div className="rates" aria-label="Tasa oficial del dia">
                  <div className="rates__head">
                    <span>Tasa BCV</span>
                    <span>{tasas.fecha ? new Date(`${tasas.fecha}T12:00:00`).toLocaleDateString('es-VE') : 'hoy'}</span>
                  </div>
                  <div className="rates__row">
                    <span>1 USD</span>
                    <strong>{formatBs(tasas.usd)}</strong>
                  </div>
                  <div className="rates__row">
                    <span>1 EUR</span>
                    <strong>{formatBs(tasas.eur)}</strong>
                  </div>
                  {cart.total > 0 && (
                    <div className="rates__row">
                      <span>Tu total en Bs</span>
                      <strong>{formatBs(cart.total * tasas.aplicada)}</strong>
                    </div>
                  )}
                  {tasas.stale && (
                    <p className="rates__stale">Tasa de un dia anterior: el BCV no ha actualizado.</p>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>

        {recomendaciones.length > 0 && (
          <section className="checkout-recos">
            <h2 className="checkout-recos__title">Tambien te puede gustar</h2>
            <div className="product-grid">
              {recomendaciones.map(p => (
                <ProductCard key={p.variante_color ? `${p.id}-${p.variante_color}` : p.id} producto={p} />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer marca={catalog?.meta?.marca} />
    </>
  )
}
