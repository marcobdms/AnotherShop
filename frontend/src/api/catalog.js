/**
 * catalog.js — Capa de datos
 * Todos los fetch al backend van aquí.
 * Si cambias la URL del backend, solo tocas este archivo.
 */

const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

export async function fetchCatalog() {
  const res = await fetch(`${BASE}/catalog`)
  if (!res.ok) throw new Error(`Error ${res.status}: no se pudo cargar el catálogo`)
  return res.json()
}

export async function fetchProducts() {
  const res = await fetch(`${BASE}/products`)
  if (!res.ok) throw new Error(`Error ${res.status}: no se pudieron cargar los productos`)
  return res.json()
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

// Helpers

export function formatPrice(price) {
  return price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

export function buildWhatsAppLink(meta, producto, selectedSize = null) {
  const numero = meta.whatsapp.replace(/\D/g, '')
  const sizeText = selectedSize ? ` (Talla: ${selectedSize})` : ''
  const texto  = encodeURIComponent(`${meta.whatsapp_mensaje}${producto.nombre}${sizeText} — Ref. ${producto.id}`)
  return `https://wa.me/${numero}?text=${texto}`
}

export function buildPayPalLink(meta, producto) {
  const nota = encodeURIComponent(`${producto.nombre} — Ref. ${producto.id}`)
  return `https://paypal.me/${meta.paypal}/${producto.precio}EUR?note=${nota}`
}
