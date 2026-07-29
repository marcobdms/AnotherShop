import { useCallback, useEffect, useMemo, useState } from 'react'
import { CrmHeader, CrmLogin, useCrmSession } from './CrmChrome'
import {
  crmAnularVenta,
  crmCrearAbono,
  crmCrearVenta,
  crmCreateCliente,
  crmDeleteCliente,
  crmDeleteClientes,
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
  .crm-page { min-height: 100vh; background: var(--white); color: var(--black); font-family: var(--font); }
  .crm-input, .crm-select, .crm-textarea {
    width: 100%; border: 1px solid var(--grey-200); background: var(--white);
    color: var(--black); font-family: var(--font); font-size: var(--size-sm);
    padding: 0.7rem 0.75rem; outline: none;
  }
  .crm-textarea { min-height: 78px; resize: vertical; line-height: 1.5; }
  .crm-input:focus, .crm-select:focus, .crm-textarea:focus { border-color: var(--black); }
  .crm-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
  .crm-stack { display: flex; flex-direction: column; gap: 1rem; }
  .crm-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
  .crm-btn {
    border: 1px solid var(--grey-200); padding: 0.62rem 0.9rem; font-family: var(--font);
    font-size: var(--size-xs); letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--grey-600); background: var(--white); cursor: pointer;
    transition: border-color 160ms ease, color 160ms ease, background 160ms ease;
  }
  .crm-btn:hover:not(:disabled) { border-color: var(--black); color: var(--black); }
  .crm-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .crm-btn--primary { background: var(--black); border-color: var(--black); color: var(--white); }
  .crm-btn--primary:hover:not(:disabled) { color: var(--white); opacity: 0.82; }
  .crm-btn--danger { border-color: #fecaca; color: #b91c1c; }
  .crm-icon-btn {
    width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid var(--grey-200); background: var(--white); color: var(--grey-600);
    font-size: var(--size-sm); cursor: pointer; flex-shrink: 0;
  }
  .crm-icon-btn:hover { border-color: var(--black); color: var(--black); }
  .crm-link-danger {
    font-size: var(--size-xs); letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--grey-400); background: none; border: none; font-family: var(--font);
    padding: 0; cursor: pointer; transition: color 160ms ease;
  }
  .crm-link-danger:hover { color: #b91c1c; }
  .crm-title { font-size: var(--size-xs); letter-spacing: 0.16em; text-transform: uppercase; color: var(--grey-400); margin-bottom: 0.75rem; }
  .crm-mini-title { font-size: var(--size-xs); line-height: 1.4; letter-spacing: 0.08em; text-transform: uppercase; color: var(--black); }
  .crm-mini-meta { font-size: var(--size-xs); line-height: 1.5; color: var(--grey-400); margin-top: 0.35rem; }
  .crm-client-meta { font-size: var(--size-xs); color: var(--grey-400); letter-spacing: 0.06em; }
  .crm-count { font-size: var(--size-xs); color: var(--grey-400); letter-spacing: 0.1em; text-transform: uppercase; }
  .crm-debt { font-size: var(--size-xs); letter-spacing: 0.1em; text-transform: uppercase; color: var(--grey-600); }
  .crm-debt.ok { color: #15803d; }
  .crm-debt.bad { color: #b91c1c; }
  .crm-debt.credit { color: #2563eb; }
  .crm-content { max-width: 1100px; margin: 0 auto; padding: 1.5rem; }
  .crm-list-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
  .crm-list-head-left { display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 200px; flex-wrap: wrap; }
  .crm-bulk-actions { display: flex; align-items: center; gap: 0.75rem; width: 100%; padding-top: 0.25rem; }
  .crm-check-cell { width: 42px; padding-right: 0 !important; text-align: center !important; }
  .crm-checkbox { width: 16px; height: 16px; accent-color: var(--black); cursor: pointer; }
  .crm-table { width: 100%; border-collapse: collapse; }
  .crm-table th { font-size: var(--size-xs); letter-spacing: 0.14em; text-transform: uppercase; color: var(--grey-400); padding: 0.6rem 1rem; text-align: left; border-bottom: 1px solid var(--grey-200); font-weight: 400; }
  .crm-table td { padding: 0.85rem 1rem; font-size: var(--size-sm); border-bottom: 1px solid var(--grey-200); vertical-align: middle; }
  .crm-table tbody tr { cursor: pointer; transition: background 160ms ease; }
  .crm-table tbody tr:hover { background: var(--grey-100); }
  .crm-table tbody tr.active { background: var(--grey-100); }
  .crm-drawer-backdrop { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,0.18); }
  .crm-drawer {
    position: fixed; top: 64px; right: 0; bottom: 0; width: min(680px, 100vw);
    background: var(--white); border-left: 1px solid var(--grey-200);
    z-index: 70; display: flex; flex-direction: column; overflow: hidden;
    box-shadow: -4px 0 24px rgba(0,0,0,0.07);
  }
  .crm-drawer-head { padding: 1rem 1.25rem 0; border-bottom: 1px solid var(--grey-200); flex-shrink: 0; }
  .crm-drawer-title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; gap: 1rem; }
  .crm-drawer-name { font-size: 1.1rem; letter-spacing: 0.02em; font-weight: 400; }
  .crm-metrics-row { display: flex; gap: 1.5rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
  .crm-metric-inline span { font-size: var(--size-xs); color: var(--grey-400); letter-spacing: 0.1em; text-transform: uppercase; display: block; }
  .crm-metric-inline strong { font-size: var(--size-sm); font-weight: 500; }
  .crm-tab-bar { display: flex; margin-top: 0.5rem; }
  .crm-tab { flex: 1; padding: 0.65rem 0.5rem; font-size: var(--size-xs); letter-spacing: 0.12em; text-transform: uppercase; color: var(--grey-400); background: none; border: none; border-bottom: 2px solid transparent; font-family: var(--font); cursor: pointer; transition: color 160ms ease, border-color 160ms ease; }
  .crm-tab:hover { color: var(--black); }
  .crm-tab--active { color: var(--black); border-bottom-color: var(--black); }
  .crm-drawer-body { flex: 1; overflow-y: auto; padding: 1.5rem; }

  .crm-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.75rem; }
  .crm-panel-head .crm-title, .crm-panel-head .crm-modal-title { margin-bottom: 0; }
  .crm-sale { border-top: 1px solid var(--grey-200); padding: 1.1rem 0; }
  .crm-sale:first-child { border-top: none; padding-top: 0; }

  .crm-sale-head { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; margin-bottom: 0.6rem; }
  .crm-sale-date { font-size: var(--size-xs); color: var(--grey-400); letter-spacing: 0.08em; }
  .crm-sale-total { font-size: var(--size-sm); color: var(--black); text-align: right; flex-shrink: 0; }
  .crm-sale.cancelled { opacity: 0.48; }
  .crm-item-line { display: grid; grid-template-columns: 62px minmax(0, 1fr) auto; gap: 0.9rem; align-items: start; padding: 0.9rem 0; border-top: 1px solid var(--grey-200); }
  .crm-item-main { min-width: 0; padding-top: 0.1rem; }
  .crm-item-price { padding-top: 0.1rem; white-space: nowrap; }
  .crm-item-thumb {
    position: relative; width: 62px; height: 82px; overflow: hidden;
    background: var(--grey-100); border: 1px solid var(--grey-200);
    display: flex; align-items: center; justify-content: center;
  }
  .crm-item-thumb::after {
    content: 'Sin imagen'; padding: 0.3rem; text-align: center;
    font-size: 0.6rem; line-height: 1.3; color: var(--grey-400); text-transform: uppercase;
  }
  .crm-item-thumb img { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; object-fit: cover; }
  .crm-payment-line, .crm-receipt-line { display: grid; grid-template-columns: 1fr auto; gap: 0.7rem; align-items: center; padding: 0.65rem 0; border-top: 1px solid var(--grey-200); }
  .crm-thumb { width: 44px; height: 58px; object-fit: cover; background: var(--grey-100); }
  .crm-sale-amounts { display: flex; gap: 1rem; margin-top: 0.6rem; flex-wrap: wrap; }
  .crm-amount-paid { font-size: var(--size-xs); color: #15803d; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500; }
  .crm-amount-pending { font-size: var(--size-xs); color: #b91c1c; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500; }
  .crm-section-divider { border-top: 1px solid var(--grey-200); margin-top: 1.5rem; padding-top: 1.5rem; }
  .crm-cart-row { display: grid; grid-template-columns: 44px 1fr auto; gap: 0.7rem; border-top: 1px solid var(--grey-200); padding: 0.6rem 0; align-items: center; }
  .crm-catalog-list { max-height: 260px; overflow: auto; border: 1px solid var(--grey-200); }
  .crm-catalog-product { border-top: 1px solid var(--grey-200); padding: 0.7rem; display: grid; grid-template-columns: 58px 1fr; gap: 0.75rem; }
  .crm-catalog-product:first-child { border-top: none; }
  .crm-catalog-img { width: 58px; height: 76px; object-fit: cover; background: var(--grey-100); border: 1px solid var(--grey-200); }
  .crm-catalog-body { min-width: 0; }
  .crm-variant-grid { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.55rem; }
  .crm-size-btn { border: 1px solid var(--grey-200); padding: 0.35rem 0.5rem; font-size: var(--size-xs); color: var(--grey-600); background: var(--white); font-family: var(--font); cursor: pointer; }
  .crm-size-btn:hover { border-color: var(--black); color: var(--black); }
  .crm-swatch { display: inline-block; width: 10px; height: 10px; border: 1px solid rgba(0,0,0,0.15); margin-right: 0.35rem; vertical-align: middle; }
  .crm-modal-backdrop { position: fixed; inset: 0; z-index: 80; background: rgba(0,0,0,0.36); display: flex; align-items: center; justify-content: center; padding: 1rem; }
  .crm-modal { width: min(760px, 100%); max-height: min(720px, calc(100vh - 2rem)); background: var(--white); border: 1px solid var(--grey-200); padding: 1rem; display: flex; flex-direction: column; gap: 0.85rem; overflow-y: auto; }
  .crm-modal--sm { width: min(420px, 100%); }
  .crm-modal .crm-catalog-list { max-height: min(520px, calc(100vh - 190px)); }
  .crm-modal-title { font-size: var(--size-sm); letter-spacing: 0.1em; text-transform: uppercase; }
  .crm-empty { min-height: 40vh; display: flex; align-items: center; justify-content: center; color: var(--grey-400); font-size: var(--size-sm); letter-spacing: 0.08em; text-align: center; }
  .crm-toast { position: fixed; bottom: 1rem; right: 1rem; background: var(--white); border: 1px solid var(--grey-200); padding: 0.85rem 1rem; font-size: var(--size-xs); color: var(--black); letter-spacing: 0.08em; z-index: 90; }
  .crm-toast.error { border-color: #fecaca; color: #b91c1c; }
  @media (max-width: 640px) {
    .crm-content { padding: 1rem; }
    .crm-form-grid { grid-template-columns: 1fr; }
    .crm-cart-row { grid-template-columns: 44px 1fr; }
    .crm-cart-row .crm-btn { grid-column: 1 / -1; }
    .crm-table th:nth-child(3), .crm-table td:nth-child(3) { display: none; }
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
  return new Date(value).toLocaleString([], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatPaymentAmount(amount, currency = 'usd') {
  const code = String(currency || 'usd').toLowerCase()
  if (code === 'usd') return formatPrice(amount)
  if (code === 'eur') return Number(amount || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
  return `${Number(amount || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${code.toUpperCase()}`
}

function emptyClientForm() { return { nombre: '', telefono: '', notas: '' } }

function productImage(product) {
  return product.imagen || product.variantes.find(v => v.imagen)?.imagen || ''
}

function saleItemMeta(item) {
  return [
    item.producto_ref ? `Ref ${item.producto_ref}` : '',
    item.color,
    item.talla,
    `x${item.cantidad}`,
  ].filter(Boolean).join(' / ')
}

export default function Clientes() {
  const { usuario, login, logout } = useCrmSession()

  const [clientes, setClientes] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkedClientIds, setCheckedClientIds] = useState([])
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const [selectedId, setSelectedId] = useState(null)
  const [selected, setSelected] = useState(null)
  const [clientForm, setClientForm] = useState(emptyClientForm)
  const [ventas, setVentas] = useState([])
  const [abonos, setAbonos] = useState([])
  const [comprobantes, setComprobantes] = useState([])

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState('ficha')

  const [newClientModalOpen, setNewClientModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [newClient, setNewClient] = useState(emptyClientForm)

  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalog, setCatalog] = useState([])
  const [cart, setCart] = useState([])
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false)

  const [abonoForm, setAbonoForm] = useState({ monto: '', metodo: 'desconocido', moneda: 'usd', nota: '' })
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'ok') => {
    setToast({ message, type, key: Date.now() })
    window.setTimeout(() => setToast(null), 2600)
  }, [])

  const refreshClients = useCallback(async () => {
    const data = await crmFetchClientes(search)
    setClientes(data)
    const visibleIds = new Set(data.map(client => client.id))
    setCheckedClientIds(current => current.filter(id => visibleIds.has(id)))
  }, [search])

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
      .catch(err => showToast(err.message, 'error'))
      .finally(() => setLoading(false))
  }, [usuario, refreshClients, showToast])

  useEffect(() => {
    if (!usuario || !selectedId) return
    refreshDetail(selectedId).catch(err => showToast(err.message, 'error'))
  }, [usuario, selectedId, refreshDetail, showToast])

  useEffect(() => {
    if (!usuario) return
    const timer = window.setTimeout(() => {
      crmFetchCatalogo(catalogSearch)
        .then(setCatalog)
        .catch(err => showToast(err.message, 'error'))
    }, 220)
    return () => window.clearTimeout(timer)
  }, [usuario, catalogSearch, showToast])

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.precio_unitario || 0) * Number(item.cantidad || 0), 0),
    [cart],
  )
  const allClientsChecked = clientes.length > 0 && checkedClientIds.length === clientes.length

  if (!usuario) return <CrmLogin onAuth={login} />

  function openClient(id) {
    setSelectedId(id)
    setDrawerOpen(true)
    setDrawerTab('ficha')
  }

  async function handleCreateClient() {
    if (!newClient.nombre.trim()) return
    try {
      const created = await crmCreateCliente(newClient)
      setNewClient(emptyClientForm())
      setNewClientModalOpen(false)
      await refreshClients()
      openClient(created.id)
      showToast('Cliente creado')
    } catch (err) { showToast(err.message, 'error') }
  }

  async function handleSaveClient() {
    if (!selected || !clientForm.nombre.trim()) return
    try {
      const updated = await crmUpdateCliente(selected.id, clientForm)
      setSelected(updated)
      await refreshClients()
      showToast('Ficha actualizada')
    } catch (err) { showToast(err.message, 'error') }
  }

  async function handleDeleteClient() {
    if (!selected) return
    const ok = window.confirm(
      `Borrar cliente "${selected.nombre}"?\n`
      + 'Debe tener todas sus compras anuladas. También se borrarán sus abonos, comprobantes y el historial de compras anuladas. El stock no se modificará de nuevo.',
    )
    if (!ok) return
    try {
      await crmDeleteCliente(selected.id)
      setCheckedClientIds(current => current.filter(id => id !== selected.id))
      setDrawerOpen(false)
      setSelected(null)
      setSelectedId(null)
      setCart([])
      await refreshClients()
      showToast('Cliente borrado')
    } catch (err) { showToast(err.message, 'error') }
  }

  function toggleClientChecked(clientId) {
    setCheckedClientIds(current => (
      current.includes(clientId)
        ? current.filter(id => id !== clientId)
        : [...current, clientId]
    ))
  }

  function toggleAllClients() {
    setCheckedClientIds(allClientsChecked ? [] : clientes.map(client => client.id))
  }

  async function handleBulkDeleteClients() {
    if (checkedClientIds.length === 0) return
    const ok = window.confirm(
      `Borrar ${checkedClientIds.length} cliente${checkedClientIds.length === 1 ? '' : 's'} seleccionado${checkedClientIds.length === 1 ? '' : 's'}?\n`
      + 'La operación se cancelará completa si alguno tiene compras activas.',
    )
    if (!ok) return

    setBulkDeleting(true)
    try {
      const result = await crmDeleteClientes(checkedClientIds)
      if (selectedId && checkedClientIds.includes(selectedId)) {
        setDrawerOpen(false)
        setSelected(null)
        setSelectedId(null)
        setCart([])
      }
      setCheckedClientIds([])
      await refreshClients()
      showToast(`${result.eliminados} cliente${result.eliminados === 1 ? '' : 's'} borrado${result.eliminados === 1 ? '' : 's'}`)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBulkDeleting(false)
    }
  }

  function addCartItem(product, variant, talla, stock) {
    const key = `${variant.id}-${talla}`
    setCart(prev => {
      const found = prev.find(item => item.key === key)
      if (found) return prev.map(item => item.key === key ? { ...item, cantidad: Math.min(stock, Number(item.cantidad) + 1) } : item)
      return [...prev, {
        key, producto_id: product.id, variante_id: variant.id, talla,
        color: variant.color, color_hex: variant.hex, producto_nombre: product.nombre,
        producto_ref: product.ref, imagen: variant.imagen || product.imagen,
        cantidad: 1, stock, precio_unitario: product.precio,
      }]
    })
  }

  async function handleCreateSale() {
    if (!selected || cart.length === 0) return
    try {
      await crmCrearVenta(selected.id, {
        usuario,
        items: cart.map(item => ({
          producto_id: item.producto_id, variante_id: item.variante_id, talla: item.talla,
          cantidad: Number(item.cantidad), precio_unitario: Number(item.precio_unitario),
        })),
      })
      setCart([])
      await Promise.all([refreshDetail(selected.id), refreshClients(), crmFetchCatalogo(catalogSearch).then(setCatalog)])
      showToast('Compra registrada y stock descontado')
    } catch (err) { showToast(err.message, 'error') }
  }

  async function handleCancelSale(saleId) {
    try {
      await crmAnularVenta(saleId)
      await Promise.all([refreshDetail(selected.id), refreshClients(), crmFetchCatalogo(catalogSearch).then(setCatalog)])
      showToast('Compra anulada y stock repuesto')
    } catch (err) { showToast(err.message, 'error') }
  }

  async function handleCreatePayment() {
    if (!selected || !abonoForm.monto) return
    try {
      await crmCrearAbono(selected.id, { ...abonoForm, monto: Number(abonoForm.monto), usuario })
      setAbonoForm({ monto: '', metodo: 'desconocido', moneda: 'usd', nota: '' })
      await Promise.all([refreshDetail(selected.id), refreshClients()])
      showToast('Abono registrado')
    } catch (err) { showToast(err.message, 'error') }
  }

  async function handleUploadReceipt(event) {
    const file = event.target.files?.[0]
    if (!file || !selected) return
    try {
      await crmUploadComprobante(selected.id, file, usuario)
      await refreshDetail(selected.id)
      showToast('Comprobante subido')
    } catch (err) { showToast(err.message, 'error') }
    finally { event.target.value = '' }
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
    try { datos = JSON.parse(importText) } catch (_) { showToast('JSON invalido', 'error'); return }
    setImporting(true)
    setImportResult(null)
    try {
      const result = await crmImportarHistorico(datos, usuario)
      setImportResult(result)
      await refreshClients()
      if (selectedId) await refreshDetail(selectedId)
      showToast(`Importados ${result.clientes_creados + result.clientes_actualizados} clientes`)
    } catch (err) { showToast(err.message, 'error') }
    finally { setImporting(false) }
  }

  return (
    <div className="crm-page">
      <style>{css}</style>
      <CrmHeader usuario={usuario} onLogout={logout} extra={
        <button className="crm-btn" onClick={() => setImportModalOpen(true)}>Importar JSON</button>
      } />

      <div className="crm-content">
        <div className="crm-list-head">
          <div className="crm-list-head-left">
            <span className="crm-count">Clientes ({clientes.length})</span>
            <input
              className="crm-input"
              placeholder="Buscar nombre, telefono..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ maxWidth: 320 }}
            />
          </div>
          <button className="crm-btn crm-btn--primary" onClick={() => setNewClientModalOpen(true)}>
            + Nuevo cliente
          </button>
          {checkedClientIds.length > 0 && (
            <div className="crm-bulk-actions">
              <span className="crm-count">{checkedClientIds.length} seleccionados</span>
              <button className="crm-btn crm-btn--danger" onClick={handleBulkDeleteClients} disabled={bulkDeleting}>
                {bulkDeleting ? 'Borrando...' : 'Borrar selección'}
              </button>
            </div>
          )}
        </div>

        <table className="crm-table">
          <thead>
            <tr>
              <th className="crm-check-cell">
                <input
                  className="crm-checkbox"
                  type="checkbox"
                  checked={allClientsChecked}
                  onChange={toggleAllClients}
                  aria-label="Seleccionar todos los clientes"
                />
              </th>
              <th>Nombre</th>
              <th>Telefono</th>
              <th>Comprado</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--grey-400)', padding: '2rem' }}>Cargando...</td></tr>
            )}
            {clientes.map(cliente => (
              <tr
                key={cliente.id}
                className={selectedId === cliente.id && drawerOpen ? 'active' : ''}
                onClick={() => openClient(cliente.id)}
              >
                <td className="crm-check-cell" onClick={event => event.stopPropagation()}>
                  <input
                    className="crm-checkbox"
                    type="checkbox"
                    checked={checkedClientIds.includes(cliente.id)}
                    onChange={() => toggleClientChecked(cliente.id)}
                    aria-label={`Seleccionar a ${cliente.nombre}`}
                  />
                </td>
                <td>{cliente.nombre}</td>
                <td className="crm-mini-meta">{cliente.telefono || '\u2014'}</td>
                <td>{formatPrice(cliente.total_comprado ?? 0)}</td>
                <td><span className={`crm-debt ${debtClass(cliente.deuda)}`}>{debtLabel(cliente.deuda)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>

        {clientes.length === 0 && !loading && (
          <div className="crm-empty" style={{ minHeight: '30vh' }}>
            {search ? 'Sin resultados.' : 'No hay clientes aun. Crea el primero.'}
          </div>
        )}
      </div>

      {drawerOpen && (
        <>
          <div className="crm-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
          <div className="crm-drawer">
            <div className="crm-drawer-head">
              <div className="crm-drawer-title-row">
                <span className="crm-drawer-name">{selected ? selected.nombre : '...'}</span>
                <button className="crm-icon-btn" onClick={() => setDrawerOpen(false)} title="Cerrar">x</button>
              </div>
              {selected && (
                <div className="crm-metrics-row">
                  <div className="crm-metric-inline"><span>Comprado</span><strong>{formatPrice(selected.total_comprado)}</strong></div>
                  <div className="crm-metric-inline"><span>Abonado</span><strong>{formatPrice(selected.total_abonado)}</strong></div>
                  <div className="crm-metric-inline"><span>Estado</span><strong className={`crm-debt ${debtClass(selected.deuda)}`}>{debtLabel(selected.deuda)}</strong></div>
                </div>
              )}
              <div className="crm-tab-bar">
                {[['ficha','Ficha'],['compras','Compras'],['abonos','Abonos'],['comprobantes','Comprobantes']].map(([key, label]) => (
                  <button key={key} className={`crm-tab ${drawerTab === key ? 'crm-tab--active' : ''}`} onClick={() => setDrawerTab(key)}>{label}</button>
                ))}
              </div>
            </div>

            <div className="crm-drawer-body">
              {!selected ? <p className="crm-mini-meta">Cargando...</p> : (
                <>
                  {drawerTab === 'ficha' && (
                    <div className="crm-stack">
                      <div className="crm-form-grid">
                        <input className="crm-input" placeholder="Nombre" value={clientForm.nombre} onChange={e => setClientForm({ ...clientForm, nombre: e.target.value })} />
                        <input className="crm-input" placeholder="Telefono" value={clientForm.telefono} onChange={e => setClientForm({ ...clientForm, telefono: e.target.value })} />
                      </div>
                      <textarea className="crm-textarea" placeholder="Notas" value={clientForm.notas} onChange={e => setClientForm({ ...clientForm, notas: e.target.value })} />
                      <div className="crm-actions">
                        <button className="crm-btn crm-btn--primary" onClick={handleSaveClient}>Guardar ficha</button>
                        <label className="crm-btn">
                          Subir comprobante
                          <input type="file" accept="image/*" onChange={handleUploadReceipt} style={{ display: 'none' }} />
                        </label>
                      </div>
                      <div className="crm-section-divider">
                        <button className="crm-link-danger" onClick={handleDeleteClient}>Borrar este cliente</button>
                      </div>
                    </div>
                  )}

                  {drawerTab === 'compras' && (
                    <div className="crm-stack">
                      <div>
                        <p className="crm-title">Nueva compra</p>
                        <button className="crm-btn" onClick={() => setCatalogPickerOpen(true)}>Añadir prendas</button>
                        <p className="crm-mini-meta" style={{ marginTop: '0.4rem' }}>Al guardar la compra se descuenta stock del catalogo real.</p>
                      </div>
                      {cart.length > 0 && (
                        <div>
                          <p className="crm-title" style={{ marginBottom: 0 }}>Prendas seleccionadas</p>
                          {cart.map(item => (
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
                      )}
                      <div className="crm-section-divider">
                        <p className="crm-title">Historial de compras</p>
                        {ventas.length === 0 ? (
                          <p className="crm-mini-meta">Sin compras registradas.</p>
                        ) : ventas.map(venta => (
                          <article key={venta.id} className={`crm-sale ${venta.estado === 'anulada' ? 'cancelled' : ''}`}>
                            <div className="crm-sale-head">
                              <div>
                                <p className="crm-mini-title">Compra {venta.estado === 'anulada' ? 'anulada' : 'activa'}</p>
                                <p className="crm-sale-date">{niceDate(venta.creada_en)}</p>
                              </div>
                              <span className="crm-mini-title">{formatPrice(venta.total)}</span>
                            </div>
                            {venta.items.map(item => (
                              <div key={item.id} className="crm-item-line">
                                <div className="crm-item-thumb">
                                  {item.imagen && (
                                    <img src={item.imagen} alt="" onError={event => { event.currentTarget.style.display = 'none' }} />
                                  )}
                                </div>
                                <div className="crm-item-main">
                                  <p className="crm-mini-title">{item.producto_nombre}</p>
                                  <p className="crm-mini-meta">{saleItemMeta(item)}</p>
                                </div>
                                <span className="crm-mini-title crm-item-price">{formatPrice(item.subtotal)}</span>
                              </div>
                            ))}
                            {venta.estado !== 'anulada' && (
                              <div className="crm-sale-amounts">
                                <span className="crm-amount-paid">
                                  {formatPrice(venta.total - venta.pendiente)} pagado
                                </span>
                                {venta.pendiente > 0 && (
                                  <span className="crm-amount-pending">
                                    {formatPrice(venta.pendiente)} pendiente
                                  </span>
                                )}
                              </div>
                            )}
                            {venta.estado === 'anulada' && (
                              <p className="crm-mini-meta" style={{ marginTop: '0.4rem', color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 'var(--size-xs)' }}>Anulada</p>
                            )}
                            {venta.estado === 'activa' && (
                              <button className="crm-btn crm-btn--danger" style={{ marginTop: '0.75rem' }} onClick={() => handleCancelSale(venta.id)}>
                                Anular y reponer stock
                              </button>
                            )}
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {drawerTab === 'abonos' && (
                    <div className="crm-stack">
                      <p className="crm-title">Registrar abono</p>
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
                      <div className="crm-section-divider">
                        <p className="crm-title">Historial de abonos</p>
                        {abonos.length === 0 ? <p className="crm-mini-meta">Sin abonos.</p> : abonos.map(abono => (
                          <div key={abono.id} className="crm-payment-line" style={{ gridTemplateColumns: '1fr auto' }}>
                            <div>
                              <p className="crm-mini-title">{abono.metodo} / {(abono.moneda || 'usd').toUpperCase()}</p>
                              <p className="crm-mini-meta">{niceDate(abono.creado_en)}{abono.nota ? ` / ${abono.nota}` : ''}</p>
                            </div>
                            <span className="crm-mini-title">{formatPaymentAmount(abono.monto, abono.moneda)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {drawerTab === 'comprobantes' && (
                    <div className="crm-stack">
                      <label className="crm-btn" style={{ textAlign: 'center' }}>
                        Subir comprobante
                        <input type="file" accept="image/*" onChange={handleUploadReceipt} style={{ display: 'none' }} />
                      </label>
                      {comprobantes.length === 0 ? <p className="crm-mini-meta">Sin imagenes subidas.</p> : comprobantes.map(item => (
                        <a key={item.id} className="crm-receipt-line" style={{ gridTemplateColumns: '1fr auto' }} href={item.url} target="_blank" rel="noreferrer">
                          <div>
                            <p className="crm-mini-title">{item.nombre_archivo}</p>
                            <p className="crm-mini-meta">{niceDate(item.creado_en)}</p>
                          </div>
                          <span className="crm-mini-meta">Abrir</span>
                        </a>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {newClientModalOpen && (
        <div className="crm-modal-backdrop" onClick={() => { setNewClientModalOpen(false); setNewClient(emptyClientForm()) }}>
          <div className="crm-modal crm-modal--sm" onClick={e => e.stopPropagation()}>
            <div className="crm-panel-head">
              <p className="crm-modal-title">Nuevo cliente</p>
              <button className="crm-icon-btn" onClick={() => { setNewClientModalOpen(false); setNewClient(emptyClientForm()) }}>x</button>
            </div>
            <div className="crm-stack">
              <input className="crm-input" placeholder="Nombre *" value={newClient.nombre} onChange={e => setNewClient({ ...newClient, nombre: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleCreateClient()} autoFocus />
              <input className="crm-input" placeholder="Telefono" value={newClient.telefono} onChange={e => setNewClient({ ...newClient, telefono: e.target.value })} />
              <textarea className="crm-textarea" placeholder="Notas" value={newClient.notas} onChange={e => setNewClient({ ...newClient, notas: e.target.value })} />
              <div className="crm-actions" style={{ justifyContent: 'flex-end' }}>
                <button className="crm-btn" onClick={() => { setNewClientModalOpen(false); setNewClient(emptyClientForm()) }}>Cancelar</button>
                <button className="crm-btn crm-btn--primary" onClick={handleCreateClient} disabled={!newClient.nombre.trim()}>Crear cliente</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {importModalOpen && (
        <div className="crm-modal-backdrop" onClick={() => setImportModalOpen(false)}>
          <div className="crm-modal" style={{ width: 'min(540px, 100%)' }} onClick={e => e.stopPropagation()}>
            <div className="crm-panel-head">
              <p className="crm-modal-title">Importar historico JSON</p>
              <button className="crm-icon-btn" onClick={() => setImportModalOpen(false)}>x</button>
            </div>
            <div className="crm-stack">
              <label className="crm-btn" style={{ textAlign: 'center' }}>
                Cargar archivo .json
                <input type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: 'none' }} />
              </label>
              <textarea className="crm-textarea" placeholder='{"clientes":[...]}' value={importText} onChange={e => setImportText(e.target.value)} style={{ minHeight: 160 }} />
              <button className="crm-btn crm-btn--primary" onClick={handleImportHistory} disabled={!importText.trim() || importing}>
                {importing ? 'Importando...' : 'Importar historico'}
              </button>
              <p className="crm-mini-meta">Registra historicos sin descontar stock actual.</p>
              {importResult && (
                <p className="crm-mini-meta">
                  OK: {importResult.clientes_creados} nuevos / {importResult.clientes_actualizados} actualizados / {importResult.ventas_creadas} compras / {importResult.abonos_creados} abonos
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {catalogPickerOpen && (
        <div className="crm-modal-backdrop" onClick={() => setCatalogPickerOpen(false)}>
          <div className="crm-modal" onClick={e => e.stopPropagation()}>
            <div className="crm-panel-head">
              <p className="crm-title">Seleccionar prendas</p>
              <button className="crm-icon-btn" onClick={() => setCatalogPickerOpen(false)} title="Cerrar">x</button>
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
              <button className="crm-btn crm-btn--primary" onClick={() => setCatalogPickerOpen(false)}>Listo</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div key={toast.key} className={`crm-toast ${toast.type}`}>{toast.message}</div>}
    </div>
  )
}
