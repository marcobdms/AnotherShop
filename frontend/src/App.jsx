/**
 * App.jsx — Raíz de la aplicación
 * Define el layout global y el sistema de rutas.
 */
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
import Login from './pages/Login'
import Account from './pages/Account'
import TopBanner from './components/TopBanner'

function AppLayout() {
  const { catalog } = useCatalog()
  const { user } = useAuth()
  const marca = catalog?.meta?.marca ?? 'ANOTHER NPC SHOP'
  const location = useLocation()
  const isAdmin = location.pathname.toLowerCase().startsWith('/admin')
  const isFullscreen = isAdmin || location.pathname === '/login'

  return (
    <>
      {/* Nav y Banner en todas las páginas excepto admin y login */}
      {!isFullscreen && <Nav marca={marca} user={user} />}
      {!isFullscreen && <TopBanner />}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/catalogo" element={<Catalog />} />
        <Route path="/producto/:id" element={<Product />} />
        <Route path="/nosotros" element={<About />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cuenta" element={<Account />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/cambios" element={<AdminCambios />} />
        {/* Fallback */}
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}
