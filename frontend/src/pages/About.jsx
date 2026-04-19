/**
 * About.jsx — Página "Sobre nosotros"
 */
import { useCatalog } from '../hooks/useCatalog'
import Footer from '../components/Footer'

export default function About() {
  const { catalog } = useCatalog()
  const marca = catalog?.meta?.marca ?? 'ANOTHER NPC SHOP'

  return (
    <>
      <main className="about-page">
        <h1>Sobre la tienda</h1>
        <p>
          Somos Another NPC Shop.
        </p>
        <p>
          No tenemos historia de origen inspiradora. No había una necesidad insatisfecha.
          No empezamos en un garaje con un sueño.
        </p>
        <p>
          Hacemos ropa. La ropa existe. Tú puedes comprarla si quieres.
        </p>
        <p>
          Sin estilo de vida. Sin valores aspiracionales. Sin comunidad con la que identificarte.
          Solo prendas con un precio.
        </p>
        <p>
          Puedes contactar por WhatsApp desde cualquier ficha de producto.
        </p>
      </main>
      <Footer marca={marca} />
    </>
  )
}
