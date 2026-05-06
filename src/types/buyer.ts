import type { Database } from './database';

export type Comprador = Database['public']['Tables']['compradores']['Row'];
export type CompradorInsert = Database['public']['Tables']['compradores']['Insert'];
export type Carrito = Database['public']['Tables']['carritos']['Row'];
export type CarritoItem = Database['public']['Tables']['carrito_items']['Row'];
