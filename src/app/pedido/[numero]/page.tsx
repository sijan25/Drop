import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icons } from '@/components/shared/icons';
import { verifyOrderAccessToken } from '@/lib/security/order-access';
import { createBuyerClient, createClient, createServiceClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type Pedido = Pick<
  Database['public']['Tables']['pedidos']['Row'],
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

const STATUS_META: Record<string, { label: string; tone: string; bg: string }> = {
  apartado: { label: 'Apartado', tone: '#92400e', bg: '#fffbeb' },
  por_verificar: { label: 'Pago en revisión', tone: '#7c2d12', bg: '#fff7ed' },
  pagado: { label: 'Pago confirmado', tone: '#065f46', bg: '#ecfdf5' },
  empacado: { label: 'Empacado', tone: '#1d4ed8', bg: '#eff6ff' },
  en_camino: { label: 'En camino', tone: '#3730a3', bg: '#eef2ff' },
  enviado: { label: 'Enviado', tone: '#3730a3', bg: '#eef2ff' },
  entregado: { label: 'Entregado', tone: '#166534', bg: '#f0fdf4' },
  cancelado: { label: 'Cancelado', tone: '#991b1b', bg: '#fef2f2' },
};

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

  if (estado === 'cancelado') {
    return [
      { label: 'Pedido creado', date: formatDate(pedido.created_at), done: true },
      { label: 'Cancelado', date: formatDate(pedido.cancelado_at), done: true, danger: true },
    ];
  }

  return [
    { label: 'Pedido creado', date: formatDate(pedido.created_at), done: true },
    {
      label: estado === 'por_verificar' ? 'Pago en revisión' : 'Pago confirmado',
      date: estado === 'por_verificar' ? 'Comprobante recibido' : formatDate(pedido.pagado_at),
      done: pagoDone,
    },
    { label: 'Empacado', date: formatDate(pedido.empacado_at), done: empacadoDone },
    { label: 'En camino', date: formatDate(pedido.en_camino_at), done: caminoDone },
    { label: 'Entregado', date: formatDate(pedido.entregado_at), done: entregadoDone },
  ];
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function canSeeOrder(pedido: Pedido, token?: string) {
  if (verifyOrderAccessToken(token, { id: pedido.id, numero: pedido.numero })) return true;

  const buyer = await createBuyerClient();
  const { data: buyerAuth } = await buyer.auth.getUser();
  if (
    buyerAuth.user?.email &&
    pedido.comprador_email &&
    buyerAuth.user.email.toLowerCase() === pedido.comprador_email.toLowerCase()
  ) {
    return true;
  }

  const seller = await createClient();
  const { data: sellerAuth } = await seller.auth.getUser();
  return Boolean(sellerAuth.user?.id && pedido.tienda?.user_id === sellerAuth.user.id);
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

  const { data } = await supabase
    .from('pedidos')
    .select(`
      id, numero, comprador_nombre, comprador_email, comprador_telefono, direccion,
      metodo_envio, metodo_pago, monto_total, estado, created_at, apartado_expira_at,
      comprobante_estado, pagado_at, empacado_at, en_camino_at, entregado_at, cancelado_at,
      foto_paquete_url,
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
  if (!(await canSeeOrder(pedido, token))) notFound();

  const estado = STATUS_META[pedido.estado ?? 'apartado'] ?? STATUS_META.apartado;
  const timeline = buildTimeline(pedido);
  const firstItem = pedido.items?.[0];
  const tiendaHref = pedido.tienda?.username ? `/${pedido.tienda.username}` : '/';

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
              {pedido.numero}
            </div>
            <div style={{ fontSize: 14, color: '#777' }}>
              Pedido en {pedido.tienda?.nombre ?? 'tienda'}{pedido.drop?.nombre ? ` · ${pedido.drop.nombre}` : ''}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(260px, 0.9fr)', gap: 0 }}>
            <div style={{ padding: 24, borderRight: '1px solid rgba(0,0,0,0.07)' }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Prendas</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {(pedido.items?.length ? pedido.items : [{ id: pedido.id, precio: pedido.monto_total, talla_seleccionada: null, prenda: null }]).map(item => (
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
                        {[item.prenda?.marca, (item.talla_seleccionada ?? item.prenda?.talla) && `T. ${item.talla_seleccionada ?? item.prenda?.talla}`].filter(Boolean).join(' · ') || pedido.drop?.nombre || 'Detalle del pedido'}
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
                <span className="mono tnum" style={{ fontSize: 24, fontWeight: 900 }}>L {pedido.monto_total.toLocaleString()}</span>
              </div>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Seguimiento</div>
              <div style={{ display: 'grid', gap: 15 }}>
                {timeline.map((step, index) => (
                  <div key={step.label} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 22, height: 22, borderRadius: 11, background: step.done ? (step.danger ? '#991b1b' : '#111') : '#fff', border: step.done ? 'none' : '1.5px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {step.done && <Icons.check width={13} height={13} style={{ color: '#fff' }} />}
                      </div>
                      {index < timeline.length - 1 && (
                        <div style={{ width: 1, height: 24, background: step.done ? '#111' : '#ddd', marginTop: 4 }} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: step.done ? 800 : 600, color: step.done ? '#111' : '#999' }}>{step.label}</div>
                      <div className="mono" style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{step.date}</div>
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
            <InfoRow label="Compradora" value={pedido.comprador_nombre} />
            <InfoRow label="WhatsApp" value={pedido.comprador_telefono} />
            <InfoRow label="Entrega" value={pedido.metodo_envio === 'domicilio' ? 'Envío a domicilio' : 'Pickup / retiro'} />
            <InfoRow label="Dirección" value={pedido.direccion ?? 'Pendiente'} />
            <InfoRow label="Pago" value={pedido.metodo_pago === 'transferencia' ? `Transferencia · ${pedido.comprobante_estado ?? 'pendiente'}` : 'Tarjeta'} />
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
      <span style={{ color: '#888' }}>{label}</span>
      <span style={{ color: '#111', fontWeight: 600 }}>{value}</span>
    </div>
  );
}
