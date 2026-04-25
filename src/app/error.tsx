'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#FAF9F7', padding: 24,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, background: '#fef2f2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: 22,
        }}>
          ⚠️
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 8 }}>
          Algo salió mal
        </div>
        <div style={{ fontSize: 14, color: '#8A8380', lineHeight: 1.6, marginBottom: 28 }}>
          Ocurrió un error inesperado. Podés intentar de nuevo o volver más tarde.
        </div>
        <button
          onClick={reset}
          style={{
            background: '#1A1714', color: '#fff', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 600, padding: '11px 24px', borderRadius: 10,
          }}
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  )
}
