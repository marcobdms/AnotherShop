/**
 * Pago.jsx — el cliente elige metodo, ve los datos y declara lo que pago.
 *
 * Nada de esto cobra dinero: registra lo que el comprador dice haber hecho.
 * La verificacion y el cobro real ocurren en el CRM.
 *
 * Efectivo es el caso especial: se paga en persona y en dolares, asi que no hay
 * nada que declarar. El pedido queda anotado y el cobro lo marca el admin.
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  declareOrderPayment,
  fetchOrder,
  fetchPaymentMethods,
  formatPrice,
  uploadOrderReceipt,
} from '../api/catalog'
import Footer from '../components/Footer'
import TransitionLink from '../components/TransitionLink'
import { rememberOrder } from '../utils/orders'
import './Checkout.css'

// Icono junto al titulo de cada metodo. Efectivo va solo con texto, sin icono.
const ICONOS = {
  binance: { src: '/pay-icons/binance.webp' },
  // El logo de PayPal ya lleva el nombre: el texto queda solo para lectores de pantalla
  paypal: { src: '/pay-icons/paypal.webp', ancho: true, soloLogo: true },
  pago_movil: { src: '/pay-icons/venezuela.webp', ancho: true, insignia: true },
}

const formatBs = (value) =>
  `${Number(value).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`

function Copiar({ valor }) {
  const [copiado, setCopiado] = useState(false)
  if (!valor) return null
  return (
    <button
      className="copy"
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(valor)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 1600)
        } catch {
          setCopiado(false)
        }
      }}
    >
      {copiado ? 'Copiado' : 'Copiar'}
    </button>
  )
}

/** Importe que el comprador tiene que enviar, en la moneda de cada metodo. */
function importeMetodo(metodo, pedido, tasa) {
  if (metodo.id === 'pago_movil' && tasa > 0) {
    return { texto: formatBs(pedido.total * tasa), copia: (pedido.total * tasa).toFixed(2), nota: `Tasa BCV ${tasa}` }
  }
  if (metodo.id === 'binance') {
    return { texto: `${pedido.total.toFixed(2)} USDT`, copia: pedido.total.toFixed(2), nota: '' }
  }
  return { texto: formatPrice(pedido.total), copia: pedido.total.toFixed(2), nota: '' }
}

export default function Pago() {
  const { numero } = useParams()
  const navigate = useNavigate()

  const [pedido, setPedido] = useState(null)
  const [config, setConfig] = useState({ tasa_bs: 0, metodos: [] })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [metodo, setMetodo] = useState(null)
  const [referencia, setReferencia] = useState('')
  const [comprobante, setComprobante] = useState(null)
  const [enviando, setEnviando] = useState(false)
  // Zelle todavia no tiene datos reales configurados: es un renglon fijo que
  // solo avisa, no un metodo mas de config.metodos.
  const [zelleAbierto, setZelleAbierto] = useState(false)

  useEffect(() => {
    Promise.all([fetchOrder(numero), fetchPaymentMethods()])
      .then(([order, methods]) => {
        setPedido(order)
        setConfig(methods)
      })
      .catch(err => setError(err.message))
      .finally(() => setCargando(false))
  }, [numero])

  if (cargando) return <div className="page-state" />

  if (error && !pedido) {
    return (
      <main className="checkout-page">
        <div className="checkout-empty">
          <p>{error}</p>
          <TransitionLink to="/catalogo">Volver al catalogo</TransitionLink>
        </div>
      </main>
    )
  }

  const tasa = Number(config.tasa_bs) || 0
  const esEfectivo = metodo?.id === 'efectivo'
  const esPagoMovil = metodo?.id === 'pago_movil'
  const esBinance = metodo?.id === 'binance'
  // Sin el ID del pagador no hay forma fiable de emparejar el pago de Binance
  const faltaReferencia = esBinance && !referencia.trim()
  const pideReferencia = metodo && !esEfectivo
  const importe = metodo ? importeMetodo(metodo, pedido, tasa) : null
  const enlace = metodo?.enlace
    ? metodo.enlace.replace('{monto}', pedido.total.toFixed(2))
    : ''

  function elegir(m) {
    setError('')
    setZelleAbierto(false)
    setMetodo(metodo?.id === m.id ? null : m)
  }

  function alternarZelle() {
    setMetodo(null)
    setZelleAbierto(o => !o)
  }

  async function confirmar() {
    if (!metodo) return
    setEnviando(true)
    setError('')

    // Pago movil siempre es en bolivares; el servidor pone su propia tasa.
    const base = {
      metodo: metodo.id,
      moneda: esPagoMovil ? 'bs' : metodo.id === 'binance' ? 'usdt' : 'usd',
      monto: esPagoMovil && tasa > 0 ? Number((pedido.total * tasa).toFixed(2)) : pedido.total,
      referencia: referencia.trim(),
    }

    try {
      if (comprobante && !esEfectivo) {
        await uploadOrderReceipt(pedido.numero, comprobante, base)
      } else {
        await declareOrderPayment(pedido.numero, base)
      }
      rememberOrder(pedido.numero)
      navigate(`/pedido/${pedido.numero}`)
    } catch (err) {
      setError(err.message || 'No se pudo registrar el pago')
      setEnviando(false)
    }
  }

  return (
    <>
      <main className="checkout-page">
        <div className="checkout-layout">
          <section className="checkout-main">
            <p className="checkout-back">
              <TransitionLink to="/resumen">← Volver a la cesta</TransitionLink>
            </p>
            <h1 className="checkout-title">Forma de pago</h1>
            <p className="checkout-sub">
              Pedido <strong>{pedido.numero}</strong> · {formatPrice(pedido.total)}
            </p>

            {config.metodos.length === 0 && (
              <p className="pay-empty">
                Todavia no hay metodos de pago configurados. Guarda el numero{' '}
                <strong>{pedido.numero}</strong> y escribenos para completarlo.
              </p>
            )}

            <ul className="pay-list">
              {config.metodos.map(m => {
                  const activo = metodo?.id === m.id
                  return (
                    <li key={m.id} className={`pay-option${activo ? ' pay-option--active' : ''}`}>
                      <button
                        className="pay-option__head"
                        onClick={() => elegir(m)}
                        aria-expanded={activo}
                        type="button"
                      >
                        <span className="pay-option__radio" aria-hidden="true" />
                        <span className="pay-option__title">
                          {ICONOS[m.id] && (
                            <img
                              className={`pay-icon${ICONOS[m.id].ancho ? ' pay-icon--wide' : ''}${ICONOS[m.id].insignia ? ' pay-icon--insignia' : ''}`}
                              src={ICONOS[m.id].src}
                              alt=""
                              loading="lazy"
                            />
                          )}
                          <span className={ICONOS[m.id]?.soloLogo ? 'sr-only' : undefined}>
                            {m.titulo || m.id}
                          </span>
                        </span>
                        {m.etiqueta && <span className="pay-badge">{m.etiqueta}</span>}
                      </button>

                      {activo && (
                        <div className="pay-option__body">
                          {m.instrucciones && <p className="pay-instructions">{m.instrucciones}</p>}

                          {/* Importe exacto a enviar */}
                          <div className="pay-amount">
                            <span className="pay-amount__label">
                              {esEfectivo ? 'Total a pagar en persona' : 'Importe a enviar'}
                            </span>
                            <span className="pay-amount__value">{importe.texto}</span>
                            {!esEfectivo && <Copiar valor={importe.copia} />}
                          </div>
                          {importe.nota && <p className="pay-hint">{importe.nota}</p>}
                          {esPagoMovil && tasa <= 0 && (
                            <p className="pay-hint">
                              La tasa del dia no esta disponible ahora mismo. Escribenos y te
                              indicamos el importe en bolivares.
                            </p>
                          )}

                          {m.qr && (
                            <figure className="pay-qr">
                              <img src={m.qr} alt={`QR de ${m.titulo || m.id}`} />
                              <figcaption>Escanea desde tu app</figcaption>
                            </figure>
                          )}

                          {enlace && (
                            <a
                              className="btn btn--ghost pay-link"
                              href={enlace}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Abrir {m.titulo || m.id}
                            </a>
                          )}

                          {(m.datos || []).filter(d => d.valor).map(d => (
                            <div className="pay-data" key={d.label}>
                              <span className="pay-data__label">{d.label}</span>
                              <span className="pay-data__value">{d.valor}</span>
                              <Copiar valor={d.valor} />
                            </div>
                          ))}

                          {!esEfectivo && (
                            <>
                              <div className="pay-data pay-data--highlight">
                                <span className="pay-data__label">{esBinance ? 'Nota' : 'Concepto'}</span>
                                <span className="pay-data__value">{pedido.numero}</span>
                                <Copiar valor={pedido.numero} />
                              </div>
                              <p className="pay-hint">
                                Pon el numero de pedido en el concepto o la nota: es como
                                encontramos tu pago.
                              </p>

                              {pideReferencia && (
                                <label className="field field--block">
                                  <span>
                                    {esBinance
                                      ? 'Tu Binance ID (la cuenta desde la que pagas)'
                                      : 'Referencia o ID de la transaccion'}
                                  </span>
                                  <input
                                    value={referencia}
                                    onChange={e => setReferencia(e.target.value)}
                                    placeholder={esBinance ? 'Ej. 12345678' : 'Ultimos digitos, txid...'}
                                    inputMode={esBinance ? 'numeric' : undefined}
                                  />
                                </label>
                              )}

                              <label className="field field--block">
                                <span>Comprobante (opcional)</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={e => setComprobante(e.target.files?.[0] ?? null)}
                                />
                              </label>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}

                {/* Zelle: renglon fijo mientras no haya datos reales configurados. */}
                <li className={`pay-option${zelleAbierto ? ' pay-option--active' : ''}`}>
                  <button
                    className="pay-option__head"
                    onClick={alternarZelle}
                    aria-expanded={zelleAbierto}
                    type="button"
                  >
                    <span className="pay-option__radio" aria-hidden="true" />
                    <span className="pay-option__title">
                      <img className="pay-icon pay-icon--wide pay-icon--insignia" src="/pay-icons/zelle.svg" alt="" loading="lazy" />
                      <span>Zelle</span>
                    </span>
                  </button>

                  {zelleAbierto && (
                    <div className="pay-option__body">
                      <p className="pay-instructions">Este metodo de pago todavia no esta disponible.</p>
                    </div>
                  )}
                </li>
              </ul>
          </section>

          <aside className="checkout-aside">
            <div className="summary">
              <h2 className="summary__title">Tu pedido</h2>
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
              {tasa > 0 && (
                <div className="summary__row">
                  <span>En bolivares (BCV)</span>
                  <span>{formatBs(pedido.total * tasa)}</span>
                </div>
              )}

              {error && <p className="summary__error">{error}</p>}

              <button
                className="btn btn--solid btn--block"
                disabled={!metodo || enviando || faltaReferencia}
                onClick={confirmar}
                type="button"
              >
                {enviando
                  ? 'Enviando...'
                  : esEfectivo
                    ? 'Confirmar pedido'
                    : 'He realizado el pago'}
              </button>
              {esEfectivo && (
                <p className="summary__hint">
                  Pagas en persona al recibir la prenda. Te escribimos para acordarlo.
                </p>
              )}
              {faltaReferencia && (
                <p className="summary__hint">
                  Indica tu Binance ID para poder verificar tu pago.
                </p>
              )}
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </>
  )
}
