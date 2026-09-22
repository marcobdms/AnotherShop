/**
 * useCart — el carrito es la lista de favoritos.
 *
 * Los favoritos solo guardan un id de producto: no saben de talla ni cantidad.
 * Aqui se guarda esa parte (talla, cantidad, si entra en el pago) en
 * localStorage y se cruza con el catalogo para tener la linea completa.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCatalog } from './useCatalog'

const CART_KEY = 'anothernpcshop:cart'

function readCart() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CART_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    console.warn('[useCart] No se pudo leer el carrito:', error)
    return {}
  }
}

function writeCart(value) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(value))
  } catch (error) {
    console.warn('[useCart] No se pudo guardar el carrito:', error)
  }
}

/** Tallas con stock real de la variante del producto. */
export function availableSizes(producto) {
  const tallas = producto?.variante_tallas
  if (tallas && typeof tallas === 'object') {
    return Object.entries(tallas)
      .filter(([, stock]) => Number(stock) > 0)
      .map(([talla]) => talla)
  }
  return []
}

export function useCart(favoriteIds) {
  const { catalog } = useCatalog()
  const productos = catalog?.productos ?? []
  const [meta, setMeta] = useState(readCart)

  const ids = useMemo(
    () => (favoriteIds instanceof Set ? [...favoriteIds] : favoriteIds ?? []),
    [favoriteIds],
  )

  // Un favorito recien anadido entra seleccionado y, si solo hay una talla, ya
  // resuelto: asi el resumen no obliga a tocar nada cuando no hay que elegir.
  useEffect(() => {
    if (!productos.length) return
    setMeta(prev => {
      const next = { ...prev }
      let changed = false
      for (const id of ids) {
        const producto = productos.find(p => p.id === id)
        if (!producto) continue
        const sizes = availableSizes(producto)
        if (!next[id]) {
          next[id] = {
            talla: sizes.length === 1 ? sizes[0] : '',
            cantidad: 1,
            seleccionado: true,
          }
          changed = true
        } else if (next[id].talla && !sizes.includes(next[id].talla)) {
          next[id] = { ...next[id], talla: sizes.length === 1 ? sizes[0] : '' }
          changed = true
        }
      }
      // Limpia entradas huerfanas (favoritos quitados), pero solo si "ids" ya
      // es una lista real: si esta vacia porque los favoritos todavia no han
      // terminado de cargar, borrar aqui vaciaria el carrito guardado entero.
      if (ids.length > 0) {
        for (const key of Object.keys(next)) {
          if (!ids.includes(key)) {
            delete next[key]
            changed = true
          }
        }
      }
      if (changed) writeCart(next)
      return changed ? next : prev
    })
  }, [ids, productos])

  const update = useCallback((id, patch) => {
    setMeta(prev => {
      const next = { ...prev, [id]: { ...(prev[id] ?? { cantidad: 1, seleccionado: true }), ...patch } }
      writeCart(next)
      return next
    })
  }, [])

  const setTalla = useCallback((id, talla) => update(id, { talla }), [update])
  const toggle = useCallback((id) => {
    setMeta(prev => {
      const current = prev[id] ?? { talla: '', cantidad: 1, seleccionado: true }
      const next = { ...prev, [id]: { ...current, seleccionado: !current.seleccionado } }
      writeCart(next)
      return next
    })
  }, [])

  const lines = useMemo(() => (
    ids
      .map(id => {
        const producto = productos.find(p => p.id === id)
        if (!producto) return null
        // Se listan SIEMPRE todas las tallas del producto (para que el selector no
        // "esconda" una talla sin mas); la que no tenga stock real se deshabilita
        // en gris ahi mismo. "Agotado" (la prenda entera) lo decide el interruptor manual.
        const sizes = producto.tallas || []
        const info = meta[id] ?? { talla: '', cantidad: 1, seleccionado: true }
        const maxStock = info.talla ? Number(producto.variante_tallas?.[info.talla] ?? 0) : 0
        return {
          id,
          producto,
          sizes,
          talla: info.talla ?? '',
          cantidad: Math.max(1, Number(info.cantidad) || 1),
          seleccionado: info.seleccionado !== false,
          maxStock,
          agotado: producto.disponible === false,
        }
      })
      .filter(Boolean)
  ), [ids, productos, meta])

  const setCantidad = useCallback((id, cantidad) => {
    const line = lines.find(l => l.id === id)
    const max = line?.maxStock || 1
    update(id, { cantidad: Math.min(Math.max(1, Number(cantidad) || 1), max) })
  }, [lines, update])

  const setTodos = useCallback((seleccionado) => {
    setMeta(prev => {
      const next = { ...prev }
      for (const id of ids) {
        next[id] = { ...(next[id] ?? { talla: '', cantidad: 1 }), seleccionado }
      }
      writeCart(next)
      return next
    })
  }, [ids])

  const selected = lines.filter(l => l.seleccionado && !l.agotado)
  const total = selected.reduce(
    (sum, l) => sum + Number(l.producto.precio || 0) * (l.talla ? l.cantidad : 0),
    0,
  )
  const faltanTallas = selected.some(l => !l.talla)

  return {
    lines,
    selected,
    total,
    faltanTallas,
    listo: selected.length > 0 && !faltanTallas && total > 0,
    setTalla,
    setCantidad,
    toggle,
    setTodos,
  }
}

/**
 * Fija talla y cantidad de una prenda sin pasar por el hook.
 * Lo usa "Comprar ahora" en la ficha de producto, donde la talla ya se eligio.
 */
export function setCartLine(id, patch) {
  const current = readCart()
  current[id] = { talla: '', cantidad: 1, seleccionado: true, ...current[id], ...patch }
  writeCart(current)
}

/** Deja el carrito limpio tras un pedido creado. */
export function clearCartMeta(ids = []) {
  const current = readCart()
  for (const id of ids) delete current[id]
  writeCart(current)
}
