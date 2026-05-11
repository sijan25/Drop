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
  getProductSizes,
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
  drop?: Drop | null;
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
    errorMsg, setErrorMsg, loadingPedido, processingMessage, pedidoNumero, pedidoTrackingUrl,
    tallaSeleccionada, setTallaSeleccionada, zoomActivo, setZoomActivo, zoomPos,
    isCompact, prendaEstado, prendaCantidad,
    fotos, costoEnvio, total, prendaRuntime, tallasProducto,
    tallaActiva, cantidadTallaSeleccionada, tieneStock, initials, checkoutOpen,
    aplicarBuyer, abrirCheckout, compartirPrenda, actualizarZoom,
    subirComprobante, confirmarApartado,
    cardData, setCardData,
  } = usePrendaCheckout({
    prenda,
    tienda,
    metodosPago,
    metodosEnvio,
    dropId: drop?.id ?? null,
    channelName: drop ? `prenda-${prenda.id}` : `prenda-catalogo-${prenda.id}`,
  });

  const dropAbierto = drop ? drop.estado === 'activo' : true;
  const dropProgramado = drop ? drop.estado === 'programado' : false;
  const dropTarget = drop
    ? (drop.cierra_at ? new Date(drop.cierra_at).getTime() : new Date(drop.inicia_at).getTime() + drop.duracion_minutos * 60000)
    : 0;
  const puedeComprar = dropAbierto && tieneStock;

  const tallaCarrito = tallasProducto.length > 0 ? (tallaActiva || null) : null;
  const enCarrito = tieneItem(prenda.id, tallaCarrito);
  const otraTallaEnCarrito = !enCarrito && tieneItem(prenda.id);

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
    <div className="buyer-product-page min-h-screen bg-white">

      {/* NAV */}
      <nav
        className={`buyer-product-nav sticky top-0 z-40 bg-white border-b border-[var(--line)] flex items-center justify-between ${isCompact ? 'px-3 py-2 min-h-[58px]' : 'px-10 h-14'}`}
        style={{ gap: isCompact ? 8 : undefined }}
      >
        <div className={`buyer-product-nav-left flex items-center min-w-0 flex-[1_1_auto] ${isCompact ? 'gap-[6px]' : 'gap-2'}`}>
          <button
            onClick={() => router.back()}
            className={`flex items-center justify-center gap-[6px] border-none cursor-pointer text-[var(--ink-3)] p-0 flex-[0_0_auto] ${isCompact ? 'bg-[var(--surface-2)] rounded-[17px] text-[0px] w-[34px] h-[34px]' : 'bg-transparent rounded-none text-[13px]'}`}
          >
            <Icons.back width={16} height={16} />
            {drop ? 'Volver al drop' : 'Volver'}
          </button>
          {!isCompact && <span className="text-[var(--line)] mx-2">·</span>}
          <span className={`buyer-product-breadcrumb min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[var(--ink-3)] ${isCompact ? 'text-[12px]' : 'text-[13px]'}`}>
            <Link href={`/${tienda.username}`} className="text-inherit no-underline">{tienda.nombre}</Link>
            {' / '}
            {drop
              ? <><Link href={`/${tienda.username}/drop/${drop.id}`} className="text-inherit no-underline">{drop.nombre}</Link>{' / '}</>
              : <><Link href={`/${tienda.username}#catalogo`} className="text-inherit no-underline">Catálogo</Link>{' / '}</>
            }
            <span className="text-[var(--ink)]">{prenda.nombre}</span>
          </span>
        </div>
        <div className={`buyer-product-nav-actions flex items-center flex-[0_0_auto] ${isCompact ? 'gap-2' : 'gap-4'}`}>
          {drop && drop.estado === 'activo' && (
            <div
              className={`buyer-product-nav-countdown flex text-[var(--urgent)] ${isCompact ? 'items-end flex-col gap-0 text-[11px] leading-[1.1] max-w-[74px]' : 'items-center flex-row gap-[6px] text-[13px]'}`}
            >
              <span className="w-[6px] h-[6px] rounded-[3px] bg-[var(--urgent)] inline-block [animation:pulse_1.4s_ease-in-out_infinite]" />
              <span className="mono font-semibold">
                CIERRA EN <CountdownTimer target={dropTarget} size="sm" urgent />
              </span>
            </div>
          )}
          {!isCompact && (tienda.logo_url ? (
            <Image src={cld(tienda.logo_url, 'logo')} alt={tienda.nombre} width={28} height={28} className="rounded-[14px] object-cover" />
          ) : (
            <div className="w-7 h-7 rounded-[14px] bg-[#e4d4d0] flex items-center justify-center text-[11px] font-bold">{initials}</div>
          ))}
          <button
            onClick={abrirDrawer}
            className={`relative flex items-center justify-center w-9 h-9 rounded-[18px] border border-[var(--line)] cursor-pointer ${carritoCount > 0 ? 'bg-[var(--accent-3)] text-white' : 'bg-white text-[var(--accent-3)]'}`}
            title="Ver carrito"
          >
            <Icons.bag width={15} height={15} />
            {carritoCount > 0 && (
              <span className="absolute top-[-4px] right-[-4px] w-[18px] h-[18px] rounded-[9px] bg-[#C96442] text-white text-[10px] font-[800] flex items-center justify-center border-2 border-white">
                {carritoCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* MAIN LAYOUT */}
      <div
        className="buyer-product-main mx-auto"
        style={{
          maxWidth: isCompact ? 560 : 1200,
          padding: isCompact ? '18px 14px 48px' : '48px 40px',
          display: 'grid',
          gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : '1fr 480px',
          gap: isCompact ? 24 : 64,
        }}
      >

        {/* GALERÍA */}
        <div
          className="buyer-product-gallery min-w-0"
          style={{
            display: 'grid',
            gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : '72px 1fr',
            gap: isCompact ? 10 : 12,
          }}
        >
          <div
            className="buyer-product-thumbs flex gap-2"
            style={{
              flexDirection: isCompact ? 'row' : 'column',
              order: isCompact ? 2 : undefined,
              overflowX: isCompact ? 'auto' : undefined,
              padding: isCompact ? '2px 2px 6px' : undefined,
            }}
          >
            {fotos.length > 0 ? fotos.map((f, i) => (
              <button
                key={i}
                onClick={() => setFotoIdx(i)}
                className="w-[72px] h-[90px] rounded-[8px] overflow-hidden border-none p-0 cursor-pointer relative transition-[outline] duration-[120ms]"
                style={{
                  outline: i === fotoIdx ? '2px solid var(--ink)' : '2px solid transparent',
                  outlineOffset: 2,
                }}
              >
                <Image src={cld(f, 'mini')} alt="" fill sizes="72px" className="object-cover" />
              </button>
            )) : [0, 1, 2].map(i => (
              <div
                key={i}
                className="w-[72px] h-[90px] rounded-[8px] overflow-hidden"
                style={{
                  outline: i === fotoIdx ? '2px solid var(--ink)' : '2px solid transparent',
                  outlineOffset: 2,
                }}
              >
                <Ph tone={TONES[i % TONES.length]} aspect="4/5" radius={0} />
              </div>
            ))}
          </div>

          <div
            className={`buyer-product-media relative overflow-hidden bg-[#f5f5f5] ${isCompact ? 'rounded-[14px]' : 'rounded-[16px]'}`}
            style={{
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
                  objectFit: 'cover', display: 'block',
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
              className="absolute top-4 right-4 w-14 h-14 rounded-[28px] border border-[rgba(26,23,20,0.06)] bg-[rgba(255,255,255,0.94)] text-[var(--ink)] shadow-[0_12px_30px_rgba(26,23,20,0.12)] flex items-center justify-center cursor-pointer z-[2] backdrop-blur-[10px]"
            >
              <Icons.share width={24} height={24} />
            </button>

            {fotos.length > 1 && (
              <>
                <button
                  onClick={() => setFotoIdx(i => Math.max(0, i - 1))}
                  disabled={fotoIdx === 0}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-[20px] bg-[rgba(255,255,255,0.9)] border-none cursor-pointer flex items-center justify-center transition-opacity duration-[120ms]"
                  style={{ opacity: fotoIdx === 0 ? 0.3 : 1 }}
                >
                  <Icons.back width={18} height={18} />
                </button>
                <button
                  onClick={() => setFotoIdx(i => Math.min(fotos.length - 1, i + 1))}
                  disabled={fotoIdx === fotos.length - 1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-[20px] bg-[rgba(255,255,255,0.9)] border-none cursor-pointer flex items-center justify-center transition-opacity duration-[120ms]"
                  style={{ opacity: fotoIdx === fotos.length - 1 ? 0.3 : 1 }}
                >
                  <Icons.arrow width={18} height={18} />
                </button>
              </>
            )}

            {prendaEstado !== 'disponible' && (
              <>
                <div className="absolute inset-0 bg-[rgba(0,0,0,0.22)] backdrop-grayscale-[0.5]" />
                <div
                  className="absolute top-[82px] right-4 text-white rounded-[20px] px-[14px] py-[6px] text-[11px] font-bold tracking-[0.08em] uppercase backdrop-blur-[8px]"
                  style={{ background: prendaEstado === 'vendida' ? 'rgba(10,10,10,0.88)' : 'rgba(180,100,0,0.88)' }}
                >
                  {prendaEstado === 'vendida' ? 'Vendida' : prendaEstado === 'apartada' ? 'Apartada' : prendaEstado}
                </div>
              </>
            )}

            {fotos.length > 1 && (
              <div className="absolute bottom-4 right-4">
                <span className="mono text-[11px] bg-[rgba(0,0,0,0.5)] text-white px-[10px] py-1 rounded-[20px]">
                  {fotoIdx + 1} / {fotos.length}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* INFO */}
        <div className={`buyer-product-info min-w-0 ${isCompact ? 'pt-0' : 'pt-2'}`}>
          {prenda.marca && (
            <div className="text-[13px] font-semibold text-[var(--ink-3)] uppercase tracking-[0.08em] mb-2">
              {prenda.marca}
            </div>
          )}
          <h1 className={`buyer-product-title font-bold tracking-[-0.02em] m-0 mb-1 leading-[1.15] overflow-wrap-anywhere ${isCompact ? 'text-[28px]' : 'text-[32px]'}`}>
            {prenda.nombre}
          </h1>
          {prenda.categoria && (
            <div className="text-[15px] text-[var(--ink-2)] mb-4">{prenda.categoria}</div>
          )}

          <div className={`buyer-product-price-row flex flex-wrap my-5 ${isCompact ? 'items-start gap-x-3 gap-y-[6px]' : 'items-baseline gap-[10px]'}`}>
            <span className={`mono tnum font-semibold tracking-[-0.03em] ${isCompact ? 'text-[25px]' : 'text-[28px]'}`}>
              L {prenda.precio.toLocaleString()}
            </span>
            {tieneStock && (
              <span className="text-[13px] font-medium" style={{ color: drop ? (dropAbierto ? 'var(--urgent)' : '#777') : 'var(--ok)' }}>
                {drop && !dropAbierto
                  ? 'Preview del próximo drop'
                  : cantidadTallaSeleccionada === 1 ? 'Solo queda 1' : `${cantidadTallaSeleccionada} disponibles`
                }
              </span>
            )}
          </div>

          <hr className="border-none border-t border-[var(--line)] my-5" />

          <div className={`buyer-product-meta-grid grid mb-5 ${isCompact ? 'grid-cols-1 gap-[18px]' : 'grid-cols-2 gap-4'}`}>
            {tallasProducto.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--ink-3)] mb-[6px]">Talla</div>
                <div className="flex flex-wrap gap-2">
                  {tallasProducto.map(size => {
                    const disponibleEnTalla = getProductSizeQuantity(prendaRuntime, size);
                    const agotada = disponibleEnTalla <= 0;
                    const estaEnCarrito = tieneItem(prenda.id, size);
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => { if (agotada) return; setTallaSeleccionada(size); setErrorMsg(''); }}
                        disabled={agotada}
                        className="relative min-w-[48px] h-[48px] px-[14px] rounded-[8px] text-[16px] font-semibold"
                        style={{
                          border: `2px solid ${tallaActiva === size ? 'var(--ink)' : agotada ? 'var(--line-2)' : estaEnCarrito ? 'var(--ok)' : 'var(--line)'}`,
                          background: tallaActiva === size ? '#fff' : agotada ? '#f6f4f1' : 'var(--surface-2)',
                          color: agotada ? 'var(--ink-3)' : 'var(--ink)',
                          cursor: agotada ? 'not-allowed' : 'pointer',
                          opacity: agotada ? 0.55 : 1,
                        }}
                      >
                        {size}
                        {estaEnCarrito && (
                          <span className="absolute top-1 right-1 w-[7px] h-[7px] rounded-full bg-[var(--ok)] border-[1.5px] border-white" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {drop && (
              <div>
                <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--ink-3)] mb-[6px]">Estado</div>
                <div className="text-[15px] font-medium text-[var(--ok)]">Muy buen estado</div>
              </div>
            )}
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--ink-3)] mb-[6px]">Disponibles</div>
              <div className="mono tnum text-[18px] font-bold">
                {tieneStock
                  ? (tallasProducto.length > 0 ? getProductSizeQuantity(prendaRuntime, tallaActiva) : prendaCantidad)
                  : 0}
              </div>
            </div>
          </div>

          {prenda.descripcion && (
            <p className="text-[14px] leading-[1.65] text-[var(--ink-2)] m-0 mb-5">
              {prenda.descripcion}
            </p>
          )}

          {/* Drop timer pill — solo en modo drop */}
          {drop && (
            <div
              className={`buyer-product-drop-timer flex items-center justify-between rounded-[10px] px-4 py-3 mb-6 ${drop.estado === 'activo' ? 'bg-[#fef2f2]' : 'bg-[var(--surface-2)]'} ${isCompact ? 'gap-[6px] flex-wrap' : ''}`}
            >
              <div className={`text-[13px] ${drop.estado === 'activo' ? 'text-[var(--urgent)]' : 'text-[var(--ink-3)]'}`}>
                Drop {drop.estado === 'activo' ? 'cierra' : 'abre'} en
              </div>
              <CountdownTimer target={dropTarget} size="sm" urgent={drop.estado === 'activo'} />
            </div>
          )}

          {/* CTAs */}
          {puedeComprar ? (
            <div className="buyer-product-actions grid gap-[10px]">
              <button
                className="btn btn-primary h-14 text-[16px] font-semibold rounded-[12px]"
                onClick={abrirCheckout}
              >
                Comprar ahora
              </button>
              <button
                className="btn btn-outline h-[52px] text-[15px] rounded-[12px] flex items-center justify-center gap-2"
                onClick={agregarAlCarrito}
              >
                <Icons.bag width={18} height={18} />
                {enCarrito ? 'Ver carrito' : otraTallaEnCarrito ? 'Añadir esta talla' : 'Añadir al carrito'}
              </button>
              <div className="border border-[var(--line)] rounded-[12px] p-[14px_16px] bg-white mt-1">
                <div className="text-[13px] font-bold mb-[6px]">Devoluciones y Cancelaciones</div>
                <div className="text-[13px] text-[var(--ink-2)] leading-[1.55]">
                  Una vez procesada la compra NO se puede cancelar la orden. NO hay devoluciones de ningún tipo.
                  {tiendaEmail && (
                    <> Por favor contactar por correo electrónico a{' '}
                      <a href={`mailto:${tiendaEmail}`} className="text-[var(--ink)] font-bold underline">{tiendaEmail}</a>.
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : drop && !dropAbierto ? (
            <div className="rounded-[14px] border-[1.5px] border-[var(--line)] overflow-hidden bg-white">
              <div className="bg-[#0a0a0a] text-white px-[18px] py-[14px] flex items-center gap-[10px]">
                <Icons.clock width={15} height={15} />
                <span className="text-[12px] font-[800] tracking-[0.08em] uppercase">
                  {dropProgramado ? 'Drop todavía no abre' : 'Drop no está abierto'}
                </span>
              </div>
              <div className="px-[18px] py-4 grid gap-3">
                <div className="text-[14px] text-[var(--ink-2)] leading-[1.55]">
                  Esta prenda está en preview. La compra se activa cuando el drop esté en vivo.
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: dropProgramado ? '1fr 1fr' : '1fr' }}>
                  <button className="btn btn-outline h-11" onClick={() => router.push(`/${tienda.username}#catalogo`)}>
                    Ver catálogo
                  </button>
                  {dropProgramado && (
                    <button className="btn btn-primary h-11" onClick={() => router.push(`/${tienda.username}/drop/${drop.id}#drop-aviso`)}>
                      Avisarme
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[14px] overflow-hidden border-[1.5px] border-[var(--line)]">
              <div className={`px-5 py-[14px] flex items-center gap-[10px] ${prendaEstado === 'vendida' ? 'bg-[#0a0a0a]' : 'bg-[#92400e]'}`}>
                <div className="w-2 h-2 rounded-[4px] bg-white opacity-50 shrink-0" />
                <span className="text-[12px] font-bold text-white tracking-[0.08em] uppercase">
                  {prendaEstado === 'vendida' ? 'Vendida' : 'Apartada'}
                </span>
              </div>
              <div className="px-5 py-4 bg-white">
                <div className="text-[14px] text-[var(--ink-2)] leading-[1.55]">
                  {prendaEstado === 'vendida'
                    ? `Esta prenda ya encontró dueño. Mirá las otras prendas ${drop ? 'del drop' : 'del catálogo'}.`
                    : 'Esta prenda está apartada temporalmente. Si no se completa el pago, volverá al catálogo.'}
                </div>
                <button
                  className="btn btn-outline h-11 mt-3"
                  onClick={() => router.push(drop ? `/${tienda.username}/drop/${drop.id}` : `/${tienda.username}#catalogo`)}
                >
                  {drop ? 'Ver más del drop' : 'Ver catálogo'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* OTRAS PRENDAS */}
      {otrasPrendas.length > 0 && (
        <div
          className="buyer-related-section mx-auto"
          style={{ maxWidth: isCompact ? 560 : 1200, padding: isCompact ? '0 14px 48px' : '0 40px 64px' }}
        >
          <hr className="border-none border-t border-[var(--line)] mb-10" />
          <div className="text-[18px] font-semibold tracking-[-0.015em] mb-5">
            {drop ? 'Más prendas en este drop' : 'Más prendas del catálogo'}
          </div>
          <div
            className="buyer-related-grid grid"
            style={{
              gridTemplateColumns: isCompact ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, 1fr)',
              gap: isCompact ? 12 : 16,
            }}
          >
            {otrasPrendas.map((p, i) => {
              const href = drop
                ? `/${tienda.username}/drop/${drop.id}/prenda/${p.id}`
                : `/${tienda.username}/prenda/${p.id}`;
              const relatedSizes = getAvailableProductSizes(p);
              const tallaRelacionada = relatedSizes[0] ?? getPrimaryProductSize(p);
              const tieneVariantes = getProductSizes(p).length > 1;
              const enCarritoRelacionado = tallaRelacionada ? tieneItem(p.id, tallaRelacionada) : tieneItem(p.id);

              return (
                <PublicProductCard
                  key={p.id}
                  product={p}
                  tone={TONES[i % TONES.length]}
                  density="compact"
                  isPreview={drop ? !dropAbierto : false}
                  showActions={drop ? dropAbierto : true}
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

      {/* CHECKOUT PANEL */}
      {(checkoutStep === 'confirmado' || (checkoutOpen && puedeComprar)) && (
        <div
          className="buyer-checkout-overlay fixed inset-0 z-50 flex"
          onClick={e => { if (!loadingPedido && e.target === e.currentTarget) setCheckoutStep('none'); }}
        >
          <div className="buyer-checkout-backdrop flex-1 bg-[rgba(0,0,0,0.3)]" onClick={() => { if (!loadingPedido) setCheckoutStep('none'); }} />
          <div className="buyer-checkout-drawer w-[480px] bg-white h-screen overflow-y-auto shadow-[-20px_0_60px_rgba(0,0,0,0.12)] [animation:slideIn_.22s_ease]">
            {checkoutStep === 'envio' && (
              <EnvioPanel
                prenda={prenda}
                tallaSeleccionada={tallaActiva || null}
                nombre={nombre} email={email} whatsapp={whatsapp}
                direccion={direccion} ciudad={ciudad} buyer={buyer}
                metodoEnvioId={metodoEnvioId} metodosEnvio={metodosEnvio}
                dropTarget={drop ? dropTarget : undefined}
                costoEnvio={costoEnvio} total={total} errorMsg={errorMsg}
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
                metodosPago={metodosPago} metodoPagoId={metodoPagoId}
                tiendaEmail={tiendaEmail} costoEnvio={costoEnvio} total={total}
                dropTarget={drop ? dropTarget : undefined}
                uploading={uploading} comprobanteUrl={comprobanteUrl}
                errorMsg={errorMsg} loading={loadingPedido} processingMessage={processingMessage} fileRef={fileRef}
                compradorNombre={nombre}
                cardData={cardData}
                onCardChange={(field, value) => setCardData(d => ({ ...d, [field]: value }))}
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
                secondaryAction={drop
                  ? { label: 'Ver más prendas del drop', onClick: () => { setCheckoutStep('none'); router.push(`/${tienda.username}/drop/${drop.id}`); } }
                  : { label: 'Ver más prendas', onClick: () => { setCheckoutStep('none'); router.push(`/${tienda.username}#catalogo`); } }
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
