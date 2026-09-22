/**
 * Contacto.jsx — datos de contacto antes de pagar (/contacto).
 *
 * Paso intermedio entre el resumen (la cesta) y el pago: aqui se elige
 * invitado o cuenta y se piden nombre/telefono/entrega. Al terminar se crea
 * el pedido y se pasa a elegir metodo de pago.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useFavorites } from '../hooks/useFavorites'
import { useCatalog } from '../hooks/useCatalog'
import { useCart } from '../hooks/useCart'
import { createOrder, formatPrice } from '../api/catalog'
import AuthGate from '../components/AuthGate'
import Footer from '../components/Footer'
import TransitionLink from '../components/TransitionLink'
import { rememberOrder } from '../utils/orders'
import './Checkout.css'

const MODO_KEY = 'anothernpcshop:checkout-modo'

export default function Contacto() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { favorites, loading: favLoading } = useFavorites(user)
  const { loading: catalogLoading } = useCatalog()
  const cart = useCart(favorites)

  const [modo, setModo] = useState(() => sessionStorage.getItem(MODO_KEY) || '')
  const [contacto, setContacto] = useState({ nombre: '', telefono: '', email: '', entrega: '' })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      setModo('cuenta')
      sessionStorage.setItem(MODO_KEY, 'cuenta')
      setContacto(c => ({ ...c, email: c.email || user.email || '' }))
    }
  }, [user])

  const cargando = authLoading || favLoading || catalogLoading

  // Sin nada que pagar (cesta vacia o sin tallas elegidas) no hay nada que
  // hacer aqui: de vuelta a la cesta. El pequeno margen evita el falso
  // positivo del primer render como invitado: useFavorites ya reporta
  // loading=false ahi aunque los favoritos reales (localStorage) todavia no
  // se hayan volcado al estado, y sin esperar se redirigia de golpe.
  useEffect(() => {
    if (cargando || cart.listo) return
    const espera = setTimeout(() => navigate('/resumen', { replace: true }), 150)
    return () => clearTimeout(espera)
  }, [cargando, cart.listo, navigate])

  if (cargando || !cart.listo) return <div className="page-state" />

  const elegirCuenta = () => {
    sessionStorage.setItem(MODO_KEY, 'cuenta')
    navigate('/login?next=/contacto')
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
            <p className="checkout-back">
              <TransitionLink to="/resumen">← Volver a la cesta</TransitionLink>
            </p>
            <h1 className="checkout-title">Tus datos</h1>
            <p className="checkout-sub">
              Para avisarte de tu pedido de {cart.selected.length} {cart.selected.length === 1 ? 'prenda' : 'prendas'}.
            </p>

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

            {modo && (
              <label className="field field--block">
                <span>Entrega</span>
                <input
                  value={contacto.entrega}
                  onChange={e => setContacto({ ...contacto, entrega: e.target.value })}
                  placeholder="Donde o como la recibes"
                />
              </label>
            )}
          </section>

          <aside className="checkout-aside">
            <div className="summary">
              <h2 className="summary__title">Tu pedido</h2>
              {cart.selected.map(line => (
                <div className="summary__row order-item" key={line.id}>
                  {line.producto.imagen
                    ? <img className="order-item__img" src={line.producto.imagen} alt="" loading="lazy" />
                    : <span className="order-item__img" aria-hidden="true" />}
                  <span className="order-item__name">{line.cantidad}× {line.producto.nombre} · {line.talla}</span>
                  <span>{formatPrice(Number(line.producto.precio || 0) * line.cantidad)}</span>
                </div>
              ))}
              <div className="summary__row summary__row--total">
                <span>Total</span>
                <span>{formatPrice(cart.total)}</span>
              </div>

              {error && <p className="summary__error">{error}</p>}

              <button
                className="btn btn--solid btn--block"
                disabled={!modo || !contactoListo || enviando}
                onClick={handleSubmit}
                type="button"
              >
                {enviando ? 'Creando pedido...' : 'Seleccionar metodo de pago'}
              </button>

              {!modo && <p className="summary__hint">Elige como quieres continuar.</p>}
              {modo && !contactoListo && (
                <p className="summary__hint">Necesitamos tu nombre y un telefono o email.</p>
              )}
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </>
  )
}
