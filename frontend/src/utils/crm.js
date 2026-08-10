const LOCAL_CRM_ORIGIN = 'http://localhost:5174'

function isLocalHost() {
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

export function crmPath(path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const configuredOrigin = (import.meta.env.VITE_CRM_URL || '').trim().replace(/\/+$/, '')

  if (configuredOrigin) return `${configuredOrigin}${normalizedPath}`
  if (isLocalHost()) return `${LOCAL_CRM_ORIGIN}${normalizedPath}`

  return normalizedPath
}
