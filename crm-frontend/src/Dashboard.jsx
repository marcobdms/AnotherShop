import { useCallback, useEffect, useMemo, useState } from 'react'
import { crmFetchDashboard } from './api/catalog'
import { CrmHeader, CrmLogin, useCrmSession } from './CrmChrome'

function inputDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function makeRange(days) {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  return { from: inputDate(from), to: inputDate(to) }
}

function queryBounds(range) {
  const desde = new Date(`${range.from}T00:00:00`)
  const hasta = new Date(`${range.to}T00:00:00`)
  hasta.setDate(hasta.getDate() + 1)
  return { desde: desde.toISOString(), hasta: hasta.toISOString() }
}

function usd(value) {
  return Number(value || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  })
}

function integer(value) {
  return Number(value || 0).toLocaleString('es-ES')
}

function shortDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  })
}

function delta(current, previous) {
  const currentValue = Number(current || 0)
  const previousValue = Number(previous || 0)
  if (!previousValue) return currentValue ? { value: 100, isNew: true } : { value: 0 }
  return { value: ((currentValue - previousValue) / Math.abs(previousValue)) * 100 }
}

function Delta({ current, previous }) {
  const change = delta(current, previous)
  const positive = change.value >= 0
  return (
    <span className={`dash-delta ${positive ? 'positive' : 'negative'}`}>
      {change.isNew ? 'Nuevo' : `${positive ? '+' : ''}${change.value.toFixed(1)}%`}
      <span> vs. anterior</span>
    </span>
  )
}

function Metric({ label, value, current, previous, note }) {
  return (
    <article className="dash-metric">
      <p>{label}</p>
      <strong>{value}</strong>
      {previous !== undefined
        ? <Delta current={current} previous={previous} />
        : <span className="dash-metric__note">{note}</span>}
    </article>
  )
}

function Empty({ children = 'Sin datos en este periodo.' }) {
  return <p className="dash-empty">{children}</p>
}

function BarList({ rows, valueKey, labelKey, formatter = integer, secondaryKey }) {
  const max = Math.max(...rows.map(row => Number(row[valueKey] || 0)), 1)
  if (!rows.length) return <Empty />
  return (
    <div className="dash-bars">
      {rows.map((row, index) => (
        <div className="dash-bar" key={`${row[labelKey]}-${index}`}>
          <div className="dash-bar__head">
            <span>{row[labelKey]}</span>
            <span>
              {formatter(row[valueKey])}
              {secondaryKey ? ` · ${integer(row[secondaryKey])} uds.` : ''}
            </span>
          </div>
          <div className="dash-bar__track">
            <span style={{ width: `${Math.max(2, (Number(row[valueKey] || 0) / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function SalesBars({ rows }) {
  const max = Math.max(...rows.map(row => Number(row.sales || 0)), 1)
  const labelEvery = Math.max(1, Math.ceil(rows.length / 7))
  if (!rows.length) return <Empty />
  return (
    <div className="sales-bars" aria-label="Ventas por dia">
      {rows.map((row, index) => (
        <div
          className="sales-bars__column"
          key={row.date}
          title={`${shortDate(row.date)}: ${usd(row.sales)} · ${row.orders} pedidos`}
        >
          <span className="sales-bars__value">
            {index === rows.length - 1 || rows.length <= 10 ? usd(row.sales) : ''}
          </span>
          <div className="sales-bars__track">
            <span style={{ height: `${Math.max(2, (Number(row.sales || 0) / max) * 100)}%` }} />
          </div>
          <span className="sales-bars__label">
            {index % labelEvery === 0 || index === rows.length - 1 ? shortDate(row.date) : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

function Panel({ title, aside, className = '', children }) {
  return (
    <section className={`dash-panel ${className}`}>
      <div className="dash-panel__head">
        <h2>{title}</h2>
        {aside && <span>{aside}</span>}
      </div>
      {children}
    </section>
  )
}

function QualityPanel({ quality }) {
  const nonUsdCount = quality.non_usd_payments.reduce(
    (sum, row) => sum + Number(row.payments || 0),
    0,
  )
  const checks = [
    { label: 'Pagos fuera de USD', value: nonUsdCount },
    { label: 'Metodo de pago desconocido', value: quality.unknown_payment_methods },
    { label: 'Ventas sin prendas', value: quality.sales_without_items },
    { label: 'Prendas sin producto enlazado', value: quality.unmatched_product_items },
    { label: 'Productos vendidos sin coste', value: quality.sold_products_without_cost },
  ]
  const totalIssues = checks.reduce((sum, row) => sum + Number(row.value || 0), 0)
  return (
    <Panel title="Calidad de datos" aside={totalIssues ? `${totalIssues} avisos` : 'Sin avisos'}>
      <div className="quality-list">
        {checks.map(row => (
          <div className="quality-row" key={row.label}>
            <span>{row.label}</span>
            <strong className={row.value ? 'warning' : 'ok'}>{integer(row.value)}</strong>
          </div>
        ))}
      </div>
      {quality.non_usd_payments.length > 0 && (
        <p className="dash-footnote">
          Los pagos no USD se excluyen de todos los totales del dashboard.
        </p>
      )}
    </Panel>
  )
}

export default function Dashboard() {
  const { usuario, login, logout } = useCrmSession()
  const [range, setRange] = useState(() => makeRange(30))
  const [preset, setPreset] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)

  const loadDashboard = useCallback(async () => {
    if (!usuario || !range.from || !range.to || range.from > range.to) return
    setLoading(true)
    setError('')
    try {
      const response = await crmFetchDashboard(queryBounds(range))
      setData(response)
    } catch (loadError) {
      setError(loadError.message || 'No se pudo cargar el dashboard')
    } finally {
      setLoading(false)
    }
  }, [range, usuario])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard, refreshVersion])

  const agingRows = useMemo(() => {
    if (!data) return []
    const aging = data.receivables.aging
    return [
      { label: '0–7 dias', amount: aging['0_7'] },
      { label: '8–30 dias', amount: aging['8_30'] },
      { label: '31–60 dias', amount: aging['31_60'] },
      { label: '+61 dias', amount: aging['61_plus'] },
    ]
  }, [data])

  function applyPreset(days) {
    setPreset(days)
    setRange(makeRange(days))
  }

  if (!usuario) return <CrmLogin onAuth={login} />

  return (
    <div className="crm-page">
      <CrmHeader usuario={usuario} onLogout={logout} />
      <main className="dashboard">
        <section className="dashboard-intro">
          <div>
            <p className="dash-eyebrow">Resumen comercial · USD</p>
            <h1>Ventas, cobros y stock</h1>
            <p>Una lectura operativa del CRM para decidir que vender, cobrar y reponer.</p>
          </div>
          <button
            className="crm-btn"
            onClick={() => setRefreshVersion(version => version + 1)}
            disabled={loading}
          >
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </section>

        <section className="dashboard-filters" aria-label="Periodo del dashboard">
          <div className="dashboard-presets">
            {[7, 30, 90].map(days => (
              <button
                key={days}
                className={`crm-btn${preset === days ? ' active' : ''}`}
                onClick={() => applyPreset(days)}
              >
                {days} dias
              </button>
            ))}
          </div>
          <label>
            <span>Desde</span>
            <input
              className="crm-input"
              type="date"
              value={range.from}
              max={range.to}
              onChange={event => {
                setPreset(null)
                setRange(current => ({ ...current, from: event.target.value }))
              }}
            />
          </label>
          <label>
            <span>Hasta</span>
            <input
              className="crm-input"
              type="date"
              value={range.to}
              min={range.from}
              onChange={event => {
                setPreset(null)
                setRange(current => ({ ...current, to: event.target.value }))
              }}
            />
          </label>
        </section>

        {error && (
          <div className="dashboard-error">
            <span>{error}</span>
            <button className="crm-btn" onClick={loadDashboard}>Reintentar</button>
          </div>
        )}

        {!data && loading ? (
          <div className="dashboard-loading">Construyendo resumen...</div>
        ) : data && (
          <>
            <section className="dash-metrics">
              <Metric
                label="Ventas netas"
                value={usd(data.kpis.net_sales)}
                current={data.kpis.net_sales}
                previous={data.previous_kpis.net_sales}
              />
              <Metric
                label="Pedidos"
                value={integer(data.kpis.orders)}
                current={data.kpis.orders}
                previous={data.previous_kpis.orders}
              />
              <Metric
                label="Unidades"
                value={integer(data.kpis.units)}
                current={data.kpis.units}
                previous={data.previous_kpis.units}
              />
              <Metric
                label="Ticket medio"
                value={usd(data.kpis.average_ticket)}
                current={data.kpis.average_ticket}
                previous={data.previous_kpis.average_ticket}
              />
              <Metric
                label="Cobrado"
                value={usd(data.collections.total)}
                note={`${integer(data.collections.by_method.reduce((sum, row) => sum + row.payments, 0))} abonos USD`}
              />
              <Metric
                label="Por cobrar"
                value={usd(data.receivables.total)}
                note={`${integer(data.receivables.clients)} clientes`}
              />
            </section>

            <div className="dash-grid dash-grid--primary">
              <Panel
                title="Evolucion de ventas"
                aside={`${integer(data.kpis.customers)} clientes · ${integer(data.kpis.orders)} pedidos`}
                className="dash-panel--wide"
              >
                <SalesBars rows={data.sales_series} />
              </Panel>

              <Panel
                title="Antigüedad de deuda"
                aside={usd(data.receivables.total)}
              >
                <BarList
                  rows={agingRows}
                  valueKey="amount"
                  labelKey="label"
                  formatter={usd}
                />
              </Panel>
            </div>

            <div className="dash-grid">
              <Panel title="Productos mas vendidos" aside="Top 10">
                {data.top_products.length ? (
                  <div className="dash-table-wrap">
                    <table className="dash-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Uds.</th>
                          <th>Ventas</th>
                          <th>Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.top_products.map(row => (
                          <tr key={`${row.producto_id}-${row.ref}-${row.name}`}>
                            <td>
                              <strong>{row.name}</strong>
                              <span>{row.ref || row.producto_id}</span>
                            </td>
                            <td>{integer(row.units)}</td>
                            <td>{usd(row.sales)}</td>
                            <td className={row.stock <= 2 ? 'warning' : ''}>{integer(row.stock)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <Empty />}
              </Panel>

              <Panel title="Clientes principales" aside="Por ventas">
                {data.top_customers.length ? (
                  <div className="dash-table-wrap">
                    <table className="dash-table">
                      <thead>
                        <tr>
                          <th>Cliente</th>
                          <th>Pedidos</th>
                          <th>Ventas</th>
                          <th>Pendiente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.top_customers.map(row => (
                          <tr key={row.cliente_id}>
                            <td>
                              <strong>{row.name}</strong>
                              <span>Ultima {shortDate(row.last_purchase)}</span>
                            </td>
                            <td>{integer(row.orders)}</td>
                            <td>{usd(row.sales)}</td>
                            <td className={row.pending > 0 ? 'warning' : ''}>{usd(row.pending)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <Empty />}
              </Panel>
            </div>

            <div className="dash-grid dash-grid--thirds">
              <Panel title="Cobros por metodo" aside={usd(data.collections.total)}>
                <BarList
                  rows={data.collections.by_method}
                  valueKey="amount"
                  labelKey="method"
                  formatter={usd}
                />
              </Panel>

              <Panel title="Tallas" aside={`${integer(data.kpis.units)} uds.`}>
                <BarList
                  rows={data.sizes}
                  valueKey="units"
                  labelKey="size"
                />
              </Panel>

              <Panel title="Colores" aside="Top 8">
                {data.colors.length ? (
                  <div className="color-list">
                    {data.colors.map(row => (
                      <div className="color-row" key={`${row.color}-${row.hex}`}>
                        <span
                          className="color-swatch"
                          style={{ backgroundColor: row.hex }}
                          aria-hidden="true"
                        />
                        <span>{row.color}</span>
                        <strong>{integer(row.units)} uds.</strong>
                      </div>
                    ))}
                  </div>
                ) : <Empty />}
              </Panel>
            </div>

            <div className="dash-grid">
              <Panel
                title="Cobros pendientes"
                aside={`${integer(data.receivables.clients)} clientes`}
              >
                {data.receivables.top_debtors.length ? (
                  <div className="dash-table-wrap">
                    <table className="dash-table">
                      <thead>
                        <tr>
                          <th>Cliente</th>
                          <th>Compras</th>
                          <th>Antigüedad</th>
                          <th>Pendiente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.receivables.top_debtors.map(row => (
                          <tr key={row.cliente_id}>
                            <td><strong>{row.nombre}</strong></td>
                            <td>{integer(row.sales)}</td>
                            <td>{integer(row.oldest_days)} dias</td>
                            <td className="warning">{usd(row.pending)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <Empty>No hay cobros pendientes.</Empty>}
              </Panel>

              <Panel
                title="Stock en riesgo"
                aside={`${integer(data.inventory.units)} uds. disponibles`}
              >
                {data.inventory.stock_risk.length ? (
                  <div className="dash-table-wrap">
                    <table className="dash-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Vendidas</th>
                          <th>Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.inventory.stock_risk.map(row => (
                          <tr key={row.producto_id}>
                            <td>
                              <strong>{row.name}</strong>
                              <span>{row.ref || row.producto_id}</span>
                            </td>
                            <td>{integer(row.sold_units)}</td>
                            <td className="warning">{integer(row.stock)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <Empty>No hay productos vendidos con stock bajo.</Empty>}
                <p className="dash-footnote">
                  {integer(data.inventory.low_skus)} tallas con 1–2 unidades · {integer(data.inventory.empty_skus)} agotadas
                </p>
              </Panel>
            </div>

            <QualityPanel quality={data.data_quality} />
          </>
        )}
      </main>
    </div>
  )
}
