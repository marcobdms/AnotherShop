/**
 * Product.jsx — Página de detalle de producto
 *
 * Consume:
 *   GET /api/products/{id}  → { id, nombre, precio, imagen, descripcion, tallas, genero, disponible }
 *   GET /api/meta           → { marca, whatsapp, paypal, recargo_paypal, ... }
 */
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchProduct, fetchMeta, formatPrice, buildWhatsAppLink, buildPayPalLink } from '../api/catalog'
import Footer from '../components/Footer'

export default function Product() {
  const { id } = useParams()

  const [producto, setProducto] = useState(null)
  const [meta,     setMeta]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  
  const [selectedSize, setSelectedSize] = useState(null)

  useEffect(() => {
    // Producto y meta en paralelo
    Promise.all([fetchProduct(id), fetchMeta()])
      .then(([prod, met]) => {
        setProducto(prod)
        setMeta(met)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])  // re-fetch si cambia el id (navegación entre productos)

  // Deseleccionar al cambiar producto
  useEffect(() => {
    setSelectedSize(null)
  }, [producto])

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
          <p className="product-page__price">{formatPrice(producto.precio)}</p>
          <p className="product-page__description">{producto.descripcion}</p>

          {/* Tallas */}
          <div className="product-page__sizes">
            <span className="product-page__sizes-label">Tallas disponibles</span>
            <div className="product-page__sizes-row">
              {producto.tallas.map(t => {
                const availableSizesText = (producto.descripcion || '').toUpperCase();
                const isAvailable = new RegExp(`\\b${t}\\b`, 'i').test(availableSizesText);
                const isSelected = selectedSize === t;
                
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
              })}
            </div>
          </div>

          {/* Acciones — solo si hay meta cargado */}
          {meta && (
            producto.disponible ? (
              <div className="product-page__actions">
                <a
                  href={buildWhatsAppLink(meta, producto, selectedSize)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp"
                >
                  Preguntar por WhatsApp
                </a>
                <a
                  href={buildPayPalLink(meta, producto)}
                  target="_blank"
                  rel="noopener noreferrer"
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
      <Footer marca={meta?.marca ?? 'ANOTHER NPC SHOP'} />
    </>
  )
}
