const BRAND_LABELS = {
  MNG: 'MANGO OUTLET',
  'A&F': 'ABERCROMBIE & FITCH',
  HCO: 'HOLLISTER',
  LFTS: 'LEFTIES',
  'P&B': 'PULL&BEAR',
  ZARA: 'ZARA',
}

const MANGO_LEGACY_REFS = new Set(['028', '039', '042', '044', '053'])
const ZARA_PREFIXES = new Set(['0085', '1044', '3253', '4174', '4424', '5643', '5644', '6050'])
const PULL_BEAR_PREFIXES = new Set(['3024', '3230', '3231', '3460', '7472'])

function normalizeBrandCode(value) {
  const raw = String(value || '').trim().toUpperCase()
  if (!raw) return ''
  if (raw === 'MNG' || raw.includes('MANGO')) return 'MNG'
  if (raw === 'A&F' || raw === 'ABF' || raw.includes('ABERCROMBIE')) return 'A&F'
  if (raw === 'HCO' || raw.includes('HOLLISTER')) return 'HCO'
  if (raw === 'LFTS' || raw.includes('LEFTIES')) return 'LFTS'
  if (raw === 'P&B' || raw.includes('PULL&BEAR') || raw.includes('PULL AND BEAR')) return 'P&B'
  if (raw === 'ZARA') return 'ZARA'
  return raw
}

function detectBrandCode(product) {
  const compactRef = String(product?.ref || product?.id || '').trim().toUpperCase().replace(/\s+/g, '')

  if (MANGO_LEGACY_REFS.has(compactRef)) return 'MNG'
  if (/^AF-/.test(compactRef)) return 'A&F'
  if (/^324[-/]?609/.test(compactRef)) return 'HCO'
  if (/^PB-/.test(compactRef)) return 'P&B'
  if (/^\d{4}\/\d{3}\/\d{3}$/.test(compactRef)) return 'LFTS'
  if (/^\d{4}\/\d{3}$/.test(compactRef)) {
    const prefix = compactRef.slice(0, 4)
    if (PULL_BEAR_PREFIXES.has(prefix)) return 'P&B'
    if (ZARA_PREFIXES.has(prefix)) return 'ZARA'
  }
  if (/^(?:17|77|87)\d{6}/.test(compactRef)) return 'MNG'

  return ''
}

export function getProductBrandLabel(product) {
  const explicitCode = normalizeBrandCode(product?.marca)
  const code = explicitCode || detectBrandCode(product)
  return BRAND_LABELS[code] || code
}
