/**
 * ProductCard.jsx
 * Props: producto, user (Supabase user | null), isFavorite (bool), onFavoriteClick (fn)
 * El corazón solo aparece en prendas disponibles.
 * Sin sesión: onFavoriteClick redirige a /login (lo gestiona el padre).
 */
import { useNavigate } from 'react-router-dom'
import { formatPrice } from '../api/catalog'

function HeartIcon({ filled }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

export default function ProductCard({ producto, isFavorite = false, onFavoriteClick }) {
  const navigate = useNavigate()

  function handleClick() {
    navigate(`/producto/${producto.id}`)
  }

  function handleFavorite(e) {
    e.stopPropagation()  // no navegar al producto
    if (onFavoriteClick) onFavoriteClick(producto)
  }

  return (
    <article
      className="product-card"
      onClick={handleClick}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
      role="link"
      tabIndex={0}
      aria-label={`Ver ${producto.nombre}`}
    >
      <div className={`product-card__img-wrap ${!producto.disponible ? 'sold-out' : ''}`}>
        <img
          src={producto.imagen}
          alt={producto.nombre}
          loading="lazy"
          onError={e => { e.target.style.visibility = 'hidden' }}
        />
        {!producto.disponible && <div className="sold-out-overlay">Agotado</div>}

        {/* Botón de favorito — solo si el producto está disponible */}
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
        {producto.disponible
          ? <p className="product-card__price">{formatPrice(producto.precio)}</p>
          : <p className="product-card__unavailable">No disponible</p>
        }
      </div>
    </article>
  )
}
