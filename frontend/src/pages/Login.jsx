/**
 * Login.jsx — Página de login / registro de clientes
 * Ruta: /login
 * Si ya hay sesión activa → redirige a /cuenta
 */
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// Estilos inline específicos de esta página
const css = `
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--gap);
    background: var(--white);
  }

  .login-card {
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .login-card__header {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .login-card__brand {
    font-size: var(--size-xs);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    font-weight: 500;
    color: var(--black);
  }

  .login-card__title {
    font-size: var(--size-sm);
    color: var(--grey-400);
    letter-spacing: 0.08em;
    font-weight: 300;
  }

  .login-card__divider {
    height: 1px;
    background: var(--grey-200);
  }

  .login-card__fields {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .login-card__input {
    width: 100%;
    border: 1px solid var(--grey-200);
    padding: 0.85rem 1rem;
    font-family: var(--font);
    font-size: var(--size-sm);
    color: var(--black);
    background: var(--white);
    outline: none;
    transition: border-color 200ms ease;
    letter-spacing: 0.03em;
  }
  .login-card__input:focus { border-color: var(--black); }
  .login-card__input::placeholder { color: var(--grey-400); }

  .login-card__btn {
    width: 100%;
    background: var(--black);
    color: var(--white);
    border: none;
    padding: 0.9rem 1rem;
    font-family: var(--font);
    font-size: var(--size-xs);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    cursor: pointer;
    transition: opacity 200ms ease;
  }
  .login-card__btn:hover:not(:disabled) { opacity: 0.75; }
  .login-card__btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .login-card__error {
    font-size: var(--size-xs);
    color: #c0392b;
    letter-spacing: 0.06em;
    text-align: center;
    line-height: 1.5;
  }

  .login-card__success {
    font-size: var(--size-xs);
    color: #16a34a;
    letter-spacing: 0.06em;
    text-align: center;
    line-height: 1.5;
    padding: 0.75rem;
    border: 1px solid #bbf7d0;
    background: #f0fdf4;
  }

  .login-card__toggle {
    font-size: var(--size-xs);
    letter-spacing: 0.1em;
    color: var(--grey-400);
    text-align: center;
  }

  .login-card__toggle button {
    color: var(--black);
    border-bottom: 1px solid var(--black);
    padding-bottom: 1px;
    font-family: var(--font);
    font-size: var(--size-xs);
    letter-spacing: 0.1em;
    cursor: pointer;
    background: none;
    border-top: none;
    border-left: none;
    border-right: none;
    margin-left: 0.3rem;
  }

  .login-card__back {
    font-size: var(--size-xs);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--grey-400);
    text-align: center;
    transition: color 200ms ease;
    display: block;
  }
  .login-card__back:hover { color: var(--black); }
`

export default function Login() {
  const { user, signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode]       = useState('login')   // 'login' | 'register'
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  // Si ya hay sesión, redirige
  useEffect(() => {
    if (user) navigate('/cuenta', { replace: true })
  }, [user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'login') {
        await signIn(email, password)
        // onAuthStateChange se encarga del redirect vía useEffect
      } else {
        await signUp(email, password)
        setSuccess(
          'Te hemos enviado un email de confirmación. ' +
          'Revisa tu bandeja de entrada y haz click en el enlace para activar tu cuenta.'
        )
        setEmail('')
        setPassword('')
      }
    } catch (err) {
      // Traducir los mensajes más comunes de Supabase al español
      const msg = err.message ?? ''
      if (msg.includes('Invalid login credentials')) {
        setError('Email o contraseña incorrectos.')
      } else if (msg.includes('Email not confirmed')) {
        setError('Confirma tu email antes de iniciar sesión. Revisa tu bandeja de entrada.')
      } else if (msg.includes('User already registered')) {
        setError('Este email ya está registrado. Prueba a iniciar sesión.')
      } else if (msg.includes('Password should be')) {
        setError('La contraseña debe tener al menos 6 caracteres.')
      } else {
        setError(msg || 'Algo ha ido mal. Inténtalo de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setMode(m => m === 'login' ? 'register' : 'login')
    setError('')
    setSuccess('')
  }

  return (
    <div className="login-page">
      <style>{css}</style>
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-card__header">
          <p className="login-card__brand">Another NPC Shop</p>
          <p className="login-card__title">
            {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </p>
        </div>

        <div className="login-card__divider" />

        {success ? (
          <p className="login-card__success">{success}</p>
        ) : (
          <>
            <div className="login-card__fields">
              <input
                className="login-card__input"
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                required
                autoFocus
              />
              <input
                className="login-card__input"
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                required
                minLength={6}
              />
            </div>

            {error && <p className="login-card__error">{error}</p>}

            <button
              className="login-card__btn"
              type="submit"
              disabled={loading || !email || !password}
            >
              {loading
                ? '...'
                : mode === 'login' ? 'Entrar' : 'Crear cuenta'
              }
            </button>
          </>
        )}

        <p className="login-card__toggle">
          {mode === 'login'
            ? <>¿No tienes cuenta?<button type="button" onClick={toggleMode}>Regístrate</button></>
            : <>¿Ya tienes cuenta?<button type="button" onClick={toggleMode}>Inicia sesión</button></>
          }
        </p>

        <Link to="/catalogo" className="login-card__back">← Volver al catálogo</Link>
      </form>
    </div>
  )
}
