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
import Admin from './pages/Admin'

function AppLayout() {
  const { catalog } = useCatalog()
  const marca = catalog?.meta?.marca ?? 'ANOTHER NPC SHOP'
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <>
      {/* Nav en todas las páginas */}
      <Nav marca={marca} />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/catalogo" element={<Catalog />} />
        <Route path="/producto/:id" element={<Product />} />
        <Route path="/nosotros" element={<About />} />
        <Route path="/admin" element={<Admin />} />
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
