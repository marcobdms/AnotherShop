/** Pedido.jsx — pagina de seguimiento de un pedido (/pedido/:numero). */
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import PedidoSeguimiento from '../components/PedidoSeguimiento'
import Footer from '../components/Footer'
import './Checkout.css'

export default function Pedido() {
  const { numero } = useParams()

  // El numero de pedido es la llave de consulta: que los buscadores no lo indexen.
  useEffect(() => {
    const tag = document.createElement('meta')
    tag.name = 'robots'
    tag.content = 'noindex, nofollow'
    document.head.appendChild(tag)
    return () => tag.remove()
  }, [])

  return (
    <>
      <main className="checkout-page checkout-page--narrow">
        <PedidoSeguimiento numero={numero} />
      </main>
      <Footer />
    </>
  )
}
