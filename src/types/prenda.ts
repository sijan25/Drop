import type { Database } from './database';

export type Prenda = Database['public']['Tables']['prendas']['Row'];
export type PrendaInsert = Database['public']['Tables']['prendas']['Insert'];
export type PrendaUpdate = Database['public']['Tables']['prendas']['Update'];
