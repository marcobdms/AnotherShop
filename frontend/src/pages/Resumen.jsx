/**
 * Resumen.jsx — la cesta antes de pagar.
 *
 * Los favoritos hacen de carrito. Como un favorito no guarda talla ni cantidad,
 * esas dos cosas se eligen aqui (ver useCart) y la talla es obligatoria.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useFavorites } from '../hooks/useFavorites'
import { useCatalog } from '../hooks/useCatalog'
import { useCart } from '../hooks/useCart'
import { createOrder, fetchRates, formatPrice } from '../api/catalog'
import ProductCard from '../components/ProductCard'
import Footer from '../components/Footer'
import TransitionLink from '../components/TransitionLink'
import { rememberOrder } from '../utils/orders'
import './Checkout.css'

const MODO_KEY = 'anothernpcshop:checkout-modo'

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

function AuthGate({ onInvitado, onCuenta }) {
  return (
    <div className="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <div className="gate__backdrop" />
      <div className="gate__panel">
        <h2 className="gate__title" id="gate-title">Antes de seguir</h2>
        <p className="gate__text">
          Con tu cuenta guardamos el pedido y tus prendas guardadas en cualquier dispositivo.
          Como invitado solo te pedimos como avisarte.
        </p>
        <div className="gate__actions">
          <button className="btn btn--solid" onClick={onCuenta} type="button">
            Entrar con mi cuenta
          </button>
          <button className="btn btn--ghost" onClick={onInvitado} type="button">
            Seguir como invitado
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Resumen() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { favorites, loading: favLoading, toggleFavorite } = useFavorites(user)
  const { catalog, loading: catalogLoading } = useCatalog()
  const cart = useCart(favorites)

  const [modo, setModo] = useState(() => sessionStorage.getItem(MODO_KEY) || '')
  const [contacto, setContacto] = useState({ nombre: '', telefono: '', email: '', entrega: '' })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [tasas, setTasas] = useState(null)

  // Tasa oficial BCV del dia. Si el servicio falla simplemente no se muestra.
  useEffect(() => {
    fetchRates().then(setTasas).catch(() => setTasas(null))
  }, [])

  useEffect(() => {
    if (user) {
      setModo('cuenta')
      sessionStorage.setItem(MODO_KEY, 'cuenta')
      setContacto(c => ({ ...c, email: c.email || user.email || '' }))
    }
  }, [user])

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

  const elegirCuenta = () => {
    sessionStorage.setItem(MODO_KEY, 'cuenta')
    navigate('/login?next=/resumen')
  }

  const elegirInvitado = () => {
    sessionStorage.setItem(MODO_KEY, 'invitado')
    setModo('invitado')
  }

  const contactoListo = contacto.nombre.trim() && (contacto.telefono.trim() || contacto.email.trim())

  async function handleSubmit() {
    setError('')
    setEnviando(true)
    try {
      const { data: sesion } = await supabase.auth.getSession()
      const pedido = await createOrder({
        items: cart.selected.map(l => ({
          producto_id: l.id,
          talla: l.talla,
          cantidad: l.cantidad,
          color: l.producto.variante_color || '',
        })),
        nombre: contacto.nombre.trim(),
        telefono: contacto.telefono.trim(),
        email: contacto.email.trim(),
        entrega: contacto.entrega.trim(),
      }, sesion?.session?.access_token || '')
      rememberOrder(pedido.numero)
      navigate(`/pago/${pedido.numero}`)
    } catch (err) {
      setError(err.message || 'No se pudo crear el pedido')
      setEnviando(false)
    }
  }

  return (
    <>
      {!modo && <AuthGate onInvitado={elegirInvitado} onCuenta={elegirCuenta} />}

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
                <div className="checkout-bulk">
                  <button className="linklike" onClick={() => cart.setTodos(true)} type="button">
                    Seleccionar todo
                  </button>
                  <span aria-hidden="true">·</span>
                  <button className="linklike" onClick={() => cart.setTodos(false)} type="button">
                    Quitar seleccion
                  </button>
                </div>

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
                                {line.sizes.map(t => <option key={t} value={t}>{t}</option>)}
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

                {modo === 'invitado' && (
                  <div className="summary__form">
                    <label className="field field--block">
                      <span>Nombre</span>
                      <input
                        value={contacto.nombre}
                        onChange={e => setContacto({ ...contacto, nombre: e.target.value })}
                        placeholder="Como te llamamos"
                      />
                    </label>
                    <label className="field field--block">
                      <span>Telefono</span>
                      <input
                        value={contacto.telefono}
                        onChange={e => setContacto({ ...contacto, telefono: e.target.value })}
                        placeholder="Para avisarte por WhatsApp"
                      />
                    </label>
                    <label className="field field--block">
                      <span>Email</span>
                      <input
                        type="email"
                        value={contacto.email}
                        onChange={e => setContacto({ ...contacto, email: e.target.value })}
                        placeholder="Opcional"
                      />
                    </label>
                  </div>
                )}

                {modo === 'cuenta' && user && (
                  <div className="summary__form">
                    <label className="field field--block">
                      <span>Nombre</span>
                      <input
                        value={contacto.nombre}
                        onChange={e => setContacto({ ...contacto, nombre: e.target.value })}
                        placeholder="Como te llamamos"
                      />
                    </label>
                    <label className="field field--block">
                      <span>Telefono</span>
                      <input
                        value={contacto.telefono}
                        onChange={e => setContacto({ ...contacto, telefono: e.target.value })}
                        placeholder="Para avisarte por WhatsApp"
                      />
                    </label>
                    <p className="summary__hint">Pedido asociado a {user.email}</p>
                  </div>
                )}

                <label className="field field--block">
                  <span>Entrega</span>
                  <input
                    value={contacto.entrega}
                    onChange={e => setContacto({ ...contacto, entrega: e.target.value })}
                    placeholder="Donde o como la recibes"
                  />
                </label>

                {cart.faltanTallas && (
                  <p className="summary__error">Elige la talla de cada prenda seleccionada.</p>
                )}
                {error && <p className="summary__error">{error}</p>}

                <button
                  className="btn btn--solid btn--block"
                  disabled={!cart.listo || !contactoListo || !modo || enviando}
                  onClick={handleSubmit}
                  type="button"
                >
                  {enviando ? 'Creando pedido...' : 'Comenzar pedido'}
                </button>

                {!modo && <p className="summary__hint">Elige como quieres continuar.</p>}
                {modo && !contactoListo && (
                  <p className="summary__hint">Necesitamos tu nombre y un telefono o email.</p>
                )}
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
