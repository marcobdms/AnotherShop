/**
 * Account.jsx — panel de cuenta (/cuenta).
 *
 * Reune lo que el cliente necesita despues de comprar: ir a pagar lo que tiene
 * guardado, buscar un pedido por su numero, y ver el estado de cada pedido en
 * una card emergente. Con sesion se listan los pedidos de la cuenta; sin
 * sesion, los de este navegador.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { fetchMeta, fetchMyOrders, fetchOrder, formatPrice } from '../api/catalog'
import { supabase } from '../lib/supabase'
import { readOrders } from '../utils/orders'
import PedidoSeguimiento, { estadoCorto } from '../components/PedidoSeguimiento'
import TransitionLink from '../components/TransitionLink'
import Footer from '../components/Footer'
import './Checkout.css'

const CIERRE_MS = 260

const css = `
  .account-page {
    max-width: min(100%, 86rem);
    margin: 0 auto;
    padding: clamp(2rem, 5vw, 4rem) clamp(1.25rem, 4vw, 3rem);
    animation: fadeIn 0.4s ease forwards;
  }

  .account-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2.4rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .account-header__title {
    margin: 0;
    font-size: clamp(2rem, 5vw, 3.2rem);
    font-weight: 300;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .account-header__email {
    margin: 0.6rem 0 0;
    font-size: var(--size-xs);
    letter-spacing: 0.12em;
    color: var(--grey-400);
    text-transform: uppercase;
  }

  .account-notice {
    max-width: 44rem;
    margin: -1rem 0 2.6rem;
    padding: 1rem 1.1rem;
    border: 1px solid rgba(34, 34, 34, 0.12);
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.72);
    color: var(--grey-600);
    font-size: 0.78rem;
    line-height: 1.65;
    letter-spacing: 0.07em;
  }

  /* Acciones principales */
  .account-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin: 0 0 3rem;
  }

  .account-actions .btn {
    text-decoration: none;
  }

  /* Favoritos: mismo alto que "Seguir mi pedido", solo icono, a su derecha */
  .account-fav-btn {
    flex: 0 0 auto;
    width: 3rem;
    padding: 0;
  }

  .account-section__label {
    font-size: var(--size-xs);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--grey-400);
    margin-bottom: 2rem;
    display: block;
    border-bottom: 1px solid var(--grey-200);
    padding-bottom: 0.75rem;
  }

  /* Pedidos */
  .account-orders__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
    max-width: 32rem;
  }

  .account-order {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.2rem 1rem;
    width: 100%;
    padding: 0.9rem 1rem;
    border: 1px solid var(--grey-200);
    border-radius: 0.5rem;
    background: var(--white);
    color: var(--black);
    font-family: var(--font);
    text-align: left;
    cursor: pointer;
    transition: border-color 160ms ease, background 160ms ease;
  }

  .account-order:hover { border-color: var(--grey-400); }
  .account-order.is-active { border-color: var(--black); background: var(--grey-100); }

  .account-order__num { font-size: 0.8125rem; letter-spacing: 0.16em; }
  .account-order__total { font-size: 0.8125rem; text-align: right; }
  .account-order__meta { color: var(--grey-400); font-size: 0.6875rem; letter-spacing: 0.08em; text-transform: uppercase; }

  .account-empty {
    min-height: 30vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.25rem;
    color: var(--grey-400);
    font-size: var(--size-sm);
    letter-spacing: 0.1em;
    text-align: center;
  }

  .account-empty--compact {
    min-height: 0;
    padding: 1.5rem 0 0.5rem;
    align-items: flex-start;
    text-align: left;
  }

  .account-empty a {
    font-size: var(--size-xs);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    border-bottom: 1px solid var(--grey-400);
    padding-bottom: 2px;
    color: var(--grey-600);
    transition: color 200ms ease, border-color 200ms ease;
  }
  .account-empty a:hover { color: var(--black); border-color: var(--black); }

  .account-contact {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 2.4rem;
    padding-top: 2rem;
    border-top: 1px solid var(--grey-200);
    max-width: 32rem;
  }

  .account-contact .btn {
    text-decoration: none;
  }

  /* Cerrar sesion: texto en escritorio, icono a juego con el titulo en movil */
  .account-signout {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--size-xs);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--grey-400);
    border-bottom: 1px solid transparent;
    padding-bottom: 1px;
    transition: color 200ms ease, border-color 200ms ease;
    background: none;
    font-family: var(--font);
  }
  .account-signout:hover { color: var(--black); border-color: var(--black); }
  .account-signout__icon { display: none; }

  /* ── Card de seguimiento (modal) ── */
  .order-modal {
    position: fixed;
    inset: 0;
    z-index: 400;
    display: grid;
    place-items: center;
    padding: 1.25rem;
  }

  .order-modal__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.42);
    animation: fadeIn 240ms ease forwards;
  }

  .order-modal__panel {
    position: relative;
    width: min(30rem, 100%);
    max-height: min(88vh, 46rem);
    overflow-y: auto;
    padding: 2.25rem 1.75rem 1.75rem;
    border-radius: 1rem;
    background: var(--white);
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.22);
    animation: orderModalIn 320ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .order-modal__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 2rem;
    height: 2rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 999px;
    background: var(--black);
    color: var(--white);
    cursor: pointer;
    transition: opacity 160ms ease;
  }
  .order-modal__close:hover { opacity: 0.8; }

  /* Pastillas de copiar dentro de la card: mismo estilo, mas compactas */
  .track__id-actions .copy {
    padding: 0.3rem 0.6rem;
    font-size: 0.625rem;
  }

  /* fadeOut y dialogOut son globales (Checkout.css): las usan tambien
     PedidoSeguimiento (confirmar cancelacion) y cualquier otro "gate". */
  .order-modal--closing .order-modal__backdrop {
    animation: fadeOut 220ms ease forwards;
  }
  .order-modal--closing .order-modal__panel {
    animation: dialogOut 220ms ease forwards;
  }

  @keyframes orderModalIn {
    from { opacity: 0; transform: translateY(10px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .order-modal__backdrop,
    .order-modal__panel {
      animation: none !important;
    }
  }

  /* Recto en escritorio, como el resto del checkout */
  @media (min-width: 64rem) {
    .account-order,
    .order-modal__panel,
    .order-modal__close {
      border-radius: 0;
    }
  }

  @media (max-width: 640px) {
    .account-signout__text { display: none; }
    .account-signout {
      border-bottom: none;
      padding: 0;
    }
    .account-signout__icon {
      display: block;
      width: 2rem;
      height: 2rem;
      color: var(--black);
    }
  }
`

function IconoSalir() {
  return (
    <svg className="account-signout__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  )
}

// Mismo trazo que el corazon de ProductCard: se "recicla" el mismo icono.
function IconoCorazon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function IconoCerrar() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  )
}

function fechaCorta(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function Account() {
  const { user, loading: authLoading, signOut } = useAuth()
  const navigate = useNavigate()

  const [pedidosApi, setPedidosApi] = useState([])
  const [modalNumero, setModalNumero] = useState(null)
  const [pedidoPreview, setPedidoPreview] = useState(null)
  const [cargandoFila, setCargandoFila] = useState('')
  const [cerrando, setCerrando] = useState(false)
  const [confirmarSalida, setConfirmarSalida] = useState(false)
  const [cerrandoConfirm, setCerrandoConfirm] = useState(false)
  const [meta, setMeta] = useState(null)

  useEffect(() => {
    fetchMeta().then(setMeta).catch(() => {})
  }, [])

  // Pedidos de la cuenta (el servidor comprueba la sesion con el token)
  useEffect(() => {
    if (!user) {
      setPedidosApi([])
      return
    }
    let cancelado = false
    supabase.auth.getSession()
      .then(({ data }) => fetchMyOrders(data?.session?.access_token || ''))
      .then(lista => { if (!cancelado) setPedidosApi(lista) })
      .catch(() => { if (!cancelado) setPedidosApi([]) })
    return () => { cancelado = true }
  }, [user])

  // Con sesion: los de la cuenta + los de este navegador que aun no esten en ella.
  const pedidos = useMemo(() => {
    const delServidor = new Set(pedidosApi.map(p => p.numero))
    const locales = readOrders()
      .filter(o => !delServidor.has(o.numero))
      .map(o => ({ numero: o.numero, creado_en: new Date(o.at).toISOString(), local: true }))
    return [...pedidosApi, ...locales]
  }, [pedidosApi])

  const handleSignOut = async () => {
    await signOut()
    navigate('/', { replace: true })
  }

  const cerrarConfirmSalida = useCallback(() => {
    setCerrandoConfirm(true)
    setTimeout(() => {
      setConfirmarSalida(false)
      setCerrandoConfirm(false)
    }, CIERRE_MS)
  }, [])

  // Prefetch antes de abrir: la card nace ya con su tamano final, sin el
  // salto de "carga chica -> contenido grande" cuando aparece el check/reloj.
  const abrirPedido = useCallback(async (numero) => {
    setCargandoFila(numero)
    try {
      const data = await fetchOrder(numero)
      setPedidoPreview(data)
    } catch {
      setPedidoPreview(null)
    } finally {
      setCargandoFila('')
      setModalNumero(numero)
    }
  }, [])

  const cerrarModal = useCallback(() => {
    setCerrando(true)
    setTimeout(() => {
      setModalNumero(null)
      setPedidoPreview(null)
      setCerrando(false)
    }, CIERRE_MS)
  }, [])

  // Escape cierra la card (o la confirmacion de salida) que este abierta
  useEffect(() => {
    if (!modalNumero && !confirmarSalida) return undefined
    const onKey = e => {
      if (e.key !== 'Escape') return
      if (confirmarSalida) cerrarConfirmSalida()
      else if (modalNumero) cerrarModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalNumero, confirmarSalida, cerrarModal, cerrarConfirmSalida])

  if (authLoading) {
    return <div className="page-state" />
  }

  const whatsapp = meta?.whatsapp
    ? `https://wa.me/${meta.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Hola, tengo una consulta sobre mi pedido')}`
    : null

  return (
    <>
      <style>{css}</style>
      <main className="account-page">
        <div className="account-header">
          <div>
            <h1 className="account-header__title">
              {user ? 'Mi cuenta' : 'Favoritos'}
            </h1>
            <p className="account-header__email">
              {user?.email || 'Guardados en este navegador'}
            </p>
          </div>
          {user && (
            <button className="account-signout" onClick={() => setConfirmarSalida(true)} aria-label="Cerrar sesion">
              <IconoSalir />
              <span className="account-signout__text">Cerrar sesion</span>
            </button>
          )}
        </div>

        {!user && (
          <p className="account-notice">
            Tus favoritos se mantienen al cerrar la pestana en este dispositivo.
            Pueden perderse si borras los datos del navegador, usas incognito o cambias de dispositivo.
          </p>
        )}

        <div className="account-actions">
          <TransitionLink className="btn btn--ghost" to="/seguimiento">
            Seguir mi pedido
          </TransitionLink>
          <TransitionLink
            className="btn btn--solid account-fav-btn"
            to="/resumen"
            aria-label="Ver mis prendas guardadas"
            title="Prendas guardadas"
          >
            <IconoCorazon />
          </TransitionLink>
        </div>

        <span className="account-section__label">
          Mis pedidos ({pedidos.length})
        </span>

        {pedidos.length === 0 ? (
          <div className="account-empty account-empty--compact">
            <p>Todavia no tienes pedidos.</p>
          </div>
        ) : (
          <ul className="account-orders__list">
            {pedidos.map(p => (
              <li key={p.numero}>
                <button
                  className={`account-order${modalNumero === p.numero ? ' is-active' : ''}`}
                  onClick={() => abrirPedido(p.numero)}
                  disabled={cargandoFila === p.numero}
                  type="button"
                >
                  <span className="account-order__num">{p.numero}</span>
                  <span className="account-order__total">
                    {p.total !== undefined ? formatPrice(p.total) : ''}
                  </span>
                  <span className="account-order__meta">
                    {cargandoFila === p.numero ? 'Cargando...' : (p.estado ? estadoCorto(p) : 'Ver estado')}
                  </span>
                  <span className="account-order__meta" style={{ textAlign: 'right' }}>
                    {fechaCorta(p.creado_en)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="account-contact">
          {whatsapp && (
            <a className="btn btn--ghost" href={whatsapp} target="_blank" rel="noopener noreferrer">
              Escribirnos por WhatsApp
            </a>
          )}
          <TransitionLink className="btn btn--ghost" to="/catalogo">
            Seguir viendo
          </TransitionLink>
        </div>
      </main>

      {modalNumero && (
        <div className={`order-modal${cerrando ? ' order-modal--closing' : ''}`} role="dialog" aria-modal="true">
          <div className="order-modal__backdrop" onClick={cerrarModal} />
          <div className="order-modal__panel">
            <button className="order-modal__close" onClick={cerrarModal} aria-label="Cerrar">
              <IconoCerrar />
            </button>
            {/* key => al cambiar de pedido el seguimiento se remonta (y se anima).
                pedidoInicial ya viene prefetcheado: nace con su tamano final.
                Whatsapp/seguir viendo van fijos en la pagina, no aqui (pero "elegir
                forma de pago" si se mantiene si el pedido aun no tiene pago). */}
            <PedidoSeguimiento key={modalNumero} numero={modalNumero} pedidoInicial={pedidoPreview} mostrarContacto={false} />
          </div>
        </div>
      )}

      {confirmarSalida && (
        <div className={`gate${cerrandoConfirm ? ' gate--closing' : ''}`} role="dialog" aria-modal="true">
          <div className="gate__backdrop" onClick={cerrarConfirmSalida} />
          <div className="gate__panel">
            <h2 className="gate__title">Cerrar sesion</h2>
            <p className="gate__text">
              ¿Seguro que quieres cerrar sesion? Tus prendas guardadas y pedidos siguen
              en tu cuenta para la proxima vez que entres.
            </p>
            <div className="gate__actions">
              <button className="btn btn--solid" onClick={handleSignOut} type="button">
                Cerrar sesion
              </button>
              <button className="btn btn--ghost" onClick={cerrarConfirmSalida} type="button">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  )
}
