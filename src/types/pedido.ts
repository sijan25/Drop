import type { Database } from './database';

export type Pedido = Database['public']['Tables']['pedidos']['Row'];
export type PedidoInsert = Database['public']['Tables']['pedidos']['Insert'];
export type PedidoUpdate = Database['public']['Tables']['pedidos']['Update'];
export type PedidoItem = Database['public']['Tables']['pedido_items']['Row'];
export type PedidoItemInsert = Database['public']['Tables']['pedido_items']['Insert'];
