'use server';

import { createClient } from '@/lib/supabase/server';
import { notificarSuscriptoresNuevoDrop } from '@/lib/resend/emails';

export async function activarDropAction(dropId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado.' };

  const { data: drop } = await supabase
    .from('drops')
    .select('id, nombre, descripcion, tienda_id, estado')
    .eq('id', dropId)
    .maybeSingle();

  if (!drop) return { error: 'Drop no encontrado.' };

  const { data: tienda } = await supabase
    .from('tiendas')
    .select('id, nombre, username')
    .eq('id', drop.tienda_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!tienda) return { error: 'No autorizado.' };

  const { error } = await supabase
    .from('drops')
    .update({ estado: 'activo', inicia_at: new Date().toISOString() })
    .eq('id', dropId);

  if (error) return { error: 'No se pudo activar el drop.' };

  // Notificar suscriptores en background
  supabase
    .from('anotaciones')
    .select('nombre, email')
    .eq('tienda_id', tienda.id)
    .not('email', 'is', null)
    .then(({ data: suscriptores }) => {
      if (!suscriptores?.length) return;
      notificarSuscriptoresNuevoDrop({
        suscriptores: suscriptores.map(s => ({
          nombre: s.nombre ?? '',
          email: s.email!,
        })),
        tiendaNombre: tienda.nombre,
        tiendaUsername: tienda.username,
        dropId,
        dropNombre: drop.nombre,
        descripcion: drop.descripcion,
      }).catch(console.error);
    });

  return {};
}
