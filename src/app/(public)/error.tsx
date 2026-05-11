'use client'

import { useEffect } from 'react'

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[PublicError]', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-[32px]">
      <div className="text-center max-w-[360px]">
        <div className="w-[48px] h-[48px] rounded-[12px] bg-[#fef2f2] flex items-center justify-center mx-auto mb-[18px] text-[20px]">
          ⚠️
        </div>
        <div className="text-[16px] font-bold tracking-[-0.01em] mb-[6px]">
          Algo salió mal
        </div>
        <div className="text-[13px] text-[#8A8380] leading-[1.6] mb-[24px]">
          No pudimos cargar esta página. Intentá de nuevo.
        </div>
        <button
          onClick={reset}
          className="bg-[#1A1714] text-white border-none cursor-pointer text-[13px] font-semibold px-[22px] py-[10px] rounded-[9px]"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
