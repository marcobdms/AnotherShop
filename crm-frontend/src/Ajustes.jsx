/**
 * Ajustes.jsx — datos de la tienda y metodos de pago.
 *
 * Antes esto solo se podia tocar con un PUT a mano o editando la fila en
 * Supabase. Aqui es donde se meten el Pay ID de Binance, el pago movil, etc.
 * Lo que se guarda como `activo` es lo que ve el comprador en el checkout.
 */
import { useEffect, useState } from 'react'
import { adminFetchMeta, adminUpdateMeta } from './api/catalog'
import { CrmSpinner } from './CrmChrome'

const css = `
  .aj-wrap { padding: 1.5rem 2rem 4rem; max-width: 56rem; }
  .aj-title { margin: 0 0 0.35rem; font-size: 1rem; font-weight: 600; }
  .aj-sub { margin: 0 0 1.5rem; color: var(--grey-400); font-size: 0.78rem; line-height: 1.6; }
  .aj-card { border: 1px solid var(--grey-200); background: var(--white); padding: 1.25rem; margin-bottom: 1rem; }
  .aj-card h3 {
    margin: 0 0 1rem; font-size: 0.68rem; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--grey-400); font-weight: 600;
  }
  .aj-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: 0.85rem; }
  .aj-field { display: flex; flex-direction: column; gap: 0.3rem; }
  .aj-field > span { font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--grey-600); }
  .aj-field input, .aj-field textarea {
    border: 1px solid var(--grey-200); background: var(--white); padding: 0.5rem 0.6rem;
    font-family: var(--font); font-size: 0.82rem; color: var(--black);
  }
  .aj-field input:focus, .aj-field textarea:focus { outline: 0; border-color: var(--black); }
  .aj-field textarea { resize: vertical; min-height: 3.5rem; }

  .aj-metodo { border: 1px solid var(--grey-200); margin-bottom: 0.6rem; }
  .aj-metodo.on { border-color: var(--black); }
  .aj-metodo__head {
    display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem;
    background: #fafafa; border-bottom: 1px solid var(--grey-200);
  }
  .aj-metodo__head strong { font-size: 0.85rem; font-weight: 500; flex: 1 1 auto; }
  .aj-metodo__body { padding: 1rem; display: grid; gap: 0.85rem; }
  .aj-toggle { display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.75rem; color: var(--grey-600); cursor: pointer; }
  .aj-toggle input { width: 1rem; height: 1rem; accent-color: #0b0b0b; cursor: pointer; }
  .aj-dato { display: grid; grid-template-columns: 10rem 1fr; gap: 0.6rem; align-items: center; }
  .aj-dato input { width: 100%; }

  .aj-bar {
    position: sticky; bottom: 0; display: flex; align-items: center; gap: 1rem;
    padding: 0.85rem 0; background: linear-gradient(to top, var(--white) 70%, transparent);
  }
  .aj-ok { color: #15803d; font-size: 0.78rem; }
  .aj-err { color: #b91c1c; font-size: 0.78rem; }
`

const ETIQUETAS = {
  efectivo: 'Efectivo (en persona, USD)',
  pago_movil: 'Pago Movil',
  binance: 'Binance Pay',
  zelle: 'Zelle',
  transferencia: 'Transferencia',
  paypal: 'PayPal',
}

export default function Ajustes({ active }) {
  const [meta, setMeta] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  useEffect(() => {
    if (!active || meta) return
    adminFetchMeta()
      .then(setMeta)
      .catch(err => setError(err.message))
      .finally(() => setCargando(false))
  }, [active, meta])

  if (!active) return null
  if (cargando || !meta) return <CrmSpinner />

  const pagos = meta.pagos || { tasa_bs: 0, metodos: [] }

  const setCampo = (campo, valor) => setMeta({ ...meta, [campo]: valor })

  const setMetodo = (id, patch) => setMeta({
    ...meta,
    pagos: {
      ...pagos,
      metodos: pagos.metodos.map(m => (m.id === id ? { ...m, ...patch } : m)),
    },
  })

  const setDato = (id, index, patch) => setMetodo(id, {
    datos: pagos.metodos.find(m => m.id === id).datos.map((d, i) => (i === index ? { ...d, ...patch } : d)),
  })

  async function guardar() {
    setGuardando(true)
    setError('')
    setOk('')
    try {
      setMeta(await adminUpdateMeta(meta))
      setOk('Guardado')
      setTimeout(() => setOk(''), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="aj-wrap">
      <style>{css}</style>

      <h2 className="aj-title">Ajustes de la tienda</h2>
      <p className="aj-sub">
        Los datos de pago solo se muestran al comprador dentro de su pedido, no en el catalogo
        publico. Un metodo desactivado no aparece en el checkout.
      </p>

      <div className="aj-card">
        <h3>Tienda</h3>
        <div className="aj-grid">
          <label className="aj-field">
            <span>Marca</span>
            <input value={meta.marca || ''} onChange={e => setCampo('marca', e.target.value)} />
          </label>
          <label className="aj-field">
            <span>Moneda</span>
            <input value={meta.moneda || ''} onChange={e => setCampo('moneda', e.target.value)} />
          </label>
          <label className="aj-field">
            <span>WhatsApp</span>
            <input value={meta.whatsapp || ''} onChange={e => setCampo('whatsapp', e.target.value)} />
          </label>
          <label className="aj-field">
            <span>Mensaje de WhatsApp</span>
            <input
              value={meta.whatsapp_mensaje || ''}
              onChange={e => setCampo('whatsapp_mensaje', e.target.value)}
            />
          </label>
          <label className="aj-field">
            <span>Tasa Bs por dolar (0 = automatica, BCV)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={pagos.tasa_bs ?? 0}
              onChange={e => setMeta({
                ...meta,
                pagos: { ...pagos, tasa_bs: Number(e.target.value) || 0 },
              })}
            />
          </label>
        </div>
      </div>

      <div className="aj-card">
        <h3>Metodos de pago</h3>
        {pagos.metodos.map(metodo => (
          <div className={`aj-metodo${metodo.activo ? ' on' : ''}`} key={metodo.id}>
            <div className="aj-metodo__head">
              <strong>{ETIQUETAS[metodo.id] || metodo.id}</strong>
              <label className="aj-toggle">
                <input
                  type="checkbox"
                  checked={!!metodo.activo}
                  onChange={e => setMetodo(metodo.id, { activo: e.target.checked })}
                />
                <span>{metodo.activo ? 'Visible en la tienda' : 'Oculto'}</span>
              </label>
            </div>

            {metodo.activo && (
              <div className="aj-metodo__body">
                <label className="aj-field">
                  <span>Titulo</span>
                  <input
                    value={metodo.titulo || ''}
                    onChange={e => setMetodo(metodo.id, { titulo: e.target.value })}
                  />
                </label>
                <label className="aj-field">
                  <span>Instrucciones</span>
                  <textarea
                    value={metodo.instrucciones || ''}
                    onChange={e => setMetodo(metodo.id, { instrucciones: e.target.value })}
                  />
                </label>
                <div className="aj-grid">
                  <label className="aj-field">
                    <span>Etiqueta (p. ej. Recomendado)</span>
                    <input
                      value={metodo.etiqueta || ''}
                      onChange={e => setMetodo(metodo.id, { etiqueta: e.target.value })}
                      placeholder="Sin etiqueta"
                    />
                  </label>
                  <label className="aj-field">
                    <span>Imagen QR (ruta en /pay-qr/)</span>
                    <input
                      value={metodo.qr || ''}
                      onChange={e => setMetodo(metodo.id, { qr: e.target.value })}
                      placeholder="/pay-qr/pago-movil.png"
                    />
                  </label>
                  <label className="aj-field">
                    <span>Enlace de pago (usa {'{monto}'})</span>
                    <input
                      value={metodo.enlace || ''}
                      onChange={e => setMetodo(metodo.id, { enlace: e.target.value })}
                      placeholder="https://paypal.me/usuario/{monto}USD"
                    />
                  </label>
                </div>
                {(metodo.datos || []).map((dato, i) => (
                  <div className="aj-dato" key={`${metodo.id}-${i}`}>
                    <input
                      value={dato.label || ''}
                      onChange={e => setDato(metodo.id, i, { label: e.target.value })}
                      placeholder="Etiqueta"
                    />
                    <input
                      value={dato.valor || ''}
                      onChange={e => setDato(metodo.id, i, { valor: e.target.value })}
                      placeholder="Valor que ve el comprador"
                    />
                  </div>
                ))}
                <button
                  className="crm-btn"
                  type="button"
                  onClick={() => setMetodo(metodo.id, {
                    datos: [...(metodo.datos || []), { label: '', valor: '' }],
                  })}
                >
                  Anadir dato
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="aj-bar">
        <button
          className="crm-btn crm-btn--primary"
          onClick={guardar}
          disabled={guardando}
          type="button"
        >
          {guardando ? 'Guardando...' : 'Guardar ajustes'}
        </button>
        {ok && <span className="aj-ok">{ok}</span>}
        {error && <span className="aj-err">{error}</span>}
      </div>
    </div>
  )
}
