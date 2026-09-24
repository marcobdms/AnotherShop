/**
 * shuffle.js — mezcla determinista por semilla (mulberry32 + Fisher-Yates).
 *
 * Con la misma semilla siempre da el mismo orden: sirve para que una lista
 * se vea "aleatoria" en una visita pero no cambie de un render a otro
 * mientras la pagina siga abierta (recomendaciones, orden del catalogo...).
 */
export function mezclar(lista, semilla) {
  let estado = semilla >>> 0
  const azar = () => {
    estado = (estado + 0x6d2b79f5) >>> 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const copia = [...lista]
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(azar() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}
