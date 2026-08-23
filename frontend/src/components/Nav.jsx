/**
 * Nav.jsx
 * Props: marca (string), user (Supabase user | null)
 * Desktop: logo + links inline
 * Mobile: logo izquierda + hamburguesa derecha → menú vertical colapsado
 */
import { useState, useEffect, useRef } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </svg>
  )
}

function HamburgerIcon({ open }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      {open ? (
        <>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </>
      ) : (
        <>
          <line x1="3" y1="7" x2="21" y2="7" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="17" x2="21" y2="17" />
        </>
      )}
    </svg>
  )
}

export default function Nav({ marca = 'ANOTHER NPC SHOP', user = null, isHome = false, isCatalog = false }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const location = useLocation()

  // Cerrar menú al cambiar de ruta
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Cerrar menú al click fuera
  useEffect(() => {
    if (!menuOpen) return
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])

  return (
    <div className={`nav-wrapper ${isHome ? 'nav-wrapper--glass' : ''} ${isCatalog ? 'nav-wrapper--catalog' : ''}`} ref={menuRef}>
      <nav className={`nav ${isHome ? 'nav--glass' : ''} ${isCatalog ? 'nav--catalog' : ''}`}>
        {/* Logo imagen */}
        <NavLink to="/" className="nav__brand nav__brand--img">
          <img
            src="/logo.png"
            alt="Another NPC Shop"
            className="nav__logo"
          />
        </NavLink>

        {isCatalog && (
          <div className="nav__catalog-actions">
            <a
              className="nav__catalog-icon"
              href="#catalog-search"
              aria-label="Buscar en catalogo"
              onClick={() => window.dispatchEvent(new Event('catalog-search-open'))}
            >
              <SearchIcon />
            </a>
            <Link
              to="/cuenta"
              className="nav__catalog-icon"
              aria-label="Abrir favoritos"
              title="Favoritos"
            >
              <HeartIcon />
            </Link>
          </div>
        )}

        {/* Desktop links */}
        <ul className="nav__links">
          <li>
            <NavLink to="/catalogo" className={({ isActive }) => isActive ? 'active' : ''}>
              Catálogo
            </NavLink>
          </li>
          <li>
            <NavLink to="/nosotros" className={({ isActive }) => isActive ? 'active' : ''}>
              Nosotros
            </NavLink>
          </li>
          <li>
            <Link
              to={user ? '/cuenta' : '/login'}
              className="nav__user-icon"
              aria-label={user ? 'Mis favoritos' : 'Iniciar sesión'}
              title={user ? user.email : 'Iniciar sesión'}
            >
              <UserIcon />
            </Link>
          </li>
        </ul>

        {/* Mobile hamburger button */}
        <button
          className="nav__hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
        >
          <HamburgerIcon open={menuOpen} />
        </button>
      </nav>

      {/* Mobile dropdown menu */}
      <div className={`nav__mobile-menu ${menuOpen ? 'nav__mobile-menu--open' : ''}`}>
        <NavLink to="/catalogo" className={({ isActive }) => `nav__mobile-link ${isActive ? 'active' : ''}`}>
          Catálogo
        </NavLink>
        <NavLink to="/nosotros" className={({ isActive }) => `nav__mobile-link ${isActive ? 'active' : ''}`}>
          Nosotros
        </NavLink>
        <Link
          to={user ? '/cuenta' : '/login'}
          className="nav__mobile-link"
          aria-label={user ? 'Mi cuenta' : 'Iniciar sesión'}
        >
          <span className="nav__mobile-icon"><UserIcon /></span>
          {user ? 'Mi cuenta' : 'Iniciar sesión'}
        </Link>
        {user && (
          <Link to="/cuenta" className="nav__mobile-link" aria-label="Mis favoritos">
            <span className="nav__mobile-icon"><HeartIcon /></span>
            Favoritos
          </Link>
        )}
      </div>
    </div>
  )
}
