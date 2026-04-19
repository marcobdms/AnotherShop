/**
 * ProductCard.jsx
 * ─────────────────────────────────────────────────────────────
 * LISTO PARA STITCH: este es EL componente principal a reemplazar.
 * Recibe un producto del catálogo y un callback onClick.
 * No sabe nada de routing ni de fetch — solo renderiza.
 * ─────────────────────────────────────────────────────────────
 */
import { useNavigate } from 'react-router-dom'
import { formatPrice } from '../api/catalog'

export default function ProductCard({ producto }) {
  const navigate = useNavigate()

  function handleClick() {
    navigate(`/producto/${producto.id}`)
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
