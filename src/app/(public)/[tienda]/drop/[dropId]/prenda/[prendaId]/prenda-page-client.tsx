'use client';

import Image from 'next/image';

import { cld } from '@/lib/cloudinary/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icons } from '@/components/shared/icons';
import { CountdownTimer } from '@/components/drops/countdown-timer';
import { Ph } from '@/components/shared/image-placeholder';
import { PublicProductCard } from '@/components/shared/public-product-card';
import { BuyerCheckoutAccess } from '@/components/buyer/buyer-checkout-access';
import { EnvioPanel, PagoPanel, ConfirmadoPanel } from '@/components/checkout/checkout-panels';
import type { Tienda } from '@/types/tienda';
import type { Prenda } from '@/types/prenda';
import type { Drop } from '@/types/drop';
import type { MetodoPago, MetodoEnvio } from '@/types/envio';
import { useCarrito } from '@/hooks/use-carrito';
import { usePrendaCheckout } from '@/hooks/use-prenda-checkout';
import {
  getAvailableProductSizes,
  getPrimaryProductSize,
  getProductSizeQuantity,
} from '@/lib/product-sizes';
import { TONES } from '@/lib/ui/tones';

type PrendaMin = Pick<Prenda, 'id' | 'nombre' | 'marca' | 'talla' | 'tallas' | 'cantidad' | 'cantidades_por_talla' | 'precio' | 'fotos' | 'estado'>;

export function PrendaPageClient({
  tienda,
  drop,
  prenda,
  metodosPago,
  metodosEnvio,
  otrasPrendas,
  tiendaEmail,
}: {
  tienda: Tienda;
  drop: Drop;
  prenda: Prenda;
  metodosPago: MetodoPago[];
  metodosEnvio: MetodoEnvio[];
  otrasPrendas: PrendaMin[];
  tiendaEmail: string;
}) {
  const router = useRouter();
  const { agregarItem, tieneItem, abrirDrawer, count: carritoCount } = useCarrito();

  const {
    fileRef, fotoIdx, setFotoIdx, checkoutStep, setCheckoutStep,
    nombre, setNombre, email, setEmail, whatsapp, setWhatsapp,
    direccion, setDireccion, ciudad, setCiudad, buyer,
    metodoEnvioId, setMetodoEnvioId, boxfulData, setBoxfulData,
    metodoPagoId, setMetodoPagoId, uploading, comprobanteUrl,
    errorMsg, setErrorMsg, loadingPedido, pedidoNumero, pedidoTrackingUrl,
    tallaSeleccionada, setTallaSeleccionada, zoomActivo, setZoomActivo, zoomPos,
    isCompact, prendaEstado, prendaCantidad, cantidadesPorTalla,
    fotos, costoEnvio, total, prendaRuntime, tallasProducto, tallasDisponibles,
    tallaActiva, cantidadTallaSeleccionada, tieneStock, initials, checkoutOpen,
    aplicarBuyer, abrirCheckout, compartirPrenda, actualizarZoom,
    subirComprobante, confirmarApartado,
  } = usePrendaCheckout({ prenda, tienda, metodosPago, metodosEnvio, dropId: drop.id, channelName: `prenda-${prenda.id}` });

  const dropTarget = drop.cierra_at
    ? new Date(drop.cierra_at).getTime()
    : new Date(drop.inicia_at).getTime() + drop.duracion_minutos * 60000;
  const dropAbierto = drop.estado === 'activo';
  const dropProgramado = drop.estado === 'programado';
  const puedeComprar = dropAbierto && tieneStock;
  const tallaCarrito = tallasProducto.length > 0 ? (tallaActiva || null) : null;
  const enCarrito = tieneItem(prenda.id, tallaCarrito);

  function agregarAlCarrito() {
    if (!puedeComprar) return;
    if (tallasProducto.length > 0 && !tallaActiva) {
      setErrorMsg('Seleccioná una talla disponible.');
      return;
    }
    if (enCarrito) { abrirDrawer(); return; }
    agregarItem({
      prendaId: prenda.id,
      nombre: prenda.nombre,
      marca: prenda.marca ?? null,
      talla: tallaCarrito,
      precio: prenda.precio,
      foto: prenda.fotos?.[0] ?? null,
      tiendaUsername: tienda.username,
      tiendaId: tienda.id,
    });
    setErrorMsg('');
  }

  return (
    <div className="buyer-product-page" style={{ minHeight: '100vh', background: '#fff' }}>

      {/* ── NAV ── */}
      <nav className="buyer-product-nav" style={{
        position: 'sticky', top: 0, zIndex: 40, background: '#fff',
        borderBottom: '1px solid var(--line)',
        padding: isCompact ? '8px 12px' : '0 40px',
        height: isCompact ? 'auto' : 56,
        minHeight: isCompact ? 58 : undefined,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: isCompact ? 8 : undefined,
      }}>
        <div className="buyer-product-nav-left" style={{ display: 'flex', alignItems: 'center', gap: isCompact ? 6 : 8, minWidth: 0, flex: '1 1 auto' }}>
          <button
            onClick={() => router.back()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: isCompact ? 'var(--surface-2)' : 'none',
              border: 'none',
              borderRadius: isCompact ? 17 : 0,
              cursor: 'pointer',
              color: 'var(--ink-3)',
              fontSize: isCompact ? 0 : 13,
              padding: 0,
              width: isCompact ? 34 : undefined,
              height: isCompact ? 34 : undefined,
              flex: '0 0 auto',
            }}
          >
            <Icons.back width={16} height={16} />
            Volver al drop
          </button>
          {!isCompact && <span style={{ color: 'var(--line)', margin: '0 8px' }}>·</span>}
          <span className="buyer-product-breadcrumb" style={{
            fontSize: isCompact ? 12 : 13,
            color: 'var(--ink-3)',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            <Link href={`/${tienda.username}`} style={{ color: 'inherit', textDecoration: 'none' }}>{tienda.nombre}</Link>
            {' / '}
            <Link href={`/${tienda.username}/drop/${drop.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{drop.nombre}</Link>
            {' / '}
            <span style={{ color: 'var(--ink)' }}>{prenda.nombre}</span>
          </span>
        </div>
        <div className="buyer-product-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: isCompact ? 8 : 16, flex: '0 0 auto' }}>
          {drop.estado === 'activo' && (
            <div className="buyer-product-nav-countdown" style={{
              display: 'flex',
              alignItems: isCompact ? 'flex-end' : 'center',
              flexDirection: isCompact ? 'column' : 'row',
              gap: isCompact ? 0 : 6,
              fontSize: isCompact ? 11 : 13,
              lineHeight: isCompact ? 1.1 : undefined,
              color: 'var(--urgent)',
              maxWidth: isCompact ? 74 : undefined,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--urgent)', display: 'inline-block', animation: 'pulse 1.4s ease-in-out infinite' }} />
              <span className="mono" style={{ fontWeight: 600 }}>
                CIERRA EN <CountdownTimer target={dropTarget} size="sm" urgent />
              </span>
            </div>
          )}
          {!isCompact && (tienda.logo_url ? (
            <Image src={cld(tienda.logo_url, 'logo')} alt={tienda.nombre} width={28} height={28} style={{ borderRadius: 14, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 28, height: 28, borderRadius: 14, background: '#e4d4d0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{initials}</div>
          ))}
          <button
            onClick={abrirDrawer}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 18,
              background: carritoCount > 0 ? 'var(--accent-3)' : '#fff',
              color: carritoCount > 0 ? '#fff' : 'var(--accent-3)',
              border: '1px solid var(--line)',
              cursor: 'pointer',
            }}
            title="Ver carrito"
          >
            <Icons.bag width={15} height={15} />
            {carritoCount > 0 && (
              <span style={{
                position: 'absolute',
                top: -4,
                right: -4,
                width: 18,
                height: 18,
                borderRadius: 9,
                background: '#C96442',
                color: '#fff',
                fontSize: 10,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #fff',
              }}>
                {carritoCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* ── MAIN LAYOUT ── */}
      <div className="buyer-product-main" style={{
        maxWidth: isCompact ? 560 : 1200,
        margin: '0 auto',
        padding: isCompact ? '18px 14px 48px' : '48px 40px',
        display: 'grid',
        gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : '1fr 480px',
        gap: isCompact ? 24 : 64,
      }}>

        {/* ── GALERÍA IZQUIERDA ── */}
        <div className="buyer-product-gallery" style={{
          display: 'grid',
          gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : '72px 1fr',
          gap: isCompact ? 10 : 12,
          minWidth: 0,
        }}>
          {/* Thumbnails */}
          <div className="buyer-product-thumbs" style={{
            display: 'flex',
            flexDirection: isCompact ? 'row' : 'column',
            gap: 8,
            order: isCompact ? 2 : undefined,
            overflowX: isCompact ? 'auto' : undefined,
            padding: isCompact ? '2px 2px 6px' : undefined,
          }}>
            {fotos.length > 0 ? fotos.map((f, i) => (
              <button
                key={i}
                onClick={() => setFotoIdx(i)}
                style={{
                  width: 72, height: 90, borderRadius: 8, overflow: 'hidden', border: 'none', padding: 0, cursor: 'pointer',
                  outline: i === fotoIdx ? '2px solid var(--ink)' : '2px solid transparent',
                  outlineOffset: 2, transition: 'outline .12s', position: 'relative',
                }}
              >
                <Image src={cld(f, 'mini')} alt="" fill sizes="72px" style={{ objectFit: 'cover' }} />
              </button>
            )) : [0, 1, 2].map(i => (
              <div key={i} style={{ width: 72, height: 90, borderRadius: 8, overflow: 'hidden', outline: i === fotoIdx ? '2px solid var(--ink)' : '2px solid transparent', outlineOffset: 2 }}>
                <Ph tone={TONES[i % TONES.length]} aspect="4/5" radius={0} />
              </div>
            ))}
          </div>

          {/* Foto principal */}
          <div
            className="buyer-product-media"
            style={{
              position: 'relative',
              borderRadius: isCompact ? 14 : 16,
              overflow: 'hidden',
              background: '#f5f5f5',
              cursor: isCompact ? 'default' : zoomActivo ? 'zoom-out' : 'zoom-in',
              aspectRatio: isCompact ? '4 / 5' : undefined,
              minHeight: isCompact ? undefined : 560,
            }}
            onMouseEnter={() => setZoomActivo(true)}
            onMouseLeave={() => setZoomActivo(false)}
            onMouseMove={actualizarZoom}
          >
            {fotos.length > 0 ? (
              <Image
                src={cld(fotos[fotoIdx], 'detail')}
                alt={prenda.nombre}
                fill
                sizes="(max-width: 1024px) 100vw, 600px"
                style={{
                  objectFit: 'cover',
                  display: 'block',
                  transform: !isCompact && zoomActivo ? 'scale(2.1)' : 'scale(1)',
                  transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                  transition: zoomActivo ? 'transform .08s ease-out' : 'transform .22s ease-out',
                }}
              />
            ) : (
              <Ph tone={TONES[0]} aspect="4/5" radius={0} />
            )}
            <button
              type="button"
              aria-label="Compartir prenda"
              onClick={compartirPrenda}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 56,
                height: 56,
                borderRadius: 28,
                border: '1px solid rgba(26,23,20,0.06)',
                background: 'rgba(255,255,255,0.94)',
                color: 'var(--ink)',
                boxShadow: '0 12px 30px rgba(26,23,20,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 2,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              <Icons.share width={24} height={24} />
            </button>

            {/* Nav arrows */}
            {fotos.length > 1 && (
              <>
                <button
                  onClick={() => setFotoIdx(i => Math.max(0, i - 1))}
                  disabled={fotoIdx === 0}
                  style={{
                    position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                    width: 40, height: 40, borderRadius: 20, background: 'rgba(255,255,255,0.9)',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: fotoIdx === 0 ? 0.3 : 1, transition: 'opacity .12s',
                  }}
                >
                  <Icons.back width={18} height={18} />
                </button>
                <button
                  onClick={() => setFotoIdx(i => Math.min(fotos.length - 1, i + 1))}
                  disabled={fotoIdx === fotos.length - 1}
                  style={{
                    position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                    width: 40, height: 40, borderRadius: 20, background: 'rgba(255,255,255,0.9)',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: fotoIdx === fotos.length - 1 ? 0.3 : 1, transition: 'opacity .12s',
                  }}
                >
                  <Icons.arrow width={18} height={18} />
                </button>
              </>
            )}

            {/* Badge estado */}
            {prendaEstado !== 'disponible' && (
              <>
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)', backdropFilter: 'grayscale(0.5)' }} />
                <div style={{
                  position: 'absolute', top: 82, right: 16,
                  background: prendaEstado === 'vendida' ? 'rgba(10,10,10,0.88)' : 'rgba(180,100,0,0.88)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  color: '#fff', borderRadius: 20,
                  padding: '6px 14px',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  {prendaEstado === 'vendida' ? 'Vendida' : prendaEstado === 'apartada' ? 'Apartada' : prendaEstado}
                </div>
              </>
            )}

            {/* Foto count */}
            {fotos.length > 1 && (
              <div style={{ position: 'absolute', bottom: 16, right: 16 }}>
                <span className="mono" style={{ fontSize: 11, background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '4px 10px', borderRadius: 20 }}>
                  {fotoIdx + 1} / {fotos.length}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── INFO DERECHA ── */}
        <div className="buyer-product-info" style={{ paddingTop: isCompact ? 0 : 8, minWidth: 0 }}>
          {/* Marca */}
          {prenda.marca && (
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              {prenda.marca}
            </div>
          )}

          {/* Nombre */}
          <h1 className="buyer-product-title" style={{ fontSize: isCompact ? 28 : 32, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px', lineHeight: 1.15, overflowWrap: 'anywhere' }}>
            {prenda.nombre}
          </h1>

          {/* Categoría */}
          {prenda.categoria && (
            <div style={{ fontSize: 15, color: 'var(--ink-2)', marginBottom: 16 }}>{prenda.categoria}</div>
          )}

          {/* Precio */}
          <div className="buyer-product-price-row" style={{ display: 'flex', alignItems: isCompact ? 'flex-start' : 'baseline', flexWrap: 'wrap', gap: isCompact ? '6px 12px' : 10, margin: '20px 0' }}>
            <span className="mono tnum" style={{ fontSize: isCompact ? 25 : 28, fontWeight: 600, letterSpacing: '-0.03em' }}>
              L {prenda.precio.toLocaleString()}
            </span>
            {tieneStock && (
              <span style={{ fontSize: 13, color: dropAbierto ? 'var(--urgent)' : '#777', fontWeight: 500 }}>
                {dropAbierto
                  ? cantidadTallaSeleccionada === 1 ? 'Solo queda 1' : `${cantidadTallaSeleccionada} disponibles`
                  : 'Preview del próximo drop'}
              </span>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '20px 0' }} />

          {/* Atributos */}
          <div className="buyer-product-meta-grid" style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr', gap: isCompact ? 18 : 16, marginBottom: 20 }}>
            {tallasProducto.length > 0 && (
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: 6 }}>Talla</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {tallasProducto.map(size => {
                    const disponibleEnTalla = getProductSizeQuantity(prendaRuntime, size);
                    const agotada = disponibleEnTalla <= 0;
                    return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        if (agotada) return;
                        setTallaSeleccionada(size);
                        setErrorMsg('');
                      }}
                      disabled={agotada}
                      style={{
                        minWidth: 48,
                        height: 48,
                        padding: '0 14px',
                        border: `2px solid ${tallaActiva === size ? 'var(--ink)' : agotada ? 'var(--line-2)' : 'var(--line)'}`,
                        borderRadius: 8,
                        background: tallaActiva === size ? '#fff' : agotada ? '#f6f4f1' : 'var(--surface-2)',
                        color: agotada ? 'var(--ink-3)' : 'var(--ink)',
                        fontSize: 16,
                        fontWeight: 600,
                        cursor: agotada ? 'not-allowed' : 'pointer',
                        opacity: agotada ? 0.55 : 1,
                      }}
                    >
                      {size}
                    </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: 6 }}>Estado</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ok)' }}>Muy buen estado</div>
            </div>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: 6 }}>Disponibles</div>
              <div className="mono tnum" style={{ fontSize: 18, fontWeight: 700 }}>{tieneStock ? cantidadTallaSeleccionada : 0}</div>
            </div>
          </div>

          {/* Descripción */}
          {prenda.descripcion && (
            <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--ink-2)', margin: '0 0 20px' }}>
              {prenda.descripcion}
            </p>
          )}

          {/* Drop timer pill */}
          <div className="buyer-product-drop-timer" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: drop.estado === 'activo' ? '#fef2f2' : 'var(--surface-2)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 24,
            gap: isCompact ? 6 : undefined,
            flexWrap: isCompact ? 'wrap' : undefined,
          }}>
            <div style={{ fontSize: 13, color: drop.estado === 'activo' ? 'var(--urgent)' : 'var(--ink-3)' }}>
              Drop {drop.estado === 'activo' ? 'cierra' : 'abre'} en
            </div>
            <CountdownTimer target={dropTarget} size="sm" urgent={drop.estado === 'activo'} />
          </div>

          {/* CTAs */}
          {puedeComprar ? (
            <div className="buyer-product-actions" style={{ display: 'grid', gap: 10 }}>
              <button
                className="btn btn-primary"
                style={{ height: 56, fontSize: 16, fontWeight: 600, borderRadius: 12 }}
                onClick={abrirCheckout}
              >
                Comprar ahora
              </button>
              <button
                className="btn btn-outline"
                style={{ height: 52, fontSize: 15, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onClick={agregarAlCarrito}
              >
                <Icons.bag width={18} height={18} />
                {enCarrito ? 'Ver carrito' : 'Añadir al carrito'}
              </button>
              <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', background: '#fff', marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Devoluciones y Cancelaciones</div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                  Una vez procesada la compra NO se puede cancelar la orden. NO hay devoluciones de ningún tipo.
                  {tiendaEmail && (
                    <> Por favor contactar por correo electrónico a{' '}
                      <a href={`mailto:${tiendaEmail}`} style={{ color: 'var(--ink)', fontWeight: 700, textDecoration: 'underline' }}>
                        {tiendaEmail}
                      </a>.
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : !dropAbierto ? (
            <div style={{ borderRadius: 14, border: '1.5px solid var(--line)', overflow: 'hidden', background: '#fff' }}>
              <div style={{ background: '#0a0a0a', color: '#fff', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icons.clock width={15} height={15} />
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {dropProgramado ? 'Drop todavía no abre' : 'Drop no está abierto'}
                </span>
              </div>
              <div style={{ padding: '16px 18px', display: 'grid', gap: 12 }}>
                <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                  Esta prenda está en preview. La compra se activa cuando el drop esté en vivo.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: dropProgramado ? '1fr 1fr' : '1fr', gap: 8 }}>
                  <button className="btn btn-outline" style={{ height: 44 }} onClick={() => router.push(`/${tienda.username}#catalogo`)}>
                    Ver catálogo
                  </button>
                  {dropProgramado && (
                    <button className="btn btn-primary" style={{ height: 44 }} onClick={() => router.push(`/${tienda.username}/drop/${drop.id}#drop-aviso`)}>
                      Avisarme
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              borderRadius: 14, overflow: 'hidden',
              border: '1.5px solid var(--line)',
            }}>
              <div style={{
                background: prendaEstado === 'vendida' ? '#0a0a0a' : '#92400e',
                padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: '#fff', opacity: 0.5, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {prendaEstado === 'vendida' ? 'Vendida' : 'Apartada'}
                </span>
              </div>
              <div style={{ padding: '16px 20px', background: '#fff' }}>
                <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                  {prendaEstado === 'vendida'
                    ? 'Esta prenda ya encontró dueño. Mirá las otras prendas del drop.'
                    : 'Esta prenda está apartada temporalmente. Si no se completa el pago, volverá al catálogo.'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── OTRAS PRENDAS ── */}
      {otrasPrendas.length > 0 && (
        <div className="buyer-related-section" style={{ maxWidth: isCompact ? 560 : 1200, margin: '0 auto', padding: isCompact ? '0 14px 48px' : '0 40px 64px' }}>
          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', marginBottom: 40 }} />
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em', marginBottom: 20 }}>
            Más prendas en este drop
          </div>
          <div className="buyer-related-grid" style={{ display: 'grid', gridTemplateColumns: isCompact ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, 1fr)', gap: isCompact ? 12 : 16 }}>
            {otrasPrendas.map((p, i) => {
              const href = `/${tienda.username}/drop/${drop.id}/prenda/${p.id}`;
              const relatedSizes = getAvailableProductSizes(p);
              const tallaRelacionada = relatedSizes[0] ?? getPrimaryProductSize(p);
              const tieneVariantes = relatedSizes.length > 1;
              const enCarritoRelacionado = tieneItem(p.id, tallaRelacionada);

              return (
                <PublicProductCard
                  key={p.id}
                  product={p}
                  tone={TONES[i % TONES.length]}
                  density="compact"
                  isPreview={!dropAbierto}
                  showActions={dropAbierto}
                  cartActive={!tieneVariantes && enCarritoRelacionado}
                  cartTitle={tieneVariantes ? 'Elegir talla' : enCarritoRelacionado ? 'Ver carrito' : 'Añadir al carrito'}
                  onOpen={() => router.push(href)}
                  onBuy={() => router.push(href)}
                  onCart={() => {
                    if (tieneVariantes) {
                      router.push(href);
                    } else if (enCarritoRelacionado) {
                      abrirDrawer();
                    } else {
                      agregarItem({
                        prendaId: p.id,
                        nombre: p.nombre,
                        marca: p.marca ?? null,
                        talla: tallaRelacionada,
                        precio: p.precio,
                        foto: p.fotos?.[0] ?? null,
                        tiendaUsername: tienda.username,
                        tiendaId: tienda.id,
                      });
                    }
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── CHECKOUT PANEL ── */}
      {(checkoutStep === 'confirmado' || (checkoutOpen && puedeComprar)) && (
        <div
          className="buyer-checkout-overlay"
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}
          onClick={e => { if (e.target === e.currentTarget) setCheckoutStep('none'); }}
        >
          <div className="buyer-checkout-backdrop" style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} onClick={() => setCheckoutStep('none')} />
          <div className="buyer-checkout-drawer" style={{
            width: 480, background: '#fff', height: '100vh', overflowY: 'auto',
            boxShadow: '-20px 0 60px rgba(0,0,0,0.12)',
            animation: 'slideIn .22s ease',
          }}>
            {checkoutStep === 'envio' && (
              <EnvioPanel
                prenda={prenda}
                tallaSeleccionada={tallaActiva || null}
                nombre={nombre}
              email={email}
                whatsapp={whatsapp}
                direccion={direccion}
                ciudad={ciudad}
                buyer={buyer}
                metodoEnvioId={metodoEnvioId}
                metodosEnvio={metodosEnvio}
                dropTarget={dropTarget}
                costoEnvio={costoEnvio}
                total={total}
                errorMsg={errorMsg}
                  onChange={(f, v) => {
                  if (f === 'nombre') setNombre(v);
                  if (f === 'email') setEmail(v);
                  if (f === 'whatsapp') setWhatsapp(v);
                  if (f === 'direccion') setDireccion(v);
                  if (f === 'ciudad') setCiudad(v);
                  if (f === 'metodoEnvioId') setMetodoEnvioId(v);
                  setErrorMsg('');
                }}
                onBuyer={aplicarBuyer}
                boxfulOriginCity={tienda.ciudad}
                boxfulData={boxfulData}
                onBoxfulChange={setBoxfulData}
                onContinuar={() => {
                  if (!nombre.trim()) { setErrorMsg('Ingresá tu nombre completo.'); return; }
                  if (!whatsapp.trim()) { setErrorMsg('Ingresá tu número de WhatsApp.'); return; }
                  if (!direccion.trim()) { setErrorMsg('Ingresá tu dirección.'); return; }
                  if (!ciudad.trim()) { setErrorMsg('Ingresá tu ciudad.'); return; }
                  if (!metodoEnvioId) { setErrorMsg('Seleccioná un método de envío.'); return; }
                  if (boxfulData.isBoxful && (!boxfulData.destination || !boxfulData.quote)) {
                    setErrorMsg('Seleccioná departamento y ciudad para calcular el envío con Boxful.');
                    return;
                  }
                  setCheckoutStep('pago');
                  setErrorMsg('');
                }}
                onCerrar={() => setCheckoutStep('none')}
              />
            )}
            {checkoutStep === 'pago' && (
              <PagoPanel
                prenda={prenda}
                tallaSeleccionada={tallaActiva || null}
                metodosPago={metodosPago}
                metodoPagoId={metodoPagoId}
                tiendaEmail={tiendaEmail}
                costoEnvio={costoEnvio}
                total={total}
                dropTarget={dropTarget}
                uploading={uploading}
                comprobanteUrl={comprobanteUrl}
                errorMsg={errorMsg}
                loading={loadingPedido}
                fileRef={fileRef}
                compradorNombre={nombre}
                onChange={(f, v) => { if (f === 'metodoPagoId') setMetodoPagoId(v); setErrorMsg(''); }}
                onSubirComprobante={subirComprobante}
                onConfirmar={confirmarApartado}
                onVolver={() => setCheckoutStep('envio')}
              />
            )}
            {checkoutStep === 'confirmado' && (
              <ConfirmadoPanel
                numero={pedidoNumero}
                onVerPedido={() => router.push(pedidoTrackingUrl || `/pedido/${pedidoNumero}`)}
                onCerrar={() => setCheckoutStep('none')}
                secondaryAction={{ label: 'Ver más prendas del drop', onClick: () => { setCheckoutStep('none'); router.push(`/${tienda.username}/drop/${drop.id}`); } }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
