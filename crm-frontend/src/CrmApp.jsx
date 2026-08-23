import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Admin from './admin/Admin.jsx'
import AdminCambios from './admin/AdminCambios.jsx'
import AdminImport from './AdminImport.jsx'
import Clientes from './Clientes.jsx'
import { CrmHeader, CrmLogin, CrmSkeleton, CrmSpinner, useCrmSession } from './CrmChrome'
import Dashboard from './Dashboard.jsx'

const VIEW_PATHS = new Set(['/clientes', '/dashboard', '/import', '/admin', '/admin/cambios'])

function normalizePath(pathname) {
  if (pathname === '/') return '/clientes'
  if (pathname === '/admin/import') return '/import'
  return VIEW_PATHS.has(pathname) ? pathname : '/clientes'
}

function viewClass(path, activePath) {
  return `crm-view${path === activePath ? ' active' : ''}`
}

function skeletonVariant(path) {
  if (path === '/dashboard') return 'dashboard'
  if (path === '/import') return 'import'
  if (path.startsWith('/admin')) return 'admin'
  return 'clients'
}

export default function CrmApp() {
  const { usuario, login, logout } = useCrmSession()
  const [catalogRevision, setCatalogRevision] = useState(0)
  const [settlingPath, setSettlingPath] = useState(null)
  const previousPathRef = useRef('/clientes')
  const scrollPositionsRef = useRef({})
  const location = useLocation()
  const navigate = useNavigate()
  const activePath = normalizePath(location.pathname)

  useEffect(() => {
    if (activePath !== location.pathname) {
      navigate(activePath, { replace: true })
    }
  }, [activePath, location.pathname, navigate])

  useLayoutEffect(() => {
    const previousPath = previousPathRef.current
    if (previousPath === activePath) return

    scrollPositionsRef.current[previousPath] = window.scrollY
    previousPathRef.current = activePath
    window.scrollTo({ top: scrollPositionsRef.current[activePath] ?? 0, left: 0 })

    setSettlingPath(activePath)
  }, [activePath])

  useEffect(() => {
    if (!settlingPath) return

    const timer = window.setTimeout(() => {
      setSettlingPath(current => current === settlingPath ? null : current)
    }, 180)

    return () => window.clearTimeout(timer)
  }, [settlingPath])

  if (!usuario) return <CrmLogin onAuth={login} />

  const isSettling = settlingPath === activePath
  const isViewActive = path => activePath === path && !isSettling

  return (
    <div className="crm-page">
      <CrmHeader onLogout={logout} />

      {isSettling && (
        <div className={`crm-route-loading crm-route-loading--${skeletonVariant(activePath)}`}>
          {activePath === '/import' ? (
            <CrmSpinner label="Cargando importador" />
          ) : (
            <CrmSkeleton rows={activePath === '/dashboard' ? 12 : 10} variant={skeletonVariant(activePath)} />
          )}
        </div>
      )}

      <section className={viewClass('/clientes', activePath)} hidden={!isViewActive('/clientes')}>
        <Clientes
          active={isViewActive('/clientes')}
          catalogRevision={catalogRevision}
          usuario={usuario}
          onCatalogChanged={() => setCatalogRevision(version => version + 1)}
        />
      </section>

      <section className={viewClass('/dashboard', activePath)} hidden={!isViewActive('/dashboard')}>
        <Dashboard
          active={isViewActive('/dashboard')}
          catalogRevision={catalogRevision}
          usuario={usuario}
        />
      </section>

      <section className={viewClass('/import', activePath)} hidden={!isViewActive('/import')}>
        <AdminImport
          active={isViewActive('/import')}
          catalogRevision={catalogRevision}
          usuario={usuario}
          onCatalogChanged={() => setCatalogRevision(version => version + 1)}
        />
      </section>

      <section className={viewClass('/admin', activePath)} hidden={!isViewActive('/admin')}>
        <Admin
          active={isViewActive('/admin')}
          catalogRevision={catalogRevision}
          usuario={usuario}
          onCatalogChanged={() => setCatalogRevision(version => version + 1)}
        />
      </section>

      <section className={viewClass('/admin/cambios', activePath)} hidden={!isViewActive('/admin/cambios')}>
        <AdminCambios active={isViewActive('/admin/cambios')} />
      </section>
    </div>
  )
}
