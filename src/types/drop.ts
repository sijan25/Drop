import type { Database } from './database';

export type Drop = Database['public']['Tables']['drops']['Row'];
export type DropInsert = Database['public']['Tables']['drops']['Insert'];
export type DropUpdate = Database['public']['Tables']['drops']['Update'];
export type Actividad = Database['public']['Tables']['actividad']['Row'];
