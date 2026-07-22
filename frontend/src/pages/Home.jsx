/**
 * Home.jsx — Banner de vídeo a pantalla completa
 * Desktop: vídeo 16:9, texto izquierda abajo, botón ver catálogo
 * Mobile:  vídeo 9:16 (object-position center), texto centrado una palabra por línea
 */
import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'

export default function Home() {
  const navigate = useNavigate()
  const [isFadingOut, setIsFadingOut] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const videoRef = useRef(null)

  // Fallback: si en 2.5s el vídeo no dispara canPlay, mostramos igualmente
  useEffect(() => {
    const timeout = setTimeout(() => setVideoReady(true), 2500)
    return () => clearTimeout(timeout)
  }, [])

  const handleCatalogClick = (e) => {
    e.preventDefault()
    setIsFadingOut(true)
    setTimeout(() => navigate('/catalogo'), 500)
  }

  return (
    <div className={`home-page ${isFadingOut ? 'home-page--fade' : ''}`}>
      {/* Banner: oculto hasta que el vídeo esté listo — todo aparece sincronizado */}
      <section className={`home-banner ${videoReady ? 'home-banner--ready' : ''}`}>
        <video
          ref={videoRef}
          className="home-banner__video"
          src="/another.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onCanPlay={() => setVideoReady(true)}
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
