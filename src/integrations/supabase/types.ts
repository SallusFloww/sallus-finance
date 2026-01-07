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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          module: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          module?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          module?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_financial_settings: {
        Row: {
          categories: Json | null
          company_id: string
          created_at: string
          id: string
          initial_balance: number
          initial_balance_adjustments: Json | null
          initial_balance_last_update: string | null
          payment_methods: Json | null
          units: Json | null
          updated_at: string
        }
        Insert: {
          categories?: Json | null
          company_id: string
          created_at?: string
          id?: string
          initial_balance?: number
          initial_balance_adjustments?: Json | null
          initial_balance_last_update?: string | null
          payment_methods?: Json | null
          units?: Json | null
          updated_at?: string
        }
        Update: {
          categories?: Json | null
          company_id?: string
          created_at?: string
          id?: string
          initial_balance?: number
          initial_balance_adjustments?: Json | null
          initial_balance_last_update?: string | null
          payment_methods?: Json | null
          units?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_financial_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_financial_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          company_id: string
          created_at: string
          currency: string
          default_period: string
          id: string
          locale: string
          score_min_days: number
          segment: string | null
          show_consolidation_message: boolean
          timezone: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          currency?: string
          default_period?: string
          id?: string
          locale?: string
          score_min_days?: number
          segment?: string | null
          show_consolidation_message?: boolean
          timezone?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: string
          default_period?: string
          id?: string
          locale?: string
          score_min_days?: number
          segment?: string | null
          show_consolidation_message?: boolean
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      conciliation_notes: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          id: string
          item_id: string
          item_type: string
          note: string
          source_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          item_id: string
          item_type?: string
          note: string
          source_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          item_id?: string
          item_type?: string
          note?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conciliation_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliation_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliation_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliation_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      conciliation_status: {
        Row: {
          company_id: string
          created_at: string
          id: string
          item_id: string
          item_type: string
          previous_status: string | null
          source_id: string
          status: string
          updated_at: string
          updated_by: string | null
          updated_by_name: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          item_id: string
          item_type?: string
          previous_status?: string | null
          source_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          previous_status?: string | null
          source_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conciliation_status_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliation_status_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliation_status_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliation_status_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entries: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          categoria: string | null
          company_id: string
          created_at: string
          created_by: string | null
          data_prevista: string
          data_recebimento: string | null
          descricao: string
          id: string
          observacao: string | null
          operadora: string | null
          payment_method: string | null
          receipt_type: string | null
          request_id: string | null
          specialty: string | null
          status: Database["public"]["Enums"]["financial_entry_status"]
          type: Database["public"]["Enums"]["financial_entry_type"]
          unit_id: string | null
          updated_at: string
          updated_by: string | null
          valor: number
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          categoria?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          data_prevista: string
          data_recebimento?: string | null
          descricao: string
          id?: string
          observacao?: string | null
          operadora?: string | null
          payment_method?: string | null
          receipt_type?: string | null
          request_id?: string | null
          specialty?: string | null
          status?: Database["public"]["Enums"]["financial_entry_status"]
          type: Database["public"]["Enums"]["financial_entry_type"]
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
          valor?: number
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          categoria?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          data_prevista?: string
          data_recebimento?: string | null
          descricao?: string
          id?: string
          observacao?: string | null
          operadora?: string | null
          payment_method?: string | null
          receipt_type?: string | null
          request_id?: string | null
          specialty?: string | null
          status?: Database["public"]["Enums"]["financial_entry_status"]
          type?: Database["public"]["Enums"]["financial_entry_type"]
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      movement_allocations: {
        Row: {
          allocation_amount: number
          allocation_percent: number
          company_id: string
          created_at: string
          criterion: string
          criterion_value: number | null
          id: string
          movement_id: string
          unit_id: string
          unit_name: string
          updated_at: string
        }
        Insert: {
          allocation_amount?: number
          allocation_percent?: number
          company_id: string
          created_at?: string
          criterion: string
          criterion_value?: number | null
          id?: string
          movement_id: string
          unit_id: string
          unit_name: string
          updated_at?: string
        }
        Update: {
          allocation_amount?: number
          allocation_percent?: number
          company_id?: string
          created_at?: string
          criterion?: string
          criterion_value?: number | null
          id?: string
          movement_id?: string
          unit_id?: string
          unit_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "movement_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_allocations_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_allocations_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements_effective"
            referencedColumns: ["id"]
          },
        ]
      }
      package_pricing_rules: {
        Row: {
          company_id: string
          consult_default_amount: number
          created_at: string
          created_by: string | null
          effective_from: string
          fee_default_amount: number
          id: string
          is_active: boolean
          notes: string | null
          package_type: string
          plan_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          consult_default_amount?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          fee_default_amount?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          package_type: string
          plan_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          consult_default_amount?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          fee_default_amount?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          package_type?: string
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_pricing_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_pricing_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_pricing_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_pricing_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          module: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          module: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string
          name?: string
        }
        Relationships: []
      }
      productions: {
        Row: {
          billed_value: number | null
          company_id: string
          competencia: string
          consult_amount: number
          convenio: string | null
          created_at: string
          created_by: string | null
          description: string
          edit_logs: Json | null
          fee_amount: number
          glossed_value: number | null
          history: Json | null
          id: string
          is_package: boolean
          linked_receivable_id: string | null
          matmed_amount: number
          package_qty: number
          package_type: string | null
          payer_type: string
          payment_method: string | null
          procedure_code: string | null
          production_date: string
          production_type: string
          quantity: number
          received_value: number | null
          request_id: string | null
          specialty: string | null
          status: string
          total_value: number
          unit: string
          unit_value: number
          updated_at: string
        }
        Insert: {
          billed_value?: number | null
          company_id: string
          competencia: string
          consult_amount?: number
          convenio?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          edit_logs?: Json | null
          fee_amount?: number
          glossed_value?: number | null
          history?: Json | null
          id?: string
          is_package?: boolean
          linked_receivable_id?: string | null
          matmed_amount?: number
          package_qty?: number
          package_type?: string | null
          payer_type: string
          payment_method?: string | null
          procedure_code?: string | null
          production_date: string
          production_type: string
          quantity?: number
          received_value?: number | null
          request_id?: string | null
          specialty?: string | null
          status?: string
          total_value?: number
          unit: string
          unit_value?: number
          updated_at?: string
        }
        Update: {
          billed_value?: number | null
          company_id?: string
          competencia?: string
          consult_amount?: number
          convenio?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          edit_logs?: Json | null
          fee_amount?: number
          glossed_value?: number | null
          history?: Json | null
          id?: string
          is_package?: boolean
          linked_receivable_id?: string | null
          matmed_amount?: number
          package_qty?: number
          package_type?: string | null
          payer_type?: string
          payment_method?: string | null
          procedure_code?: string | null
          production_date?: string
          production_type?: string
          quantity?: number
          received_value?: number | null
          request_id?: string | null
          specialty?: string | null
          status?: string
          total_value?: number
          unit?: string
          unit_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          last_login: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          last_login?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          last_login?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      receivables: {
        Row: {
          actual_receipt_date: string | null
          appeal_amount: number | null
          appeal_recovered_amount: number | null
          appeal_resolved_date: string | null
          appeal_start_date: string | null
          appeal_status: string | null
          appeal_transaction_id: string | null
          billed_amount: number
          billing_date: string
          company_id: string
          competencia: string | null
          consult_amount: number
          consult_qty: number
          created_at: string
          created_by: string | null
          description: string
          edit_logs: Json | null
          expected_receipt_days: number | null
          fee_amount: number
          gloss_reason: string | null
          gloss_type: string | null
          glossed_amount: number
          history: Json | null
          id: string
          is_package: boolean
          linked_transaction_id: string | null
          matmed_amount: number
          notes: string | null
          package_qty: number
          package_type: string | null
          received_amount: number
          request_id: string | null
          source: string
          status: string
          unit: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actual_receipt_date?: string | null
          appeal_amount?: number | null
          appeal_recovered_amount?: number | null
          appeal_resolved_date?: string | null
          appeal_start_date?: string | null
          appeal_status?: string | null
          appeal_transaction_id?: string | null
          billed_amount?: number
          billing_date: string
          company_id: string
          competencia?: string | null
          consult_amount?: number
          consult_qty?: number
          created_at?: string
          created_by?: string | null
          description: string
          edit_logs?: Json | null
          expected_receipt_days?: number | null
          fee_amount?: number
          gloss_reason?: string | null
          gloss_type?: string | null
          glossed_amount?: number
          history?: Json | null
          id?: string
          is_package?: boolean
          linked_transaction_id?: string | null
          matmed_amount?: number
          notes?: string | null
          package_qty?: number
          package_type?: string | null
          received_amount?: number
          request_id?: string | null
          source: string
          status?: string
          unit: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actual_receipt_date?: string | null
          appeal_amount?: number | null
          appeal_recovered_amount?: number | null
          appeal_resolved_date?: string | null
          appeal_start_date?: string | null
          appeal_status?: string | null
          appeal_transaction_id?: string | null
          billed_amount?: number
          billing_date?: string
          company_id?: string
          competencia?: string | null
          consult_amount?: number
          consult_qty?: number
          created_at?: string
          created_by?: string | null
          description?: string
          edit_logs?: Json | null
          expected_receipt_days?: number | null
          fee_amount?: number
          gloss_reason?: string | null
          gloss_type?: string | null
          glossed_amount?: number
          history?: Json | null
          id?: string
          is_package?: boolean
          linked_transaction_id?: string | null
          matmed_amount?: number
          notes?: string | null
          package_qty?: number
          package_type?: string | null
          received_amount?: number
          request_id?: string | null
          source?: string
          status?: string
          unit?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receivables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      user_company_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          is_primary: boolean
          role_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          role_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          role_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_company_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_company_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_company_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_company_roles_user_id_fkey_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_company_roles_user_id_fkey_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invites: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string
          role_id: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          full_name: string
          id?: string
          invited_by: string
          role_id: string
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string
          role_id?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invites_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      companies_safe: {
        Row: {
          created_at: string | null
          id: string | null
          name: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          name?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          name?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      movements_effective: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          categoria: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          data_prevista: string | null
          data_recebimento: string | null
          descricao: string | null
          effective_amount_cancelado: number | null
          effective_amount_previsto: number | null
          effective_amount_realizado: number | null
          effective_amount_recebido: number | null
          id: string | null
          is_cancelado: boolean | null
          is_entrada: boolean | null
          is_previsto: boolean | null
          is_realizado: boolean | null
          is_recebido: boolean | null
          is_saida: boolean | null
          observacao: string | null
          operadora: string | null
          payment_method: string | null
          receipt_type: string | null
          status: Database["public"]["Enums"]["financial_entry_status"] | null
          type: Database["public"]["Enums"]["financial_entry_type"] | null
          unit_id: string | null
          updated_at: string | null
          updated_by: string | null
          valor: number | null
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          categoria?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_prevista?: string | null
          data_recebimento?: string | null
          descricao?: string | null
          effective_amount_cancelado?: never
          effective_amount_previsto?: never
          effective_amount_realizado?: never
          effective_amount_recebido?: never
          id?: string | null
          is_cancelado?: never
          is_entrada?: never
          is_previsto?: never
          is_realizado?: never
          is_recebido?: never
          is_saida?: never
          observacao?: string | null
          operadora?: string | null
          payment_method?: string | null
          receipt_type?: string | null
          status?: Database["public"]["Enums"]["financial_entry_status"] | null
          type?: Database["public"]["Enums"]["financial_entry_type"] | null
          unit_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valor?: number | null
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          categoria?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_prevista?: string | null
          data_recebimento?: string | null
          descricao?: string | null
          effective_amount_cancelado?: never
          effective_amount_previsto?: never
          effective_amount_realizado?: never
          effective_amount_recebido?: never
          id?: string | null
          is_cancelado?: never
          is_entrada?: never
          is_previsto?: never
          is_realizado?: never
          is_recebido?: never
          is_saida?: never
          observacao?: string | null
          operadora?: string | null
          payment_method?: string | null
          receipt_type?: string | null
          status?: Database["public"]["Enums"]["financial_entry_status"] | null
          type?: Database["public"]["Enums"]["financial_entry_type"] | null
          unit_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_safe: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invite: {
        Args: { invite_token: string; user_id: string }
        Returns: boolean
      }
      check_permission: {
        Args: {
          _company_id: string
          _permission_code: string
          _user_id: string
        }
        Returns: boolean
      }
      get_accessible_modules: {
        Args: { _company_id: string; _user_id: string }
        Returns: {
          module: string
          permissions: string[]
        }[]
      }
      get_company_profiles_safe: {
        Args: { _company_id: string }
        Returns: {
          avatar_url: string
          created_at: string
          full_name: string
          id: string
          status: string
          updated_at: string
        }[]
      }
      get_expense_by_category: {
        Args: { p_company_id: string; p_date_end: string; p_date_start: string }
        Returns: {
          categoria: string
          count: number
          total: number
        }[]
      }
      get_financial_summary: {
        Args: {
          p_company_id: string
          p_date_end: string
          p_date_start: string
          p_unit_id?: string
        }
        Returns: {
          count_cancelado: number
          count_previsto: number
          count_realizado: number
          entradas_canceladas: number
          entradas_previstas: number
          entradas_realizadas: number
          saidas_canceladas: number
          saidas_previstas: number
          saidas_realizadas: number
          saldo_realizado: number
        }[]
      }
      get_income_breakdown: {
        Args: { p_company_id: string; p_date_end: string; p_date_start: string }
        Returns: {
          bradesco: number
          convenio: number
          credito_parcelado: number
          credito_vista: number
          debito: number
          dinheiro: number
          geap: number
          ipasgo: number
          particular: number
          pix: number
          unimed: number
        }[]
      }
      get_latest_movements: {
        Args: {
          p_company_id: string
          p_date_end?: string
          p_date_start?: string
          p_include_cancelled?: boolean
          p_include_previsto?: boolean
          p_limit?: number
        }
        Returns: {
          cancel_reason: string
          cancelled_at: string
          categoria: string
          created_at: string
          data_prevista: string
          data_recebimento: string
          descricao: string
          id: string
          observacao: string
          operadora: string
          payment_method: string
          receipt_type: string
          status: string
          type: string
          unit_id: string
          valor: number
        }[]
      }
      get_summary_by_unit: {
        Args: {
          p_company_id: string
          p_date_end: string
          p_date_start: string
          p_include_cancelled?: boolean
          p_include_previsto?: boolean
        }
        Returns: {
          cancelados_total: number
          entradas_previstas: number
          entradas_realizadas: number
          mov_count_realizado: number
          saidas_previstas: number
          saidas_realizadas: number
          saldo_realizado: number
          unit_id: string
        }[]
      }
      get_user_companies: { Args: { _user_id: string }; Returns: string[] }
      get_user_permissions: {
        Args: { _company_id: string; _user_id: string }
        Returns: {
          module: string
          permission_code: string
          permission_name: string
        }[]
      }
      has_permission: {
        Args: {
          _company_id: string
          _permission_code: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_company: {
        Args: { _company_id: string; _role_name: string; _user_id: string }
        Returns: boolean
      }
      is_active_user: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      link_receivable_to_existing_entry:
        | {
            Args: {
              p_company_id: string
              p_entry_id: string
              p_receivable_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_company_id: string
              p_entry_id: string
              p_receivable_id: string
              p_user_id: string
            }
            Returns: Json
          }
      log_access_denied: {
        Args: {
          _action: string
          _company_id: string
          _details?: Json
          _resource: string
          _user_id: string
        }
        Returns: undefined
      }
      user_belongs_to_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      validate_invite_token: {
        Args: { invite_token: string }
        Returns: {
          company_name: string
          email: string
          full_name: string
          id: string
          is_valid: boolean
          role_name: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "viewer"
      financial_entry_status: "previsto" | "recebido" | "cancelado"
      financial_entry_type: "entrada" | "saida"
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
    Enums: {
      app_role: ["admin", "manager", "viewer"],
      financial_entry_status: ["previsto", "recebido", "cancelado"],
      financial_entry_type: ["entrada", "saida"],
    },
  },
} as const
