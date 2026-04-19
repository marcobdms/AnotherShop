/**
 * Nav.jsx
 * ─────────────────────────────────────────────────────────────
 * LISTO PARA STITCH: este componente es el candidato principal
 * para ser reemplazado por el componente de navegación de Stitch.
 * Props: marca (string)
 * ─────────────────────────────────────────────────────────────
 */
import { NavLink } from 'react-router-dom'

export default function Nav({ marca = 'ANOTHER NPC SHOP' }) {
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
      </ul>
    </nav>
  )
}
