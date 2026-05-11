import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF9F7] p-6">
      <div className="text-center max-w-[400px]">
        <div className="text-[72px] font-extrabold tracking-[-0.04em] text-[#E8DED5] leading-none mb-4">
          404
        </div>
        <div className="text-[20px] font-bold tracking-[-0.01em] mb-2">
          Página no encontrada
        </div>
        <div className="text-[14px] text-[#8A8380] leading-relaxed mb-7">
          La página que buscás no existe o fue movida.
        </div>
        <Link
          href="/"
          className="inline-block bg-[#1A1714] text-white text-[14px] font-semibold py-[11px] px-6 rounded-[10px] no-underline"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
