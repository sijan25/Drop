import type { Database } from './database';

export type Tienda = Database['public']['Tables']['tiendas']['Row'];
export type TiendaInsert = Database['public']['Tables']['tiendas']['Insert'];
export type TiendaUpdate = Database['public']['Tables']['tiendas']['Update'];
