'use client';

import { useRouter } from 'next/navigation';
import { carritoItemKey, useCarrito } from '@/hooks/use-carrito';
import { Icons } from '@/components/shared/icons';

export function CarritoDrawer() {
  const router = useRouter();
  const { items, total, count, quitarItem, cerrarDrawer, drawerAbierto, limpiar, errorHidratacion } = useCarrito();

  if (!drawerAbierto) return null;

  function irAComprar(tiendaUsername: string, prendaId: string) {
    cerrarDrawer();
    router.push(`/${tiendaUsername}/prenda/${prendaId}`);
  }

  function irAlCheckout() {
    if (items.length === 0) return;
    cerrarDrawer();
    // Todas las prendas son de la misma tienda
    router.push(`/${items[0].tiendaUsername}/carrito`);
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]"
        onClick={cerrarDrawer}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 z-[51] w-[420px] max-w-[100vw] bg-white shadow-[-20px_0_60px_rgba(0,0,0,0.12)] flex flex-col [animation:slideIn_.22s_ease]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--line)] flex items-center justify-between">
          <div className="flex items-center gap-[10px]">
            <Icons.bag width={20} height={20} />
            <span className="text-[17px] font-bold tracking-[-0.01em]">
              Mi carrito
            </span>
            {count > 0 && (
              <span className="bg-[#0a0a0a] text-white rounded-[20px] px-2 py-[2px] text-[12px] font-bold">
                {count}
              </span>
            )}
          </div>
          <button
            onClick={cerrarDrawer}
            className="bg-none border-none cursor-pointer text-[var(--ink-3)] flex"
          >
            <Icons.close width={20} height={20} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {errorHidratacion ? (
            <div className="text-center py-[60px] text-[var(--ink-3)]">
              <div className="text-[14px] text-[var(--urgent)] mb-3">No se pudo cargar el carrito.</div>
              <button onClick={() => window.location.reload()} className="btn btn-outline h-[36px] text-[13px]">Reintentar</button>
            </div>
          ) : count === 0 ? (
            <div className="text-center py-[60px] text-[var(--ink-3)]">
              <div className="w-14 h-14 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center mx-auto mb-4">
                <Icons.bag width={26} height={26} className="text-[var(--ink-3)]" />
              </div>
              <div className="text-[15px] font-semibold text-[var(--ink-2)] mb-[6px]">
                Tu carrito está vacío
              </div>
              <div className="text-[13px] text-[var(--ink-3)] leading-[1.55]">
                Agregá prendas del catálogo para verlas aquí.
              </div>
              <button
                onClick={cerrarDrawer}
                className="btn btn-outline mt-5 h-[42px] px-5"
              >
                Seguir viendo
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              {items.map(item => (
                <div
                  key={carritoItemKey(item.prendaId, item.talla)}
                  className="grid gap-[14px] items-center p-[14px_16px] border border-[var(--line)] rounded-[14px] bg-white grid-cols-[72px_1fr_auto]"
                >
                  {/* Foto */}
                  <div
                    className="w-[72px] h-[90px] rounded-[10px] overflow-hidden cursor-pointer shrink-0"
                    onClick={() => irAComprar(item.tiendaUsername, item.prendaId)}
                  >
                    {item.foto
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={item.foto} alt={item.nombre} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-[var(--surface-2)]" />}
                  </div>

                  {/* Info */}
                  <div
                    className="min-w-0 cursor-pointer"
                    onClick={() => irAComprar(item.tiendaUsername, item.prendaId)}
                  >
                    {item.marca && (
                      <div className="text-[10px] font-semibold text-[var(--ink-3)] uppercase tracking-[0.07em] mb-[3px]">
                        {item.marca}
                      </div>
                    )}
                    <div className="text-[14px] font-semibold leading-[1.3] mb-1">
                      {item.nombre}
                    </div>
                    {item.talla && (
                      <div className="text-[12px] text-[var(--ink-3)] mb-[6px]">
                        Talla {item.talla}
                      </div>
                    )}
                    <div className="mono tnum text-[15px] font-bold">
                      L {item.precio.toLocaleString()}
                    </div>
                  </div>

                  {/* Quitar */}
                  <button
                    onClick={() => quitarItem(item.prendaId, item.talla)}
                    className="bg-none border-none cursor-pointer text-[var(--ink-3)] p-1 flex self-start"
                    title="Quitar del carrito"
                  >
                    <Icons.close width={16} height={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer con total */}
        {count > 0 && (
          <div className="px-6 py-5 border-t border-[var(--line)] bg-white">
            {/* Resumen */}
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[13px] text-[var(--ink-3)]">
                {count} {count === 1 ? 'prenda' : 'prendas'}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-[11px] text-[var(--ink-3)]">Total estimado</span>
                <span className="mono tnum text-[22px] font-[800] tracking-[-0.03em]">
                  L {total.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="text-[12px] text-[var(--ink-3)] mb-4 leading-[1.4]">
              El envío se calcula al finalizar cada compra. Cada prenda se compra por separado.
            </div>

            {/* Botón finalizar */}
            <button
              className="btn btn-primary h-[52px] text-[15px] font-semibold rounded-[12px] w-full"
              onClick={irAlCheckout}
            >
              Finalizar compra
            </button>

            <button
              onClick={() => { limpiar(); cerrarDrawer(); }}
              className="w-full mt-[10px] h-[38px] bg-transparent border-none text-[var(--ink-3)] text-[12px] cursor-pointer underline"
            >
              Vaciar carrito
            </button>
          </div>
        )}
      </div>
    </>
  );
}
