/**
 * ProductCard.jsx
 * Desktop: hover sobre la tarjeta muestra la segunda imagen.
 * Mobile:  swipe táctil cambia entre imágenes.
 * Sin flechas visibles — interacción implícita.
 */
import { useNavigate } from 'react-router-dom'
import { useState, useRef, useCallback, useEffect } from 'react'
import { formatPrice } from '../api/catalog'
import { getProductBrandLabel } from '../utils/brand'

function HeartIcon({ filled }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

export default function ProductCard({ producto, isFavorite = false, onFavoriteClick }) {
  const navigate = useNavigate()
  const images = producto.imagenes?.length > 0 ? producto.imagenes : [producto.imagen]
  const hasMultiple = images.length > 1
  const carouselRef = useRef(null)
  const brandLabel = getProductBrandLabel(producto)
  const swatches = producto.variante_hex
    ? [{ hex: producto.variante_hex, label: producto.variante_color || 'Color' }]
    : []

  // displayIndex controla qué imagen se muestra
  // Desktop: hover → 1, blur → 0
  // Mobile:  swipe → incrementa / decrementa
  const [displayIndex, setDisplayIndex] = useState(0)
  const touchStartX = useRef(null)
  const isDragging = useRef(false)

  function handleClick() {
    if (!isDragging.current) {
      // Guardar scroll actual para restaurarlo al volver al catálogo
      sessionStorage.setItem('catalog-scroll', String(window.scrollY))
      navigate(`/producto/${producto.id}`)
    }
  }

  function handleFavorite(e) {
    e.stopPropagation()
    if (onFavoriteClick) onFavoriteClick(producto)
  }

  // ── Desktop hover ───────────────────────────────────────────────────────────
  const handleMouseEnter = useCallback(() => {
    if (hasMultiple) setDisplayIndex(1)
  }, [hasMultiple])

  const handleMouseLeave = useCallback(() => {
    setDisplayIndex(0)
  }, [])

  // ── Mobile swipe ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = carouselRef.current
    if (!el) return

    const handleTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX
      isDragging.current = false
    }

    const handleTouchMove = (e) => {
      if (touchStartX.current === null) return
      const diff = e.touches[0].clientX - touchStartX.current
      if (Math.abs(diff) > 8) {
        isDragging.current = true
        e.preventDefault()
      }
    }

    const handleTouchEnd = (e) => {
      if (touchStartX.current === null) return
      const diff = touchStartX.current - e.changedTouches[0].clientX
      if (Math.abs(diff) > 40 && hasMultiple) {
        if (diff > 0) {
          setDisplayIndex(i => Math.min(i + 1, images.length - 1))
        } else {
          setDisplayIndex(i => Math.max(i - 1, 0))
        }
      }
      touchStartX.current = null
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [hasMultiple, images.length])

  return (
    <article
      className="product-card"
      onClick={handleClick}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="link"
      tabIndex={0}
      aria-label={`Ver ${producto.nombre}`}
    >
      <div 
        ref={carouselRef}
        className={`product-card__img-wrap ${!producto.disponible ? 'sold-out' : ''}`}
      >
        {/* Carrusel */}
        <div className="product-card__carousel">
          {images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`${producto.nombre} ${i + 1}`}
              loading="lazy"
              className={`product-card__carousel-img ${i === displayIndex ? 'product-card__carousel-img--active' : ''}`}
              onError={e => { e.target.style.visibility = 'hidden' }}
            />
          ))}
        </div>

        {!producto.disponible && <div className="sold-out-overlay">Agotado</div>}
        {!producto.disponible && <span className="product-card__badge">Agotado</span>}

        {/* Dots — solo en mobile (si hay múltiples imágenes) */}
        {hasMultiple && (
          <div className="product-card__dots product-card__dots--mobile">
            {images.map((_, i) => (
              <span
                key={i}
                className={`product-card__dot ${i === displayIndex ? 'product-card__dot--active' : ''}`}
              />
            ))}
          </div>
        )}

        {/* Favorito */}
        {producto.disponible && (
          <button
            className={`product-card__fav ${isFavorite ? 'product-card__fav--active' : ''}`}
            onClick={handleFavorite}
            aria-label={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          >
            <HeartIcon filled={isFavorite} />
          </button>
        )}
      </div>

      <div className="product-card__info">
        <p className="product-card__name">{producto.nombre}</p>
        {brandLabel && (
          <p className="product-card__brand">{brandLabel}</p>
        )}
        {producto.disponible
          ? <p className="product-card__price">{formatPrice(producto.precio)}</p>
          : <p className="product-card__unavailable">No disponible</p>
        }
        {swatches.length > 0 && (
          <div className="product-card__swatches" aria-label="Colores disponibles">
            {swatches.map(swatch => (
              <span
                key={`${swatch.hex}-${swatch.label}`}
                className="product-card__swatch"
                style={{ '--swatch-color': swatch.hex }}
                title={swatch.label}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
