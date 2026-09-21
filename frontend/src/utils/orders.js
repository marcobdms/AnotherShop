/**
 * Pedidos recientes de este navegador.
 *
 * El numero de pedido es la unica llave de seguimiento y no hay cuenta
 * obligatoria, asi que se guarda aqui para poder volver a consultarlo.
 */
const KEY = 'anothernpcshop:orders'
const MAX = 10

export function readOrders() {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter(o => o && o.numero) : []
  } catch {
    return []
  }
}

export function rememberOrder(numero) {
  if (!numero || typeof window === 'undefined') return
  try {
    const rest = readOrders().filter(o => o.numero !== numero)
    const next = [{ numero, at: Date.now() }, ...rest].slice(0, MAX)
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Sin localStorage el seguimiento sigue funcionando con el numero.
  }
}

/** Acepta "abc123", "ANPC-ABC123" o con espacios y devuelve el formato canonico. */
export function normalizeOrderNumber(value) {
  const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const code = raw.startsWith('ANPC') ? raw.slice(4) : raw
  return code ? `ANPC-${code}` : ''
}
