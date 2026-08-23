import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFavorites } from '../hooks/useFavorites'
import { fetchProducts } from '../api/catalog'
import ProductCard from '../components/ProductCard'
import Footer from '../components/Footer'

const css = `
  .account-page {
    max-width: min(100%, 86rem);
    margin: 0 auto;
    padding: clamp(2rem, 5vw, 4rem) clamp(1.25rem, 4vw, 3rem);
    animation: fadeIn 0.4s ease forwards;
  }

  .account-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2.4rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .account-header__title {
    margin: 0;
    font-size: clamp(2rem, 5vw, 3.2rem);
    font-weight: 300;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .account-header__email {
    margin: 0.6rem 0 0;
    font-size: var(--size-xs);
    letter-spacing: 0.12em;
    color: var(--grey-400);
    text-transform: uppercase;
  }

  .account-notice {
    max-width: 44rem;
    margin: -1rem 0 2.6rem;
    padding: 1rem 1.1rem;
    border: 1px solid rgba(34, 34, 34, 0.12);
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.72);
    color: var(--grey-600);
    font-size: 0.78rem;
    line-height: 1.65;
    letter-spacing: 0.07em;
  }

  .account-section__label {
    font-size: var(--size-xs);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--grey-400);
    margin-bottom: 2rem;
    display: block;
    border-bottom: 1px solid var(--grey-200);
    padding-bottom: 0.75rem;
  }

  .account-empty {
    min-height: 30vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.25rem;
    color: var(--grey-400);
    font-size: var(--size-sm);
    letter-spacing: 0.1em;
    text-align: center;
  }

  .account-empty a {
    font-size: var(--size-xs);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    border-bottom: 1px solid var(--grey-400);
    padding-bottom: 2px;
    color: var(--grey-600);
    transition: color 200ms ease, border-color 200ms ease;
  }
  .account-empty a:hover { color: var(--black); border-color: var(--black); }

  .account-signout {
    font-size: var(--size-xs);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--grey-400);
    border-bottom: 1px solid transparent;
    padding-bottom: 1px;
    transition: color 200ms ease, border-color 200ms ease;
    background: none;
    font-family: var(--font);
  }
  .account-signout:hover { color: var(--black); border-color: var(--black); }

  .account-page .product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (min-width: 64rem) {
    .account-page .product-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
`

export default function Account() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { favorites, loading: favLoading, isFavorite, toggleFavorite } = useFavorites(user)
  const navigate = useNavigate()

  const [products, setProducts] = useState([])
  const [prodsLoading, setProdsLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .finally(() => setProdsLoading(false))
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/', { replace: true })
  }

  const handleFavoriteClick = async (producto) => {
    await toggleFavorite(producto.id)
  }

  if (authLoading || prodsLoading || favLoading) {
    return <div className="page-state" />
  }

  const favoriteProducts = products.filter(p => favorites.has(p.id))

  return (
    <>
      <style>{css}</style>
      <main className="account-page">
        <div className="account-header">
          <div>
            <h1 className="account-header__title">
              {user ? 'Mi cuenta' : 'Favoritos'}
            </h1>
            <p className="account-header__email">
              {user?.email || 'Guardados en este navegador'}
            </p>
          </div>
          {user && (
            <button className="account-signout" onClick={handleSignOut}>
              Cerrar sesion
            </button>
          )}
        </div>

        {!user && (
          <p className="account-notice">
            Tus favoritos se mantienen al cerrar la pestana en este dispositivo.
            Pueden perderse si borras los datos del navegador, usas incognito o cambias de dispositivo.
          </p>
        )}

        <span className="account-section__label">
          Prendas guardadas ({favoriteProducts.length})
        </span>

        {favoriteProducts.length === 0 ? (
          <div className="account-empty">
            <p>Todavia no has guardado ninguna prenda.</p>
            <Link to="/catalogo">Explorar catalogo</Link>
          </div>
        ) : (
          <div className="product-grid">
            {favoriteProducts.map(p => (
              <ProductCard
                key={p.variante_color ? `${p.id}-${p.variante_color}` : p.id}
                producto={p}
                isFavorite={isFavorite(p.id)}
                onFavoriteClick={handleFavoriteClick}
              />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
