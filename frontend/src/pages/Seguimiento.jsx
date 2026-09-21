/** Seguimiento.jsx — buscar un pedido por su numero. */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { normalizeOrderNumber, readOrders } from '../utils/orders'
import Footer from '../components/Footer'
import TransitionLink from '../components/TransitionLink'
import './Checkout.css'

export default function Seguimiento() {
  const navigate = useNavigate()
  const [valor, setValor] = useState('')
  const recientes = useMemo(readOrders, [])
  const numero = normalizeOrderNumber(valor)

  function buscar(event) {
    event.preventDefault()
    if (numero.length > 5) navigate(`/pedido/${numero}`)
  }

  return (
    <>
      <main className="checkout-page checkout-page--narrow">
        <h1 className="checkout-title">Seguir mi pedido</h1>
        <p className="checkout-sub">
          Escribe el numero de seguimiento que recibiste al hacer el pedido.
        </p>

        <form className="track-search" onSubmit={buscar}>
          <label className="field field--block">
            <span>Numero de pedido</span>
            <input
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder="ANPC-XXXXXX"
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
            />
          </label>
          <button className="btn btn--solid btn--block" disabled={numero.length <= 5} type="submit">
            Ver estado
          </button>
        </form>

        {recientes.length > 0 && (
          <section className="track-recent">
            <h2 className="checkout-recos__title">Tus pedidos en este dispositivo</h2>
            <ul className="track-recent__list">
              {recientes.map(o => (
                <li key={o.numero}>
                  <TransitionLink to={`/pedido/${o.numero}`}>
                    <span>{o.numero}</span>
                    <span>{new Date(o.at).toLocaleDateString('es-ES')}</span>
                  </TransitionLink>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </>
  )
}
