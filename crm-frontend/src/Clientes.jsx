import { useCallback, useEffect, useMemo, useState } from 'react'
import { hasSupabaseConfig, supabase } from './lib/supabase'
import {
  crmAnularVenta,
  crmCrearAbono,
  crmCrearVenta,
  crmCreateCliente,
  crmDeleteCliente,
  crmFetchAbonos,
  crmFetchCatalogo,
  crmFetchCliente,
  crmFetchClientes,
  crmFetchComprobantes,
  crmFetchVentas,
  crmImportarHistorico,
  crmUpdateCliente,
  crmUploadComprobante,
  formatPrice,
} from './api/catalog'

const css = `
  .crm-page {
    min-height: 100vh;
    background: var(--white);
    color: var(--black);
    font-family: var(--font);
  }
  .crm-header {
    height: 64px;
    border-bottom: 1px solid var(--grey-200);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1.5rem;
    position: sticky;
    top: 0;
    z-index: 50;
    background: var(--white);
  }
  .crm-brand {
    font-size: var(--size-xs);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    font-weight: 600;
  }
  .crm-nav {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: var(--size-xs);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--grey-600);
  }
  .crm-shell {
    display: grid;
    grid-template-columns: 360px 1fr;
    min-height: calc(100vh - 64px);
  }
  .crm-sidebar {
    border-right: 1px solid var(--grey-200);
    padding: 1rem;
    overflow: auto;
  }
  .crm-main {
    padding: 1.25rem;
    overflow: auto;
  }
  .crm-section {
    border-bottom: 1px solid var(--grey-200);
    padding: 1rem 0;
  }
  .crm-section:first-child { padding-top: 0; }
  .crm-title {
    font-size: var(--size-xs);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--grey-400);
    margin-bottom: 0.75rem;
  }
  .crm-input,
  .crm-select,
  .crm-textarea {
    width: 100%;
    border: 1px solid var(--grey-200);
    background: var(--white);
    color: var(--black);
    font-family: var(--font);
    font-size: var(--size-sm);
    padding: 0.7rem 0.75rem;
    outline: none;
  }
  .crm-textarea {
    min-height: 78px;
    resize: vertical;
    line-height: 1.5;
  }
  .crm-input:focus,
  .crm-select:focus,
  .crm-textarea:focus { border-color: var(--black); }
  .crm-form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
  }
  .crm-stack { display: flex; flex-direction: column; gap: 0.6rem; }
  .crm-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
  .crm-btn {
    border: 1px solid var(--grey-200);
    padding: 0.62rem 0.9rem;
    font-family: var(--font);
    font-size: var(--size-xs);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--grey-600);
    background: var(--white);
    transition: border-color 160ms ease, color 160ms ease, background 160ms ease;
  }
  .crm-btn:hover:not(:disabled) { border-color: var(--black); color: var(--black); }
  .crm-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .crm-btn--primary { background: var(--black); border-color: var(--black); color: var(--white); }
  .crm-btn--primary:hover:not(:disabled) { color: var(--white); opacity: 0.82; }
  .crm-btn--danger { border-color: #fecaca; color: #b91c1c; }
  .crm-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }
  .crm-panel-head .crm-title { margin-bottom: 0; }
  .crm-icon-btn {
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--grey-200);
    background: var(--white);
    color: var(--grey-600);
    font-size: var(--size-sm);
  }
  .crm-icon-btn:hover { border-color: var(--black); color: var(--black); }
  .crm-client-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-top: 0.75rem;
  }
  .crm-client-row {
    width: 100%;
    text-align: left;
    border: 1px solid var(--grey-200);
    padding: 0.75rem;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.35rem;
    align-items: center;
  }
  .crm-client-row.active { border-color: var(--black); background: var(--grey-100); }
  .crm-client-name {
    font-size: var(--size-sm);
    letter-spacing: 0.04em;
    color: var(--black);
  }
  .crm-client-meta {
    font-size: var(--size-xs);
    color: var(--grey-400);
    letter-spacing: 0.06em;
  }
  .crm-debt {
    font-size: var(--size-xs);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--grey-600);
  }
  .crm-debt.ok { color: #15803d; }
  .crm-debt.bad { color: #b91c1c; }
  .crm-debt.credit { color: #2563eb; }
  .crm-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .crm-metric {
    border: 1px solid var(--grey-200);
    padding: 0.8rem;
  }
  .crm-metric span {
    display: block;
    font-size: var(--size-xs);
    color: var(--grey-400);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 0.35rem;
  }
  .crm-metric strong {
    font-size: var(--size-lg);
    font-weight: 400;
  }
  .crm-detail-grid {
    display: grid;
    grid-template-columns: 1fr 360px;
    gap: 1.25rem;
    align-items: start;
  }
  .crm-panel {
    border: 1px solid var(--grey-200);
    padding: 1rem;
  }
  .crm-panel + .crm-panel { margin-top: 1rem; }
  .crm-sale {
    border-top: 1px solid var(--grey-200);
    padding: 0.85rem 0;
  }
  .crm-sale:first-child { border-top: none; padding-top: 0; }
  .crm-sale-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
  }
  .crm-sale-date {
    font-size: var(--size-xs);
    color: var(--grey-400);
    letter-spacing: 0.08em;
  }
  .crm-sale-total {
    font-size: var(--size-sm);
    color: var(--black);
    text-align: right;
  }
  .crm-sale.cancelled { opacity: 0.48; }
  .crm-item-line,
  .crm-payment-line,
  .crm-receipt-line {
    display: grid;
    grid-template-columns: 44px 1fr auto;
    gap: 0.7rem;
    align-items: center;
    padding: 0.55rem 0;
    border-top: 1px solid var(--grey-200);
  }
  .crm-thumb {
    width: 44px;
    height: 58px;
    object-fit: cover;
    background: var(--grey-100);
  }
  .crm-mini-title {
    font-size: var(--size-xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--black);
  }
  .crm-mini-meta {
    font-size: var(--size-xs);
    color: var(--grey-400);
    margin-top: 0.2rem;
  }
  .crm-cart-row {
    display: grid;
    grid-template-columns: 44px 1fr auto;
    gap: 0.7rem;
    border-top: 1px solid var(--grey-200);
    padding: 0.6rem 0;
    align-items: center;
  }
  .crm-catalog-list {
    max-height: 260px;
    overflow: auto;
    border: 1px solid var(--grey-200);
  }
  .crm-catalog-product {
    border-top: 1px solid var(--grey-200);
    padding: 0.7rem;
    display: grid;
    grid-template-columns: 58px 1fr;
    gap: 0.75rem;
  }
  .crm-catalog-product:first-child { border-top: none; }
  .crm-catalog-img {
    width: 58px;
    height: 76px;
    object-fit: cover;
    background: var(--grey-100);
    border: 1px solid var(--grey-200);
  }
  .crm-catalog-body { min-width: 0; }
  .crm-variant-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.55rem;
  }
  .crm-size-btn {
    border: 1px solid var(--grey-200);
    padding: 0.35rem 0.5rem;
    font-size: var(--size-xs);
    color: var(--grey-600);
  }
  .crm-size-btn.active,
  .crm-size-btn:hover { border-color: var(--black); color: var(--black); }
  .crm-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: rgba(0,0,0,0.36);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .crm-modal {
    width: min(760px, 100%);
    max-height: min(720px, calc(100vh - 2rem));
    background: var(--white);
    border: 1px solid var(--grey-200);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  .crm-modal .crm-catalog-list {
    max-height: min(520px, calc(100vh - 190px));
  }
  .crm-swatch {
    display: inline-block;
    width: 10px;
    height: 10px;
    border: 1px solid rgba(0,0,0,0.15);
    margin-right: 0.35rem;
    vertical-align: middle;
  }
  .crm-empty {
    min-height: 42vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--grey-400);
    font-size: var(--size-sm);
    letter-spacing: 0.08em;
    text-align: center;
  }
  .crm-toast {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    background: var(--white);
    border: 1px solid var(--grey-200);
    padding: 0.85rem 1rem;
    font-size: var(--size-xs);
    color: var(--black);
    letter-spacing: 0.08em;
    z-index: 90;
  }
  .crm-toast.error { border-color: #fecaca; color: #b91c1c; }
  @media (max-width: 1100px) {
    .crm-shell,
    .crm-detail-grid { grid-template-columns: 1fr; }
    .crm-sidebar { border-right: none; border-bottom: 1px solid var(--grey-200); }
  }
  @media (max-width: 640px) {
    .crm-header { padding: 0 1rem; }
    .crm-summary,
    .crm-form-grid { grid-template-columns: 1fr; }
    .crm-main { padding: 1rem; }
    .crm-cart-row { grid-template-columns: 44px 1fr; }
    .crm-cart-row .crm-btn { grid-column: 1 / -1; }
  }
`

function debtClass(value) {
  if (value > 0) return 'bad'
  if (value < 0) return 'credit'
  return 'ok'
}

function debtLabel(value) {
  if (value > 0) return `Debe ${formatPrice(value)}`
  if (value < 0) return `Saldo ${formatPrice(Math.abs(value))}`
  return 'Al dia'
}

function niceDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString([], {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPaymentAmount(amount, currency = 'usd') {
  const code = String(currency || 'usd').toLowerCase()
  if (code === 'usd') return formatPrice(amount)
  if (code === 'eur') {
    return Number(amount || 0).toLocaleString('es-ES', {
      style: 'currency',
      currency: 'EUR',
    })
  }
  return `${Number(amount || 0).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${code.toUpperCase()}`
}

function emptyClientForm() {
  return { nombre: '', telefono: '', notas: '' }
}

function productImage(product) {
  return product.imagen || product.variantes.find(variant => variant.imagen)?.imagen || ''
}

function CrmLogin({ onAuth }) {
  const [pwd, setPwd] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const adminToken = import.meta.env.VITE_ADMIN_TOKEN || ''

  async function handleSubmit() {
    if (!pwd) return
    setLoading(true)
    setError('')
    try {
      if (adminToken) {
        if (pwd !== adminToken) {
          setError('Contrasena incorrecta')
          setPwd('')
          return
        }
        sessionStorage.setItem('admin_auth_user', 'admin')
        onAuth('admin')
        return
      }
      if (!hasSupabaseConfig) {
        setError('Falta configurar VITE_ADMIN_TOKEN')
        return
      }
      const { data, error: sbError } = await supabase
        .from('admin_users')
        .select('username')
        .eq('password', pwd)
        .maybeSingle()
      if (sbError) throw new Error(sbError.message)
      if (!data?.username) {
        setError('Contrasena incorrecta')
        setPwd('')
        return
      }
      sessionStorage.setItem('admin_auth_user', data.username)
      onAuth(data.username)
    } catch (_) {
      setError('Error de conexion. Intentalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="crm-page">
      <style>{css}</style>
      <div className="crm-empty" style={{ minHeight: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <p className="crm-brand">Another NPC Shop CRM</p>
        <input
          className="crm-input"
          type="password"
          placeholder="Contrasena admin"
          value={pwd}
          onChange={e => { setPwd(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          style={{ maxWidth: 320 }}
          autoFocus
        />
        <button className="crm-btn crm-btn--primary" onClick={handleSubmit} disabled={!pwd || loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
        {error && <p className="crm-debt bad">{error}</p>}
      </div>
    </div>
  )
}

export default function Clientes() {
  const [usuario, setUsuario] = useState(() => sessionStorage.getItem('admin_auth_user'))
  const [clientes, setClientes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selected, setSelected] = useState(null)
  const [clientForm, setClientForm] = useState(emptyClientForm)
  const [newClient, setNewClient] = useState(emptyClientForm)
  const [ventas, setVentas] = useState([])
  const [abonos, setAbonos] = useState([])
  const [comprobantes, setComprobantes] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalog, setCatalog] = useState([])
  const [cart, setCart] = useState([])
  const [purchaseOpen, setPurchaseOpen] = useState(true)
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false)
  const [abonoForm, setAbonoForm] = useState({ monto: '', metodo: 'desconocido', moneda: 'usd', nota: '' })
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  const showToast = useCallback((message, type = 'ok') => {
    setToast({ message, type, key: Date.now() })
    window.setTimeout(() => setToast(null), 2600)
  }, [])

  const refreshClients = useCallback(async () => {
    const data = await crmFetchClientes(search)
    setClientes(data)
    if (!selectedId && data[0]) setSelectedId(data[0].id)
  }, [search, selectedId])

  const refreshDetail = useCallback(async (id) => {
    if (!id) return
    const [client, saleRows, paymentRows, receiptRows] = await Promise.all([
      crmFetchCliente(id),
      crmFetchVentas(id),
      crmFetchAbonos(id),
      crmFetchComprobantes(id),
    ])
    setSelected(client)
    setClientForm({ nombre: client.nombre, telefono: client.telefono, notas: client.notas })
    setVentas(saleRows)
    setAbonos(paymentRows)
    setComprobantes(receiptRows)
  }, [])

  useEffect(() => {
    if (!usuario) return
    setLoading(true)
    refreshClients()
      .catch(error => showToast(error.message, 'error'))
      .finally(() => setLoading(false))
  }, [usuario, refreshClients, showToast])

  useEffect(() => {
    if (!usuario || !selectedId) return
    refreshDetail(selectedId).catch(error => showToast(error.message, 'error'))
  }, [usuario, selectedId, refreshDetail, showToast])

  useEffect(() => {
    if (!usuario) return
    const timer = window.setTimeout(() => {
      crmFetchCatalogo(catalogSearch)
        .then(setCatalog)
        .catch(error => showToast(error.message, 'error'))
    }, 220)
    return () => window.clearTimeout(timer)
  }, [usuario, catalogSearch, showToast])

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.precio_unitario || 0) * Number(item.cantidad || 0), 0),
    [cart],
  )

  if (!usuario) return <CrmLogin onAuth={setUsuario} />

  async function handleCreateClient() {
    if (!newClient.nombre.trim()) return
    try {
      const created = await crmCreateCliente(newClient)
      setNewClient(emptyClientForm())
      await refreshClients()
      setSelectedId(created.id)
      showToast('Cliente creado')
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handleSaveClient() {
    if (!selected || !clientForm.nombre.trim()) return
    try {
      const updated = await crmUpdateCliente(selected.id, clientForm)
      setSelected(updated)
      await refreshClients()
      showToast('Ficha actualizada')
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handleDeleteClient() {
    if (!selected) return
    const ok = window.confirm(`Borrar cliente "${selected.nombre}"? Solo se puede borrar si no tiene compras ni abonos.`)
    if (!ok) return
    try {
      await crmDeleteCliente(selected.id)
      setSelected(null)
      setSelectedId(null)
      setCart([])
      await refreshClients()
      showToast('Cliente borrado')
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  function addCartItem(product, variant, talla, stock) {
    const key = `${variant.id}-${talla}`
    setCart(prev => {
      const found = prev.find(item => item.key === key)
      if (found) {
        return prev.map(item => item.key === key
          ? { ...item, cantidad: Math.min(stock, Number(item.cantidad) + 1) }
          : item)
      }
      return [
        ...prev,
        {
          key,
          producto_id: product.id,
          variante_id: variant.id,
          talla,
          color: variant.color,
          color_hex: variant.hex,
          producto_nombre: product.nombre,
          producto_ref: product.ref,
          imagen: variant.imagen || product.imagen,
          cantidad: 1,
          stock,
          precio_unitario: product.precio,
        },
      ]
    })
  }

  async function handleCreateSale() {
    if (!selected || cart.length === 0) return
    try {
      await crmCrearVenta(selected.id, {
        usuario,
        items: cart.map(item => ({
          producto_id: item.producto_id,
          variante_id: item.variante_id,
          talla: item.talla,
          cantidad: Number(item.cantidad),
          precio_unitario: Number(item.precio_unitario),
        })),
      })
      setCart([])
      await Promise.all([refreshDetail(selected.id), refreshClients(), crmFetchCatalogo(catalogSearch).then(setCatalog)])
      showToast('Compra registrada y stock descontado')
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handleCancelSale(saleId) {
    try {
      await crmAnularVenta(saleId)
      await Promise.all([refreshDetail(selected.id), refreshClients(), crmFetchCatalogo(catalogSearch).then(setCatalog)])
      showToast('Compra anulada y stock repuesto')
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handleCreatePayment() {
    if (!selected || !abonoForm.monto) return
    try {
      await crmCrearAbono(selected.id, { ...abonoForm, monto: Number(abonoForm.monto), usuario })
      setAbonoForm({ monto: '', metodo: 'desconocido', moneda: 'usd', nota: '' })
      await Promise.all([refreshDetail(selected.id), refreshClients()])
      showToast('Abono registrado')
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handleUploadReceipt(event) {
    const file = event.target.files?.[0]
    if (!file || !selected) return
    try {
      await crmUploadComprobante(selected.id, file, usuario)
      await refreshDetail(selected.id)
      showToast('Comprobante subido')
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      event.target.value = ''
    }
  }

  function handleImportFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImportText(String(reader.result || ''))
    reader.onerror = () => showToast('No se pudo leer el archivo', 'error')
    reader.readAsText(file)
    event.target.value = ''
  }

  async function handleImportHistory() {
    if (!importText.trim()) return
    let datos
    try {
      datos = JSON.parse(importText)
    } catch (_) {
      showToast('JSON invalido', 'error')
      return
    }

    setImporting(true)
    setImportResult(null)
    try {
      const result = await crmImportarHistorico(datos, usuario)
      setImportResult(result)
      await refreshClients()
      if (selectedId) await refreshDetail(selectedId)
      showToast(`Importados ${result.clientes_creados + result.clientes_actualizados} clientes`)
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="crm-page">
      <style>{css}</style>
      <header className="crm-header">
        <span className="crm-brand">Another NPC Shop CRM</span>
        <nav className="crm-nav">
          <span>CRM privado</span>
          <span>{usuario}</span>
          <button
            className="crm-btn"
            onClick={() => {
              sessionStorage.removeItem('admin_auth_user')
              setUsuario(null)
            }}
          >
            Salir
          </button>
        </nav>
      </header>

      <div className="crm-shell">
        <aside className="crm-sidebar">
          <section className="crm-section">
            <p className="crm-title">Nuevo cliente</p>
            <div className="crm-stack">
              <input className="crm-input" placeholder="Nombre" value={newClient.nombre} onChange={e => setNewClient({ ...newClient, nombre: e.target.value })} />
              <input className="crm-input" placeholder="Telefono" value={newClient.telefono} onChange={e => setNewClient({ ...newClient, telefono: e.target.value })} />
              <textarea className="crm-textarea" placeholder="Notas" value={newClient.notas} onChange={e => setNewClient({ ...newClient, notas: e.target.value })} />
              <button className="crm-btn crm-btn--primary" onClick={handleCreateClient} disabled={!newClient.nombre.trim()}>
                Crear cliente
              </button>
            </div>
          </section>

          <section className="crm-section">
            <p className="crm-title">Importar JSON</p>
            <div className="crm-stack">
              <label className="crm-btn">
                Cargar archivo
                <input type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: 'none' }} />
              </label>
              <textarea
                className="crm-textarea"
                placeholder='{"clientes":[...]}'
                value={importText}
                onChange={e => setImportText(e.target.value)}
                style={{ minHeight: 130 }}
              />
              <button className="crm-btn crm-btn--primary" onClick={handleImportHistory} disabled={!importText.trim() || importing}>
                {importing ? 'Importando...' : 'Importar historico'}
              </button>
              <p className="crm-client-meta">Registra historicos sin descontar stock actual.</p>
              {importResult && (
                <p className="crm-client-meta">
                  {importResult.clientes_creados} nuevos / {importResult.clientes_actualizados} actualizados / {importResult.ventas_creadas} compras / {importResult.abonos_creados} abonos
                </p>
              )}
            </div>
          </section>

          <section className="crm-section">
            <p className="crm-title">Clientes</p>
            <input className="crm-input" placeholder="Buscar nombre, telefono o nota" value={search} onChange={e => setSearch(e.target.value)} />
            <div className="crm-client-list">
              {loading && <p className="crm-client-meta">Cargando...</p>}
              {clientes.map(cliente => (
                <button
                  key={cliente.id}
                  className={`crm-client-row${selectedId === cliente.id ? ' active' : ''}`}
                  onClick={() => setSelectedId(cliente.id)}
                >
                  <span>
                    <span className="crm-client-name">{cliente.nombre}</span>
                    <span className="crm-client-meta">{cliente.telefono || 'Sin telefono'}</span>
                  </span>
                  <span className={`crm-debt ${debtClass(cliente.deuda)}`}>{debtLabel(cliente.deuda)}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <main className="crm-main">
          {!selected ? (
            <div className="crm-empty">Selecciona o crea un cliente para empezar.</div>
          ) : (
            <>
              <div className="crm-summary">
                <div className="crm-metric"><span>Comprado</span><strong>{formatPrice(selected.total_comprado)}</strong></div>
                <div className="crm-metric"><span>Abonado</span><strong>{formatPrice(selected.total_abonado)}</strong></div>
                <div className="crm-metric"><span>Estado</span><strong className={`crm-debt ${debtClass(selected.deuda)}`}>{debtLabel(selected.deuda)}</strong></div>
              </div>

              <div className="crm-detail-grid">
                <div>
                  <section className="crm-panel">
                    <p className="crm-title">Ficha del cliente</p>
                    <div className="crm-form-grid">
                      <input className="crm-input" placeholder="Nombre" value={clientForm.nombre} onChange={e => setClientForm({ ...clientForm, nombre: e.target.value })} />
                      <input className="crm-input" placeholder="Telefono" value={clientForm.telefono} onChange={e => setClientForm({ ...clientForm, telefono: e.target.value })} />
                    </div>
                    <div style={{ marginTop: '0.6rem' }}>
                      <textarea className="crm-textarea" placeholder="Notas" value={clientForm.notas} onChange={e => setClientForm({ ...clientForm, notas: e.target.value })} />
                    </div>
                    <div className="crm-actions" style={{ marginTop: '0.75rem' }}>
                      <button className="crm-btn crm-btn--primary" onClick={handleSaveClient}>Guardar ficha</button>
                      <label className="crm-btn">
                        Subir comprobante
                        <input type="file" accept="image/*" onChange={handleUploadReceipt} style={{ display: 'none' }} />
                      </label>
                      <button className="crm-btn crm-btn--danger" onClick={handleDeleteClient}>Borrar cliente</button>
                    </div>
                  </section>

                  <section className="crm-panel">
                    <p className="crm-title">Historial de compras</p>
                    {ventas.length === 0 ? (
                      <p className="crm-client-meta">Sin compras registradas.</p>
                    ) : ventas.map(venta => (
                      <article key={venta.id} className={`crm-sale ${venta.estado === 'anulada' ? 'cancelled' : ''}`}>
                        <div className="crm-sale-head">
                          <div>
                            <p className="crm-mini-title">Compra {venta.estado === 'anulada' ? 'anulada' : 'activa'}</p>
                            <p className="crm-sale-date">{niceDate(venta.creada_en)}</p>
                          </div>
                          <div className="crm-sale-total">
                            <div>{formatPrice(venta.total)}</div>
                            <div className={`crm-debt ${venta.pendiente > 0 ? 'bad' : 'ok'}`}>
                              {venta.estado === 'anulada' ? 'Anulada' : venta.pendiente > 0 ? `Pendiente ${formatPrice(venta.pendiente)}` : 'Pagada'}
                            </div>
                          </div>
                        </div>
                        {venta.items.map(item => (
                          <div key={item.id} className="crm-item-line">
                            <img className="crm-thumb" src={item.imagen} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
                            <div>
                              <p className="crm-mini-title">{item.producto_nombre}</p>
                              <p className="crm-mini-meta">
                                Ref {item.producto_ref} / {item.color} / {item.talla} / x{item.cantidad}
                              </p>
                            </div>
                            <span className="crm-mini-title">{formatPrice(item.subtotal)}</span>
                          </div>
                        ))}
                        {venta.estado === 'activa' && (
                          <button className="crm-btn crm-btn--danger" onClick={() => handleCancelSale(venta.id)}>
                            Anular y reponer stock
                          </button>
                        )}
                      </article>
                    ))}
                  </section>
                </div>

                <aside>
                  <section className="crm-panel">
                    <div className="crm-panel-head">
                      <p className="crm-title">Nueva compra</p>
                      <button className="crm-icon-btn" onClick={() => setPurchaseOpen(open => !open)} title={purchaseOpen ? 'Colapsar compra' : 'Abrir compra'}>
                        {purchaseOpen ? '-' : '+'}
                      </button>
                    </div>
                    {purchaseOpen && (
                      <div className="crm-stack">
                        <button className="crm-btn" onClick={() => setCatalogPickerOpen(true)}>Añadir prendas</button>
                        <p className="crm-client-meta">Al guardar la compra se descuenta stock del catalogo real.</p>
                        <div>
                          <p className="crm-title">Prendas</p>
                          {cart.length === 0 ? <p className="crm-client-meta">Selecciona tallas desde el catalogo.</p> : cart.map(item => (
                            <div key={item.key} className="crm-cart-row">
                              <img className="crm-thumb" src={item.imagen} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
                              <div>
                                <p className="crm-mini-title">{item.producto_nombre}</p>
                                <p className="crm-mini-meta">{item.color} / {item.talla} / stock {item.stock}</p>
                                <div className="crm-form-grid" style={{ marginTop: '0.45rem' }}>
                                  <input className="crm-input" type="number" min="1" max={item.stock} value={item.cantidad} onChange={e => setCart(prev => prev.map(row => row.key === item.key ? { ...row, cantidad: e.target.value } : row))} />
                                  <input className="crm-input" type="number" min="0" step="0.01" value={item.precio_unitario} onChange={e => setCart(prev => prev.map(row => row.key === item.key ? { ...row, precio_unitario: e.target.value } : row))} />
                                </div>
                              </div>
                              <button className="crm-btn" onClick={() => setCart(prev => prev.filter(row => row.key !== item.key))}>Quitar</button>
                            </div>
                          ))}
                          <div className="crm-actions" style={{ marginTop: '0.75rem', justifyContent: 'space-between' }}>
                            <span className="crm-mini-title">Total {formatPrice(cartTotal)}</span>
                            <button className="crm-btn crm-btn--primary" onClick={handleCreateSale} disabled={!cart.length}>Guardar compra</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="crm-panel">
                    <p className="crm-title">Registrar abono</p>
                    <div className="crm-stack">
                      <input className="crm-input" type="number" min="0" step="0.01" placeholder="Monto" value={abonoForm.monto} onChange={e => setAbonoForm({ ...abonoForm, monto: e.target.value })} />
                      <div className="crm-form-grid">
                        <select className="crm-select" value={abonoForm.metodo} onChange={e => setAbonoForm({ ...abonoForm, metodo: e.target.value })}>
                          <option value="desconocido">Desconocido</option>
                          <option value="efectivo">Efectivo</option>
                          <option value="transferencia">Transferencia</option>
                          <option value="zelle">Zelle</option>
                          <option value="binance">Binance</option>
                          <option value="paypal">PayPal</option>
                        </select>
                        <select className="crm-select" value={abonoForm.moneda} onChange={e => setAbonoForm({ ...abonoForm, moneda: e.target.value })}>
                          <option value="usd">USD</option>
                          <option value="bs">BS</option>
                          <option value="eur">EUR</option>
                          <option value="usdt">USDT</option>
                        </select>
                      </div>
                      <input className="crm-input" placeholder="Nota opcional" value={abonoForm.nota} onChange={e => setAbonoForm({ ...abonoForm, nota: e.target.value })} />
                      <button className="crm-btn crm-btn--primary" onClick={handleCreatePayment} disabled={!abonoForm.monto}>Guardar abono</button>
                    </div>
                  </section>

                  <section className="crm-panel">
                    <p className="crm-title">Abonos</p>
                    {abonos.length === 0 ? <p className="crm-client-meta">Sin abonos.</p> : abonos.map(abono => (
                      <div key={abono.id} className="crm-payment-line" style={{ gridTemplateColumns: '1fr auto' }}>
                        <div>
                          <p className="crm-mini-title">{abono.metodo} / {(abono.moneda || 'usd').toUpperCase()}</p>
                          <p className="crm-mini-meta">{niceDate(abono.creado_en)} {abono.nota ? `/ ${abono.nota}` : ''}</p>
                        </div>
                        <span className="crm-mini-title">{formatPaymentAmount(abono.monto, abono.moneda)}</span>
                      </div>
                    ))}
                  </section>

                  <section className="crm-panel">
                    <p className="crm-title">Comprobantes</p>
                    {comprobantes.length === 0 ? <p className="crm-client-meta">Sin imagenes.</p> : comprobantes.map(item => (
                      <a key={item.id} className="crm-receipt-line" style={{ gridTemplateColumns: '1fr auto' }} href={item.url} target="_blank" rel="noreferrer">
                        <div>
                          <p className="crm-mini-title">{item.nombre_archivo}</p>
                          <p className="crm-mini-meta">{niceDate(item.creado_en)}</p>
                        </div>
                        <span className="crm-mini-meta">Abrir</span>
                      </a>
                    ))}
                  </section>
                </aside>
              </div>
            </>
          )}
        </main>
      </div>

      {catalogPickerOpen && (
        <div className="crm-modal-backdrop" onClick={() => setCatalogPickerOpen(false)}>
          <div className="crm-modal" onClick={e => e.stopPropagation()}>
            <div className="crm-panel-head">
              <p className="crm-title">Seleccionar prendas</p>
              <button className="crm-icon-btn" onClick={() => setCatalogPickerOpen(false)} title="Cerrar selector">x</button>
            </div>
            <input className="crm-input" placeholder="Buscar producto, ref, color o talla" value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} autoFocus />
            <div className="crm-catalog-list">
              {catalog.length === 0 ? (
                <p className="crm-client-meta" style={{ padding: '0.8rem' }}>Sin prendas disponibles.</p>
              ) : catalog.map(product => (
                <div key={product.id} className="crm-catalog-product">
                  <img className="crm-catalog-img" src={productImage(product)} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
                  <div className="crm-catalog-body">
                    <p className="crm-mini-title">{product.nombre}</p>
                    <p className="crm-mini-meta">Ref {product.ref} / sugerido {formatPrice(product.precio)}</p>
                    {product.variantes.map(variant => (
                      <div key={variant.id} className="crm-variant-grid">
                        <span className="crm-mini-meta">
                          <span className="crm-swatch" style={{ background: variant.hex }} />
                          {variant.color}
                        </span>
                        {Object.entries(variant.tallas).map(([talla, stock]) => (
                          <button key={`${variant.id}-${talla}`} className="crm-size-btn" onClick={() => addCartItem(product, variant, talla, stock)}>
                            Añadir {talla} ({stock})
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="crm-actions" style={{ justifyContent: 'space-between' }}>
              <span className="crm-mini-title">{cart.length} prendas seleccionadas</span>
              <button className="crm-btn crm-btn--primary" onClick={() => setCatalogPickerOpen(false)}>Añadir</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div key={toast.key} className={`crm-toast ${toast.type}`}>{toast.message}</div>}
    </div>
  )
}
