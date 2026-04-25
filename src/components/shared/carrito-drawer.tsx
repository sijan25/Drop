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
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
        }}
        onClick={cerrarDrawer}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 51,
        width: 420, maxWidth: '100vw',
        background: '#fff',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideIn .22s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icons.bag width={20} height={20} />
            <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>
              Mi carrito
            </span>
            {count > 0 && (
              <span style={{
                background: '#0a0a0a', color: '#fff',
                borderRadius: 20, padding: '2px 8px',
                fontSize: 12, fontWeight: 700,
              }}>
                {count}
              </span>
            )}
          </div>
          <button
            onClick={cerrarDrawer}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', display: 'flex' }}
          >
            <Icons.close width={20} height={20} />
          </button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {errorHidratacion ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-3)' }}>
              <div style={{ fontSize: 14, color: 'var(--urgent)', marginBottom: 12 }}>No se pudo cargar el carrito.</div>
              <button onClick={() => window.location.reload()} className="btn btn-outline" style={{ height: 36, fontSize: 13 }}>Reintentar</button>
            </div>
          ) : count === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-3)' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Icons.bag width={26} height={26} style={{ color: 'var(--ink-3)' }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>
                Tu carrito está vacío
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55 }}>
                Agregá prendas del catálogo para verlas aquí.
              </div>
              <button
                onClick={cerrarDrawer}
                className="btn btn-outline"
                style={{ marginTop: 20, height: 42, padding: '0 20px' }}
              >
                Seguir viendo
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {items.map(item => (
                <div
                  key={carritoItemKey(item.prendaId, item.talla)}
                  style={{
                    display: 'grid', gridTemplateColumns: '72px 1fr auto',
                    gap: 14, alignItems: 'center',
                    padding: '14px 16px',
                    border: '1px solid var(--line)',
                    borderRadius: 14, background: '#fff',
                  }}
                >
                  {/* Foto */}
                  <div
                    style={{ width: 72, height: 90, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', flexShrink: 0 }}
                    onClick={() => irAComprar(item.tiendaUsername, item.prendaId)}
                  >
                    {item.foto
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={item.foto} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', background: 'var(--surface-2)' }} />}
                  </div>

                  {/* Info */}
                  <div
                    style={{ minWidth: 0, cursor: 'pointer' }}
                    onClick={() => irAComprar(item.tiendaUsername, item.prendaId)}
                  >
                    {item.marca && (
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
                        {item.marca}
                      </div>
                    )}
                    <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>
                      {item.nombre}
                    </div>
                    {item.talla && (
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                        Talla {item.talla}
                      </div>
                    )}
                    <div className="mono tnum" style={{ fontSize: 15, fontWeight: 700 }}>
                      L {item.precio.toLocaleString()}
                    </div>
                  </div>

                  {/* Quitar */}
                  <button
                    onClick={() => quitarItem(item.prendaId, item.talla)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--ink-3)', padding: 4, display: 'flex',
                      alignSelf: 'flex-start',
                    }}
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
          <div style={{
            padding: '20px 24px',
            borderTop: '1px solid var(--line)',
            background: '#fff',
          }}>
            {/* Resumen */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                {count} {count === 1 ? 'prenda' : 'prendas'}
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Total estimado</span>
                <span className="mono tnum" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>
                  L {total.toLocaleString()}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16, lineHeight: 1.4 }}>
              El envío se calcula al finalizar cada compra. Cada prenda se compra por separado.
            </div>

            {/* Botón finalizar */}
            <button
              className="btn btn-primary"
              style={{ height: 52, fontSize: 15, fontWeight: 600, borderRadius: 12, width: '100%' }}
              onClick={irAlCheckout}
            >
              Finalizar compra
            </button>

            <button
              onClick={() => { limpiar(); cerrarDrawer(); }}
              style={{
                width: '100%', marginTop: 10,
                height: 38, background: 'none', border: 'none',
                color: 'var(--ink-3)', fontSize: 12, cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Vaciar carrito
            </button>
          </div>
        )}
      </div>
    </>
  );
}
