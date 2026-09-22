/**
 * PedidoSeguimiento.jsx — seguimiento de un pedido por su numero.
 *
 * Componente reutilizable: lo usa la pagina /pedido/:numero y el panel de cuenta.
 *
 * Es tambien la pantalla que se ve nada mas declarar el pago: un check verde
 * que se dibuja y despues pasa a un reloj mientras se verifica el pago. La
 * pagina se refresca sola hasta que el pedido se confirma o se cancela.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { cancelOrder, fetchMeta, fetchOrder, formatPrice } from '../api/catalog'
import { rememberOrder } from '../utils/orders'
import TransitionLink from './TransitionLink'
import '../pages/Checkout.css'

const POLL_MS = 12000
const CHECK_TO_CLOCK_MS = 1900
const CIERRE_MS = 200
// El cliente puede cancelar mientras el pedido no este ya confirmado (o
// cancelado). Igual que en el backend: aqui no hay stock ni dinero de por
// medio, asi que cancelar es reversible en la practica (basta con volver a
// declarar el pago).
const FASES_CANCELABLES = new Set(['sin_pago', 'verificando', 'efectivo'])

const PASOS = [
  { id: 'recibido', label: 'Pedido recibido' },
  { id: 'pago', label: 'Pago recibido' },
  { id: 'verificado', label: 'Pago verificado' },
  { id: 'confirmado', label: 'Pedido confirmado' },
]

/** Fase visible al cliente a partir del estado y del metodo de pago. */
function fase(pedido) {
  if (pedido.estado === 'cancelado') return 'cancelado'
  if (pedido.estado === 'confirmado') return 'confirmado'
  if (pedido.estado === 'verificado') return 'verificado'
  if (pedido.estado === 'pago_declarado') {
    return pedido.metodo_pago === 'efectivo' ? 'efectivo' : 'verificando'
  }
  return 'sin_pago'
}

const TEXTOS = {
  verificando: {
    titulo: 'Estamos verificando tu pago',
    detalle: 'Esto puede tardar unos minutos. Puedes cerrar esta pagina: con tu numero de pedido vuelves a ver el estado.',
  },
  efectivo: {
    titulo: 'Pedido recibido',
    detalle: 'Pagas en efectivo, en persona, al recibir la prenda. Te escribimos para acordar donde y cuando.',
  },
  verificado: {
    titulo: 'Pago verificado',
    detalle: 'Tu pago esta acreditado. Estamos preparando tu pedido.',
  },
  confirmado: {
    titulo: 'Pedido confirmado',
    detalle: 'Todo listo. Te escribimos para coordinar la entrega.',
  },
  cancelado: {
    titulo: 'Pedido cancelado',
    detalle: 'Este pedido se cancelo. Si crees que es un error, escribenos con tu numero de pedido.',
  },
  sin_pago: {
    titulo: 'Falta el pago',
    detalle: 'Tu pedido esta creado pero todavia no has indicado como lo pagas.',
  },
}

function CheckIcon({ animar }) {
  return (
    <svg className={`status-icon status-icon--check${animar ? ' is-drawing' : ''}`} viewBox="0 0 96 96" aria-hidden="true">
      <circle className="status-icon__ring" cx="48" cy="48" r="42" />
      <path className="status-icon__mark" d="M29 50 L43 64 L68 36" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="status-icon status-icon--clock" viewBox="0 0 96 96" aria-hidden="true">
      <circle className="status-icon__ring" cx="48" cy="48" r="42" />
      <line className="clock-hand clock-hand--hour" x1="48" y1="48" x2="48" y2="30" />
      <line className="clock-hand clock-hand--minute" x1="48" y1="48" x2="48" y2="22" />
      <circle className="clock-pin" cx="48" cy="48" r="3" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg className="status-icon status-icon--cross is-drawing" viewBox="0 0 96 96" aria-hidden="true">
      <circle className="status-icon__ring" cx="48" cy="48" r="42" />
      <path className="status-icon__mark" d="M34 34 L62 62 M62 34 L34 62" />
    </svg>
  )
}

function Estado({ fase: f, mostrarReloj }) {
  // key => al cambiar de fase el icono se vuelve a montar y se anima de nuevo
  if (f === 'cancelado') return <CrossIcon key="x" />
  if (f === 'sin_pago') return <ClockIcon key="clock-idle" />
  if (f === 'verificando') {
    return mostrarReloj ? <ClockIcon key="clock" /> : <CheckIcon key="check-first" animar />
  }
  return <CheckIcon key={f} animar />
}

function hora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function Copiar({ texto, etiqueta = 'Copiar' }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      className="copy"
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto)
          setOk(true)
          setTimeout(() => setOk(false), 1600)
        } catch {
          setOk(false)
        }
      }}
    >
      {ok ? 'Copiado' : etiqueta}
    </button>
  )
}

export default function PedidoSeguimiento({ numero, mostrarAcciones = true, mostrarContacto = true, pedidoInicial = null }) {
  // Con pedidoInicial (ya prefetcheado, p. ej. antes de abrir una card) se
  // salta el parpadeo de carga: el contenido nace con su tamano final.
  const [pedido, setPedido] = useState(pedidoInicial)
  const [meta, setMeta] = useState(null)
  const [cargando, setCargando] = useState(!pedidoInicial)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [mostrarReloj, setMostrarReloj] = useState(false)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [cerrandoConfirm, setCerrandoConfirm] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const primeraCarga = useRef(true)

  const cargar = useCallback(async () => {
    try {
      const data = await fetchOrder(numero)
      setPedido(data)
      setNoEncontrado(false)
      rememberOrder(data.numero)
    } catch {
      // En un refresco automatico un fallo de red no debe borrar lo que ya se ve.
      if (primeraCarga.current) setNoEncontrado(true)
    } finally {
      primeraCarga.current = false
      setCargando(false)
    }
  }, [numero])

  useEffect(() => {
    primeraCarga.current = true
    if (!pedidoInicial) setCargando(true)
    setMostrarReloj(false)
    cargar()
    fetchMeta().then(setMeta).catch(() => {})
  }, [cargar])

  const faseActual = pedido ? fase(pedido) : null

  // Refresco automatico mientras el pedido siga en curso
  useEffect(() => {
    if (!faseActual || ['confirmado', 'cancelado'].includes(faseActual)) return undefined
    const timer = setInterval(cargar, POLL_MS)
    return () => clearInterval(timer)
  }, [faseActual, cargar])

  // El check se dibuja primero y luego pasa a reloj mientras se verifica
  useEffect(() => {
    if (faseActual !== 'verificando') {
      setMostrarReloj(false)
      return undefined
    }
    const timer = setTimeout(() => setMostrarReloj(true), CHECK_TO_CLOCK_MS)
    return () => clearTimeout(timer)
  }, [faseActual])

  const cerrarConfirmCancelar = useCallback(() => {
    setCerrandoConfirm(true)
    setTimeout(() => {
      setConfirmarCancelar(false)
      setCerrandoConfirm(false)
      setCancelError('')
    }, CIERRE_MS)
  }, [])

  async function ejecutarCancelacion() {
    setCancelando(true)
    setCancelError('')
    try {
      const data = await cancelOrder(numero)
      setPedido(data)
      cerrarConfirmCancelar()
    } catch (err) {
      setCancelError(err.message || 'No se pudo cancelar el pedido')
    } finally {
      setCancelando(false)
    }
  }

  // Escape cierra el dialogo de confirmacion si esta abierto
  useEffect(() => {
    if (!confirmarCancelar) return undefined
    const onKey = e => { if (e.key === 'Escape') cerrarConfirmCancelar() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmarCancelar, cerrarConfirmCancelar])

  if (cargando) return <div className="page-state" />

  if (noEncontrado || !pedido) {
    return (
      <div className="checkout-empty">
        <p>No encontramos el pedido <strong>{numero}</strong>.</p>
        <TransitionLink to="/seguimiento">Buscar otro pedido</TransitionLink>
      </div>
    )
  }

  const textos = TEXTOS[faseActual]
  const eventos = Object.fromEntries((pedido.eventos || []).map(e => [e.id, e.at]))
  const enlace = `${window.location.origin}/pedido/${pedido.numero}`
  const whatsapp = meta?.whatsapp
    ? `https://wa.me/${meta.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
        `Hola, consulto mi pedido ${pedido.numero}`,
      )}`
    : null

  // Ultimo paso alcanzado, para marcar cual esta "en curso"
  const alcanzados = PASOS.filter(p => eventos[p.id])
  const actual = alcanzados.length ? alcanzados[alcanzados.length - 1].id : 'recibido'
  const terminado = faseActual === 'confirmado'
  const puedeCancelar = FASES_CANCELABLES.has(faseActual)

  return (
    <>
    <div className="track">
          <div className="track__hero" role="status" aria-live="polite">
            <Estado fase={faseActual} mostrarReloj={mostrarReloj} />
            <h1 className="track__title">{textos.titulo}</h1>
            <p className="track__detail">{textos.detalle}</p>
          </div>

          <div className="track__id">
            <span className="track__id-label">Tu numero de seguimiento</span>
            <span className="track__id-value">{pedido.numero}</span>
            <div className="track__id-actions">
              <Copiar texto={pedido.numero} etiqueta="Copiar numero" />
              <Copiar texto={enlace} etiqueta="Copiar enlace" />
            </div>
          </div>

          {faseActual !== 'cancelado' && (
            <ol className="track__steps">
              {PASOS.map(paso => {
                const hecho = !!eventos[paso.id]
                const enCurso = !terminado && hecho && paso.id === actual
                return (
                  <li
                    key={paso.id}
                    className={`track__step${hecho ? ' is-done' : ''}${enCurso ? ' is-current' : ''}`}
                  >
                    <span className="track__dot" aria-hidden="true" />
                    <span className="track__step-label">{paso.label}</span>
                    <span className="track__step-time">{hecho ? hora(eventos[paso.id]) : ''}</span>
                  </li>
                )
              })}
            </ol>
          )}

          <div className="track__box">
            {pedido.items.map(item => (
              <div className="summary__row order-item" key={item.id}>
                {item.imagen
                  ? <img className="order-item__img" src={item.imagen} alt="" loading="lazy" />
                  : <span className="order-item__img" aria-hidden="true" />}
                <span className="order-item__name">{item.cantidad}× {item.producto_nombre} · {item.talla}</span>
                <span>{formatPrice(item.subtotal)}</span>
              </div>
            ))}
            <div className="summary__row summary__row--total">
              <span>Total</span>
              <span>{formatPrice(pedido.total)}</span>
            </div>
          </div>

          {mostrarAcciones && (puedeCancelar || mostrarContacto) && (
            <div className="track__actions">
              {faseActual === 'sin_pago' && (
                <TransitionLink className="btn btn--solid" to={`/pago/${pedido.numero}`}>
                  Elegir forma de pago
                </TransitionLink>
              )}
              {puedeCancelar && (
                <button className="btn btn--ghost" onClick={() => setConfirmarCancelar(true)} type="button">
                  Cancelar pedido
                </button>
              )}
              {mostrarContacto && whatsapp && (
                <a className="btn btn--ghost" href={whatsapp} target="_blank" rel="noopener noreferrer">
                  Escribirnos por WhatsApp
                </a>
              )}
              {mostrarContacto && (
                <TransitionLink className="btn btn--ghost" to="/catalogo">
                  Seguir viendo
                </TransitionLink>
              )}
            </div>
          )}
        </div>

        {confirmarCancelar && (
          <div className={`gate${cerrandoConfirm ? ' gate--closing' : ''}`} role="dialog" aria-modal="true">
            <div className="gate__backdrop" onClick={cerrarConfirmCancelar} />
            <div className="gate__panel">
              <h2 className="gate__title">Cancelar pedido</h2>
              <p className="gate__text">
                ¿Seguro que quieres cancelar el pedido <strong>{pedido.numero}</strong>? Si cambias
                de idea, puedes volver a declarar el pago con el mismo numero.
              </p>
              {cancelError && <p className="summary__error">{cancelError}</p>}
              <div className="gate__actions">
                <button className="btn btn--solid" onClick={ejecutarCancelacion} disabled={cancelando} type="button">
                  {cancelando ? 'Cancelando...' : 'Si, cancelar pedido'}
                </button>
                <button className="btn btn--ghost" onClick={cerrarConfirmCancelar} disabled={cancelando} type="button">
                  Volver
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  )
}

/** Etiqueta corta del estado, para listados. */
export function estadoCorto(pedido) {
  return {
    sin_pago: 'Falta el pago',
    verificando: 'Verificando pago',
    efectivo: 'Pedido recibido',
    verificado: 'Pago verificado',
    confirmado: 'Confirmado',
    cancelado: 'Cancelado',
  }[fase(pedido)]
}
