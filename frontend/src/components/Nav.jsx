/**
 * Nav.jsx
 * Props: marca (string), user (Supabase user | null)
 * Muestra icono de usuario → /cuenta si hay sesión, → /login si no.
 */
import { NavLink, Link } from 'react-router-dom'

// Icono de usuario SVG minimalista (sin dependencias externas)
function UserIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

export default function Nav({ marca = 'ANOTHER NPC SHOP', user = null }) {
  return (
    <nav className="nav">
      <NavLink to="/" className="nav__brand">
        {marca}
      </NavLink>
      <ul className="nav__links">
        <li>
          <NavLink
            to="/catalogo"
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            Catálogo
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/nosotros"
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            Nosotros
          </NavLink>
        </li>
        <li>
          <Link
            to={user ? '/cuenta' : '/login'}
            className="nav__user-icon"
            aria-label={user ? 'Mi cuenta' : 'Iniciar sesión'}
            title={user ? user.email : 'Iniciar sesión'}
          >
            <UserIcon />
          </Link>
        </li>
      </ul>
    </nav>
  )
}
