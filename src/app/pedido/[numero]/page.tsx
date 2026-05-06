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
> & {
  tienda: { nombre: string; username: string; logo_url: string | null; user_id: string } | null;
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
      tienda:tiendas(nombre, username, logo_url, user_id),
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
    <main style={{ minHeight: '100vh', background: '#f7f7f6', padding: '28px 16px 40px' }}>
      <div style={{ width: '100%', maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <Link href={tiendaHref} style={{ color: '#555', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700 }}>
            <Icons.back width={16} height={16} />
            Volver a la tienda
          </Link>
          <span style={{ fontSize: 11, fontWeight: 900, color: estado.tone, background: estado.bg, borderRadius: 20, padding: '6px 10px' }}>
            {estado.label}
          </span>
        </div>

        <section style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '26px 28px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            <div className="mono tnum" style={{ fontSize: 30, fontWeight: 900, color: '#111', marginBottom: 5 }}>
              {visiblePedido.numero}
            </div>
            <div style={{ fontSize: 14, color: '#777' }}>
              Pedido en {visiblePedido.tienda?.nombre ?? 'tienda'}{visiblePedido.drop?.nombre ? ` · ${visiblePedido.drop.nombre}` : ''}
            </div>
          </div>

          <div className="pedido-content-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(260px, 0.9fr)', gap: 0 }}>
            <div className="pedido-prendas-col" style={{ padding: 24, borderRight: '1px solid rgba(0,0,0,0.07)' }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Prendas</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {(visiblePedido.items?.length ? visiblePedido.items : [{ id: visiblePedido.id, precio: visiblePedido.monto_total, talla_seleccionada: null, prenda: null }]).map(item => (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '62px 1fr auto', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 62, height: 78, borderRadius: 8, overflow: 'hidden', background: '#eeeeee' }}>
                      {item.prenda?.fotos?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.prenda.fotos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #eeeeee, #dddddd)' }} />
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.prenda?.nombre ?? firstItem?.prenda?.nombre ?? 'Pedido registrado'}
                      </div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
                        {[item.prenda?.marca, (item.talla_seleccionada ?? item.prenda?.talla) && `T. ${item.talla_seleccionada ?? item.prenda?.talla}`].filter(Boolean).join(' · ') || visiblePedido.drop?.nombre || 'Detalle del pedido'}
                      </div>
                    </div>
                    <div className="mono tnum" style={{ fontSize: 14, fontWeight: 900 }}>
                      L {item.precio.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>Total</span>
                <span className="mono tnum" style={{ fontSize: 24, fontWeight: 900 }}>L {visiblePedido.monto_total.toLocaleString()}</span>
              </div>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Seguimiento</div>
              <div style={{ display: 'grid', gap: 15 }}>
                {timeline.map((step, index) => (
                  <div key={step.label} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 22, height: 22, borderRadius: 11, background: step.done ? ('danger' in step && step.danger ? '#991b1b' : '#111') : '#fff', border: step.done ? 'none' : '1.5px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {step.done && <Icons.check width={13} height={13} style={{ color: '#fff' }} />}
                      </div>
                      {index < timeline.length - 1 && (
                        <div style={{ width: 1, height: 24, background: step.done ? '#111' : '#ddd', marginTop: 4 }} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: step.done ? 800 : 600, color: step.done ? '#111' : '#999' }}>{step.label}</div>
                      <div className="mono" style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{step.date}</div>
                      {'trackingUrl' in step && step.trackingUrl && (
                        <a href={step.trackingUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 6, fontSize: 12, fontWeight: 700, color: '#fff', background: '#3730a3', borderRadius: 6, padding: '4px 10px', textDecoration: 'none' }}>
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

        <section style={{ marginTop: 14, background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '18px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Detalles de entrega</div>
          <div style={{ display: 'grid', gap: 9, fontSize: 13 }}>
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
                  <a href={trackingUrl} target="_blank" rel="noreferrer" style={{ color: '#16a34a', fontWeight: 800 }}>
                    {visiblePedido.tracking_numero ?? 'Rastrear envío'}
                  </a>
                ) : visiblePedido.tracking_numero ?? 'Pendiente'}
              />
            )}
            <InfoRow label="Pago" value={visiblePedido.metodo_pago === 'transferencia' ? `Transferencia · ${visiblePedido.comprobante_estado ?? 'pendiente'}` : 'Tarjeta'} />
          </div>
          {hasMaskedPersonalData && (
            <div style={{ marginTop: 12, fontSize: 12, color: '#888' }}>
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
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
      <span style={{ color: '#888' }}>{label}</span>
      <span style={{ color: '#111', fontWeight: 600 }}>{value}</span>
    </div>
  );
}
