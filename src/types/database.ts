export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      actividad: {
        Row: {
          created_at: string | null
          drop_id: string
          id: string
          texto: string
          tipo: string | null
        }
        Insert: {
          created_at?: string | null
          drop_id: string
          id?: string
          texto: string
          tipo?: string | null
        }
        Update: {
          created_at?: string | null
          drop_id?: string
          id?: string
          texto?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actividad_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "drops"
            referencedColumns: ["id"]
          },
        ]
      }
      anotaciones: {
        Row: {
          apellido: string | null
          created_at: string | null
          drop_id: string
          email: string | null
          id: string
          nombre: string | null
          telefono: string | null
        }
        Insert: {
          apellido?: string | null
          created_at?: string | null
          drop_id: string
          email?: string | null
          id?: string
          nombre?: string | null
          telefono?: string | null
        }
        Update: {
          apellido?: string | null
          created_at?: string | null
          drop_id?: string
          email?: string | null
          id?: string
          nombre?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anotaciones_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "drops"
            referencedColumns: ["id"]
          },
        ]
      }
      carrito_items: {
        Row: {
          cantidad: number
          carrito_id: string
          created_at: string
          id: string
          prenda_id: string
          talla_seleccionada: string | null
        }
        Insert: {
          cantidad?: number
          carrito_id: string
          created_at?: string
          id?: string
          prenda_id: string
          talla_seleccionada?: string | null
        }
        Update: {
          cantidad?: number
          carrito_id?: string
          created_at?: string
          id?: string
          prenda_id?: string
          talla_seleccionada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carrito_items_carrito_id_fkey"
            columns: ["carrito_id"]
            isOneToOne: false
            referencedRelation: "carritos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrito_items_prenda_id_fkey"
            columns: ["prenda_id"]
            isOneToOne: false
            referencedRelation: "prendas"
            referencedColumns: ["id"]
          },
        ]
      }
      carritos: {
        Row: {
          buyer_user_id: string | null
          created_at: string
          estado: string
          expires_at: string
          id: string
          session_id: string | null
          tienda_id: string
          updated_at: string
        }
        Insert: {
          buyer_user_id?: string | null
          created_at?: string
          estado?: string
          expires_at?: string
          id?: string
          session_id?: string | null
          tienda_id: string
          updated_at?: string
        }
        Update: {
          buyer_user_id?: string | null
          created_at?: string
          estado?: string
          expires_at?: string
          id?: string
          session_id?: string | null
          tienda_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carritos_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      compradores: {
        Row: {
          ciudad: string | null
          created_at: string | null
          direccion: string | null
          email: string | null
          id: string
          nombre: string | null
          telefono: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ciudad?: string | null
          created_at?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          nombre?: string | null
          telefono?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ciudad?: string | null
          created_at?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          nombre?: string | null
          telefono?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      comprobantes: {
        Row: {
          banco: string | null
          coincide_cuenta: boolean | null
          coincide_monto: boolean | null
          coincide_referencia: boolean | null
          created_at: string | null
          cuenta_destino: string | null
          estado: string
          fecha_transferencia: string | null
          id: string
          imagen_url: string
          monto_declarado: number | null
          notas_rechazo: string | null
          pedido_id: string
          referencia: string | null
          tienda_id: string
          verificacion_automatica: boolean | null
          verificado_at: string | null
        }
        Insert: {
          banco?: string | null
          coincide_cuenta?: boolean | null
          coincide_monto?: boolean | null
          coincide_referencia?: boolean | null
          created_at?: string | null
          cuenta_destino?: string | null
          estado?: string
          fecha_transferencia?: string | null
          id?: string
          imagen_url: string
          monto_declarado?: number | null
          notas_rechazo?: string | null
          pedido_id: string
          referencia?: string | null
          tienda_id: string
          verificacion_automatica?: boolean | null
          verificado_at?: string | null
        }
        Update: {
          banco?: string | null
          coincide_cuenta?: boolean | null
          coincide_monto?: boolean | null
          coincide_referencia?: boolean | null
          created_at?: string | null
          cuenta_destino?: string | null
          estado?: string
          fecha_transferencia?: string | null
          id?: string
          imagen_url?: string
          monto_declarado?: number | null
          notas_rechazo?: string | null
          pedido_id?: string
          referencia?: string | null
          tienda_id?: string
          verificacion_automatica?: boolean | null
          verificado_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comprobantes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprobantes_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      drops: {
        Row: {
          cierra_at: string | null
          created_at: string | null
          descripcion: string | null
          duracion_minutos: number
          estado: string | null
          foto_portada_url: string | null
          id: string
          inicia_at: string
          nombre: string
          recaudado_total: number | null
          tienda_id: string
          vendidas_count: number | null
          viewers_count: number | null
        }
        Insert: {
          cierra_at?: string | null
          created_at?: string | null
          descripcion?: string | null
          duracion_minutos: number
          estado?: string | null
          foto_portada_url?: string | null
          id?: string
          inicia_at: string
          nombre: string
          recaudado_total?: number | null
          tienda_id: string
          vendidas_count?: number | null
          viewers_count?: number | null
        }
        Update: {
          cierra_at?: string | null
          created_at?: string | null
          descripcion?: string | null
          duracion_minutos?: number
          estado?: string | null
          foto_portada_url?: string | null
          id?: string
          inicia_at?: string
          nombre?: string
          recaudado_total?: number | null
          tienda_id?: string
          vendidas_count?: number | null
          viewers_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drops_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      metodos_envio: {
        Row: {
          activo: boolean
          cobertura: string | null
          created_at: string
          id: string
          nombre: string
          precio: number
          proveedor: string
          tiempo_estimado: string | null
          tienda_id: string
        }
        Insert: {
          activo?: boolean
          cobertura?: string | null
          created_at?: string
          id?: string
          nombre: string
          precio?: number
          proveedor: string
          tiempo_estimado?: string | null
          tienda_id: string
        }
        Update: {
          activo?: boolean
          cobertura?: string | null
          created_at?: string
          id?: string
          nombre?: string
          precio?: number
          proveedor?: string
          tiempo_estimado?: string | null
          tienda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metodos_envio_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      metodos_pago: {
        Row: {
          activo: boolean | null
          created_at: string | null
          detalle: string | null
          id: string
          nombre: string
          proveedor: string
          tienda_id: string
          tipo: string
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          detalle?: string | null
          id?: string
          nombre: string
          proveedor: string
          tienda_id: string
          tipo: string
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          detalle?: string | null
          id?: string
          nombre?: string
          proveedor?: string
          tienda_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "metodos_pago_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      opciones_catalogo: {
        Row: {
          activo: boolean
          created_at: string | null
          id: string
          nombre: string
          orden: number
          tienda_id: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string | null
          id?: string
          nombre: string
          orden?: number
          tienda_id: string
          tipo: string
          updated_at?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string | null
          id?: string
          nombre?: string
          orden?: number
          tienda_id?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opciones_catalogo_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_items: {
        Row: {
          id: string
          pedido_id: string
          precio: number
          prenda_id: string
          talla_seleccionada: string | null
        }
        Insert: {
          id?: string
          pedido_id: string
          precio: number
          prenda_id: string
          talla_seleccionada?: string | null
        }
        Update: {
          id?: string
          pedido_id?: string
          precio?: number
          prenda_id?: string
          talla_seleccionada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_items_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_items_prenda_id_fkey"
            columns: ["prenda_id"]
            isOneToOne: false
            referencedRelation: "prendas"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          apartado_expira_at: string | null
          cancelado_at: string | null
          comprador_email: string | null
          comprador_nombre: string
          comprador_telefono: string
          comprobante_estado: string | null
          comprobante_url: string | null
          created_at: string | null
          direccion: string | null
          drop_id: string | null
          empacado_at: string | null
          en_camino_at: string | null
          entregado_at: string | null
          estado: string | null
          foto_paquete_url: string | null
          id: string
          metodo_envio: string | null
          metodo_pago: string | null
          monto_total: number
          numero: string
          pagado_at: string | null
          tienda_id: string
          tracking_numero: string | null
          tracking_url: string | null
        }
        Insert: {
          apartado_expira_at?: string | null
          cancelado_at?: string | null
          comprador_email?: string | null
          comprador_nombre: string
          comprador_telefono: string
          comprobante_estado?: string | null
          comprobante_url?: string | null
          created_at?: string | null
          direccion?: string | null
          drop_id?: string | null
          empacado_at?: string | null
          en_camino_at?: string | null
          entregado_at?: string | null
          estado?: string | null
          foto_paquete_url?: string | null
          id?: string
          metodo_envio?: string | null
          metodo_pago?: string | null
          monto_total: number
          numero: string
          pagado_at?: string | null
          tienda_id: string
          tracking_numero?: string | null
          tracking_url?: string | null
        }
        Update: {
          apartado_expira_at?: string | null
          cancelado_at?: string | null
          comprador_email?: string | null
          comprador_nombre?: string
          comprador_telefono?: string
          comprobante_estado?: string | null
          comprobante_url?: string | null
          created_at?: string | null
          direccion?: string | null
          drop_id?: string | null
          empacado_at?: string | null
          en_camino_at?: string | null
          entregado_at?: string | null
          estado?: string | null
          foto_paquete_url?: string | null
          id?: string
          metodo_envio?: string | null
          metodo_pago?: string | null
          monto_total?: number
          numero?: string
          pagado_at?: string | null
          tienda_id?: string
          tracking_numero?: string | null
          tracking_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      prendas: {
        Row: {
          cantidad: number
          cantidades_por_talla: Json
          categoria: string | null
          created_at: string | null
          descripcion: string | null
          drop_id: string | null
          estado: string | null
          fotos: string[]
          id: string
          marca: string | null
          nombre: string
          precio: number
          remanente_hasta: string | null
          talla: string | null
          tallas: string[]
          tienda_id: string
        }
        Insert: {
          cantidad?: number
          cantidades_por_talla?: Json
          categoria?: string | null
          created_at?: string | null
          descripcion?: string | null
          drop_id?: string | null
          estado?: string | null
          fotos: string[]
          id?: string
          marca?: string | null
          nombre: string
          precio: number
          remanente_hasta?: string | null
          talla?: string | null
          tallas?: string[]
          tienda_id: string
        }
        Update: {
          cantidad?: number
          cantidades_por_talla?: Json
          categoria?: string | null
          created_at?: string | null
          descripcion?: string | null
          drop_id?: string | null
          estado?: string | null
          fotos?: string[]
          id?: string
          marca?: string | null
          nombre?: string
          precio?: number
          remanente_hasta?: string | null
          talla?: string | null
          tallas?: string[]
          tienda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prendas_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prendas_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      security_rate_limits: {
        Row: {
          count: number
          key: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      tienda_username_redirects: {
        Row: {
          created_at: string
          id: string
          new_username: string
          old_username: string
          tienda_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_username: string
          old_username: string
          tienda_id: string
        }
        Update: {
          created_at?: string
          id?: string
          new_username?: string
          old_username?: string
          tienda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tienda_username_redirects_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      tiendas: {
        Row: {
          activa: boolean | null
          bio: string | null
          contact_email: string | null
          cover_url: string | null
          created_at: string | null
          facebook: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          next_order_number: number
          nombre: string
          order_prefix: string
          plan: string | null
          tiktok: string | null
          tipo_negocio: string
          ubicacion: string | null
          user_id: string
          username: string
          username_change_count: number
          username_changed_at: string | null
          whatsapp: string | null
        }
        Insert: {
          activa?: boolean | null
          bio?: string | null
          contact_email?: string | null
          cover_url?: string | null
          created_at?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          next_order_number?: number
          nombre: string
          order_prefix?: string
          plan?: string | null
          tiktok?: string | null
          tipo_negocio?: string
          ubicacion?: string | null
          user_id: string
          username: string
          username_change_count?: number
          username_changed_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          activa?: boolean | null
          bio?: string | null
          contact_email?: string | null
          cover_url?: string | null
          created_at?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          next_order_number?: number
          nombre?: string
          order_prefix?: string
          plan?: string | null
          tiktok?: string | null
          tipo_negocio?: string
          ubicacion?: string | null
          user_id?: string
          username?: string
          username_change_count?: number
          username_changed_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      crear_checkout_publico_seguro: {
        Args: {
          p_ciudad: string
          p_comprador_email: string
          p_comprador_nombre: string
          p_comprador_telefono: string
          p_comprobante_url?: string
          p_direccion: string
          p_drop_id: string
          p_metodo_envio_id: string
          p_metodo_pago_id: string
          p_prenda_ids: string[]
          p_tienda_id: string
        }
        Returns: {
          metodo_envio_nombre: string
          metodo_envio_precio: number
          metodo_pago_nombre: string
          metodo_pago_tipo: string
          monto_total: number
          numero: string
          pedido_id: string
          prenda_marca: string
          prenda_nombre: string
          prenda_talla: string
          prendas_count: number
          tienda_contact_email: string
          tienda_nombre: string
          tienda_user_id: string
          tienda_username: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
