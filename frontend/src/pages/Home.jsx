/**
 * Home.jsx — Banner de vídeo a pantalla completa
 * Desktop: vídeo 16:9, texto izquierda abajo, botón ver catálogo
 * Mobile:  vídeo 9:16 (object-position center), texto centrado una palabra por línea
 */
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

export default function Home() {
  const navigate = useNavigate()
  const [isFadingOut, setIsFadingOut] = useState(false)

  const handleCatalogClick = (e) => {
    e.preventDefault()
    setIsFadingOut(true)
    setTimeout(() => navigate('/catalogo'), 500)
  }

  return (
    <div className={`home-page ${isFadingOut ? 'home-page--fade' : ''}`}>
      <section className="home-banner">
        {/* Vídeo de fondo */}
        <video
          className="home-banner__video"
          src="/another.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />

        {/* Overlay oscuro sutil */}
        <div className="home-banner__overlay" />

        {/* Contenido sobre el vídeo */}
        <div className="home-banner__content">
          {/* Desktop: una línea / Mobile: una palabra por línea */}
          <h1 className="home-banner__title">
            <span className="home-banner__word">ANOTHER</span>
            <span className="home-banner__word">NPC</span>
            <span className="home-banner__word">SHOP</span>
          </h1>

          <a
            href="/catalogo"
            className="home-banner__cta"
            onClick={handleCatalogClick}
          >
            VER CATÁLOGO
          </a>
        </div>
      </section>
    </div>
  )
}
