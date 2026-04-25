import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#FAF9F7', padding: 24,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{
          fontSize: 72, fontWeight: 800, letterSpacing: '-0.04em',
          color: '#E8DED5', lineHeight: 1, marginBottom: 16,
        }}>
          404
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 8 }}>
          Página no encontrada
        </div>
        <div style={{ fontSize: 14, color: '#8A8380', lineHeight: 1.6, marginBottom: 28 }}>
          La página que buscás no existe o fue movida.
        </div>
        <Link
          href="/"
          style={{
            display: 'inline-block', background: '#1A1714', color: '#fff',
            fontSize: 14, fontWeight: 600, padding: '11px 24px',
            borderRadius: 10, textDecoration: 'none',
          }}
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
