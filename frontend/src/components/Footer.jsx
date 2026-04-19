/**
 * Footer.jsx
 * ─────────────────────────────────────────────────────────────
 * LISTO PARA STITCH: reemplazable directamente.
 * ─────────────────────────────────────────────────────────────
 */
export default function Footer({ marca = 'ANOTHER NPC SHOP' }) {
  return (
    <footer className="footer">
      <p>{marca}</p>
      <p>Solo ropa. Solo existir.</p>
    </footer>
  )
}
