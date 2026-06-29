/**
 * catalog.js — Capa de datos
 * Todos los fetch al backend van aquí.
 * Si cambias la URL del backend, solo tocas este archivo.
 */

const BASE       = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api`   : '/api'
const ADMIN_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/admin` : '/admin'

// Token del backend — viene de variable de entorno, nunca lo escribe el usuario
const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN ?? ''

// ── Helpers internos ───────────────────────────────────────────────────────────

function adminHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Admin-Token': ADMIN_TOKEN,
  }
}

async function handleResponse(res) {
  if (!res.ok) {
    let detail = `Error ${res.status}`
    try {
      const body = await res.json()
      if (body.detail) detail = body.detail
    } catch (_) {}
    throw new Error(detail)
  }
  if (res.status === 204) return null
  return res.json()
}

// ── Endpoints públicos ─────────────────────────────────────────────────────────

export async function fetchCatalog() {
  const res = await fetch(`${BASE}/catalog`)
  if (!res.ok) throw new Error(`Error ${res.status}: no se pudo cargar el catálogo`)
  return res.json()
}

export async function fetchProducts() {
  const res = await fetch(`${BASE}/catalog`)
  if (!res.ok) throw new Error(`Error ${res.status}: no se pudieron cargar los productos`)
  const data = await res.json()
  return data.productos
}

export async function fetchProduct(id) {
  const res = await fetch(`${BASE}/products/${id}`)
  if (!res.ok) throw new Error(`Error ${res.status}: producto no encontrado`)
  return res.json()
}

export async function fetchMeta() {
  const res = await fetch(`${BASE}/meta`)
  if (!res.ok) throw new Error(`Error ${res.status}: no se pudo cargar la metadata`)
  return res.json()
}

export async function fetchFilters() {
  const res = await fetch(`${BASE}/filters`)
  if (!res.ok) throw new Error(`Error ${res.status}: no se pudieron cargar los filtros`)
  return res.json()
}

// ── Endpoints admin ────────────────────────────────────────────────────────────

export async function adminFetchProducts() {
  const res = await fetch(`${ADMIN_BASE}/products`, {
    headers: adminHeaders(),
  })
  return handleResponse(res)
}

export async function adminFetchHistory() {
  const res = await fetch(`${ADMIN_BASE}/history`, {
    headers: adminHeaders(),
  })
  return handleResponse(res)
}

export async function adminPublishDraft(productos, nuevos_eventos_historial) {
  const res = await fetch(`${ADMIN_BASE}/publish`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ productos, nuevos_eventos_historial }),
  })
  return handleResponse(res)
}

export async function adminFetchInventory(productId) {
  const res = await fetch(`${ADMIN_BASE}/inventory/${productId}`, {
    headers: adminHeaders(),
  })
  return handleResponse(res)
}

export async function adminSaveInventory(productId, variantes) {
  const res = await fetch(`${ADMIN_BASE}/inventory/${productId}`, {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify({ variantes }),
  })
  return handleResponse(res)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function formatPrice(price) {
  return price.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD'
  })
}

export function buildWhatsAppLink(meta, producto, selectedSize = null) {
  const numero = meta.whatsapp.replace(/\D/g, '')
  const sizeText = selectedSize ? ` (Talla: ${selectedSize})` : ''
  const texto = encodeURIComponent(`${meta.whatsapp_mensaje}${producto.nombre}${sizeText} — Ref. ${producto.id}`)
  return `https://wa.me/${numero}?text=${texto}`
}

export function buildPayPalLink(meta, producto) {
  const nota = encodeURIComponent(`${producto.nombre} — Ref. ${producto.id}`)
  return `https://paypal.me/${meta.paypal}/${producto.precio}USD?note=${nota}`
}