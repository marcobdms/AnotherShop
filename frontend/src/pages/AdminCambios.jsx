import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { adminFetchHistory } from '../api/catalog'

const css = `
  .adm-cambios {
    min-height: 100vh;
    background: var(--white);
    font-family: var(--font);
    padding-bottom: 4rem;
  }
  .adm-cambios__header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--white);
    border-bottom: 1px solid var(--grey-200);
    padding: 1.25rem var(--gap);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .adm-cambios__brand {
    font-size: var(--size-xs);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    font-weight: 500;
    text-decoration: none;
    color: var(--black);
  }
  .adm-cambios__container {
    max-width: 800px;
    margin: 3rem auto;
    padding: 0 var(--gap);
  }
  .adm-cambios__title {
    font-size: var(--size-md);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 300;
    margin-bottom: 2rem;
    color: var(--black);
  }
  .adm-cambios__list {
    list-style: none;
    padding: 0;
    margin: 0;
    border: 1px solid var(--grey-200);
    border-radius: 4px;
  }
  .adm-cambios__item {
    padding: 1.5rem;
    border-bottom: 1px solid var(--grey-200);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .adm-cambios__item:last-child {
    border-bottom: none;
  }
  .adm-cambios__info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .adm-cambios__user {
    font-weight: 600;
    text-transform: capitalize;
    color: var(--black);
    font-size: var(--size-sm);
  }
  .adm-cambios__date {
    font-size: 0.85rem;
    color: var(--grey-400);
  }
  .adm-cambios__text {
    font-size: var(--size-sm);
    color: var(--grey-600);
    line-height: 1.5;
  }
  .adm-cambios__empty {
    text-align: center;
    padding: 4rem 1rem;
    color: var(--grey-400);
    font-size: var(--size-sm);
    border: 1px solid var(--grey-200);
    border-radius: 4px;
  }
`

export default function AdminCambios() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const authedUser = sessionStorage.getItem('admin_auth_user')

  useEffect(() => {
    if (!authedUser) return

    adminFetchHistory()
      .then(data => {
        setHistory(data)
        setError(null)
      })
      .catch(e => {
        setError(e.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [authedUser])

  if (!authedUser) {
    return <Navigate to="/admin" replace />
  }

  return (
    <div className="adm-cambios">
      <style>{css}</style>
      
      <header className="adm-cambios__header">
        <Link to="/admin" className="adm-cambios__brand">← Volver al Panel</Link>
      </header>

      <main className="adm-cambios__container">
        <h1 className="adm-cambios__title">Historial Completo de Cambios</h1>
        
        {loading ? (
          <div className="adm-cambios__empty">Cargando historial...</div>
        ) : error ? (
          <div className="adm-cambios__empty" style={{ color: '#c0392b' }}>
            Error al cargar el historial: {error}
          </div>
        ) : history.length === 0 ? (
          <div className="adm-cambios__empty">No hay registro de cambios en el sistema.</div>
        ) : (
          <ul className="adm-cambios__list">
            {history.map(h => {
              const dateObj = new Date(h.fecha_hora)
              const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
              return (
                <li key={h.id} className="adm-cambios__item">
                  <div className="adm-cambios__info">
                    <span className="adm-cambios__text">
                      <span className="adm-cambios__user">{h.usuario}</span>: {h.mensaje}
                    </span>
                    <span className="adm-cambios__date">{dateStr}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
