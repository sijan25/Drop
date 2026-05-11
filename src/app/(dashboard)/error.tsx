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
    <div className="flex-1 flex items-center justify-center p-[40px]">
      <div className="text-center max-w-[380px]">
        <div className="w-[48px] h-[48px] rounded-[12px] bg-[#fef2f2] flex items-center justify-center mx-auto mb-[18px] text-[20px]">
          ⚠️
        </div>
        <div className="text-[16px] font-bold tracking-[-0.01em] mb-[6px]">
          Error al cargar esta sección
        </div>
        <div className="text-[13px] text-[#8A8380] leading-[1.6] mb-[24px]">
          Ocurrió un error inesperado. Podés intentar recargar.
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
