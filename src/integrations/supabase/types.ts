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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          active: boolean
          id: string
          name: string
          sort: number
        }
        Insert: {
          active?: boolean
          id: string
          name: string
          sort?: number
        }
        Update: {
          active?: boolean
          id?: string
          name?: string
          sort?: number
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          phone: string | null
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          phone?: string | null
          provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          phone?: string | null
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_email: string | null
          id: string
          kind: string
          product_id: string
          quantity: number
          reason: string
          stock_after: number
          variant_id: string | null
          variant_label: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          id?: string
          kind: string
          product_id: string
          quantity: number
          reason?: string
          stock_after: number
          variant_id?: string | null
          variant_label?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          id?: string
          kind?: string
          product_id?: string
          quantity?: number
          reason?: string
          stock_after?: number
          variant_id?: string | null
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: string
          created_at: string
          id: string
          message: string
          order_id: string | null
          recipient: string
          status: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          message: string
          order_id?: string | null
          recipient: string
          status?: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          message?: string
          order_id?: string | null
          recipient?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          color_snapshot: string | null
          id: string
          image: string | null
          name: string
          order_id: string
          price: number
          product_id: string | null
          quantity: number
          storage_snapshot: string | null
          variant_id: string | null
        }
        Insert: {
          color_snapshot?: string | null
          id?: string
          image?: string | null
          name: string
          order_id: string
          price: number
          product_id?: string | null
          quantity: number
          storage_snapshot?: string | null
          variant_id?: string | null
        }
        Update: {
          color_snapshot?: string | null
          id?: string
          image?: string | null
          name?: string
          order_id?: string
          price?: number
          product_id?: string | null
          quantity?: number
          storage_snapshot?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          id: string
          order_id: string
          previous_status: string | null
          status: string
        }
        Insert: {
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          id?: string
          order_id: string
          previous_status?: string | null
          status: string
        }
        Update: {
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          id?: string
          order_id?: string
          previous_status?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          archived: boolean
          carrier: string | null
          checkout_fingerprint: string | null
          checkout_key: string | null
          created_at: string
          customer_name: string
          delivery_method: string
          email: string
          id: string
          notes: string | null
          order_number: string
          payment_method: string
          payment_reference: string | null
          payment_status: string
          phone: string
          status: string
          subtotal: number
          total: number
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          archived?: boolean
          carrier?: string | null
          checkout_fingerprint?: string | null
          checkout_key?: string | null
          created_at?: string
          customer_name: string
          delivery_method: string
          email: string
          id?: string
          notes?: string | null
          order_number?: string
          payment_method: string
          payment_reference?: string | null
          payment_status?: string
          phone: string
          status?: string
          subtotal?: number
          total?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          archived?: boolean
          carrier?: string | null
          checkout_fingerprint?: string | null
          checkout_key?: string | null
          created_at?: string
          customer_name?: string
          delivery_method?: string
          email?: string
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          phone?: string
          status?: string
          subtotal?: number
          total?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          active: boolean
          color_hex: string | null
          color_name: string | null
          created_at: string
          id: string
          image: string | null
          price_override: number | null
          product_id: string
          stock: number
          storage: string | null
        }
        Insert: {
          active?: boolean
          color_hex?: string | null
          color_name?: string | null
          created_at?: string
          id?: string
          image?: string | null
          price_override?: number | null
          product_id: string
          stock?: number
          storage?: string | null
        }
        Update: {
          active?: boolean
          color_hex?: string | null
          color_name?: string | null
          created_at?: string
          id?: string
          image?: string | null
          price_override?: number | null
          product_id?: string
          stock?: number
          storage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          brand: string
          capacity: string
          category_id: string
          color_variants_enabled: boolean
          colors: string[]
          created_at: string
          description: string
          features: string[]
          financing: string | null
          id: string
          image: string
          is_bestseller: boolean
          is_featured: boolean
          is_new: boolean
          is_offer: boolean
          model: string
          name: string
          old_price: number | null
          price: number
          specs: Json
          stock: number
          storage_variants_enabled: boolean
        }
        Insert: {
          active?: boolean
          brand?: string
          capacity?: string
          category_id: string
          color_variants_enabled?: boolean
          colors?: string[]
          created_at?: string
          description?: string
          features?: string[]
          financing?: string | null
          id?: string
          image?: string
          is_bestseller?: boolean
          is_featured?: boolean
          is_new?: boolean
          is_offer?: boolean
          model?: string
          name: string
          old_price?: number | null
          price?: number
          specs?: Json
          stock?: number
          storage_variants_enabled?: boolean
        }
        Update: {
          active?: boolean
          brand?: string
          capacity?: string
          category_id?: string
          color_variants_enabled?: boolean
          colors?: string[]
          created_at?: string
          description?: string
          features?: string[]
          financing?: string | null
          id?: string
          image?: string
          is_bestseller?: boolean
          is_featured?: boolean
          is_new?: boolean
          is_offer?: boolean
          model?: string
          name?: string
          old_price?: number | null
          price?: number
          specs?: Json
          stock?: number
          storage_variants_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_products: {
        Row: {
          product_id: string
          promotion_id: string
        }
        Insert: {
          product_id: string
          promotion_id: string
        }
        Update: {
          product_id?: string
          promotion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_products_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          active: boolean
          created_at: string
          description: string
          discount_percent: number | null
          ends_at: string | null
          id: string
          starts_at: string
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          discount_percent?: number | null
          ends_at?: string | null
          id?: string
          starts_at?: string
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          discount_percent?: number | null
          ends_at?: string | null
          id?: string
          starts_at?: string
          title?: string
        }
        Relationships: []
      }
      service_requests: {
        Row: {
          amount: number | null
          created_at: string
          customer_name: string
          details: Json
          email: string
          id: string
          internal_notes: string | null
          payment_method: string
          payment_reference: string | null
          payment_status: string
          phone: string
          reference: string
          service_name: string
          service_slug: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          customer_name: string
          details?: Json
          email: string
          id?: string
          internal_notes?: string | null
          payment_method: string
          payment_reference?: string | null
          payment_status?: string
          phone: string
          reference?: string
          service_name: string
          service_slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          customer_name?: string
          details?: Json
          email?: string
          id?: string
          internal_notes?: string | null
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          phone?: string
          reference?: string
          service_name?: string
          service_slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          amount_field: boolean
          cost: string
          description: string
          fee: number | null
          fields: Json
          name: string
          requirements: string[]
          short: string
          slug: string
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_field?: boolean
          cost?: string
          description?: string
          fee?: number | null
          fields?: Json
          name: string
          requirements?: string[]
          short?: string
          slug: string
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_field?: boolean
          cost?: string
          description?: string
          fee?: number | null
          fields?: Json
          name?: string
          requirements?: string[]
          short?: string
          slug?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          is_public: boolean
          key: string
          value: string
        }
        Insert: {
          is_public?: boolean
          key: string
          value?: string
        }
        Update: {
          is_public?: boolean
          key?: string
          value?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_product_inventory: {
        Args: {
          _delta?: number
          _expected_stock?: number
          _product_id: string
          _variant_id?: string
        }
        Returns: undefined
      }
      configure_initial_product_variants: {
        Args: {
          _color: boolean
          _expected_stock: number
          _product_id: string
          _storage: boolean
          _variants: Json
        }
        Returns: undefined
      }
      configure_product_variants: {
        Args: {
          _color: boolean
          _expected_stock: number
          _product_id: string
          _storage: boolean
          _variants: Json
        }
        Returns: undefined
      }
      create_order_atomic: { Args: { _input: Json }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      parse_variant_price_override: { Args: { _val: Json }; Returns: number }
      status_label: { Args: { s: string }; Returns: string }
      update_product_variant_prices: {
        Args: {
          _expected_base_price: number
          _product_id: string
          _updates: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
