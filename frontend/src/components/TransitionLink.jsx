import { Link } from 'react-router-dom'
import { useExitNavigate, isPlainClick } from '../hooks/useExitNavigate'

/** Link que reproduce la animación de salida de la ruta antes de navegar. */
export default function TransitionLink({ to, onClick, ...props }) {
  const exitNavigate = useExitNavigate()

  function handleClick(event) {
    onClick?.(event)
    if (!isPlainClick(event) || props.target) return
    event.preventDefault()
    exitNavigate(to)
  }

  return <Link to={to} onClick={handleClick} {...props} />
}
