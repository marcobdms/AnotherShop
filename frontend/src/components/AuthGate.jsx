/**
 * AuthGate.jsx — "¿Con tu cuenta o como invitado?"
 *
 * Se muestra como un dialogo antes de pedir los datos de contacto. Vive en
 * su propio componente porque la pagina que lo dispara (Contacto.jsx) es la
 * unica que lo usa, pero como dialogo generico conviene tenerlo aparte.
 */
import '../pages/Checkout.css'

export default function AuthGate({ onInvitado, onCuenta }) {
  return (
    <div className="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <div className="gate__backdrop" />
      <div className="gate__panel">
        <h2 className="gate__title" id="gate-title">Antes de seguir</h2>
        <p className="gate__text">
          Con tu cuenta guardamos el pedido y tus prendas guardadas en cualquier dispositivo.
          Como invitado solo te pedimos como avisarte.
        </p>
        <div className="gate__actions">
          <button className="btn btn--solid" onClick={onCuenta} type="button">
            Entrar con mi cuenta
          </button>
          <button className="btn btn--ghost" onClick={onInvitado} type="button">
            Seguir como invitado
          </button>
        </div>
      </div>
    </div>
  )
}
