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

  const { data: comprobantes } = await supabase
    .from('comprobantes')
    .select(`
      id, pedido_id, imagen_url, estado,
      monto_declarado, banco, cuenta_destino, referencia,
      fecha_transferencia, verificacion_automatica,
      coincide_monto, coincide_cuenta, coincide_referencia, created_at,
      pedido:pedidos(id, numero, comprador_nombre, comprador_telefono, monto_total, pedido_items(id, precio, talla_seleccionada, prenda:prendas(id, nombre, marca, talla, fotos)))
    `)
    .eq('tienda_id', tienda.id)
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: true })

  return (
    <ComprobantesClient
      comprobantes={(comprobantes ?? []) as Parameters<typeof ComprobantesClient>[0]['comprobantes']}
    />
  )
}
