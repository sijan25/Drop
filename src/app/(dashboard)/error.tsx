'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[DashboardError]', error)
  }, [error])

  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 40,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, background: '#fef2f2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px', fontSize: 20,
        }}>
          ⚠️
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 6 }}>
          Error al cargar esta sección
        </div>
        <div style={{ fontSize: 13, color: '#8A8380', lineHeight: 1.6, marginBottom: 24 }}>
          Ocurrió un error inesperado. Podés intentar recargar.
        </div>
        <button
          onClick={reset}
          style={{
            background: '#1A1714', color: '#fff', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, padding: '10px 22px', borderRadius: 9,
          }}
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
