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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          acquisition_date: string | null
          estimated_value: number | null
          id: string
          name: string | null
          notes: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          acquisition_date?: string | null
          estimated_value?: number | null
          id?: string
          name?: string | null
          notes?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          acquisition_date?: string | null
          estimated_value?: number | null
          id?: string
          name?: string | null
          notes?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string | null
          created_at: string | null
          details: Json | null
          id: string
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_type: string | null
          balance: number | null
          bank_name: string
          created_at: string | null
          id: string
          last_updated: string | null
          notes: string | null
        }
        Insert: {
          account_type?: string | null
          balance?: number | null
          bank_name: string
          created_at?: string | null
          id?: string
          last_updated?: string | null
          notes?: string | null
        }
        Update: {
          account_type?: string | null
          balance?: number | null
          bank_name?: string
          created_at?: string | null
          id?: string
          last_updated?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      bank_import_history: {
        Row: {
          auto_categorized: number | null
          bank_account_id: string | null
          duplicate_transactions: number | null
          file_name: string
          file_path: string
          file_size_bytes: number | null
          file_type: string | null
          id: string
          imported_at: string | null
          imported_by: string | null
          metadata: Json | null
          new_transactions: number | null
          pending_review: number | null
          period_end: string | null
          period_start: string | null
          reference_month: string | null
          total_credits: number | null
          total_debits: number | null
          total_transactions: number | null
        }
        Insert: {
          auto_categorized?: number | null
          bank_account_id?: string | null
          duplicate_transactions?: number | null
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          metadata?: Json | null
          new_transactions?: number | null
          pending_review?: number | null
          period_end?: string | null
          period_start?: string | null
          reference_month?: string | null
          total_credits?: number | null
          total_debits?: number | null
          total_transactions?: number | null
        }
        Update: {
          auto_categorized?: number | null
          bank_account_id?: string | null
          duplicate_transactions?: number | null
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          metadata?: Json | null
          new_transactions?: number | null
          pending_review?: number | null
          period_end?: string | null
          period_start?: string | null
          reference_month?: string | null
          total_credits?: number | null
          total_debits?: number | null
          total_transactions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_import_history_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          bank_account_id: string | null
          category_confidence: string | null
          category_confirmed: string | null
          category_intent: string | null
          category_label: string | null
          category_suggestion: string | null
          created_at: string | null
          date: string
          description: string | null
          external_id: string | null
          id: string
          matched_expense_id: string | null
          matched_revenue_id: string | null
          raw_data: Json | null
          source: string | null
          status: string | null
          transaction_hash: string | null
          type: string | null
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          category_confidence?: string | null
          category_confirmed?: string | null
          category_intent?: string | null
          category_label?: string | null
          category_suggestion?: string | null
          created_at?: string | null
          date: string
          description?: string | null
          external_id?: string | null
          id?: string
          matched_expense_id?: string | null
          matched_revenue_id?: string | null
          raw_data?: Json | null
          source?: string | null
          status?: string | null
          transaction_hash?: string | null
          type?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          category_confidence?: string | null
          category_confirmed?: string | null
          category_intent?: string | null
          category_label?: string | null
          category_suggestion?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          external_id?: string | null
          id?: string
          matched_expense_id?: string | null
          matched_revenue_id?: string | null
          raw_data?: Json | null
          source?: string | null
          status?: string | null
          transaction_hash?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_expense_id_fkey"
            columns: ["matched_expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_revenue_id_fkey"
            columns: ["matched_revenue_id"]
            isOneToOne: false
            referencedRelation: "revenues"
            referencedColumns: ["id"]
          },
        ]
      }
      celesc_invoices: {
        Row: {
          amount_paid: number | null
          cosip: number | null
          created_at: string | null
          created_by: string | null
          due_date: string | null
          icms_pct: number | null
          id: string
          invoice_total: number | null
          kwh_total: number | null
          pdf_url: string | null
          pis_cofins_pct: number | null
          reference_month: string | null
          residencial_code: string | null
          solar_kwh_offset: number | null
          tariff_per_kwh: number | null
        }
        Insert: {
          amount_paid?: number | null
          cosip?: number | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          icms_pct?: number | null
          id?: string
          invoice_total?: number | null
          kwh_total?: number | null
          pdf_url?: string | null
          pis_cofins_pct?: number | null
          reference_month?: string | null
          residencial_code?: string | null
          solar_kwh_offset?: number | null
          tariff_per_kwh?: number | null
        }
        Update: {
          amount_paid?: number | null
          cosip?: number | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          icms_pct?: number | null
          id?: string
          invoice_total?: number | null
          kwh_total?: number | null
          pdf_url?: string | null
          pis_cofins_pct?: number | null
          reference_month?: string | null
          residencial_code?: string | null
          solar_kwh_offset?: number | null
          tariff_per_kwh?: number | null
        }
        Relationships: []
      }
      classification_patterns: {
        Row: {
          auto_apply: boolean | null
          category: string
          count: number | null
          created_at: string | null
          description_pattern: string
          id: string
          intent: string
          label: string
          updated_at: string | null
        }
        Insert: {
          auto_apply?: boolean | null
          category: string
          count?: number | null
          created_at?: string | null
          description_pattern: string
          id?: string
          intent: string
          label: string
          updated_at?: string | null
        }
        Update: {
          auto_apply?: boolean | null
          category?: string
          count?: number | null
          created_at?: string | null
          description_pattern?: string
          id?: string
          intent?: string
          label?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      consortiums: {
        Row: {
          id: string
          installments_paid: number | null
          installments_total: number | null
          monthly_payment: number | null
          name: string | null
          status: string | null
          total_value: number | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          installments_paid?: number | null
          installments_total?: number | null
          monthly_payment?: number | null
          name?: string | null
          status?: string | null
          total_value?: number | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          installments_paid?: number | null
          installments_total?: number | null
          monthly_payment?: number | null
          name?: string | null
          status?: string | null
          total_value?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      construction_expenses: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          expense_date: string | null
          id: string
          installments_paid: number | null
          installments_total: number | null
          next_due_date: string | null
          paid_by: string | null
          partner_amount: number | null
          payment_type: string | null
          property_code: string | null
          property_id: string | null
          receipt_url: string | null
          total_amount: number | null
          william_amount: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expense_date?: string | null
          id?: string
          installments_paid?: number | null
          installments_total?: number | null
          next_due_date?: string | null
          paid_by?: string | null
          partner_amount?: number | null
          payment_type?: string | null
          property_code?: string | null
          property_id?: string | null
          receipt_url?: string | null
          total_amount?: number | null
          william_amount?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expense_date?: string | null
          id?: string
          installments_paid?: number | null
          installments_total?: number | null
          next_due_date?: string | null
          paid_by?: string | null
          partner_amount?: number | null
          payment_type?: string | null
          property_code?: string | null
          property_id?: string | null
          receipt_url?: string | null
          total_amount?: number | null
          william_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "construction_expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "real_estate_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_categories: {
        Row: {
          active: boolean | null
          color: string | null
          created_at: string | null
          emoji: string | null
          id: string
          name: string
          type: string | null
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          name: string
          type?: string | null
        }
        Update: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          name?: string
          type?: string | null
        }
        Relationships: []
      }
      debts: {
        Row: {
          created_at: string | null
          creditor: string | null
          due_date: string | null
          id: string
          monthly_payment: number | null
          name: string | null
          remaining_amount: number | null
          status: string | null
          total_amount: number | null
        }
        Insert: {
          created_at?: string | null
          creditor?: string | null
          due_date?: string | null
          id?: string
          monthly_payment?: number | null
          name?: string | null
          remaining_amount?: number | null
          status?: string | null
          total_amount?: number | null
        }
        Update: {
          created_at?: string | null
          creditor?: string | null
          due_date?: string | null
          id?: string
          monthly_payment?: number | null
          name?: string | null
          remaining_amount?: number | null
          status?: string | null
          total_amount?: number | null
        }
        Relationships: []
      }
      energy_readings: {
        Row: {
          amount_to_charge: number | null
          celesc_invoice_id: string | null
          consumption_kwh: number | null
          created_at: string | null
          created_by: string | null
          id: string
          kitnet_id: string | null
          reading_current: number | null
          reading_previous: number | null
          reference_month: string | null
          tariff_per_kwh: number | null
        }
        Insert: {
          amount_to_charge?: number | null
          celesc_invoice_id?: string | null
          consumption_kwh?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          kitnet_id?: string | null
          reading_current?: number | null
          reading_previous?: number | null
          reference_month?: string | null
          tariff_per_kwh?: number | null
        }
        Update: {
          amount_to_charge?: number | null
          celesc_invoice_id?: string | null
          consumption_kwh?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          kitnet_id?: string | null
          reading_current?: number | null
          reading_previous?: number | null
          reference_month?: string | null
          tariff_per_kwh?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "energy_readings_celesc_invoice_id_fkey"
            columns: ["celesc_invoice_id"]
            isOneToOne: false
            referencedRelation: "celesc_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "energy_readings_kitnet_id_fkey"
            columns: ["kitnet_id"]
            isOneToOne: false
            referencedRelation: "kitnets"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          paid_at: string | null
          reference_month: string | null
          type: string | null
        }
        Insert: {
          amount?: number | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          paid_at?: string | null
          reference_month?: string | null
          type?: string | null
        }
        Update: {
          amount?: number | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          paid_at?: string | null
          reference_month?: string | null
          type?: string | null
        }
        Relationships: []
      }
      goals: {
        Row: {
          current_value: number | null
          deadline: string | null
          id: string
          name: string | null
          notes: string | null
          target_value: number | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          current_value?: number | null
          deadline?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          target_value?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          current_value?: number | null
          deadline?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          target_value?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      import_history: {
        Row: {
          file_name: string | null
          id: string
          imported_at: string | null
          imported_by: string | null
          records_imported: number | null
          reference_month: string | null
          total_commission: number | null
          total_paid: number | null
        }
        Insert: {
          file_name?: string | null
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          records_imported?: number | null
          reference_month?: string | null
          total_commission?: number | null
          total_paid?: number | null
        }
        Update: {
          file_name?: string | null
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          records_imported?: number | null
          reference_month?: string | null
          total_commission?: number | null
          total_paid?: number | null
        }
        Relationships: []
      }
      investments: {
        Row: {
          bank: string | null
          current_amount: number | null
          id: string
          initial_amount: number | null
          maturity_date: string | null
          name: string | null
          rate_percent: number | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          bank?: string | null
          current_amount?: number | null
          id?: string
          initial_amount?: number | null
          maturity_date?: string | null
          name?: string | null
          rate_percent?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          bank?: string | null
          current_amount?: number | null
          id?: string
          initial_amount?: number | null
          maturity_date?: string | null
          name?: string | null
          rate_percent?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      kitnet_entries: {
        Row: {
          adm_fee: number | null
          broker_creci: string | null
          broker_name: string | null
          celesc: number | null
          created_at: string | null
          created_by: string | null
          id: string
          iptu_taxa: number | null
          kitnet_id: string | null
          period_end: string | null
          period_start: string | null
          reference_month: string | null
          rent_gross: number | null
          semasa: number | null
          total_liquid: number | null
        }
        Insert: {
          adm_fee?: number | null
          broker_creci?: string | null
          broker_name?: string | null
          celesc?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          iptu_taxa?: number | null
          kitnet_id?: string | null
          period_end?: string | null
          period_start?: string | null
          reference_month?: string | null
          rent_gross?: number | null
          semasa?: number | null
          total_liquid?: number | null
        }
        Update: {
          adm_fee?: number | null
          broker_creci?: string | null
          broker_name?: string | null
          celesc?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          iptu_taxa?: number | null
          kitnet_id?: string | null
          period_end?: string | null
          period_start?: string | null
          reference_month?: string | null
          rent_gross?: number | null
          semasa?: number | null
          total_liquid?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kitnet_entries_kitnet_id_fkey"
            columns: ["kitnet_id"]
            isOneToOne: false
            referencedRelation: "kitnets"
            referencedColumns: ["id"]
          },
        ]
      }
      kitnets: {
        Row: {
          code: string | null
          deposit_account: string | null
          deposit_agency: string | null
          deposit_bank: string | null
          id: string
          rent_value: number | null
          residencial_code: string | null
          status: string | null
          tenant_name: string | null
          unit_number: number | null
        }
        Insert: {
          code?: string | null
          deposit_account?: string | null
          deposit_agency?: string | null
          deposit_bank?: string | null
          id?: string
          rent_value?: number | null
          residencial_code?: string | null
          status?: string | null
          tenant_name?: string | null
          unit_number?: number | null
        }
        Update: {
          code?: string | null
          deposit_account?: string | null
          deposit_agency?: string | null
          deposit_bank?: string | null
          id?: string
          rent_value?: number | null
          residencial_code?: string | null
          status?: string | null
          tenant_name?: string | null
          unit_number?: number | null
        }
        Relationships: []
      }
      pluggy_connections: {
        Row: {
          account_id: string | null
          bank_name: string | null
          created_at: string | null
          id: string
          item_id: string | null
          last_sync: string | null
          status: string | null
        }
        Insert: {
          account_id?: string | null
          bank_name?: string | null
          created_at?: string | null
          id?: string
          item_id?: string | null
          last_sync?: string | null
          status?: string | null
        }
        Update: {
          account_id?: string | null
          bank_name?: string | null
          created_at?: string | null
          id?: string
          item_id?: string | null
          last_sync?: string | null
          status?: string | null
        }
        Relationships: []
      }
      prevensul_billing: {
        Row: {
          amount_paid: number | null
          balance_remaining: number | null
          client_name: string | null
          closing_date: string | null
          commission_rate: number | null
          commission_value: number | null
          contract_nf: string | null
          contract_total: number | null
          created_at: string | null
          created_by: string | null
          id: string
          installment_current: number | null
          installment_total: number | null
          notes: string | null
          reference_month: string | null
          status: string | null
        }
        Insert: {
          amount_paid?: number | null
          balance_remaining?: number | null
          client_name?: string | null
          closing_date?: string | null
          commission_rate?: number | null
          commission_value?: number | null
          contract_nf?: string | null
          contract_total?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          installment_current?: number | null
          installment_total?: number | null
          notes?: string | null
          reference_month?: string | null
          status?: string | null
        }
        Update: {
          amount_paid?: number | null
          balance_remaining?: number | null
          client_name?: string | null
          closing_date?: string | null
          commission_rate?: number | null
          commission_value?: number | null
          contract_nf?: string | null
          contract_total?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          installment_current?: number | null
          installment_total?: number | null
          notes?: string | null
          reference_month?: string | null
          status?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          name: string | null
          partner_projects: string[] | null
        }
        Insert: {
          created_at?: string | null
          id: string
          name?: string | null
          partner_projects?: string[] | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string | null
          partner_projects?: string[] | null
        }
        Relationships: []
      }
      real_estate_properties: {
        Row: {
          address: string | null
          city: string | null
          code: string | null
          estimated_completion: string | null
          estimated_rent_per_unit: number | null
          id: string
          iptu_annual: number | null
          name: string | null
          notes: string | null
          ownership_pct: number | null
          partner_name: string | null
          partner_pct: number | null
          property_value: number | null
          status: string | null
          total_units_built: number | null
          total_units_planned: number | null
          total_units_rented: number | null
          type: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          code?: string | null
          estimated_completion?: string | null
          estimated_rent_per_unit?: number | null
          id?: string
          iptu_annual?: number | null
          name?: string | null
          notes?: string | null
          ownership_pct?: number | null
          partner_name?: string | null
          partner_pct?: number | null
          property_value?: number | null
          status?: string | null
          total_units_built?: number | null
          total_units_planned?: number | null
          total_units_rented?: number | null
          type?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string | null
          estimated_completion?: string | null
          estimated_rent_per_unit?: number | null
          id?: string
          iptu_annual?: number | null
          name?: string | null
          notes?: string | null
          ownership_pct?: number | null
          partner_name?: string | null
          partner_pct?: number | null
          property_value?: number | null
          status?: string | null
          total_units_built?: number | null
          total_units_planned?: number | null
          total_units_rented?: number | null
          type?: string | null
        }
        Relationships: []
      }
      residenciais: {
        Row: {
          address: string | null
          city: string | null
          code: string
          id: string
          name: string | null
          total_units: number | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          id?: string
          name?: string | null
          total_units?: number | null
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          id?: string
          name?: string | null
          total_units?: number | null
        }
        Relationships: []
      }
      revenues: {
        Row: {
          amount: number | null
          created_at: string | null
          description: string | null
          id: string
          received_at: string | null
          reference_month: string | null
          source: string | null
          type: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          received_at?: string | null
          reference_month?: string | null
          source?: string | null
          type?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          received_at?: string | null
          reference_month?: string | null
          source?: string | null
          type?: string | null
        }
        Relationships: []
      }
      taxes: {
        Row: {
          amount: number | null
          created_at: string | null
          due_date: string | null
          id: string
          name: string | null
          paid_at: string | null
          reference_year: number | null
          status: string | null
          type: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          name?: string | null
          paid_at?: string | null
          reference_year?: number | null
          status?: string | null
          type?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          name?: string | null
          paid_at?: string | null
          reference_year?: number | null
          status?: string | null
          type?: string | null
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
      wedding_budget: {
        Row: {
          amount_paid: number | null
          amount_remaining: number | null
          category: string | null
          contracted_value: number | null
          created_at: string | null
          estimated_value: number | null
          id: string
          item: string | null
          notes: string | null
          status: string | null
          supplier: string | null
        }
        Insert: {
          amount_paid?: number | null
          amount_remaining?: number | null
          category?: string | null
          contracted_value?: number | null
          created_at?: string | null
          estimated_value?: number | null
          id?: string
          item?: string | null
          notes?: string | null
          status?: string | null
          supplier?: string | null
        }
        Update: {
          amount_paid?: number | null
          amount_remaining?: number | null
          category?: string | null
          contracted_value?: number | null
          created_at?: string | null
          estimated_value?: number | null
          id?: string
          item?: string | null
          notes?: string | null
          status?: string | null
          supplier?: string | null
        }
        Relationships: []
      }
      wedding_installments: {
        Row: {
          amount: number | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          paid_at: string | null
          status: string | null
          supplier: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          paid_at?: string | null
          status?: string | null
          supplier?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          paid_at?: string | null
          status?: string | null
          supplier?: string | null
        }
        Relationships: []
      }
      wedding_vendor_payments: {
        Row: {
          amount: number
          created_at: string | null
          description: string
          due_date: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          receipt_file_name: string | null
          receipt_url: string | null
          status: string | null
          vendor_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          description: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          receipt_file_name?: string | null
          receipt_url?: string | null
          status?: string | null
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          receipt_file_name?: string | null
          receipt_url?: string | null
          status?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wedding_vendor_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "wedding_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_vendors: {
        Row: {
          contract_file_name: string | null
          contract_file_url: string | null
          contracted_value: number | null
          created_at: string | null
          estimated_value: number | null
          id: string
          notes: string | null
          service: string
          status: string | null
          updated_at: string | null
          vendor_name: string | null
        }
        Insert: {
          contract_file_name?: string | null
          contract_file_url?: string | null
          contracted_value?: number | null
          created_at?: string | null
          estimated_value?: number | null
          id?: string
          notes?: string | null
          service: string
          status?: string | null
          updated_at?: string | null
          vendor_name?: string | null
        }
        Update: {
          contract_file_name?: string | null
          contract_file_url?: string | null
          contracted_value?: number | null
          created_at?: string | null
          estimated_value?: number | null
          id?: string
          notes?: string | null
          service?: string
          status?: string | null
          updated_at?: string | null
          vendor_name?: string | null
        }
        Relationships: []
      }
      wisely_messages: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          module: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          module?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          module?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_transaction_hash: {
        Args: {
          p_account_id: string
          p_amount: number
          p_date: string
          p_description: string
          p_memo: string
        }
        Returns: string
      }
      clean_duplicate_expenses: { Args: never; Returns: undefined }
      clean_duplicate_revenues: { Args: never; Returns: undefined }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "kitnet_manager" | "financial" | "partner"
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
      app_role: ["admin", "kitnet_manager", "financial", "partner"],
    },
  },
} as const
