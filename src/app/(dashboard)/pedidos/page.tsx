import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PedidosClient from './pedidos-client'

function contarPedidosUltimaSemana(pedidos: { created_at: string | null }[]) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  return pedidos.filter(p => p.created_at && new Date(p.created_at) >= weekAgo).length
}

export default async function PedidosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tienda } = await supabase
    .from('tiendas')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!tienda) redirect('/onboarding')

  const { data: metodosEnvio } = await supabase
    .from('metodos_envio')
    .select('id, nombre, tracking_url')
    .eq('tienda_id', tienda.id)
    .eq('activo', true)

  const { data: pedidos } = await supabase
    .from('pedidos')
    .select(`
      id, numero, comprador_nombre, comprador_telefono, direccion,
      metodo_envio, monto_total, estado, created_at,
      pagado_at, empacado_at, en_camino_at,
      tracking_numero, tracking_url,
      drop:drops(nombre),
      items:pedido_items(
        id, precio, talla_seleccionada,
        prenda:prendas(nombre, talla, marca)
      )
    `)
    .eq('tienda_id', tienda.id)
    .order('created_at', { ascending: false })

  const semanaCount = contarPedidosUltimaSemana(pedidos ?? [])
  const transitoTotal = pedidos
    ?.filter(p => ['por_verificar', 'pagado', 'empacado', 'en_camino'].includes(p.estado ?? ''))
    .reduce((s, p) => s + p.monto_total, 0) ?? 0

  return (
    <PedidosClient
      pedidos={(pedidos ?? []) as Parameters<typeof PedidosClient>[0]['pedidos']}
      semanaCount={semanaCount}
      transitoTotal={transitoTotal}
      metodosEnvio={(metodosEnvio ?? []) as unknown as { id: string; nombre: string; tracking_url: string | null }[]}
    />
  )
}
