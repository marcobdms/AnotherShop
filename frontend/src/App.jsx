/**
 * App.jsx — Raíz de la aplicación
 * Define el layout global y el sistema de rutas.
 */
import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Nav from './components/Nav'
import Home from './pages/Home'
import Catalog from './pages/Catalog'
import Product from './pages/Product'
import About from './pages/About'
import { useCatalog } from './hooks/useCatalog'
import { useAuth } from './hooks/useAuth'
import Admin from './pages/Admin'
import AdminCambios from './pages/AdminCambios'
import Clientes from './pages/Clientes'
import Login from './pages/Login'
import Account from './pages/Account'
import TopBanner from './components/TopBanner'
import { crmPath } from './utils/crm'

function CrmImportRedirect() {
  useEffect(() => {
    window.location.replace(crmPath('/import'))
  }, [])

  return <main className="page-state">Redirigiendo al CRM...</main>
}

function AppLayout() {
  const { catalog } = useCatalog()
  const { user } = useAuth()
  const [catalogReadyLocation, setCatalogReadyLocation] = useState(null)
  const marca = catalog?.meta?.marca ?? 'ANOTHER NPC SHOP'
  const location = useLocation()
  const isAdmin = location.pathname.toLowerCase().startsWith('/admin')
  const isCrm = location.pathname.toLowerCase().startsWith('/clientes')
  const isFullscreen = isAdmin || isCrm || location.pathname === '/login'

  const isHome = location.pathname === '/'
  const isCatalog = location.pathname.toLowerCase() === '/catalogo'
  const hasSavedCatalogScroll = isCatalog && sessionStorage.getItem('catalog-scroll') !== null
  const isRestoringCatalog = hasSavedCatalogScroll && catalogReadyLocation !== location.key

  // Cada salida del catálogo inicia una nueva restauración, incluso si el
  // usuario vuelve con el botón Atrás al mismo entry del historial.
  useEffect(() => {
    if (!isCatalog) setCatalogReadyLocation(null)
  }, [isCatalog])

  const handleCatalogReady = useCallback(() => {
    setCatalogReadyLocation(location.key)
  }, [location.key])

  return (
    <div className={isRestoringCatalog ? 'catalog-route--restoring' : undefined}>
      {/* Nav en todas las páginas excepto admin, login */}
      {!isFullscreen && <Nav marca={marca} user={user} isHome={isHome} />}
      {/* Cinta solo en el catálogo */}
      {isCatalog && <TopBanner />}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/catalogo" element={<Catalog onReady={handleCatalogReady} />} />
        <Route path="/producto/:id" element={<Product />} />
        <Route path="/nosotros" element={<About />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cuenta" element={<Account />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/cambios" element={<AdminCambios />} />
        <Route path="/admin/import" element={<CrmImportRedirect />} />
        <Route path="/clientes" element={<Clientes />} />
        {/* Fallback */}
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}
