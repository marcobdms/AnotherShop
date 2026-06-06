/**
 * Account.jsx — Página de cuenta del usuario
 * Ruta: /cuenta
 * Sin sesión → redirige a /login
 * Muestra las prendas marcadas como favoritas.
 */
import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFavorites } from '../hooks/useFavorites'
import { supabase } from '../lib/supabase'
import { fetchProducts, formatPrice } from '../api/catalog'
import Footer from '../components/Footer'

const css = `
  .account-page {
    max-width: var(--max-width);
    margin: 0 auto;
    padding: var(--gap-lg) var(--gap);
    animation: fadeIn 0.4s ease forwards;
  }

  .account-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 3rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .account-header__title {
    font-size: var(--size-xl);
    font-weight: 300;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .account-header__email {
    font-size: var(--size-xs);
    letter-spacing: 0.12em;
    color: var(--grey-400);
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
`

export default function Account() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { favorites, loading: favLoading } = useFavorites(user)
  const navigate = useNavigate()

  const [products, setProducts]   = useState([])
  const [prodsLoading, setProdsLoading] = useState(true)

  // Guard: sin sesión → /login
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true })
    }
  }, [user, authLoading, navigate])

  // Carga todos los productos para cruzar con los favoritos
  useEffect(() => {
    if (!user) return
    fetchProducts()
      .then(setProducts)
      .finally(() => setProdsLoading(false))
  }, [user])

  const handleSignOut = async () => {
    await signOut()
    navigate('/', { replace: true })
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
            <h1 className="account-header__title">Mi cuenta</h1>
            <p className="account-header__email">{user?.email}</p>
          </div>
          <button className="account-signout" onClick={handleSignOut}>
            Cerrar sesión
          </button>
        </div>

        <span className="account-section__label">
          Prendas guardadas ({favoriteProducts.length})
        </span>

        {favoriteProducts.length === 0 ? (
          <div className="account-empty">
            <p>Todavía no has guardado ninguna prenda.</p>
            <Link to="/catalogo">Explorar catálogo</Link>
          </div>
        ) : (
          <div className="product-grid">
            {favoriteProducts.map(p => (
              <article
                key={p.id}
                className="product-card"
                onClick={() => navigate(`/producto/${p.id}`)}
                onKeyDown={e => e.key === 'Enter' && navigate(`/producto/${p.id}`)}
                role="link"
                tabIndex={0}
                aria-label={`Ver ${p.nombre}`}
              >
                <div className={`product-card__img-wrap ${!p.disponible ? 'sold-out' : ''}`}>
                  <img
                    src={p.imagen}
                    alt={p.nombre}
                    loading="lazy"
                    onError={e => { e.target.style.visibility = 'hidden' }}
                  />
                  {!p.disponible && <div className="sold-out-overlay">Agotado</div>}
                </div>
                <div className="product-card__info">
                  <p className="product-card__name">{p.nombre}</p>
                  {p.disponible
                    ? <p className="product-card__price">{formatPrice(p.precio)}</p>
                    : <p className="product-card__unavailable">No disponible</p>
                  }
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
