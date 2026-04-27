import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ComprobantesClient from './comprobantes-client'

export default async function ComprobantesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tienda } = await supabase
    .from('tiendas')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!tienda) redirect('/onboarding')

  const SELECT = `
    id, pedido_id, imagen_url, estado,
    monto_declarado, banco, cuenta_destino, referencia,
    fecha_transferencia, verificacion_automatica,
    coincide_monto, coincide_cuenta, coincide_referencia, created_at,
    pedido:pedidos(id, numero, comprador_nombre, comprador_telefono, monto_total, pedido_items(id, precio, talla_seleccionada, prenda:prendas(id, nombre, marca, talla, fotos)))
  `

  const [{ data: comprobantes }, { data: historial }] = await Promise.all([
    supabase.from('comprobantes').select(SELECT)
      .eq('tienda_id', tienda.id).eq('estado', 'pendiente')
      .order('created_at', { ascending: true }),
    supabase.from('comprobantes').select(SELECT)
      .eq('tienda_id', tienda.id).in('estado', ['verificado', 'rechazado'])
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  return (
    <ComprobantesClient
      comprobantes={(comprobantes ?? []) as Parameters<typeof ComprobantesClient>[0]['comprobantes']}
      historial={(historial ?? []) as Parameters<typeof ComprobantesClient>[0]['comprobantes']}
    />
  )
}
