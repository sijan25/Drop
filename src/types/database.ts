export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      asientos_diario: {
        Row: {
          created_at: string
          descripcion: string
          empresa_id: string
          fecha: string
          id: string
          moneda: string
          numero_folio: string | null
          tipo_cambio: number
        }
        Insert: {
          created_at?: string
          descripcion: string
          empresa_id: string
          fecha: string
          id?: string
          moneda?: string
          numero_folio?: string | null
          tipo_cambio?: number
        }
        Update: {
          created_at?: string
          descripcion?: string
          empresa_id?: string
          fecha?: string
          id?: string
          moneda?: string
          numero_folio?: string | null
          tipo_cambio?: number
        }
        Relationships: [
          {
            foreignKeyName: "asientos_diario_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
      catalogo_cuentas: {
        Row: {
          activa: boolean
          codigo: string
          created_at: string
          empresa_id: string
          id: string
          naturaleza: string
          nivel: number
          nombre: string
          padre_id: string | null
          tipo: string
        }
        Insert: {
          activa?: boolean
          codigo: string
          created_at?: string
          empresa_id: string
          id?: string
          naturaleza: string
          nivel?: number
          nombre: string
          padre_id?: string | null
          tipo: string
        }
        Update: {
          activa?: boolean
          codigo?: string
          created_at?: string
          empresa_id?: string
          id?: string
          naturaleza?: string
          nivel?: number
          nombre?: string
          padre_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_cuentas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_cuentas_padre_id_fkey"
            columns: ["padre_id"]
            isOneToOne: false
            referencedRelation: "catalogo_cuentas"
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
      compras: {
        Row: {
          created_at: string
          descripcion: string
          empresa_id: string
          estado: string
          fecha: string
          id: string
          monto_hnl: number
          monto_usd: number | null
          numero_factura: string
          proveedor: string
          tipo_cambio: number
        }
        Insert: {
          created_at?: string
          descripcion?: string
          empresa_id: string
          estado?: string
          fecha: string
          id?: string
          monto_hnl?: number
          monto_usd?: number | null
          numero_factura: string
          proveedor: string
          tipo_cambio?: number
        }
        Update: {
          created_at?: string
          descripcion?: string
          empresa_id?: string
          estado?: string
          fecha?: string
          id?: string
          monto_hnl?: number
          monto_usd?: number | null
          numero_factura?: string
          proveedor?: string
          tipo_cambio?: number
        }
        Relationships: [
          {
            foreignKeyName: "compras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
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
          verificacion_automatica?: boolean | null
          verificado_at?: string | null
          fecha_transferencia?: string | null
          id?: string
          imagen_url: string
          monto_declarado?: number | null
          notas_rechazo?: string | null
          pedido_id: string
          referencia?: string | null
          tienda_id: string
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
          portada_cloudinary_id: string | null
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
          portada_cloudinary_id?: string | null
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
          portada_cloudinary_id?: string | null
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
      empresas: {
        Row: {
          created_at: string
          direccion: string | null
          id: string
          logo_url: string | null
          moneda_base: string
          nombre: string
          pais: string
          rtn: string | null
          telefono: string | null
          usa_dual_moneda: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          direccion?: string | null
          id?: string
          logo_url?: string | null
          moneda_base?: string
          nombre: string
          pais?: string
          rtn?: string | null
          telefono?: string | null
          usa_dual_moneda?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          direccion?: string | null
          id?: string
          logo_url?: string | null
          moneda_base?: string
          nombre?: string
          pais?: string
          rtn?: string | null
          telefono?: string | null
          usa_dual_moneda?: boolean
          user_id?: string
        }
        Relationships: []
      }
      inventario_items: {
        Row: {
          cantidad: number
          categoria: string
          codigo: string | null
          created_at: string
          empresa_id: string
          estado: string
          id: string
          nombre: string
          precio_hnl: number
          precio_usd: number | null
          unidad_medida: string
        }
        Insert: {
          cantidad?: number
          categoria: string
          codigo?: string | null
          created_at?: string
          empresa_id: string
          estado?: string
          id?: string
          nombre: string
          precio_hnl?: number
          precio_usd?: number | null
          unidad_medida?: string
        }
        Update: {
          cantidad?: number
          categoria?: string
          codigo?: string | null
          created_at?: string
          empresa_id?: string
          estado?: string
          id?: string
          nombre?: string
          precio_hnl?: number
          precio_usd?: number | null
          unidad_medida?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventario_items_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      lineas_asiento: {
        Row: {
          asiento_id: string
          cuenta_id: string
          debe: number
          descripcion: string | null
          haber: number
          id: string
        }
        Insert: {
          asiento_id: string
          cuenta_id: string
          debe?: number
          descripcion?: string | null
          haber?: number
          id?: string
        }
        Update: {
          asiento_id?: string
          cuenta_id?: string
          debe?: number
          descripcion?: string | null
          haber?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineas_asiento_asiento_id_fkey"
            columns: ["asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos_diario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineas_asiento_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "catalogo_cuentas"
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
          tracking_url: string | null
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
          tracking_url?: string | null
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
          tracking_url?: string | null
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
          envio_courier_id: string | null
          envio_courier_logo: string | null
          envio_courier_nombre: string | null
          envio_estado: string | null
          envio_label_url: string | null
          envio_metadata: Json
          envio_modalidad: string | null
          envio_monto: number
          envio_proveedor: string | null
          envio_tracking_url: string | null
          estado: string | null
          foto_paquete_url: string | null
          id: string
          metodo_envio: string | null
          metodo_pago: string | null
          monto_total: number
          numero: string
          pagado_at: string | null
          pixelpay_order_id: string | null
          pixelpay_payment_hash: string | null
          pixelpay_payment_uuid: string | null
          pixelpay_response: Json
          pixelpay_transaction_id: string | null
          simbolo_moneda: string | null
          moneda: string | null
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
          envio_courier_id?: string | null
          envio_courier_logo?: string | null
          envio_courier_nombre?: string | null
          envio_estado?: string | null
          envio_label_url?: string | null
          envio_metadata?: Json
          envio_modalidad?: string | null
          envio_monto?: number
          envio_proveedor?: string | null
          envio_tracking_url?: string | null
          estado?: string | null
          foto_paquete_url?: string | null
          id?: string
          metodo_envio?: string | null
          metodo_pago?: string | null
          monto_total: number
          numero: string
          pagado_at?: string | null
          pixelpay_order_id?: string | null
          pixelpay_payment_hash?: string | null
          pixelpay_payment_uuid?: string | null
          pixelpay_response?: Json
          pixelpay_transaction_id?: string | null
          simbolo_moneda?: string | null
          moneda?: string | null
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
          envio_courier_id?: string | null
          envio_courier_logo?: string | null
          envio_courier_nombre?: string | null
          envio_estado?: string | null
          envio_label_url?: string | null
          envio_metadata?: Json
          envio_modalidad?: string | null
          envio_monto?: number
          envio_proveedor?: string | null
          envio_tracking_url?: string | null
          estado?: string | null
          foto_paquete_url?: string | null
          id?: string
          metodo_envio?: string | null
          metodo_pago?: string | null
          monto_total?: number
          numero?: string
          pagado_at?: string | null
          pixelpay_order_id?: string | null
          pixelpay_payment_hash?: string | null
          pixelpay_payment_uuid?: string | null
          pixelpay_response?: Json
          pixelpay_transaction_id?: string | null
          simbolo_moneda?: string | null
          moneda?: string | null
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
      payment_attempts: {
        Row: {
          amount: number
          created_at: string
          currency: string
          error_message: string | null
          id: string
          idempotency_key: string
          order_id: string
          payment_uuid: string | null
          pedido_id: string
          provider: string
          request_payload: Json
          response_payload: Json
          sandbox: boolean
          status: string
          tienda_id: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          error_message?: string | null
          id?: string
          idempotency_key: string
          order_id: string
          payment_uuid?: string | null
          pedido_id: string
          provider: string
          request_payload?: Json
          response_payload?: Json
          sandbox?: boolean
          status?: string
          tienda_id: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string
          order_id?: string
          payment_uuid?: string | null
          pedido_id?: string
          provider?: string
          request_payload?: Json
          response_payload?: Json
          sandbox?: boolean
          status?: string
          tienda_id?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      ppe_activos: {
        Row: {
          clase: string
          costo: number
          created_at: string
          descripcion: string | null
          empresa_id: string
          estado: string
          fecha_compra: string
          id: string
          moneda: string
          nombre: string
          numero_activo: string | null
          numero_serie: string | null
          ubicacion: string | null
          valor_residual_pct: number
          vida_util_años: number
        }
        Insert: {
          clase: string
          costo: number
          created_at?: string
          descripcion?: string | null
          empresa_id: string
          estado?: string
          fecha_compra: string
          id?: string
          moneda?: string
          nombre: string
          numero_activo?: string | null
          numero_serie?: string | null
          ubicacion?: string | null
          valor_residual_pct?: number
          vida_util_años: number
        }
        Update: {
          clase?: string
          costo?: number
          created_at?: string
          descripcion?: string | null
          empresa_id?: string
          estado?: string
          fecha_compra?: string
          id?: string
          moneda?: string
          nombre?: string
          numero_activo?: string | null
          numero_serie?: string | null
          ubicacion?: string | null
          valor_residual_pct?: number
          vida_util_años?: number
        }
        Relationships: [
          {
            foreignKeyName: "ppe_activos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      prendas: {
        Row: {
          cantidad: number
          cantidades_por_talla: Json
          categoria: string | null
          cloudinary_ids: string[] | null
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
          cloudinary_ids?: string[] | null
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
          cloudinary_ids?: string[] | null
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
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
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
          ciudad: string | null
          contact_email: string | null
          cover_cloudinary_id: string | null
          cover_url: string | null
          created_at: string | null
          departamento: string | null
          facebook: string | null
          id: string
          instagram: string | null
          logo_cloudinary_id: string | null
          logo_url: string | null
          next_order_number: number
          nombre: string
          order_prefix: string
          paypal_plan_id: string | null
          paypal_sub_id: string | null
          pixelpay_enabled: boolean
          pixelpay_endpoint: string | null
          pixelpay_key_id: string | null
          pixelpay_sandbox: boolean
          pixelpay_secret_key: string | null
          boxful_email: string | null
          boxful_password: string | null
          boxful_enabled: boolean
          codigo_telefono: string
          moneda: string
          pais: string
          plan: string | null
          plan_status: string | null
          plan_vence_at: string | null
          simbolo_moneda: string
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
          ciudad?: string | null
          codigo_telefono?: string
          contact_email?: string | null
          cover_cloudinary_id?: string | null
          cover_url?: string | null
          created_at?: string | null
          departamento?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          logo_cloudinary_id?: string | null
          logo_url?: string | null
          moneda?: string
          next_order_number?: number
          nombre: string
          order_prefix: string
          pais?: string
          paypal_plan_id?: string | null
          paypal_sub_id?: string | null
          pixelpay_enabled?: boolean
          pixelpay_endpoint?: string | null
          pixelpay_key_id?: string | null
          pixelpay_sandbox?: boolean
          boxful_email?: string | null
          boxful_password?: string | null
          boxful_enabled?: boolean
          plan?: string | null
          plan_status?: string | null
          plan_vence_at?: string | null
          simbolo_moneda?: string
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
          ciudad?: string | null
          codigo_telefono?: string
          contact_email?: string | null
          cover_cloudinary_id?: string | null
          cover_url?: string | null
          created_at?: string | null
          departamento?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          logo_cloudinary_id?: string | null
          logo_url?: string | null
          moneda?: string
          next_order_number?: number
          nombre?: string
          order_prefix?: string
          pais?: string
          paypal_plan_id?: string | null
          paypal_sub_id?: string | null
          pixelpay_enabled?: boolean
          pixelpay_endpoint?: string | null
          pixelpay_key_id?: string | null
          pixelpay_sandbox?: boolean
          boxful_email?: string | null
          boxful_password?: string | null
          boxful_enabled?: boolean
          plan?: string | null
          plan_status?: string | null
          plan_vence_at?: string | null
          simbolo_moneda?: string
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
      tipos_cambio: {
        Row: {
          empresa_id: string
          fecha: string
          id: string
          moneda: string
          valor: number
        }
        Insert: {
          empresa_id: string
          fecha: string
          id?: string
          moneda: string
          valor: number
        }
        Update: {
          empresa_id?: string
          fecha?: string
          id?: string
          moneda?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "tipos_cambio_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ventas: {
        Row: {
          cliente: string
          created_at: string
          descripcion: string
          empresa_id: string
          estado: string
          fecha: string
          id: string
          monto_hnl: number
          monto_usd: number | null
          numero_factura: string
          tipo_cambio: number
        }
        Insert: {
          cliente: string
          created_at?: string
          descripcion?: string
          empresa_id: string
          estado?: string
          fecha: string
          id?: string
          monto_hnl?: number
          monto_usd?: number | null
          numero_factura: string
          tipo_cambio?: number
        }
        Update: {
          cliente?: string
          created_at?: string
          descripcion?: string
          empresa_id?: string
          estado?: string
          fecha?: string
          id?: string
          monto_hnl?: number
          monto_usd?: number | null
          numero_factura?: string
          tipo_cambio?: number
        }
        Relationships: [
          {
            foreignKeyName: "ventas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calcular_depreciacion_mensual: {
        Args: {
          p_costo: number
          p_valor_residual_pct: number
          p_vida_util_años: number
        }
        Returns: number
      }
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      close_expired_drops: { Args: never; Returns: undefined }
      crear_checkout_publico_seguro: {
        Args: {
          p_ciudad: string
          p_comprador_email: string
          p_comprador_nombre: string
          p_comprador_telefono: string
          p_comprobante_url?: string
          p_direccion: string
          p_drop_id: string
          p_envio_courier_id?: string
          p_envio_courier_logo?: string
          p_envio_courier_nombre?: string
          p_envio_metadata?: Json
          p_envio_modalidad?: string
          p_envio_monto?: number
          p_envio_proveedor?: string
          p_items: Json
          p_metodo_envio_id: string
          p_metodo_pago_id: string
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
      ensure_unique_order_prefix: {
        Args: { base_prefix: string; store_id?: string }
        Returns: string
      }
      normalize_order_prefix: { Args: { raw_value: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof Database
}
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
