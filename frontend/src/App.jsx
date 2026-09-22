/**
 * App.jsx — Raíz de la aplicación
 * Define el layout global y el sistema de rutas.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { ExitNavigateContext } from './hooks/useExitNavigate'
import Nav from './components/Nav'
import Home from './pages/Home'
import Catalog from './pages/Catalog'
import Product from './pages/Product'
import About from './pages/About'
import Resumen from './pages/Resumen'
import Contacto from './pages/Contacto'
import Pago from './pages/Pago'
import Pedido from './pages/Pedido'
import Seguimiento from './pages/Seguimiento'
import { useCatalog } from './hooks/useCatalog'
import { useAuth } from './hooks/useAuth'
import Clientes from './pages/Clientes'
import Login from './pages/Login'
import Account from './pages/Account'
import TopBanner from './components/TopBanner'
import { crmPath } from './utils/crm'

function CrmRedirect({ path }) {
  useEffect(() => {
    window.location.replace(crmPath(path))
  }, [path])

  return <main className="page-state">Redirigiendo al CRM...</main>
}

// Debe coincidir con la duración de `route-out` en index.css.
const ROUTE_EXIT_MS = 400

function AppLayout() {
  const { catalog } = useCatalog()
  const { user } = useAuth()
  const [catalogReadyLocation, setCatalogReadyLocation] = useState(null)
  const [leaving, setLeaving] = useState(false)
  const exitTimer = useRef(null)
  const marca = catalog?.meta?.marca ?? 'ANOTHER NPC SHOP'
  const location = useLocation()
  const navigate = useNavigate()

  // Fade-out de la ruta actual y luego navega. La animación solo existe en
  // escritorio: en móvil / reduced-motion se navega al instante.
  const exitNavigate = useCallback((to, options) => {
    if (typeof to === 'number') {
      navigate(to)
      return
    }
    const canAnimate = window.matchMedia?.('(min-width: 64rem)')?.matches
      && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (!canAnimate) {
      navigate(to, options)
      return
    }
    if (exitTimer.current) return
    setLeaving(true)
    exitTimer.current = setTimeout(() => {
      exitTimer.current = null
      navigate(to, options)
    }, ROUTE_EXIT_MS)
  }, [navigate])

  // La nueva ruta ya montó: quitamos el estado de salida antes de pintar para
  // que anime su entrada sin heredar el fade-out.
  useLayoutEffect(() => {
    setLeaving(false)
  }, [location.key])

  useEffect(() => () => clearTimeout(exitTimer.current), [])

  // Al abrir cualquier página que no sea el catálogo (que restaura su propio
  // scroll), se empieza arriba: antes heredaba el scroll del catálogo.
  useLayoutEffect(() => {
    const isDesktop = window.matchMedia?.('(min-width: 64rem)')?.matches
    if (isDesktop && location.pathname.toLowerCase() !== '/catalogo') window.scrollTo(0, 0)
  }, [location.pathname])
  const isAdmin = location.pathname.toLowerCase().startsWith('/admin')
  const isCrm = location.pathname.toLowerCase().startsWith('/clientes')
  const isFullscreen = isAdmin || isCrm || location.pathname === '/login'

  const isHome = location.pathname === '/'
  const isCatalog = location.pathname.toLowerCase() === '/catalogo'
  const hasSavedCatalogScroll = isCatalog && sessionStorage.getItem('catalog-scroll') !== null
  // Al salir hacia un producto el scroll ya está guardado, pero el catálogo debe
  // seguir visible mientras hace su fade-out: solo "restauramos" al volver.
  const isRestoringCatalog = hasSavedCatalogScroll && catalogReadyLocation !== location.key && !leaving

  // Cada salida del catálogo inicia una nueva restauración, incluso si el
  // usuario vuelve con el botón Atrás al mismo entry del historial.
  useEffect(() => {
    if (!isCatalog) setCatalogReadyLocation(null)
  }, [isCatalog])

  const handleCatalogReady = useCallback(() => {
    setCatalogReadyLocation(location.key)
  }, [location.key])

  const routeClass = [
    isRestoringCatalog && 'catalog-route--restoring',
    isCatalog && catalogReadyLocation === location.key && 'catalog-route--revealed',
    leaving && 'route--leaving',
  ].filter(Boolean).join(' ') || undefined

  return (
    <ExitNavigateContext.Provider value={exitNavigate}>
    <div className={routeClass}>
      {/* Nav en todas las páginas excepto admin, login */}
      {!isFullscreen && <Nav marca={marca} user={user} isHome={isHome} isCatalog={isCatalog} />}
      {/* Cinta solo en el catálogo */}
      {isCatalog && <TopBanner />}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/catalogo" element={<Catalog onReady={handleCatalogReady} />} />
        <Route path="/producto/:id" element={<Product />} />
        <Route path="/nosotros" element={<About />} />
        <Route path="/resumen" element={<Resumen />} />
        <Route path="/contacto" element={<Contacto />} />
        <Route path="/pago/:numero" element={<Pago />} />
        <Route path="/gracias/:numero" element={<Pedido />} />
        <Route path="/pedido/:numero" element={<Pedido />} />
        <Route path="/seguimiento" element={<Seguimiento />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cuenta" element={<Account />} />
        <Route path="/admin" element={<CrmRedirect path="/admin" />} />
        <Route path="/admin/cambios" element={<CrmRedirect path="/admin/cambios" />} />
        <Route path="/admin/import" element={<CrmRedirect path="/import" />} />
        <Route path="/clientes" element={<Clientes />} />
        {/* Fallback */}
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
    </ExitNavigateContext.Provider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}
