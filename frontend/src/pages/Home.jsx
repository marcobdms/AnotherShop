/**
 * Home.jsx — Página de inicio
 */
import { Link } from 'react-router-dom'
import { useCatalog } from '../hooks/useCatalog'

export default function Home() {
  const { catalog } = useCatalog()
  const marca = catalog?.meta?.marca ?? 'ANOTHER NPC SHOP'

  return (
    <main className="home">
      <img src="/npc.png" alt="NPC Wojak" className="home__logo" />
      <p className="home__title">{marca}</p>
      <p className="home__sub">Solo ropa. Solo existir.</p>
      <Link to="/catalogo" className="home__enter">Entrar</Link>
    </main>
  )
}
