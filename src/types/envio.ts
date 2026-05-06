import type { Database } from './database';

export type MetodoEnvio = Database['public']['Tables']['metodos_envio']['Row'];
export type MetodoEnvioInsert = Database['public']['Tables']['metodos_envio']['Insert'];
export type MetodoPago = Database['public']['Tables']['metodos_pago']['Row'];
export type MetodoPagoInsert = Database['public']['Tables']['metodos_pago']['Insert'];
