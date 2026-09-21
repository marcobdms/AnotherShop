/**
 * Pedidos.jsx — pedidos que llegan de la tienda publica.
 *
 * Aqui no hay nada automatico: el pedido espera a que alguien lo revise.
 * "Confirmar" es lo unico que mueve stock y dinero — crea la venta real y
 * registra el abono contra ella.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  crmCambiarEstadoPedido,
  crmBinanceEstado,
  crmConciliarBinance,
  crmConfirmarPedido,
  crmFetchPedidos,
  crmRechazarPagoPedido,
  formatPrice,
} from './api/catalog'
import { CrmSpinner } from './CrmChrome'

const css = `
  .ped-wrap { padding: 1.5rem 2rem 4rem; }
  .ped-head {
    display: flex; align-items: center; justify-content: space-between;
    gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem;
  }
  .ped-title { margin: 0; font-size: 1rem; font-weight: 600; letter-spacing: 0.02em; }
  .ped-title span { color: var(--grey-400); font-weight: 400; margin-left: 0.5rem; }
  .ped-tools { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
  .ped-search {
    height: 2.25rem; padding: 0 0.7rem; border: 1px solid var(--grey-200);
    background: var(--white); font-family: var(--font); font-size: 0.8rem; min-width: 14rem;
  }
  .ped-search:focus { outline: 0; border-color: var(--black); }
  .ped-tabs { display: flex; gap: 0.35rem; flex-wrap: wrap; }
  .ped-tab {
    padding: 0.4rem 0.75rem; border: 1px solid var(--grey-200); background: var(--white);
    font-family: var(--font); font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--grey-600); cursor: pointer; transition: all 150ms ease;
  }
  .ped-tab:hover { border-color: var(--grey-400); color: var(--black); }
  .ped-tab.active { background: var(--black); border-color: var(--black); color: var(--white); }

  .ped-empty { padding: 3rem 0; text-align: center; color: var(--grey-400); font-size: 0.85rem; }
  .ped-error {
    margin-bottom: 1rem; padding: 0.6rem 0.8rem; border: 1px solid #fecaca;
    background: #fff5f5; color: #b91c1c; font-size: 0.78rem;
  }

  .ped-list { display: grid; gap: 0.6rem; }
  .ped-card { border: 1px solid var(--grey-200); background: var(--white); }
  .ped-card.confirmado { border-left: 3px solid #15803d; }
  .ped-card.cancelado { opacity: 0.55; }
  .ped-card.pago_declarado { border-left: 3px solid #b45309; }

  .ped-row {
    display: grid; grid-template-columns: 8rem minmax(0, 1fr) 7rem 7rem 8rem auto;
    gap: 1rem; align-items: center; padding: 0.85rem 1rem; cursor: pointer;
  }
  .ped-row:hover { background: #fafafa; }
  .ped-num { font-family: monospace; font-size: 0.8rem; letter-spacing: 0.06em; }
  .ped-cliente { min-width: 0; }
  .ped-cliente strong { display: block; font-size: 0.85rem; font-weight: 500; }
  .ped-cliente span { display: block; color: var(--grey-400); font-size: 0.72rem; }
  .ped-cell { font-size: 0.78rem; color: var(--grey-600); }
  .ped-total { font-size: 0.85rem; font-weight: 600; text-align: right; }
  .ped-badge {
    display: inline-block; padding: 0.2rem 0.5rem; border: 1px solid var(--grey-200);
    font-size: 0.65rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--grey-600);
    white-space: nowrap;
  }
  .ped-badge.pago_declarado { border-color: #fcd34d; background: #fffbeb; color: #b45309; }
  .ped-badge.confirmado { border-color: #bbf7d0; background: #f0fdf4; color: #15803d; }
  .ped-badge.cancelado { border-color: #fecaca; background: #fff5f5; color: #b91c1c; }

  .ped-detail { padding: 0 1rem 1.1rem; border-top: 1px solid var(--grey-100); }
  .ped-section { margin-top: 1rem; }
  .ped-section h4 {
    margin: 0 0 0.5rem; font-size: 0.68rem; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--grey-400); font-weight: 600;
  }
  .ped-item, .ped-pago {
    display: flex; gap: 0.75rem; align-items: center; padding: 0.4rem 0;
    border-bottom: 1px solid var(--grey-100); font-size: 0.78rem;
  }
  .ped-item img { width: 2.25rem; height: 3rem; object-fit: cover; background: var(--grey-100); }
  .ped-item__name { flex: 1 1 auto; min-width: 0; }
  .ped-item__name small { display: block; color: var(--grey-400); font-size: 0.7rem; }
  .ped-swatch {
    width: 0.7rem; height: 0.7rem; border-radius: 50%; border: 1px solid rgba(0,0,0,.18);
    flex: 0 0 auto;
  }
  .ped-pago__estado { color: var(--grey-400); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; }
  .ped-pago__estado.verificado { color: #15803d; }
  .ped-pago__estado.rechazado { color: #b91c1c; }
  .ped-pago__alerta { color: #b91c1c !important; }
  .ped-pago a { color: var(--black); border-bottom: 1px solid var(--grey-300); }

  .ped-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1.1rem; }
  .ped-note { margin: 0.75rem 0 0; color: var(--grey-400); font-size: 0.72rem; line-height: 1.6; }
  .ped-sync { display: flex; align-items: center; gap: 0.6rem; }
  .ped-sync small { color: var(--grey-400); font-size: 0.7rem; }
  .ped-report {
    margin-bottom: 1rem; padding: 0.8rem 1rem; border: 1px solid var(--grey-200);
    background: #fafafa; font-size: 0.78rem; line-height: 1.7;
  }
  .ped-report.ok { border-color: #bbf7d0; background: #f0fdf4; }
  .ped-report.err { border-color: #fecaca; background: #fff5f5; color: #b91c1c; }
  .ped-report ul { margin: 0.3rem 0 0; padding-left: 1.1rem; }
  .ped-cash {
    display: flex; align-items: center; gap: 0.55rem; margin-top: 1.1rem;
    padding: 0.7rem 0.85rem; border: 1px solid var(--grey-200); background: #fafafa;
    font-size: 0.8rem; cursor: pointer;
  }
  .ped-cash input { width: 1.05rem; height: 1.05rem; accent-color: #0b0b0b; cursor: pointer; }
`

const ESTADOS = [
  { id: '', label: 'Todos' },
  { id: 'pago_declarado', label: 'Por revisar' },
  { id: 'borrador', label: 'Sin pago' },
  { id: 'confirmado', label: 'Confirmados' },
  { id: 'cancelado', label: 'Cancelados' },
]

const ESTADO_LABEL = {
  borrador: 'Sin pago',
  pago_declarado: 'Por revisar',
  verificado: 'Verificado',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
}

function fecha(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function Pedidos({ active, catalogRevision, usuario, onCatalogChanged }) {
  const [pedidos, setPedidos] = useState([])
  const [estado, setEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  // Pedidos en efectivo donde ya se marco "cobrado en persona"
  const [cobrados, setCobrados] = useState({})
  // null = aun no se sabe; luego { configurado }
  const [binance, setBinance] = useState(null)
  const [informe, setInforme] = useState(null)

  const cargar = useCallback(async () => {
    setError('')
    try {
      setPedidos(await crmFetchPedidos({ estado, q: busqueda.trim() }))
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }, [estado, busqueda])

  useEffect(() => {
    if (!active) return
    crmBinanceEstado().then(setBinance).catch(() => setBinance({ configurado: false }))
  }, [active])

  useEffect(() => {
    if (!active) return undefined
    const timer = setTimeout(cargar, busqueda ? 250 : 0)
    return () => clearTimeout(timer)
  }, [active, cargar, busqueda, catalogRevision])

  const resumen = useMemo(() => {
    const porRevisar = pedidos.filter(p => p.estado === 'pago_declarado').length
    return { total: pedidos.length, porRevisar }
  }, [pedidos])

  async function accion(fn, mensajeError) {
    setOcupado(true)
    setError('')
    try {
      await fn()
      await cargar()
      onCatalogChanged?.()
    } catch (err) {
      setError(err.message || mensajeError)
    } finally {
      setOcupado(false)
    }
  }

  const confirmar = (pedido, registrarPago, cobroEfectivo = false) => {
    const aviso = cobroEfectivo
      ? `Confirmar ${pedido.numero} COBRADO en efectivo?

Se creara la venta, bajara el stock y se registrara el cobro de ${formatPrice(pedido.total)} en dolares.`
      : registrarPago
        ? `Confirmar ${pedido.numero}?

Se creara la venta, bajara el stock y se registrara el pago.`
        : `Confirmar ${pedido.numero} sin registrar pago?

Se creara la venta y bajara el stock, pero quedara como deuda del cliente.`
    if (!window.confirm(aviso)) return
    accion(
      () => crmConfirmarPedido(pedido.id, { usuario, registrarPago, cobroEfectivo }),
      'No se pudo confirmar el pedido',
    )
  }

  const conciliarBinance = () => {
    accion(async () => setInforme(await crmConciliarBinance()), 'No se pudo conciliar con Binance')
  }

  const cancelar = (pedido) => {
    const motivo = window.prompt(`Motivo para cancelar ${pedido.numero}:`, 'Sin respuesta del cliente')
    if (motivo === null) return
    accion(
      () => crmCambiarEstadoPedido(pedido.id, 'cancelado', motivo),
      'No se pudo cancelar',
    )
  }

  const rechazarPago = (pago) => {
    if (!window.confirm('Marcar este pago como rechazado?')) return
    accion(() => crmRechazarPagoPedido(pago.id, usuario), 'No se pudo rechazar el pago')
  }

  if (cargando) return <CrmSpinner />

  return (
    <div className="ped-wrap">
      <style>{css}</style>

      <div className="ped-head">
        <h2 className="ped-title">
          Pedidos
          <span>
            {resumen.total} en lista
            {resumen.porRevisar > 0 && ` · ${resumen.porRevisar} por revisar`}
          </span>
        </h2>
        <div className="ped-tools">
          <div className="ped-sync">
            <button
              className="crm-btn"
              disabled={ocupado || !binance?.configurado}
              onClick={conciliarBinance}
              type="button"
              title={binance?.configurado ? 'Cruza los pagos declarados con el historial de Binance Pay' : 'Faltan BINANCE_API_KEY y BINANCE_API_SECRET en el backend'}
            >
              Conciliar con Binance
            </button>
            {binance && !binance.configurado && <small>sin configurar</small>}
          </div>
          <input
            className="ped-search"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Numero, nombre, telefono o email"
          />
          <div className="ped-tabs">
            {ESTADOS.map(e => (
              <button
                key={e.id}
                className={`ped-tab${estado === e.id ? ' active' : ''}`}
                onClick={() => setEstado(e.id)}
                type="button"
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="ped-error">{error}</div>}

      {informe && (
        <div className={`ped-report ${informe.error ? 'err' : informe.verificados.length ? 'ok' : ''}`}>
          {informe.error ? (
            <>Binance: {informe.error}</>
          ) : (
            <>
              <strong>Conciliacion con Binance:</strong>{' '}
              {informe.verificados.length} verificado(s), {informe.pendientes} pendiente(s).
              {informe.verificados.length > 0 && (
                <ul>
                  {informe.verificados.map(v => (
                    <li key={v.transaccion}>{v.numero} · {v.importe} · por {v.razones.join(' + ')}</li>
                  ))}
                </ul>
              )}
              {(informe.discrepancias || []).length > 0 && (
                <>
                  <br /><strong>No cuadra con el CRM (no se verifico):</strong>
                  <ul>
                    {informe.discrepancias.map(d => (
                      <li key={d.transaccion + d.numero}>
                        {d.numero} · {d.problemas.join('; ')}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {informe.candidatos.length > 0 && (
                <>
                  <br />Sin coincidencia segura (revisar a mano):
                  <ul>
                    {informe.candidatos.map(c => (
                      <li key={c.transaccion + c.numero}>
                        {c.numero} · entro {c.importe} {c.moneda} de {c.pagador || 'desconocido'}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      )}

      {pedidos.length === 0 ? (
        <div className="ped-empty">No hay pedidos con este filtro.</div>
      ) : (
        <div className="ped-list">
          {pedidos.map(pedido => {
            const open = abierto === pedido.id
            return (
              <div key={pedido.id} className={`ped-card ${pedido.estado}`}>
                <div
                  className="ped-row"
                  onClick={() => setAbierto(open ? null : pedido.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setAbierto(open ? null : pedido.id)}
                >
                  <span className="ped-num">{pedido.numero}</span>
                  <div className="ped-cliente">
                    <strong>{pedido.nombre || 'Sin nombre'}</strong>
                    <span>{pedido.telefono || pedido.email || 'Sin contacto'}</span>
                  </div>
                  <span className="ped-cell">{fecha(pedido.creado_en)}</span>
                  <span className="ped-cell">{pedido.metodo_pago || '—'}</span>
                  <span className={`ped-badge ${pedido.estado}`}>
                    {ESTADO_LABEL[pedido.estado] || pedido.estado}
                  </span>
                  <span className="ped-total">{formatPrice(pedido.total)}</span>
                </div>

                {open && (
                  <div className="ped-detail">
                    <div className="ped-section">
                      <h4>Prendas ({pedido.items.length})</h4>
                      {pedido.items.map(item => (
                        <div className="ped-item" key={item.id}>
                          {item.imagen && <img src={item.imagen} alt="" />}
                          <span className="ped-swatch" style={{ background: item.color_hex }} />
                          <span className="ped-item__name">
                            {item.producto_nombre}
                            <small>
                              {item.color} · Talla {item.talla} · {item.cantidad} ud.
                              {item.producto_ref ? ` · ${item.producto_ref}` : ''}
                            </small>
                          </span>
                          <span>{formatPrice(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="ped-section">
                      <h4>Pagos declarados</h4>
                      {pedido.pagos.length === 0 ? (
                        <p className="ped-note">Todavia no ha declarado ningun pago.</p>
                      ) : (
                        pedido.pagos.map(pago => (
                          <div className="ped-pago" key={pago.id}>
                            <span className="ped-item__name">
                              {pago.metodo}
                              <small>
                                {pago.monto} {pago.moneda.toUpperCase()}
                                {pago.tasa ? ` · tasa ${pago.tasa}` : ''}
                                {` · ${formatPrice(pago.monto_usd)}`}
                                {pago.referencia ? ` · ref ${pago.referencia}` : ''}
                              </small>
                              {pago.nota && (
                                <small className={pago.nota.startsWith('REVISAR') ? 'ped-pago__alerta' : ''}>
                                  {pago.nota}
                                </small>
                              )}
                            </span>
                            {pago.comprobante_url && (
                              <a href={pago.comprobante_url} target="_blank" rel="noopener noreferrer">
                                Comprobante
                              </a>
                            )}
                            <span className={`ped-pago__estado ${pago.estado}`}>
                              {pago.estado}{pago.verificado_por ? ` · ${pago.verificado_por}` : ''}
                            </span>
                            {pago.estado === 'declarado' && pedido.estado !== 'confirmado' && (
                              <button
                                className="crm-btn"
                                disabled={ocupado}
                                onClick={() => rechazarPago(pago)}
                                type="button"
                              >
                                Rechazar
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {(pedido.entrega || pedido.nota || pedido.motivo_cancelacion) && (
                      <div className="ped-section">
                        <h4>Notas</h4>
                        {pedido.entrega && <p className="ped-note">Entrega: {pedido.entrega}</p>}
                        {pedido.nota && <p className="ped-note">{pedido.nota}</p>}
                        {pedido.motivo_cancelacion && (
                          <p className="ped-note">Cancelado: {pedido.motivo_cancelacion}</p>
                        )}
                      </div>
                    )}

                    {pedido.estado === 'confirmado' ? (
                      <p className="ped-note">
                        Venta creada. El stock ya bajo y el pago quedo registrado en la ficha del cliente.
                      </p>
                    ) : pedido.estado === 'cancelado' ? (
                      <p className="ped-note">Pedido cancelado. No toco el stock.</p>
                    ) : (
                      <>
                        {pedido.metodo_pago === 'efectivo' ? (
                          <>
                            <label className="ped-cash">
                              <input
                                type="checkbox"
                                checked={!!cobrados[pedido.id]}
                                onChange={e => setCobrados({ ...cobrados, [pedido.id]: e.target.checked })}
                              />
                              <span>
                                Cobrado en efectivo, en persona ({formatPrice(pedido.total)} USD)
                              </span>
                            </label>
                            <div className="ped-actions">
                              <button
                                className="crm-btn crm-btn--primary"
                                disabled={ocupado}
                                onClick={() => confirmar(pedido, true, !!cobrados[pedido.id])}
                                type="button"
                              >
                                {cobrados[pedido.id] ? 'Confirmar y marcar pagado' : 'Confirmar sin cobrar aun'}
                              </button>
                              <button
                                className="crm-btn"
                                disabled={ocupado}
                                onClick={() => cancelar(pedido)}
                                type="button"
                              >
                                Cancelar
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="ped-actions">
                            <button
                              className="crm-btn crm-btn--primary"
                              disabled={ocupado}
                              onClick={() => confirmar(pedido, true)}
                              type="button"
                            >
                              Confirmar y cobrar
                            </button>
                            <button
                              className="crm-btn"
                              disabled={ocupado}
                              onClick={() => confirmar(pedido, false)}
                              type="button"
                            >
                              Confirmar sin cobrar
                            </button>
                            <button
                              className="crm-btn"
                              disabled={ocupado}
                              onClick={() => cancelar(pedido)}
                              type="button"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                        <p className="ped-note">
                          Confirmar crea la venta y baja el stock. Si no hay stock suficiente fallara
                          y no se creara nada.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
