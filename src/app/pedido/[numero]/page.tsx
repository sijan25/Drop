import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Icons } from '@/components/shared/icons';
import { verifyOrderAccessToken } from '@/lib/security/order-access';
import { createBuyerClient, createClient, createServiceClient } from '@/lib/supabase/server';
import type { Pedido as PedidoRow } from '@/types/pedido';
import { ORDER_STATUS } from '@/lib/ui/order-status';

type Pedido = Pick<
  PedidoRow,
  | 'id'
  | 'numero'
  | 'comprador_nombre'
  | 'comprador_email'
  | 'comprador_telefono'
  | 'direccion'
  | 'metodo_envio'
  | 'metodo_pago'
  | 'monto_total'
  | 'estado'
  | 'created_at'
  | 'apartado_expira_at'
  | 'comprobante_estado'
  | 'pagado_at'
  | 'empacado_at'
  | 'en_camino_at'
  | 'entregado_at'
  | 'cancelado_at'
  | 'foto_paquete_url'
  | 'tracking_numero'
  | 'tracking_url'
  | 'envio_modalidad'
  | 'envio_courier_nombre'
  | 'envio_estado'
  | 'envio_tracking_url'
  | 'envio_label_url'
  | 'simbolo_moneda'
> & {
  tienda: { nombre: string; username: string; logo_url: string | null; user_id: string; simbolo_moneda: string } | null;
  drop: { nombre: string | null } | null;
  items: {
    id: string;
    precio: number;
    talla_seleccionada: string | null;
    prenda: { nombre: string | null; marca: string | null; talla: string | null; fotos: string[] | null } | null;
  }[];
};

const STATUS_META = ORDER_STATUS;

function formatDate(value: string | null) {
  if (!value) return 'Pendiente';
  return new Intl.DateTimeFormat('es-HN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function buildTimeline(pedido: Pedido) {
  const estado = pedido.estado ?? 'apartado';
  const pagoDone = ['por_verificar', 'pagado', 'empacado', 'en_camino', 'enviado', 'entregado'].includes(estado);
  const empacadoDone = ['empacado', 'en_camino', 'enviado', 'entregado'].includes(estado);
  const caminoDone = ['en_camino', 'enviado', 'entregado'].includes(estado);
  const entregadoDone = estado === 'entregado';
  const trackingUrl = pedido.envio_tracking_url ?? pedido.tracking_url;

  if (estado === 'cancelado') {
    return [
      { label: 'Pedido creado', date: formatDate(pedido.created_at), done: true },
      { label: 'Cancelado', date: formatDate(pedido.cancelado_at), done: true, danger: true },
    ];
  }

  return [
    {
      label: estado === 'por_verificar' ? 'Pago en revisión' : 'Pagado',
      date: estado === 'por_verificar' ? 'Comprobante recibido' : formatDate(pedido.pagado_at),
      done: pagoDone,
    },
    { label: 'Empacado', date: formatDate(pedido.empacado_at), done: empacadoDone },
    { label: 'Enviado', date: formatDate(pedido.en_camino_at), done: caminoDone, trackingUrl: caminoDone ? trackingUrl : null },
    { label: 'Entregado', date: formatDate(pedido.entregado_at), done: entregadoDone },
  ];
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type OrderAccessScope = 'seller' | 'buyer' | 'token' | 'none';

function maskEmail(value: string | null) {
  if (!value) return null;

  const [localPart, domain = ''] = value.split('@');
  if (!localPart) return 'Protegido';

  const localVisible = localPart.length <= 2
    ? `${localPart[0] ?? '*'}*`
    : `${localPart.slice(0, 2)}***`;

  if (!domain) return `${localVisible}@***`;

  const [domainName, ...rest] = domain.split('.');
  const maskedDomain = domainName
    ? `${domainName.slice(0, 1)}***`
    : '***';

  return `${localVisible}@${[maskedDomain, ...rest].filter(Boolean).join('.')}`;
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return 'Protegido';
  return `••• ••• ${digits.slice(-4)}`;
}

function isDeliveryMethod(metodoEnvio: string | null, envioModalidad?: string | null) {
  const metodo = envioModalidad ?? metodoEnvio;
  return metodo === 'domicilio' || metodo === 'boxful_dropoff' || metodo === 'boxful_recoleccion';
}

function metodoEnvioLabel(metodoEnvio: string | null, envioModalidad?: string | null) {
  const metodo = envioModalidad ?? metodoEnvio;
  if (metodo === 'boxful_dropoff') return 'Boxful · Punto autorizado';
  if (metodo === 'boxful_recoleccion') return 'Boxful · Recolección';
  return metodo === 'domicilio' ? 'Envío a domicilio' : 'Pickup / retiro';
}

function maskAddress(value: string | null, metodoEnvio: Pedido['metodo_envio'], envioModalidad?: Pedido['envio_modalidad']) {
  if (!isDeliveryMethod(metodoEnvio, envioModalidad)) return 'Se confirma al coordinar el retiro';
  if (!value?.trim()) return 'Protegida en este enlace';
  return 'Protegida en este enlace';
}

function redactOrderForTokenViewer(pedido: Pedido): Pedido {
  return {
    ...pedido,
    comprador_email: maskEmail(pedido.comprador_email),
    comprador_telefono: maskPhone(pedido.comprador_telefono),
    direccion: maskAddress(pedido.direccion, pedido.metodo_envio, pedido.envio_modalidad),
  };
}

async function getOrderAccessScope(pedido: Pedido, token?: string): Promise<OrderAccessScope> {

  const buyer = await createBuyerClient();
  const { data: buyerAuth } = await buyer.auth.getUser();
  if (
    buyerAuth.user?.email &&
    pedido.comprador_email &&
    buyerAuth.user.email.toLowerCase() === pedido.comprador_email.toLowerCase()
  ) {
    return 'buyer';
  }

  const seller = await createClient();
  const { data: sellerAuth } = await seller.auth.getUser();
  if (sellerAuth.user?.id && pedido.tienda?.user_id === sellerAuth.user.id) {
    return 'seller';
  }

  if (verifyOrderAccessToken(token, { id: pedido.id, numero: pedido.numero })) {
    return 'token';
  }

  return 'none';
}

export default async function PedidoPublicoPage({
  params,
  searchParams,
}: {
  params: Promise<{ numero: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const { numero } = await params;
  const token = firstParam((await searchParams).t);
  const supabase = await createServiceClient();

  // Read minimal fields first to verify access without exposing full buyer data
  const { data: minimal } = await supabase
    .from('pedidos')
    .select('id, numero, comprador_email, tienda:tiendas(user_id)')
    .eq('numero', numero)
    .single();

  if (!minimal) notFound();

  const minimalPedido = minimal as unknown as Pick<Pedido, 'id' | 'numero' | 'comprador_email'> & { tienda: { user_id: string } | null };
  const accessScope = await getOrderAccessScope(minimalPedido as unknown as Pedido, token);
  if (accessScope === 'none') notFound();

  const { data } = await supabase
    .from('pedidos')
    .select(`
      id, numero, comprador_nombre, comprador_email, comprador_telefono, direccion,
      metodo_envio, metodo_pago, monto_total, estado, created_at, apartado_expira_at,
      comprobante_estado, pagado_at, empacado_at, en_camino_at, entregado_at, cancelado_at,
      foto_paquete_url, tracking_numero, tracking_url,
      envio_modalidad, envio_courier_nombre, envio_estado, envio_tracking_url, envio_label_url,
      simbolo_moneda,
      tienda:tiendas(nombre, username, logo_url, user_id, simbolo_moneda),
      drop:drops(nombre),
      items:pedido_items(
        id, precio, talla_seleccionada,
        prenda:prendas(nombre, marca, talla, fotos)
      )
    `)
    .eq('numero', numero)
    .single();

  if (!data) notFound();

  const pedido = data as unknown as Pedido;

  const visiblePedido = accessScope === 'token' ? redactOrderForTokenViewer(pedido) : pedido;
  const hasMaskedPersonalData = accessScope === 'token';
  const estado = STATUS_META[visiblePedido.estado ?? 'apartado'] ?? STATUS_META.apartado;
  const timeline = buildTimeline(visiblePedido);
  const firstItem = visiblePedido.items?.[0];
  const tiendaHref = visiblePedido.tienda?.username ? `/${visiblePedido.tienda.username}` : '/';
  const trackingUrl = visiblePedido.envio_tracking_url ?? visiblePedido.tracking_url;

  return (
    <main className="min-h-screen bg-[#f7f7f6] px-4 pt-7 pb-10">
      <div className="w-full max-w-[760px] mx-auto">
        <div className="flex justify-between items-center gap-3 mb-[22px]">
          <Link href={tiendaHref} className="text-[#555] no-underline inline-flex items-center gap-[7px] text-[13px] font-bold">
            <Icons.back width={16} height={16} />
            Volver a la tienda
          </Link>
          <span className="text-[11px] font-black rounded-[20px] px-[10px] py-[6px]" style={{ color: estado.tone, background: estado.bg }}>
            {estado.label}
          </span>
        </div>

        <section className="bg-white border border-black/[0.08] rounded-lg overflow-hidden">
          <div className="px-7 py-[26px] border-b border-black/[0.07]">
            <div className="mono tnum text-[30px] font-black text-[#111] mb-[5px]">
              {visiblePedido.numero}
            </div>
            <div className="text-[14px] text-[#777]">
              Pedido en {visiblePedido.tienda?.nombre ?? 'tienda'}{visiblePedido.drop?.nombre ? ` · ${visiblePedido.drop.nombre}` : ''}
            </div>
          </div>

          <div className="pedido-content-grid grid grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
            <div className="pedido-prendas-col p-6 border-r border-black/[0.07]">
              <div className="text-[14px] font-extrabold mb-4">Prendas</div>
              <div className="grid gap-3">
                {(visiblePedido.items?.length ? visiblePedido.items : [{ id: visiblePedido.id, precio: visiblePedido.monto_total, talla_seleccionada: null, prenda: null }]).map(item => (
                  <div key={item.id} className="grid grid-cols-[62px_1fr_auto] gap-3 items-center">
                    <div className="w-[62px] h-[78px] rounded-lg overflow-hidden bg-[#eeeeee]">
                      {item.prenda?.fotos?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.prenda.fotos[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#eeeeee] to-[#dddddd]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-extrabold text-[#111] whitespace-nowrap overflow-hidden text-ellipsis">
                        {item.prenda?.nombre ?? firstItem?.prenda?.nombre ?? 'Pedido registrado'}
                      </div>
                      <div className="text-[12px] text-[#888] mt-[3px]">
                        {[item.prenda?.marca, (item.talla_seleccionada ?? item.prenda?.talla) && `T. ${item.talla_seleccionada ?? item.prenda?.talla}`].filter(Boolean).join(' · ') || visiblePedido.drop?.nombre || 'Detalle del pedido'}
                      </div>
                    </div>
                    <div className="mono tnum text-[14px] font-black">
                      {visiblePedido.simbolo_moneda ?? visiblePedido.tienda?.simbolo_moneda ?? 'L'} {item.precio.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-[22px] pt-[18px] border-t border-black/[0.07] flex justify-between items-baseline">
                <span className="text-[14px] font-extrabold">Total</span>
                <span className="mono tnum text-[24px] font-black">{visiblePedido.simbolo_moneda ?? visiblePedido.tienda?.simbolo_moneda ?? 'L'} {visiblePedido.monto_total.toLocaleString()}</span>
              </div>
            </div>

            <div className="p-6">
              <div className="text-[14px] font-extrabold mb-4">Seguimiento</div>
              <div className="grid gap-[15px]">
                {timeline.map((step, index) => (
                  <div key={step.label} className="grid grid-cols-[22px_1fr] gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center ${step.done ? ('danger' in step && step.danger ? 'bg-[#991b1b]' : 'bg-[#111]') : 'bg-white border-[1.5px] border-[#ddd]'}`}>
                        {step.done && <Icons.check width={13} height={13} className="text-white" />}
                      </div>
                      {index < timeline.length - 1 && (
                        <div className={`w-px h-6 mt-1 ${step.done ? 'bg-[#111]' : 'bg-[#ddd]'}`} />
                      )}
                    </div>
                    <div>
                      <div className={`text-[13px] ${step.done ? 'font-extrabold text-[#111]' : 'font-semibold text-[#999]'}`}>{step.label}</div>
                      <div className="mono text-[11px] text-[#999] mt-[2px]">{step.date}</div>
                      {'trackingUrl' in step && step.trackingUrl && (
                        <a href={step.trackingUrl} target="_blank" rel="noreferrer" className="inline-block mt-[6px] text-[12px] font-bold text-white bg-[#3730a3] rounded-md px-[10px] py-1 no-underline">
                          Ver tracking →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-[14px] bg-white border border-black/[0.08] rounded-lg px-5 py-[18px]">
          <div className="text-[14px] font-extrabold mb-3">Detalles de entrega</div>
          <div className="grid gap-[9px] text-[13px]">
            <InfoRow label="Compradora" value={visiblePedido.comprador_nombre} />
            <InfoRow label="WhatsApp" value={visiblePedido.comprador_telefono} />
            <InfoRow label="Entrega" value={metodoEnvioLabel(visiblePedido.metodo_envio, visiblePedido.envio_modalidad)} />
            <InfoRow label="Dirección" value={visiblePedido.direccion ?? 'Pendiente'} />
            {visiblePedido.envio_courier_nombre && <InfoRow label="Courier" value={visiblePedido.envio_courier_nombre} />}
            {visiblePedido.envio_estado && <InfoRow label="Estado envío" value={visiblePedido.envio_estado} />}
            {(visiblePedido.tracking_numero || trackingUrl) && (
              <InfoRow
                label="Tracking"
                value={trackingUrl ? (
                  <a href={trackingUrl} target="_blank" rel="noreferrer" className="text-[#16a34a] font-extrabold">
                    {visiblePedido.tracking_numero ?? 'Rastrear envío'}
                  </a>
                ) : visiblePedido.tracking_numero ?? 'Pendiente'}
              />
            )}
            <InfoRow label="Pago" value={visiblePedido.metodo_pago === 'transferencia' ? `Transferencia · ${visiblePedido.comprobante_estado ?? 'pendiente'}` : 'Tarjeta'} />
          </div>
          {hasMaskedPersonalData && (
            <div className="mt-3 text-[12px] text-[#888]">
              Los datos personales se muestran protegidos en enlaces compartidos.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <span className="text-[#888]">{label}</span>
      <span className="text-[#111] font-semibold">{value}</span>
    </div>
  );
}
