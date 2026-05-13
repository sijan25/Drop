import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProductTotalQuantity } from '@/lib/product-sizes';
import DashboardPageClient from './page-client';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: tienda } = await supabase
    .from('tiendas')
    .select('id, nombre, username, simbolo_moneda')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!tienda) redirect('/onboarding');

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const [dropsRes, ventasRes, dropsActivosRes, inventarioRes, comprobantesRes, pedidosRes] = await Promise.all([
    supabase.from('drops')
      .select('id, nombre, estado, inicia_at, cierra_at, vendidas_count, recaudado_total, foto_portada_url')
      .eq('tienda_id', tienda.id).order('inicia_at', { ascending: false }).limit(5),
    supabase.from('pedidos').select('monto_total')
      .eq('tienda_id', tienda.id).in('estado', ['pagado', 'empacado', 'en_camino', 'enviado', 'entregado'])
      .gte('created_at', inicioMes.toISOString()),
    supabase.from('drops').select('id', { count: 'exact', head: true })
      .eq('tienda_id', tienda.id).eq('estado', 'activo'),
    supabase.from('prendas').select('cantidad, cantidades_por_talla, talla, tallas')
      .eq('tienda_id', tienda.id).in('estado', ['disponible', 'remanente']).limit(500),
    supabase.from('pedidos').select('id', { count: 'exact', head: true })
      .eq('tienda_id', tienda.id).eq('comprobante_estado', 'pendiente').eq('metodo_pago', 'transferencia'),
    supabase.from('pedidos')
      .select('id, numero, comprador_nombre, monto_total, metodo_pago, estado, created_at, pedido_items ( id, precio, talla_seleccionada, prendas ( nombre, talla, marca ) )')
      .eq('tienda_id', tienda.id).order('created_at', { ascending: false }).limit(10),
  ]);

  const ventasMes = (ventasRes.data ?? []).reduce((s, p) => s + (p.monto_total ?? 0), 0);
  const inventarioActivo = (inventarioRes.data ?? []).reduce((s, p) => s + getProductTotalQuantity(p), 0);

  return (
    <DashboardPageClient
      tiendaUsername={tienda.username}
      tiendaNombre={tienda.nombre}
      simbolo={(tienda as unknown as { simbolo_moneda: string }).simbolo_moneda ?? 'L'}
      drops={(dropsRes.data ?? []) as Parameters<typeof DashboardPageClient>[0]['drops']}
      pedidos={(pedidosRes.data ?? []) as Parameters<typeof DashboardPageClient>[0]['pedidos']}
      stats={{
        ventasMes,
        dropsActivos: dropsActivosRes.count ?? 0,
        inventarioActivo,
        comprobantesP: comprobantesRes.count ?? 0,
      }}
    />
  );
}
