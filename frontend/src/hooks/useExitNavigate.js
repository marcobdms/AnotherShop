/**
 * useExitNavigate — navegación con animación de salida.
 *
 * AppLayout provee `exitNavigate`: marca la ruta como "saliendo" (CSS hace el
 * fade-out inverso al de entrada) y navega al terminar. Solo en escritorio;
 * en móvil o con reduced-motion navega al instante, como antes.
 */
import { createContext, useContext } from 'react'
import { useNavigate } from 'react-router-dom'

export const ExitNavigateContext = createContext(null)

export function useExitNavigate() {
  const exitNavigate = useContext(ExitNavigateContext)
  const navigate = useNavigate()
  return exitNavigate ?? navigate
}

// Un clic "normal" (sin modificadores) es el único que animamos.
export function isPlainClick(event) {
  return !event.defaultPrevented
    && event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
}
