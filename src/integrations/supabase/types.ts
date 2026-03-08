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
        ]
      }
      companies: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          is_demo: boolean
          name: string
          owner_user_id: string | null
          plan: string
          status: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          name: string
          owner_user_id?: string | null
          plan?: string
          status?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          name?: string
          owner_user_id?: string | null
          plan?: string
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
          exam_types: Json | null
          id: string
          initial_balance: number
          initial_balance_adjustments: Json | null
          initial_balance_last_update: string | null
          payers: Json | null
          payment_methods: Json | null
          payment_methods_particular: Json | null
          production_types: Json | null
          specialties: Json | null
          system_parameters: Json | null
          units: Json | null
          updated_at: string
        }
        Insert: {
          categories?: Json | null
          company_id: string
          created_at?: string
          exam_types?: Json | null
          id?: string
          initial_balance?: number
          initial_balance_adjustments?: Json | null
          initial_balance_last_update?: string | null
          payers?: Json | null
          payment_methods?: Json | null
          payment_methods_particular?: Json | null
          production_types?: Json | null
          specialties?: Json | null
          system_parameters?: Json | null
          units?: Json | null
          updated_at?: string
        }
        Update: {
          categories?: Json | null
          company_id?: string
          created_at?: string
          exam_types?: Json | null
          id?: string
          initial_balance?: number
          initial_balance_adjustments?: Json | null
          initial_balance_last_update?: string | null
          payers?: Json | null
          payment_methods?: Json | null
          payment_methods_particular?: Json | null
          production_types?: Json | null
          specialties?: Json | null
          system_parameters?: Json | null
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
        ]
      }
      company_financial_settings_categories_backup: {
        Row: {
          backed_up_at: string | null
          categories: Json | null
          company_id: string | null
        }
        Insert: {
          backed_up_at?: string | null
          categories?: Json | null
          company_id?: string | null
        }
        Update: {
          backed_up_at?: string | null
          categories?: Json | null
          company_id?: string | null
        }
        Relationships: []
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
        ]
      }
      company_usage_metrics: {
        Row: {
          company_id: string
          created_at: string | null
          financial_volume: number | null
          id: string
          metric_date: string
          total_records: number | null
          total_users: number | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          financial_volume?: number | null
          id?: string
          metric_date?: string
          total_records?: number | null
          total_users?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          financial_volume?: number | null
          id?: string
          metric_date?: string
          total_records?: number | null
          total_users?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_usage_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      conciliation_notes: {
        Row: {
          company_id: string
          conciliation_status_id: string | null
          created_at: string
          created_by: string | null
          id: string
          note: string
          receivable_id: string | null
        }
        Insert: {
          company_id: string
          conciliation_status_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note: string
          receivable_id?: string | null
        }
        Update: {
          company_id?: string
          conciliation_status_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          receivable_id?: string | null
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
            foreignKeyName: "conciliation_notes_conciliation_status_id_fkey"
            columns: ["conciliation_status_id"]
            isOneToOne: false
            referencedRelation: "conciliation_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliation_notes_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      conciliation_status: {
        Row: {
          company_id: string
          created_at: string
          financial_entry_id: string | null
          id: string
          matched_at: string | null
          matched_by: string | null
          receivable_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          financial_entry_id?: string | null
          id?: string
          matched_at?: string | null
          matched_by?: string | null
          receivable_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          financial_entry_id?: string | null
          id?: string
          matched_at?: string | null
          matched_by?: string | null
          receivable_id?: string | null
          status?: string
          updated_at?: string
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
            foreignKeyName: "conciliation_status_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliation_status_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliation_status_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          name: string
          specialty_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          name: string
          specialty_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          specialty_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string | null
          error_message: string
          id: string
          page: string | null
          severity: string | null
          stack_trace: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string | null
          error_message: string
          id?: string
          page?: string | null
          severity?: string | null
          stack_trace?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string | null
          error_message?: string
          id?: string
          page?: string | null
          severity?: string | null
          stack_trace?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          valor: number
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
        ]
      }
      health_plans: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          health_plan_id: string
          id: string
          is_active: boolean
          notes: string | null
          package_type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          consult_default_amount?: number
          created_at?: string
          created_by?: string | null
          effective_from: string
          fee_default_amount?: number
          health_plan_id: string
          id?: string
          is_active?: boolean
          notes?: string | null
          package_type: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          consult_default_amount?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          fee_default_amount?: number
          health_plan_id?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          package_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_package_rule_health_plan"
            columns: ["health_plan_id"]
            isOneToOne: false
            referencedRelation: "health_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_pricing_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      production_import_batches: {
        Row: {
          company_id: string
          context: Json
          created_at: string
          created_by: string
          error_message: string | null
          file_name: string | null
          id: string
          import_hash: string | null
          invalid_rows: number
          status: string
          total_rows: number
          total_value: number | null
          valid_rows: number
        }
        Insert: {
          company_id: string
          context: Json
          created_at?: string
          created_by: string
          error_message?: string | null
          file_name?: string | null
          id?: string
          import_hash?: string | null
          invalid_rows: number
          status?: string
          total_rows: number
          total_value?: number | null
          valid_rows: number
        }
        Update: {
          company_id?: string
          context?: Json
          created_at?: string
          created_by?: string
          error_message?: string | null
          file_name?: string | null
          id?: string
          import_hash?: string | null
          invalid_rows?: number
          status?: string
          total_rows?: number
          total_value?: number | null
          valid_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_import_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      productions: {
        Row: {
          billed_value: number | null
          company_id: string
          competencia: string
          consult_amount: number | null
          created_at: string
          created_by: string | null
          description: string
          doctor_id: string | null
          edit_logs: Json | null
          fee_amount: number | null
          glossed_value: number | null
          health_plan_id: string
          history: Json | null
          id: string
          import_batch_id: string | null
          import_row_number: number | null
          import_source: string
          is_package: boolean | null
          linked_receivable_id: string | null
          matmed_amount: number | null
          paciente_nome: string | null
          package_qty: number | null
          package_type: string | null
          payer_type: string
          payment_method: string | null
          procedure_code: string | null
          production_date: string
          production_type: string
          quantity: number
          received_value: number | null
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
          consult_amount?: number | null
          created_at?: string
          created_by?: string | null
          description: string
          doctor_id?: string | null
          edit_logs?: Json | null
          fee_amount?: number | null
          glossed_value?: number | null
          health_plan_id: string
          history?: Json | null
          id?: string
          import_batch_id?: string | null
          import_row_number?: number | null
          import_source?: string
          is_package?: boolean | null
          linked_receivable_id?: string | null
          matmed_amount?: number | null
          paciente_nome?: string | null
          package_qty?: number | null
          package_type?: string | null
          payer_type: string
          payment_method?: string | null
          procedure_code?: string | null
          production_date: string
          production_type: string
          quantity?: number
          received_value?: number | null
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
          consult_amount?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          doctor_id?: string | null
          edit_logs?: Json | null
          fee_amount?: number | null
          glossed_value?: number | null
          health_plan_id?: string
          history?: Json | null
          id?: string
          import_batch_id?: string | null
          import_row_number?: number | null
          import_source?: string
          is_package?: boolean | null
          linked_receivable_id?: string | null
          matmed_amount?: number | null
          paciente_nome?: string | null
          package_qty?: number | null
          package_type?: string | null
          payer_type?: string
          payment_method?: string | null
          procedure_code?: string | null
          production_date?: string
          production_type?: string
          quantity?: number
          received_value?: number | null
          specialty?: string | null
          status?: string
          total_value?: number
          unit?: string
          unit_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_production_health_plan"
            columns: ["health_plan_id"]
            isOneToOne: false
            referencedRelation: "health_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_productions_doctor"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          created_at: string
          created_by: string | null
          description: string
          edit_logs: Json | null
          expected_receipt_days: number | null
          gloss_reason: string | null
          gloss_type: string | null
          glossed_amount: number
          history: Json | null
          id: string
          idempotency_key: string | null
          linked_transaction_id: string | null
          notes: string | null
          received_amount: number
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
          billed_amount: number
          billing_date: string
          company_id: string
          competencia?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          edit_logs?: Json | null
          expected_receipt_days?: number | null
          gloss_reason?: string | null
          gloss_type?: string | null
          glossed_amount?: number
          history?: Json | null
          id?: string
          idempotency_key?: string | null
          linked_transaction_id?: string | null
          notes?: string | null
          received_amount?: number
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
          created_at?: string
          created_by?: string | null
          description?: string
          edit_logs?: Json | null
          expected_receipt_days?: number | null
          gloss_reason?: string | null
          gloss_type?: string | null
          glossed_amount?: number
          history?: Json | null
          id?: string
          idempotency_key?: string | null
          linked_transaction_id?: string | null
          notes?: string | null
          received_amount?: number
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
        ]
      }
      system_alerts: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          message: string
          resolved: boolean
          severity: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          resolved?: boolean
          severity?: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          resolved?: boolean
          severity?: string
        }
        Relationships: []
      }
      system_backups: {
        Row: {
          backup_date: string | null
          created_at: string | null
          id: string
          status: string | null
          table_name: string
          total_records: number | null
        }
        Insert: {
          backup_date?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          table_name: string
          total_records?: number | null
        }
        Update: {
          backup_date?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          table_name?: string
          total_records?: number | null
        }
        Relationships: []
      }
      system_metrics: {
        Row: {
          context: Json | null
          created_at: string | null
          id: string
          metric_name: string
          value: number | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          id?: string
          metric_name: string
          value?: number | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          id?: string
          metric_name?: string
          value?: number | null
        }
        Relationships: []
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
            foreignKeyName: "user_company_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
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
      v_invalid_categories: {
        Row: {
          categoria: string | null
          company_id: string | null
          id: string | null
        }
        Insert: {
          categoria?: string | null
          company_id?: string | null
          id?: string | null
        }
        Update: {
          categoria?: string | null
          company_id?: string | null
          id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_user_registration: {
        Args: { _company_id: string; _role_id: string; _user_id: string }
        Returns: boolean
      }
      cleanup_company_data_by_window: {
        Args: {
          p_confirm_text?: string
          p_dry_run?: boolean
          p_minutes: number
        }
        Returns: Json
      }
      create_default_company_for_user: {
        Args: { _user_email: string; _user_id: string; _user_name: string }
        Returns: Json
      }
      find_doctor_by_name: {
        Args: { _company_id: string; _doctor_name: string }
        Returns: string
      }
      get_company_plan_limits: { Args: { _company_id: string }; Returns: Json }
      get_pending_registrations: {
        Args: { _company_id: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          user_id: string
        }[]
      }
      get_user_companies: { Args: { _user_id: string }; Returns: string[] }
      get_user_permissions: {
        Args: { _user_id: string }
        Returns: {
          module: string
          permission_code: string
          permission_name: string
        }[]
      }
      has_role_in_company: {
        Args: { _company_id: string; _role_name: string; _user_id: string }
        Returns: boolean
      }
      import_productions_batch: {
        Args: {
          _company_id: string
          _context: Json
          _file_name: string
          _rows: Json
        }
        Returns: Json
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_valid_financial_category: {
        Args: { p_category: string; p_company_id: string }
        Returns: boolean
      }
      is_valid_financial_category_code: {
        Args: { p_code: string; p_company_id: string }
        Returns: boolean
      }
      link_receivable_to_existing_entry: {
        Args: { _financial_entry_id: string; _receivable_id: string }
        Returns: boolean
      }
      normalize_text: { Args: { "": string }; Returns: string }
      reset_demo_company: { Args: { _company_id: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
      upsert_production_type_with_category: {
        Args: {
          _company_id: string
          _description?: string
          _desired_entry_type?: string
          _name: string
        }
        Returns: Json
      }
      user_belongs_to_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      validate_invite_token: {
        Args: { _token: string }
        Returns: {
          company_id: string
          company_name: string
          email: string
          expires_at: string
          full_name: string
          id: string
          role_id: string
          role_name: string
          status: string
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
