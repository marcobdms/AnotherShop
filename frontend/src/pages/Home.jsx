/**
 * Home.jsx — Página de inicio
 */
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useCatalog } from '../hooks/useCatalog'

export default function Home() {
  const { catalog } = useCatalog()
  const marca = catalog?.meta?.marca ?? 'ANOTHER NPC SHOP'
  const navigate = useNavigate()
  const [isFadingOut, setIsFadingOut] = useState(false)

  const handleEnterClick = (e) => {
    e.preventDefault()
    setIsFadingOut(true)
    setTimeout(() => {
      navigate('/catalogo')
    }, 700)
  }

  return (
    <main className={`home ${isFadingOut ? 'fade-out' : ''}`}>
      <img src="/npc.png" alt="NPC Wojak" className="home__logo" />
      <p className="home__title">{marca}</p>
      <p className="home__sub">Solo ropa. Solo existir.</p>
      <a href="/catalogo" onClick={handleEnterClick} className="home__enter">Entrar</a>
    </main>
  )
}
