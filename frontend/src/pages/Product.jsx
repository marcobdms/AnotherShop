/**
 * Product.jsx — Página de detalle de producto
 *
 * Consume:
 *   GET /api/products/{id}  → { id, nombre, precio, imagen, descripcion, tallas, genero, disponible }
 *   GET /api/meta           → { marca, whatsapp, paypal, recargo_paypal, ... }
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { fetchProduct, fetchMeta, formatPrice, buildWhatsAppLink, buildPayPalLink } from '../api/catalog'
import { useAuth } from '../hooks/useAuth'
import { useFavorites } from '../hooks/useFavorites'
import Footer from '../components/Footer'

function HeartIcon({ filled }) {
  return (
    <svg
      width="22" height="22" viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

// Pequeño toast de favorito
function FavToast({ msg, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="fav-toast">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {msg}
    </div>
  )
}

export default function Product() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [producto, setProducto]   = useState(null)
  const [meta,     setMeta]       = useState(null)
  const [loading,  setLoading]    = useState(true)
  const [error,    setError]      = useState(null)
  const [selectedSize, setSelectedSize] = useState(null)
  const [favToast, setFavToast]   = useState(null) // { msg, key }

  const { user } = useAuth()
  const { isFavorite, toggleFavorite } = useFavorites(user)

  useEffect(() => {
    Promise.all([fetchProduct(id), fetchMeta()])
      .then(([prod, met]) => {
        setProducto(prod)
        setMeta(met)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    setSelectedSize(null)
  }, [producto])

  const showFavToast = useCallback((msg) => {
    setFavToast({ msg, key: Date.now() })
  }, [])

  const handleFavoriteClick = async () => {
    if (!user) {
      navigate('/login')
      return
    }
    const wasAdded = await toggleFavorite(producto.id)
    showFavToast(wasAdded !== false ? 'Añadido a favoritos' : 'Eliminado de favoritos')
  }

  if (loading) return <div className="page-state"></div>

  if (error || !producto) {
    return (
      <>
        <main style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--grey-400)', letterSpacing: '.1em', fontSize: '.8rem' }}>
            Producto no encontrado.
          </p>
          <Link to="/catalogo" className="product-page__back" style={{ marginTop: '2rem', display: 'inline-block' }}>
            ← Volver al catálogo
          </Link>
        </main>
      </>
    )
  }

  const favActive = isFavorite(producto.id)

  const hasVariantes = producto.variantes && producto.variantes.length > 0
  const [selectedColor, setSelectedColor] = useState(null)

  // Auto-select first color with stock when variants load
  useEffect(() => {
    if (hasVariantes) {
      const firstWithStock = producto.variantes.find(v =>
        Object.values(v.tallas || {}).some(s => s > 0)
      )
      setSelectedColor(firstWithStock?.color || producto.variantes[0]?.color || null)
    }
  }, [producto, hasVariantes])

  const selectedVariante = hasVariantes
    ? producto.variantes.find(v => v.color === selectedColor) || null
    : null

  return (
    <>
      <main className="product-page">
        {/* Imagen */}
        <div className={`product-page__img-wrap ${!producto.disponible ? 'sold-out' : ''}`}>
          <img
            src={producto.imagen}
            alt={producto.nombre}
            onError={e => { e.target.style.visibility = 'hidden' }}
          />
          {!producto.disponible && <div className="sold-out-overlay">Agotado</div>}
        </div>

        {/* Info */}
        <div className="product-page__info">
          <Link to="/catalogo" className="product-page__back">← Catálogo</Link>

          <h1 className="product-page__name">{producto.nombre}</h1>

          {/* Precio + corazón */}
          <div className="product-page__price-row">
            <p className="product-page__price">{formatPrice(producto.precio)}</p>
            {producto.disponible && (
              <button
                className={`product-page__fav ${favActive ? 'product-page__fav--active' : ''}`}
                onClick={handleFavoriteClick}
                aria-label={favActive ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              >
                <HeartIcon filled={favActive} />
              </button>
            )}
          </div>

          <p className="product-page__description">{producto.descripcion}</p>

          {/* Colores — solo si hay variantes */}
          {hasVariantes && (
            <div className="product-page__colors">
              <span className="product-page__sizes-label">Color</span>
              <div className="product-page__colors-row">
                {producto.variantes.map(v => {
                  const colorStock = Object.values(v.tallas || {}).reduce((a, b) => a + b, 0)
                  const isSelected = v.color === selectedColor
                  return (
                    <button
                      key={v.color}
                      className={`color-dot ${isSelected ? 'color-dot--selected' : ''} ${colorStock === 0 ? 'color-dot--empty' : ''}`}
                      style={{ '--dot-color': v.hex }}
                      onClick={() => setSelectedColor(v.color)}
                      title={`${v.color}${colorStock === 0 ? ' (sin stock)' : ''}`}
                      aria-label={v.color}
                    >
                      <span className="color-dot__inner" />
                      {colorStock === 0 && <span className="color-dot__x">✕</span>}
                    </button>
                  )
                })}
              </div>
              {selectedColor && (
                <span className="product-page__color-name">{selectedColor}</span>
              )}
            </div>
          )}

          {/* Tallas */}
          <div className="product-page__sizes">
            <span className="product-page__sizes-label">Tallas disponibles</span>
            <div className="product-page__sizes-row">
              {hasVariantes && selectedVariante ? (
                // Modo inventario: tallas con stock real
                ['XS', 'S', 'M', 'L', 'XL'].map(t => {
                  const stock = selectedVariante.tallas?.[t] ?? 0
                  const isAvailable = stock > 0
                  const isSelected = selectedSize === t
                  return (
                    <button
                      key={t}
                      disabled={!isAvailable}
                      onClick={() => isAvailable && setSelectedSize(t)}
                      className={`size-tag ${isAvailable ? 'size-tag--available' : 'size-tag--unavailable'} ${isSelected ? 'size-tag--selected' : ''}`}
                      title={isAvailable ? `${stock} uds.` : 'Sin stock'}
                    >
                      {t}
                    </button>
                  )
                })
              ) : (
                // Modo legacy: sin inventario, usar descripcion
                producto.tallas.map(t => {
                  const availableSizesText = (producto.descripcion || '').toUpperCase()
                  const isAvailable = new RegExp(`\\b${t}\\b`, 'i').test(availableSizesText)
                  const isSelected = selectedSize === t
                  return (
                    <button
                      key={t}
                      disabled={!isAvailable}
                      onClick={() => isAvailable && setSelectedSize(t)}
                      className={`size-tag ${isAvailable ? 'size-tag--available' : 'size-tag--unavailable'} ${isSelected ? 'size-tag--selected' : ''}`}
                    >
                      {t}
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Acciones */}
          {meta && (
            producto.disponible ? (
              <div className="product-page__actions">
                <a
                  href={buildWhatsAppLink(meta, producto, selectedSize)}
                  target="_blank" rel="noopener noreferrer"
                  className="btn-whatsapp"
                >
                  Preguntar por WhatsApp
                </a>
                <a
                  href={buildPayPalLink(meta, producto)}
                  target="_blank" rel="noopener noreferrer"
                  className="btn-paypal"
                >
                  Pagar con PayPal
                </a>
                <p className="paypal-notice">{meta.recargo_paypal}</p>
              </div>
            ) : (
              <p className="product-page__unavailable">No disponible</p>
            )
          )}
        </div>
      </main>

      {/* Toast de favorito */}
      {favToast && (
        <FavToast
          key={favToast.key}
          msg={favToast.msg}
          onDone={() => setFavToast(null)}
        />
      )}

      <Footer marca={meta?.marca ?? 'ANOTHER NPC SHOP'} />
    </>
  )
}
