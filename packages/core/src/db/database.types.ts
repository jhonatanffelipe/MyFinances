
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "app_meta": {
                  Row: {
                    "key": string,"value": string
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"value": string
                  }
                  Update: {
                    "key"?: string,"value"?: string
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "change_xid": unknown,"color": string | null,"created_at": string,"deleted_at": string | null,"description": string | null,"family_id": string,"icon": string | null,"id": string,"monthly_limit": number | null,"name": string,"type": Database["public"]['Enums']["transaction_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "change_xid"?: unknown,"color"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"family_id": string,"icon"?: string | null,"id"?: string,"monthly_limit"?: number | null,"name": string,"type": Database["public"]['Enums']["transaction_type"],"updated_at"?: string
                  }
                  Update: {
                    "change_xid"?: unknown,"color"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"family_id"?: string,"icon"?: string | null,"id"?: string,"monthly_limit"?: number | null,"name"?: string,"type"?: Database["public"]['Enums']["transaction_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"credit_cards": {
                  Row: {
                    "active": boolean,"change_xid": unknown,"color": string,"created_at": string,"deleted_at": string | null,"description": string,"due_day": number,"family_id": string,"id": string,"owner_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"change_xid"?: unknown,"color"?: string,"created_at"?: string,"deleted_at"?: string | null,"description": string,"due_day": number,"family_id": string,"id"?: string,"owner_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"change_xid"?: unknown,"color"?: string,"created_at"?: string,"deleted_at"?: string | null,"description"?: string,"due_day"?: number,"family_id"?: string,"id"?: string,"owner_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "credit_cards_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"device_pairings": {
                  Row: {
                    "approved_at": string | null,"consumed_at": string | null,"created_at": string,"device_name": string | null,"expires_at": string,"family_id": string,"id": string,"status": Database["public"]['Enums']["pairing_status"],"token_hash": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"consumed_at"?: string | null,"created_at"?: string,"device_name"?: string | null,"expires_at"?: string,"family_id": string,"id"?: string,"status"?: Database["public"]['Enums']["pairing_status"],"token_hash": string,"user_id"?: string
                  }
                  Update: {
                    "approved_at"?: string | null,"consumed_at"?: string | null,"created_at"?: string,"device_name"?: string | null,"expires_at"?: string,"family_id"?: string,"id"?: string,"status"?: Database["public"]['Enums']["pairing_status"],"token_hash"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "device_pairings_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"families": {
                  Row: {
                    "created_at": string,"created_by": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"family_invites": {
                  Row: {
                    "created_at": string,"created_by": string,"expires_at": string,"family_id": string,"id": string,"role": Database["public"]['Enums']["family_role"],"token_hash": string,"used_at": string | null,"used_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"expires_at"?: string,"family_id": string,"id"?: string,"role"?: Database["public"]['Enums']["family_role"],"token_hash": string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"expires_at"?: string,"family_id"?: string,"id"?: string,"role"?: Database["public"]['Enums']["family_role"],"token_hash"?: string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_invites_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"family_members": {
                  Row: {
                    "active": boolean,"family_id": string,"joined_at": string,"role": Database["public"]['Enums']["family_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"family_id": string,"joined_at"?: string,"role"?: Database["public"]['Enums']["family_role"],"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"family_id"?: string,"joined_at"?: string,"role"?: Database["public"]['Enums']["family_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_members_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"fixed_expense_payments": {
                  Row: {
                    "change_xid": unknown,"deleted_at": string | null,"family_id": string,"fixed_expense_id": string,"id": string,"paid_at": string,"paid_by": string,"updated_at": string,"year_month": string
                  }
                  ComputedFields: never
                  Insert: {
                    "change_xid"?: unknown,"deleted_at"?: string | null,"family_id": string,"fixed_expense_id": string,"id"?: string,"paid_at"?: string,"paid_by"?: string,"updated_at"?: string,"year_month": string
                  }
                  Update: {
                    "change_xid"?: unknown,"deleted_at"?: string | null,"family_id"?: string,"fixed_expense_id"?: string,"id"?: string,"paid_at"?: string,"paid_by"?: string,"updated_at"?: string,"year_month"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fixed_expense_payments_family_id_fixed_expense_id_fkey"
      columns: ["family_id","fixed_expense_id"]
isOneToOne: false
      referencedRelation: "fixed_expenses"
      referencedColumns: ["family_id","id"]
    }
                  ]
                },"fixed_expenses": {
                  Row: {
                    "active": boolean,"amount": number,"category_id": string | null,"change_xid": unknown,"created_at": string,"created_by": string,"credit_card_id": string | null,"deleted_at": string | null,"description": string,"due_day": number,"end_date": string | null,"family_id": string,"id": string,"member_id": string | null,"notes": string | null,"recurrence": Database["public"]['Enums']["recurrence"],"start_date": string,"type": Database["public"]['Enums']["transaction_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"amount": number,"category_id"?: string | null,"change_xid"?: unknown,"created_at"?: string,"created_by"?: string,"credit_card_id"?: string | null,"deleted_at"?: string | null,"description": string,"due_day": number,"end_date"?: string | null,"family_id": string,"id"?: string,"member_id"?: string | null,"notes"?: string | null,"recurrence"?: Database["public"]['Enums']["recurrence"],"start_date": string,"type"?: Database["public"]['Enums']["transaction_type"],"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"amount"?: number,"category_id"?: string | null,"change_xid"?: unknown,"created_at"?: string,"created_by"?: string,"credit_card_id"?: string | null,"deleted_at"?: string | null,"description"?: string,"due_day"?: number,"end_date"?: string | null,"family_id"?: string,"id"?: string,"member_id"?: string | null,"notes"?: string | null,"recurrence"?: Database["public"]['Enums']["recurrence"],"start_date"?: string,"type"?: Database["public"]['Enums']["transaction_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fixed_expenses_family_id_category_id_fkey"
      columns: ["family_id","category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["family_id","id"]
    },{
      foreignKeyName: "fixed_expenses_family_id_credit_card_id_fkey"
      columns: ["family_id","credit_card_id"]
isOneToOne: false
      referencedRelation: "credit_cards"
      referencedColumns: ["family_id","id"]
    },{
      foreignKeyName: "fixed_expenses_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"movements": {
                  Row: {
                    "amount": number,"category_id": string | null,"change_xid": unknown,"created_at": string,"created_by": string,"credit_card_id": string | null,"date": string,"deleted_at": string | null,"description": string,"family_id": string,"fixed_expense_id": string | null,"id": string,"import_hash": string | null,"member_id": string,"notes": string | null,"to_member_id": string | null,"type": Database["public"]['Enums']["movement_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category_id"?: string | null,"change_xid"?: unknown,"created_at"?: string,"created_by"?: string,"credit_card_id"?: string | null,"date": string,"deleted_at"?: string | null,"description": string,"family_id": string,"fixed_expense_id"?: string | null,"id"?: string,"import_hash"?: string | null,"member_id"?: string,"notes"?: string | null,"to_member_id"?: string | null,"type": Database["public"]['Enums']["movement_type"],"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"category_id"?: string | null,"change_xid"?: unknown,"created_at"?: string,"created_by"?: string,"credit_card_id"?: string | null,"date"?: string,"deleted_at"?: string | null,"description"?: string,"family_id"?: string,"fixed_expense_id"?: string | null,"id"?: string,"import_hash"?: string | null,"member_id"?: string,"notes"?: string | null,"to_member_id"?: string | null,"type"?: Database["public"]['Enums']["movement_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "movements_family_id_category_id_fkey"
      columns: ["family_id","category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["family_id","id"]
    },{
      foreignKeyName: "movements_family_id_credit_card_id_fkey"
      columns: ["family_id","credit_card_id"]
isOneToOne: false
      referencedRelation: "credit_cards"
      referencedColumns: ["family_id","id"]
    },{
      foreignKeyName: "movements_family_id_fixed_expense_id_fkey"
      columns: ["family_id","fixed_expense_id"]
isOneToOne: false
      referencedRelation: "fixed_expenses"
      referencedColumns: ["family_id","id"]
    },{
      foreignKeyName: "movements_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movements_family_id_member_id_fkey"
      columns: ["family_id","member_id"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["family_id","user_id"]
    },{
      foreignKeyName: "movements_family_id_to_member_id_fkey"
      columns: ["family_id","to_member_id"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["family_id","user_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"id": string,"name": string,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"id": string,"name": string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sync_conflicts": {
                  Row: {
                    "base_xid": unknown,"created_at": string,"family_id": string,"id": number,"overwritten": NonNullable<Json>,"pushed_by": string,"row_id": string,"server_xid": unknown,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_xid"?: unknown,"created_at"?: string,"family_id": string,"id"?: never,"overwritten": NonNullable<Json>,"pushed_by"?: string,"row_id": string,"server_xid"?: unknown,"table_name": string
                  }
                  Update: {
                    "base_xid"?: unknown,"created_at"?: string,"family_id"?: string,"id"?: never,"overwritten"?: NonNullable<Json>,"pushed_by"?: string,"row_id"?: string,"server_xid"?: unknown,"table_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sync_conflicts_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"user_devices": {
                  Row: {
                    "created_at": string,"device_name": string,"id": string,"last_seen_at": string,"platform": string,"session_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"device_name": string,"id"?: string,"last_seen_at"?: string,"platform": string,"session_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"device_name"?: string,"id"?: string,"last_seen_at"?: string,"platform"?: string,"session_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_family_invite":
{ Args: { "p_token": string }; Returns: string
                           },
"app_schema_version":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"create_device_link":
{ Args: { "p_family_id": string }; Returns: Json
                           },
"create_family":
{ Args: { "p_name": string }; Returns: string
                           },
"create_family_invite":
{ Args: { "p_family_id": string,"p_role"?: Database["public"]['Enums']["family_role"] }; Returns: string
                           },
"dashboard_summary":
{ Args: { "p_end": string,"p_family_id": string,"p_member_id"?: string,"p_start": string }; Returns: Json
                           },
"is_family_admin":
{ Args: { "p_family_id": string }; Returns: boolean
                           },
"is_family_member":
{ Args: { "p_family_id": string }; Returns: boolean
                           },
"monthly_history":
{ Args: { "p_family_id": string,"p_member_id"?: string,"p_months"?: number,"p_ref": string }; Returns: {
              "expense": number,"income": number,"year_month": string
            }[]
                           },
"my_family_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"register_device":
{ Args: { "p_device_name": string,"p_platform": string }; Returns: undefined
                           },
"resolve_device_pairing":
{ Args: { "p_approve": boolean,"p_pairing_id": string }; Returns: undefined
                           },
"revoke_device":
{ Args: { "p_device_id": string }; Returns: undefined
                           },
"set_member_active":
{ Args: { "p_active": boolean,"p_family_id": string,"p_user_id": string }; Returns: undefined
                           },
"sync_pull":
{ Args: { "p_cursor"?: string,"p_family_id": string }; Returns: Json
                           },
"sync_push":
{ Args: { "p_changes": Json,"p_family_id": string }; Returns: Json
                           }
          }
          Enums: {
            "family_role": "OWNER"|"ADMIN"|"MEMBER","movement_type": "INCOME"|"EXPENSE"|"TRANSFER","pairing_status": "WAITING_SCAN"|"WAITING_APPROVAL"|"APPROVED"|"DENIED"|"CONSUMED","recurrence": "MONTHLY"|"BIMONTHLY"|"QUARTERLY"|"SEMIANNUAL"|"ANNUAL","transaction_type": "INCOME"|"EXPENSE"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "family_role": ["OWNER", "ADMIN", "MEMBER"],"movement_type": ["INCOME", "EXPENSE", "TRANSFER"],"pairing_status": ["WAITING_SCAN", "WAITING_APPROVAL", "APPROVED", "DENIED", "CONSUMED"],"recurrence": ["MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"],"transaction_type": ["INCOME", "EXPENSE"]
          }
        }
} as const
