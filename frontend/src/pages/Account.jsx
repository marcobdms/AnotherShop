/**
 * Account.jsx — panel de cuenta (/cuenta).
 *
 * Reune lo que el cliente necesita despues de comprar: pagar lo que tiene en
 * favoritos, buscar un pedido por su numero, y ver el estado de sus pedidos con
 * la misma vista de seguimiento que se ve al pagar. Con sesion se listan los
 * pedidos de la cuenta; sin sesion, los de este navegador.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFavorites } from '../hooks/useFavorites'
import { fetchMyOrders, fetchProducts, formatPrice } from '../api/catalog'
import { supabase } from '../lib/supabase'
import { readOrders } from '../utils/orders'
import ProductCard from '../components/ProductCard'
import PedidoSeguimiento, { estadoCorto } from '../components/PedidoSeguimiento'
import TransitionLink from '../components/TransitionLink'
import Footer from '../components/Footer'
import './Checkout.css'

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

  /* Acciones principales */
  .account-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 0 0 3rem;
  }

  .account-actions .btn {
    text-decoration: none;
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

  /* Pedidos: lista a la izquierda, seguimiento a la derecha */
  .account-orders {
    display: grid;
    gap: 2rem;
    margin-bottom: 4rem;
  }

  .account-orders__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
    align-content: start;
  }

  .account-order {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.2rem 1rem;
    width: 100%;
    padding: 0.9rem 1rem;
    border: 1px solid var(--grey-200);
    border-radius: 0.5rem;
    background: var(--white);
    color: var(--black);
    font-family: var(--font);
    text-align: left;
    cursor: pointer;
    transition: border-color 160ms ease, background 160ms ease;
  }

  .account-order:hover { border-color: var(--grey-400); }
  .account-order.is-active { border-color: var(--black); background: var(--grey-100); }

  .account-order__num { font-size: 0.8125rem; letter-spacing: 0.16em; }
  .account-order__total { font-size: 0.8125rem; text-align: right; }
  .account-order__meta { color: var(--grey-400); font-size: 0.6875rem; letter-spacing: 0.08em; text-transform: uppercase; }

  .account-orders__detail {
    min-width: 0;
    padding: 0.5rem 0 0;
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

  .account-empty--compact {
    min-height: 0;
    padding: 1.5rem 0 0.5rem;
    align-items: flex-start;
    text-align: left;
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

    .account-orders {
      grid-template-columns: 20rem minmax(0, 1fr);
      gap: 3rem;
    }

    .account-order { border-radius: 0; }
  }
`

function fechaCorta(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function Account() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { favorites, loading: favLoading, isFavorite, toggleFavorite } = useFavorites(user)
  const navigate = useNavigate()

  const [products, setProducts] = useState([])
  const [prodsLoading, setProdsLoading] = useState(true)
  const [pedidosApi, setPedidosApi] = useState([])
  const [seleccionado, setSeleccionado] = useState('')

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .finally(() => setProdsLoading(false))
  }, [])

  // Pedidos de la cuenta (el servidor comprueba la sesion con el token)
  useEffect(() => {
    if (!user) {
      setPedidosApi([])
      return
    }
    let cancelado = false
    supabase.auth.getSession()
      .then(({ data }) => fetchMyOrders(data?.session?.access_token || ''))
      .then(lista => { if (!cancelado) setPedidosApi(lista) })
      .catch(() => { if (!cancelado) setPedidosApi([]) })
    return () => { cancelado = true }
  }, [user])

  // Con sesion: los de la cuenta + los de este navegador que aun no esten en ella.
  const pedidos = useMemo(() => {
    const delServidor = new Set(pedidosApi.map(p => p.numero))
    const locales = readOrders()
      .filter(o => !delServidor.has(o.numero))
      .map(o => ({ numero: o.numero, creado_en: new Date(o.at).toISOString(), local: true }))
    return [...pedidosApi, ...locales]
  }, [pedidosApi])

  const activo = seleccionado || pedidos[0]?.numero || ''

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
  // "Agotado" solo lo marca el interruptor manual del catalogo
  const pagables = favoriteProducts.filter(p => p.disponible !== false).length

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

        <div className="account-actions">
          {pagables > 0 && (
            <TransitionLink className="btn btn--solid" to="/resumen">
              Pagar ahora ({pagables})
            </TransitionLink>
          )}
          <TransitionLink className="btn btn--ghost" to="/seguimiento">
            Seguir mi pedido
          </TransitionLink>
        </div>

        <span className="account-section__label">
          Mis pedidos ({pedidos.length})
        </span>

        {pedidos.length === 0 ? (
          <div className="account-empty account-empty--compact">
            <p>Todavia no tienes pedidos.</p>
          </div>
        ) : (
          <div className="account-orders">
            <ul className="account-orders__list">
              {pedidos.map(p => (
                <li key={p.numero}>
                  <button
                    className={`account-order${activo === p.numero ? ' is-active' : ''}`}
                    onClick={() => setSeleccionado(p.numero)}
                    type="button"
                  >
                    <span className="account-order__num">{p.numero}</span>
                    <span className="account-order__total">
                      {p.total !== undefined ? formatPrice(p.total) : ''}
                    </span>
                    <span className="account-order__meta">
                      {p.estado ? estadoCorto(p) : 'Ver estado'}
                    </span>
                    <span className="account-order__meta" style={{ textAlign: 'right' }}>
                      {fechaCorta(p.creado_en)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="account-orders__detail">
              {/* key => al cambiar de pedido se vuelve a montar (y a animar) */}
              <PedidoSeguimiento key={activo} numero={activo} />
            </div>
          </div>
        )}

        <span className="account-section__label">
          Prendas guardadas ({favoriteProducts.length})
        </span>

        {favoriteProducts.length === 0 ? (
          <div className="account-empty">
            <p>Todavia no has guardado ninguna prenda.</p>
            <TransitionLink to="/catalogo">Explorar catalogo</TransitionLink>
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
