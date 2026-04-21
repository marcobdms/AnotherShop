/**
 * catalog.js — Capa de datos
 * Todos los fetch al backend van aquí.
 * Si cambias la URL del backend, solo tocas este archivo.
 */

const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
const ADMIN_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/admin` : '/admin'

// ── Helpers internos ───────────────────────────────────────────────────────────

function adminHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'X-Admin-Token': token,
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
  // 204 No Content (DELETE) no tiene body
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

export async function adminFetchProducts(token) {
  const res = await fetch(`${ADMIN_BASE}/products`, {
    headers: adminHeaders(token),
  })
  return handleResponse(res)
}

export async function adminCreateProduct(token, producto) {
  const res = await fetch(`${ADMIN_BASE}/products`, {
    method: 'POST',
    headers: adminHeaders(token),
    body: JSON.stringify(producto),
  })
  return handleResponse(res)
}

export async function adminUpdateProduct(token, id, producto) {
  const res = await fetch(`${ADMIN_BASE}/products/${id}`, {
    method: 'PUT',
    headers: adminHeaders(token),
    body: JSON.stringify(producto),
  })
  return handleResponse(res)
}

export async function adminToggleDisponible(token, id, disponible) {
  const res = await fetch(`${ADMIN_BASE}/products/${id}/disponible`, {
    method: 'PATCH',
    headers: adminHeaders(token),
    body: JSON.stringify({ disponible }),
  })
  return handleResponse(res)
}

export async function adminDeleteProduct(token, id) {
  const res = await fetch(`${ADMIN_BASE}/products/${id}`, {
    method: 'DELETE',
    headers: adminHeaders(token),
  })
  return handleResponse(res)
}

export async function adminFetchMeta(token) {
  const res = await fetch(`${ADMIN_BASE}/meta`, {
    headers: adminHeaders(token),
  })
  return handleResponse(res)
}

export async function adminUpdateMeta(token, meta) {
  const res = await fetch(`${ADMIN_BASE}/meta`, {
    method: 'PUT',
    headers: adminHeaders(token),
    body: JSON.stringify(meta),
  })
  return handleResponse(res)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function formatPrice(price) {
  return price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

export function buildWhatsAppLink(meta, producto, selectedSize = null) {
  const numero = meta.whatsapp.replace(/\D/g, '')
  const sizeText = selectedSize ? ` (Talla: ${selectedSize})` : ''
  const texto = encodeURIComponent(`${meta.whatsapp_mensaje}${producto.nombre}${sizeText} — Ref. ${producto.id}`)
  return `https://wa.me/${numero}?text=${texto}`
}

export function buildPayPalLink(meta, producto) {
  const nota = encodeURIComponent(`${producto.nombre} — Ref. ${producto.id}`)
  return `https://paypal.me/${meta.paypal}/${producto.precio}EUR?note=${nota}`
}