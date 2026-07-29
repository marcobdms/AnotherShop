import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from './lib/supabase'

const SESSION_KEY = 'admin_auth_user'

export function useCrmSession() {
  const [usuario, setUsuario] = useState(() => sessionStorage.getItem(SESSION_KEY))

  function login(username) {
    sessionStorage.setItem(SESSION_KEY, username)
    setUsuario(username)
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY)
    setUsuario(null)
  }

  return { usuario, login, logout }
}

export function CrmLogin({ onAuth }) {
  const [pwd, setPwd] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const adminToken = import.meta.env.VITE_ADMIN_TOKEN || ''

  async function handleSubmit() {
    if (!pwd) return
    setLoading(true)
    setError('')
    try {
      if (adminToken) {
        if (pwd !== adminToken) {
          setError('Contrasena incorrecta')
          setPwd('')
          return
        }
        onAuth('admin')
        return
      }
      if (!hasSupabaseConfig) {
        setError('Falta configurar VITE_ADMIN_TOKEN')
        return
      }
      const { data, error: sbError } = await supabase
        .from('admin_users')
        .select('username')
        .eq('password', pwd)
        .maybeSingle()
      if (sbError) throw new Error(sbError.message)
      if (!data?.username) {
        setError('Contrasena incorrecta')
        setPwd('')
        return
      }
      onAuth(data.username)
    } catch (_) {
      setError('Error de conexion. Intentalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="crm-page crm-login">
      <div className="crm-login__form">
        <p className="crm-brand">Another NPC Shop CRM</p>
        <input
          className="crm-input"
          type="password"
          placeholder="Contrasena admin"
          value={pwd}
          onChange={event => {
            setPwd(event.target.value)
            setError('')
          }}
          onKeyDown={event => event.key === 'Enter' && handleSubmit()}
          autoFocus
        />
        <button
          className="crm-btn crm-btn--primary"
          onClick={handleSubmit}
          disabled={!pwd || loading}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
        {error && <p className="crm-debt bad">{error}</p>}
      </div>
    </div>
  )
}

export function CrmHeader({ usuario, onLogout, extra }) {
  return (
    <header className="crm-header">
      <span className="crm-brand">Another NPC Shop CRM</span>
      <nav className="crm-nav" aria-label="Navegacion CRM">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `crm-nav-link${isActive ? ' active' : ''}`}
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/clientes"
          className={({ isActive }) => `crm-nav-link${isActive ? ' active' : ''}`}
        >
          Clientes
        </NavLink>
        {extra && extra}
        <span className="crm-nav-user">{usuario}</span>
        <button className="crm-btn" onClick={onLogout}>Salir</button>
      </nav>
    </header>
  )
}
