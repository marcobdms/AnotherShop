/**
 * Home.jsx — Página de inicio
 * Rediseño minimalista manteniendo identidad del sitio
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
    }, 500)
  }

  return (
    <div className={`home-page ${isFadingOut ? 'home-page--fade' : ''}`}>
    <main className="home-hero">
      <div className="home-hero__content">
        <h1 className="home-hero__title">REDEFINE YOUR<br />ESSENTIALS</h1>
        <p className="home-hero__sub">
          Experience the pinnacle of uncompromising design. A curated collection of essential items crafted for the modern individual who values clarity over clutter.
        </p>
        <div className="home-hero__actions">
          <a href="/catalogo" onClick={handleEnterClick} className="home-hero__btn home-hero__btn--primary">
            VER CATÁLOGO
          </a>
          <a href="/nosotros" className="home-hero__btn home-hero__btn--outline">
            NOSOTROS
          </a>
        </div>
      </div>
      <div className="home-hero__image-wrapper">
        <img 
          src="/hero-group.jpg"
          alt={marca}
          className="home-hero__image"
          fetchpriority="high"
        />
      </div>
    </main>

    <footer className="home-footer">
      <div className="home-footer__inner">
        <span className="home-footer__brand">{marca}</span>
        <nav className="home-footer__links">
          <a href="/catalogo">Catálogo</a>
          <a href="/nosotros">Nosotros</a>
        </nav>
        <span className="home-footer__copy">© {new Date().getFullYear()} Another Shop</span>
      </div>
    </footer>
    </div>
  )
}
