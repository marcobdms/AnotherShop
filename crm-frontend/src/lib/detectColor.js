/**
 * detectColor.js — color primario de una prenda a partir de su foto.
 *
 * Heurística (no perfecta): descarta el fondo de estudio y los tonos de piel,
 * vota por color píxel a píxel dentro de la zona central y devuelve el preset
 * más votado. Pensado para el modo "Auto" del selector de color en /import.
 */

function rgbToLab(r, g, b) {
  const lin = (v) => {
    const c = v / 255
    return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92
  }
  const R = lin(r), G = lin(g), B = lin(b)
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

function hexToLab(hex) {
  const h = hex.replace('#', '')
  return rgbToLab(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16))
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
    img.src = src
  })
}

const ACHROMATIC = new Set(['Negro', 'Blanco', 'Gris'])

/**
 * @param {string} src      URL o blob de la imagen
 * @param {{nombre:string,hex:string}[]} presets  colores disponibles en el selector
 * @returns {Promise<string|null>} nombre del preset, o null si no se pudo decidir
 */
export async function detectPrimaryColor(src, presets) {
  const img = await loadImage(src)
  const scale = Math.min(1, 160 / img.width)
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)

  const lab = (x, y) => {
    const i = (y * w + x) * 4
    return rgbToLab(data[i], data[i + 1], data[i + 2])
  }

  // Fondo = mediana del marco exterior
  const edge = Math.max(2, Math.round(Math.min(w, h) * 0.05))
  const border = []
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (x < edge || y < edge || x >= w - edge || y >= h - edge) border.push(lab(x, y))
    }
  }
  const bg = [0, 1, 2].map((c) => median(border.map((p) => p[c])))

  // Zona central (torso)
  const zone = []
  for (let y = Math.round(h * 0.2); y < Math.round(h * 0.72); y += 1) {
    for (let x = Math.round(w * 0.22); x < Math.round(w * 0.78); x += 1) zone.push(lab(x, y))
  }
  if (!zone.length) return null

  let fg = zone.filter((p) => Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]) > 10)
  if (fg.length < 0.06 * zone.length) fg = zone // prenda casi del color del fondo

  const isSkin = ([L, a, b]) => {
    const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
    return L > 52 && L < 82 && a > 11 && a < 24 && hue > 30 && hue < 62
  }
  const noSkin = fg.filter((p) => !isSkin(p))
  if (noSkin.length > 0.25 * fg.length) fg = noSkin

  const chromatic = presets
    .filter((p) => !ACHROMATIC.has(p.nombre))
    .map((p) => ({ nombre: p.nombre, lab: hexToLab(p.hex) }))
  const has = (n) => presets.some((p) => p.nombre === n)
  const W = [0.5, 1, 1] // la luminosidad pesa menos: las sombras no cambian el color

  const votes = new Map()
  for (const [L, a, b] of fg) {
    const C = Math.hypot(a, b)
    let name = null
    if (C < 10) {
      name = L < 30 ? 'Negro' : L < 70 ? 'Gris' : 'Blanco'
    } else if (L < 22) {
      name = 'Negro'
    } else {
      let best = Infinity
      for (const c of chromatic) {
        const d = Math.hypot((L - c.lab[0]) * W[0], (a - c.lab[1]) * W[1], (b - c.lab[2]) * W[2])
        if (d < best) { best = d; name = c.nombre }
      }
    }
    if (name && (chromatic.some((c) => c.nombre === name) || has(name))) {
      votes.set(name, (votes.get(name) || 0) + 1)
    }
  }

  let winner = null
  let max = 0
  for (const [name, n] of votes) {
    if (n > max) { max = n; winner = name }
  }
  return winner
}
