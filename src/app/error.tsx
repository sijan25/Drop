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
    <div className="min-h-screen flex items-center justify-center bg-[#FAF9F7] p-[24px]">
      <div className="text-center max-w-[400px]">
        <div className="w-[52px] h-[52px] rounded-[14px] bg-[#fef2f2] flex items-center justify-center mx-auto mb-[20px] text-[22px]">
          ⚠️
        </div>
        <div className="text-[18px] font-bold tracking-[-0.01em] mb-[8px]">
          Algo salió mal
        </div>
        <div className="text-[14px] text-[#8A8380] leading-[1.6] mb-[28px]">
          Ocurrió un error inesperado. Podés intentar de nuevo o volver más tarde.
        </div>
        <button
          onClick={reset}
          className="bg-[#1A1714] text-white border-none cursor-pointer text-[14px] font-semibold px-[24px] py-[11px] rounded-[10px]"
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  )
}
