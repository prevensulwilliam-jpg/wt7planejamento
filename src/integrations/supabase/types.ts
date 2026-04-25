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
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          estado: string | null
          estimated_value: number | null
          id: string
          logradouro: string | null
          name: string | null
          notes: string | null
          numero: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          acquisition_date?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          estado?: string | null
          estimated_value?: number | null
          id?: string
          logradouro?: string | null
          name?: string | null
          notes?: string | null
          numero?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          acquisition_date?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          estado?: string | null
          estimated_value?: number | null
          id?: string
          logradouro?: string | null
          name?: string | null
          notes?: string | null
          numero?: string | null
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
          account_number: string | null
          account_type: string | null
          agency: string | null
          balance: number | null
          bank_code: string | null
          bank_name: string
          created_at: string | null
          id: string
          last_updated: string | null
          notes: string | null
          pix_key: string | null
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          agency?: string | null
          balance?: number | null
          bank_code?: string | null
          bank_name: string
          created_at?: string | null
          id?: string
          last_updated?: string | null
          notes?: string | null
          pix_key?: string | null
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          agency?: string | null
          balance?: number | null
          bank_code?: string | null
          bank_name?: string
          created_at?: string | null
          id?: string
          last_updated?: string | null
          notes?: string | null
          pix_key?: string | null
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
          kitnet_entry_id: string | null
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
          kitnet_entry_id?: string | null
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
          kitnet_entry_id?: string | null
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
            foreignKeyName: "bank_transactions_kitnet_entry_id_fkey"
            columns: ["kitnet_entry_id"]
            isOneToOne: false
            referencedRelation: "kitnet_entries"
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
      billing_payment_schedule: {
        Row: {
          amount: number
          billing_id: string
          created_at: string | null
          due_date: string
          id: string
          installment_number: number
          paid_at: string | null
          status: string | null
        }
        Insert: {
          amount: number
          billing_id: string
          created_at?: string | null
          due_date: string
          id?: string
          installment_number: number
          paid_at?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          billing_id?: string
          created_at?: string | null
          due_date?: string
          id?: string
          installment_number?: number
          paid_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_payment_schedule_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "prevensul_billing"
            referencedColumns: ["id"]
          },
        ]
      }
      business_revenue_entries: {
        Row: {
          amount_total: number | null
          amount_william: number
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          reference_month: string
        }
        Insert: {
          amount_total?: number | null
          amount_william: number
          business_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          reference_month: string
        }
        Update: {
          amount_total?: number | null
          amount_william?: number
          business_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          reference_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_revenue_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          category: string
          code: string
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          monthly_target: number
          name: string
          notes: string | null
          order_index: number
          ownership_pct: number
          partner_name: string | null
          status: string
          target_year_end: number
          target_year_end_date: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          code: string
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          monthly_target?: number
          name: string
          notes?: string | null
          order_index?: number
          ownership_pct?: number
          partner_name?: string | null
          status?: string
          target_year_end?: number
          target_year_end_date?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          monthly_target?: number
          name?: string
          notes?: string | null
          order_index?: number
          ownership_pct?: number
          partner_name?: string | null
          status?: string
          target_year_end?: number
          target_year_end_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      card_invoices: {
        Row: {
          card_id: string
          closing_date: string | null
          due_date: string | null
          file_format: string | null
          file_url: string | null
          id: string
          imported_at: string | null
          paid_amount: number | null
          paid_at: string | null
          reference_month: string
          total_amount: number | null
        }
        Insert: {
          card_id: string
          closing_date?: string | null
          due_date?: string | null
          file_format?: string | null
          file_url?: string | null
          id?: string
          imported_at?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          reference_month: string
          total_amount?: number | null
        }
        Update: {
          card_id?: string
          closing_date?: string | null
          due_date?: string | null
          file_format?: string | null
          file_url?: string | null
          id?: string
          imported_at?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          reference_month?: string
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "card_invoices_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_merchant_patterns: {
        Row: {
          category_id: string
          confidence: number | null
          id: string
          last_used_at: string | null
          merchant_pattern: string
        }
        Insert: {
          category_id: string
          confidence?: number | null
          id?: string
          last_used_at?: string | null
          merchant_pattern: string
        }
        Update: {
          category_id?: string
          confidence?: number | null
          id?: string
          last_used_at?: string | null
          merchant_pattern?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_merchant_patterns_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "custom_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      card_rewards: {
        Row: {
          card_id: string
          created_at: string | null
          id: string
          notes: string | null
          points_balance: number | null
          points_earned: number | null
          program: string | null
          reference_month: string
        }
        Insert: {
          card_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          points_balance?: number | null
          points_earned?: number | null
          program?: string | null
          reference_month: string
        }
        Update: {
          card_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          points_balance?: number | null
          points_earned?: number | null
          program?: string | null
          reference_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_rewards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_transactions: {
        Row: {
          amount: number
          card_id: string
          cardholder: string | null
          category_id: string | null
          counts_as_investment: boolean | null
          created_at: string | null
          currency: string | null
          description: string
          fitid: string | null
          fx_rate: number | null
          id: string
          installment_current: number | null
          installment_total: number | null
          invoice_id: string
          merchant_normalized: string | null
          notes: string | null
          transaction_date: string
          updated_at: string | null
          vector: string | null
        }
        Insert: {
          amount: number
          card_id: string
          cardholder?: string | null
          category_id?: string | null
          counts_as_investment?: boolean | null
          created_at?: string | null
          currency?: string | null
          description: string
          fitid?: string | null
          fx_rate?: number | null
          id?: string
          installment_current?: number | null
          installment_total?: number | null
          invoice_id: string
          merchant_normalized?: string | null
          notes?: string | null
          transaction_date: string
          updated_at?: string | null
          vector?: string | null
        }
        Update: {
          amount?: number
          card_id?: string
          cardholder?: string | null
          category_id?: string | null
          counts_as_investment?: boolean | null
          created_at?: string | null
          currency?: string | null
          description?: string
          fitid?: string | null
          fx_rate?: number | null
          id?: string
          installment_current?: number | null
          installment_total?: number | null
          invoice_id?: string
          merchant_normalized?: string | null
          notes?: string | null
          transaction_date?: string
          updated_at?: string | null
          vector?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "custom_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "card_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          active: boolean | null
          bank: string
          brand: string | null
          closing_day: number | null
          created_at: string | null
          credit_limit: number | null
          due_day: number | null
          id: string
          last4: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          bank: string
          brand?: string | null
          closing_day?: number | null
          created_at?: string | null
          credit_limit?: number | null
          due_day?: number | null
          id?: string
          last4?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          bank?: string
          brand?: string | null
          closing_day?: number | null
          created_at?: string | null
          credit_limit?: number | null
          due_day?: number | null
          id?: string
          last4?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
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
          payment_date: string | null
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
          payment_date?: string | null
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
          payment_date?: string | null
          pdf_url?: string | null
          pis_cofins_pct?: number | null
          reference_month?: string | null
          residencial_code?: string | null
          solar_kwh_offset?: number | null
          tariff_per_kwh?: number | null
        }
        Relationships: []
      }
      ceo_config: {
        Row: {
          config_key: string
          config_value: Json
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value?: Json
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          id?: string
          updated_at?: string | null
          updated_by?: string | null
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
      consortium_installments: {
        Row: {
          accounting_date: string | null
          admin_pct: number | null
          amount_due: number | null
          amount_paid: number | null
          consortium_id: string
          created_at: string | null
          fc_pct: number | null
          id: string
          installment_number: number
          insurance_pct: number | null
          interest: number | null
          payment_date: string | null
          penalty: number | null
          transaction_type: string | null
        }
        Insert: {
          accounting_date?: string | null
          admin_pct?: number | null
          amount_due?: number | null
          amount_paid?: number | null
          consortium_id: string
          created_at?: string | null
          fc_pct?: number | null
          id?: string
          installment_number: number
          insurance_pct?: number | null
          interest?: number | null
          payment_date?: string | null
          penalty?: number | null
          transaction_type?: string | null
        }
        Update: {
          accounting_date?: string | null
          admin_pct?: number | null
          amount_due?: number | null
          amount_paid?: number | null
          consortium_id?: string
          created_at?: string | null
          fc_pct?: number | null
          id?: string
          installment_number?: number
          insurance_pct?: number | null
          interest?: number | null
          payment_date?: string | null
          penalty?: number | null
          transaction_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consortium_installments_consortium_id_fkey"
            columns: ["consortium_id"]
            isOneToOne: false
            referencedRelation: "consortiums"
            referencedColumns: ["id"]
          },
        ]
      }
      consortiums: {
        Row: {
          adhesion_date: string | null
          admin_fee_paid: number | null
          admin_fee_pct: number | null
          asset_type: string | null
          contract_number: string | null
          credit_value: number | null
          end_date: string | null
          extrato_file_name: string | null
          extrato_file_url: string | null
          extrato_updated_at: string | null
          fund_paid: number | null
          fund_pct: number | null
          group_number: string | null
          id: string
          installments_paid: number | null
          installments_remaining: number | null
          installments_total: number | null
          insurance_paid: number | null
          insurance_pct: number | null
          monthly_payment: number | null
          name: string | null
          notes: string | null
          ownership_pct: number | null
          partner_name: string | null
          quota: string | null
          status: string | null
          total_paid: number | null
          total_pending: number | null
          total_value: number | null
          updated_at: string | null
        }
        Insert: {
          adhesion_date?: string | null
          admin_fee_paid?: number | null
          admin_fee_pct?: number | null
          asset_type?: string | null
          contract_number?: string | null
          credit_value?: number | null
          end_date?: string | null
          extrato_file_name?: string | null
          extrato_file_url?: string | null
          extrato_updated_at?: string | null
          fund_paid?: number | null
          fund_pct?: number | null
          group_number?: string | null
          id?: string
          installments_paid?: number | null
          installments_remaining?: number | null
          installments_total?: number | null
          insurance_paid?: number | null
          insurance_pct?: number | null
          monthly_payment?: number | null
          name?: string | null
          notes?: string | null
          ownership_pct?: number | null
          partner_name?: string | null
          quota?: string | null
          status?: string | null
          total_paid?: number | null
          total_pending?: number | null
          total_value?: number | null
          updated_at?: string | null
        }
        Update: {
          adhesion_date?: string | null
          admin_fee_paid?: number | null
          admin_fee_pct?: number | null
          asset_type?: string | null
          contract_number?: string | null
          credit_value?: number | null
          end_date?: string | null
          extrato_file_name?: string | null
          extrato_file_url?: string | null
          extrato_updated_at?: string | null
          fund_paid?: number | null
          fund_pct?: number | null
          group_number?: string | null
          id?: string
          installments_paid?: number | null
          installments_remaining?: number | null
          installments_total?: number | null
          insurance_paid?: number | null
          insurance_pct?: number | null
          monthly_payment?: number | null
          name?: string | null
          notes?: string | null
          ownership_pct?: number | null
          partner_name?: string | null
          quota?: string | null
          status?: string | null
          total_paid?: number | null
          total_pending?: number | null
          total_value?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      construction_expenses: {
        Row: {
          category: string | null
          construction_id: string | null
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
          stage_id: string | null
          total_amount: number | null
          william_amount: number | null
        }
        Insert: {
          category?: string | null
          construction_id?: string | null
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
          stage_id?: string | null
          total_amount?: number | null
          william_amount?: number | null
        }
        Update: {
          category?: string | null
          construction_id?: string | null
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
          stage_id?: string | null
          total_amount?: number | null
          william_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "construction_expenses_construction_id_fkey"
            columns: ["construction_id"]
            isOneToOne: false
            referencedRelation: "constructions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "real_estate_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_expenses_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "construction_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_stages: {
        Row: {
          budget_estimated: number | null
          construction_id: string
          created_at: string | null
          end_date: string | null
          id: string
          name: string
          notes: string | null
          order_index: number | null
          pct_complete: number | null
          pct_complete_auto: boolean
          start_date: string | null
          status: string
        }
        Insert: {
          budget_estimated?: number | null
          construction_id: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          order_index?: number | null
          pct_complete?: number | null
          pct_complete_auto?: boolean
          start_date?: string | null
          status?: string
        }
        Update: {
          budget_estimated?: number | null
          construction_id?: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          order_index?: number | null
          pct_complete?: number | null
          pct_complete_auto?: boolean
          start_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_stages_construction_id_fkey"
            columns: ["construction_id"]
            isOneToOne: false
            referencedRelation: "constructions"
            referencedColumns: ["id"]
          },
        ]
      }
      constructions: {
        Row: {
          asset_id: string | null
          created_at: string | null
          debt_partner_name: string | null
          debt_target_date: string | null
          debt_to_partner: number | null
          end_date: string | null
          estimated_completion: string | null
          estimated_rent_per_unit: number | null
          estimated_value_ready: number | null
          id: string
          name: string
          notes: string | null
          ownership_pct: number | null
          partner_name: string | null
          partner_pct: number | null
          start_date: string | null
          status: string
          total_budget: number | null
          total_units_built: number | null
          total_units_planned: number | null
          total_units_rented: number | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string | null
          debt_partner_name?: string | null
          debt_target_date?: string | null
          debt_to_partner?: number | null
          end_date?: string | null
          estimated_completion?: string | null
          estimated_rent_per_unit?: number | null
          estimated_value_ready?: number | null
          id?: string
          name: string
          notes?: string | null
          ownership_pct?: number | null
          partner_name?: string | null
          partner_pct?: number | null
          start_date?: string | null
          status?: string
          total_budget?: number | null
          total_units_built?: number | null
          total_units_planned?: number | null
          total_units_rented?: number | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string | null
          debt_partner_name?: string | null
          debt_target_date?: string | null
          debt_to_partner?: number | null
          end_date?: string | null
          estimated_completion?: string | null
          estimated_rent_per_unit?: number | null
          estimated_value_ready?: number | null
          id?: string
          name?: string
          notes?: string | null
          ownership_pct?: number | null
          partner_name?: string | null
          partner_pct?: number | null
          start_date?: string | null
          status?: string
          total_budget?: number | null
          total_units_built?: number | null
          total_units_planned?: number | null
          total_units_rented?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "constructions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_categories: {
        Row: {
          active: boolean | null
          color: string | null
          counts_as_investment: boolean | null
          created_at: string | null
          emoji: string | null
          id: string
          name: string
          slug: string | null
          type: string | null
          vector: string | null
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          counts_as_investment?: boolean | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          name: string
          slug?: string | null
          type?: string | null
          vector?: string | null
        }
        Update: {
          active?: boolean | null
          color?: string | null
          counts_as_investment?: boolean | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          name?: string
          slug?: string | null
          type?: string | null
          vector?: string | null
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
      energy_config: {
        Row: {
          id: string
          residencial_code: string
          tariff_kwh: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          residencial_code: string
          tariff_kwh?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          residencial_code?: string
          tariff_kwh?: number
          updated_at?: string | null
          updated_by?: string | null
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
          cdi_percent: number | null
          current_amount: number | null
          id: string
          inclusion_date: string | null
          initial_amount: number | null
          is_cdi_linked: boolean | null
          maturity_date: string | null
          name: string | null
          notes: string | null
          product_code: string | null
          rate_percent: number | null
          rescue_amount: number | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          bank?: string | null
          cdi_percent?: number | null
          current_amount?: number | null
          id?: string
          inclusion_date?: string | null
          initial_amount?: number | null
          is_cdi_linked?: boolean | null
          maturity_date?: string | null
          name?: string | null
          notes?: string | null
          product_code?: string | null
          rate_percent?: number | null
          rescue_amount?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          bank?: string | null
          cdi_percent?: number | null
          current_amount?: number | null
          id?: string
          inclusion_date?: string | null
          initial_amount?: number | null
          is_cdi_linked?: boolean | null
          maturity_date?: string | null
          name?: string | null
          notes?: string | null
          product_code?: string | null
          rate_percent?: number | null
          rescue_amount?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      kitnet_alerts: {
        Row: {
          alert_month: string
          alert_type: string
          confirmed: boolean | null
          created_at: string | null
          id: string
          kitnet_id: string
          pending_amount: number
          resolved: boolean
          resolved_at: string | null
          source_entry_id: string | null
          source_month: string
        }
        Insert: {
          alert_month: string
          alert_type?: string
          confirmed?: boolean | null
          created_at?: string | null
          id?: string
          kitnet_id: string
          pending_amount: number
          resolved?: boolean
          resolved_at?: string | null
          source_entry_id?: string | null
          source_month: string
        }
        Update: {
          alert_month?: string
          alert_type?: string
          confirmed?: boolean | null
          created_at?: string | null
          id?: string
          kitnet_id?: string
          pending_amount?: number
          resolved?: boolean
          resolved_at?: string | null
          source_entry_id?: string | null
          source_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitnet_alerts_kitnet_id_fkey"
            columns: ["kitnet_id"]
            isOneToOne: false
            referencedRelation: "kitnets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitnet_alerts_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "kitnet_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      kitnet_entries: {
        Row: {
          adm_fee: number | null
          bank_transaction_id: string | null
          broker_creci: string | null
          broker_name: string | null
          celesc: number | null
          created_at: string | null
          created_by: string | null
          discount_amount: number | null
          discount_reason: string | null
          id: string
          iptu_taxa: number | null
          kitnet_id: string | null
          notes: string | null
          period_end: string | null
          period_start: string | null
          reconciled: boolean | null
          reconciled_at: string | null
          reference_month: string | null
          rent_gross: number | null
          semasa: number | null
          surcharge_amount: number | null
          surcharge_reason: string | null
          tenant_name: string | null
          total_liquid: number | null
        }
        Insert: {
          adm_fee?: number | null
          bank_transaction_id?: string | null
          broker_creci?: string | null
          broker_name?: string | null
          celesc?: number | null
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number | null
          discount_reason?: string | null
          id?: string
          iptu_taxa?: number | null
          kitnet_id?: string | null
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          reconciled?: boolean | null
          reconciled_at?: string | null
          reference_month?: string | null
          rent_gross?: number | null
          semasa?: number | null
          surcharge_amount?: number | null
          surcharge_reason?: string | null
          tenant_name?: string | null
          total_liquid?: number | null
        }
        Update: {
          adm_fee?: number | null
          bank_transaction_id?: string | null
          broker_creci?: string | null
          broker_name?: string | null
          celesc?: number | null
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number | null
          discount_reason?: string | null
          id?: string
          iptu_taxa?: number | null
          kitnet_id?: string | null
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          reconciled?: boolean | null
          reconciled_at?: string | null
          reference_month?: string | null
          rent_gross?: number | null
          semasa?: number | null
          surcharge_amount?: number | null
          surcharge_reason?: string | null
          tenant_name?: string | null
          total_liquid?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kitnet_entries_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitnet_entries_kitnet_id_fkey"
            columns: ["kitnet_id"]
            isOneToOne: false
            referencedRelation: "kitnets"
            referencedColumns: ["id"]
          },
        ]
      }
      kitnet_entry_transactions: {
        Row: {
          amount: number
          bank_transaction_id: string
          created_at: string | null
          id: string
          kitnet_entry_id: string
        }
        Insert: {
          amount: number
          bank_transaction_id: string
          created_at?: string | null
          id?: string
          kitnet_entry_id: string
        }
        Update: {
          amount?: number
          bank_transaction_id?: string
          created_at?: string | null
          id?: string
          kitnet_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitnet_entry_transactions_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitnet_entry_transactions_kitnet_entry_id_fkey"
            columns: ["kitnet_entry_id"]
            isOneToOne: false
            referencedRelation: "kitnet_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      kitnet_month_data: {
        Row: {
          kitnet_id: string
          reference_month: string
          rent_value: number | null
          tenant_name: string | null
          tenant_phone: string | null
          updated_at: string | null
        }
        Insert: {
          kitnet_id: string
          reference_month: string
          rent_value?: number | null
          tenant_name?: string | null
          tenant_phone?: string | null
          updated_at?: string | null
        }
        Update: {
          kitnet_id?: string
          reference_month?: string
          rent_value?: number | null
          tenant_name?: string | null
          tenant_phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kitnet_month_data_kitnet_id_fkey"
            columns: ["kitnet_id"]
            isOneToOne: false
            referencedRelation: "kitnets"
            referencedColumns: ["id"]
          },
        ]
      }
      kitnet_month_status: {
        Row: {
          kitnet_id: string
          reference_month: string
          status: string
          updated_at: string | null
        }
        Insert: {
          kitnet_id: string
          reference_month: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          kitnet_id?: string
          reference_month?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kitnet_month_status_kitnet_id_fkey"
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
          contract_url: string | null
          deposit_account: string | null
          deposit_agency: string | null
          deposit_bank: string | null
          id: string
          rent_value: number | null
          residencial_code: string | null
          status: string | null
          tenant_name: string | null
          tenant_phone: string | null
          unit_number: number | null
        }
        Insert: {
          code?: string | null
          contract_url?: string | null
          deposit_account?: string | null
          deposit_agency?: string | null
          deposit_bank?: string | null
          id?: string
          rent_value?: number | null
          residencial_code?: string | null
          status?: string | null
          tenant_name?: string | null
          tenant_phone?: string | null
          unit_number?: number | null
        }
        Update: {
          code?: string | null
          contract_url?: string | null
          deposit_account?: string | null
          deposit_agency?: string | null
          deposit_bank?: string | null
          id?: string
          rent_value?: number | null
          residencial_code?: string | null
          status?: string | null
          tenant_name?: string | null
          tenant_phone?: string | null
          unit_number?: number | null
        }
        Relationships: []
      }
      locked_months: {
        Row: {
          id: string
          is_locked: boolean
          locked_at: string | null
          locked_by: string | null
          reference_month: string
        }
        Insert: {
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          reference_month: string
        }
        Update: {
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          reference_month?: string
        }
        Relationships: []
      }
      login_history: {
        Row: {
          id: string
          logged_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          logged_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          logged_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      month_lock_log: {
        Row: {
          action: string
          id: string
          performed_at: string | null
          performed_by: string | null
          reference_month: string
        }
        Insert: {
          action: string
          id?: string
          performed_at?: string | null
          performed_by?: string | null
          reference_month: string
        }
        Update: {
          action?: string
          id?: string
          performed_at?: string | null
          performed_by?: string | null
          reference_month?: string
        }
        Relationships: []
      }
      monthly_bill_instances: {
        Row: {
          actual_amount: number | null
          created_at: string | null
          due_date: string
          expected_amount: number
          id: string
          matched_expense_id: string | null
          matched_transaction_id: string | null
          notes: string | null
          paid_at: string | null
          recurring_bill_id: string
          reference_month: string
          status: string
        }
        Insert: {
          actual_amount?: number | null
          created_at?: string | null
          due_date: string
          expected_amount?: number
          id?: string
          matched_expense_id?: string | null
          matched_transaction_id?: string | null
          notes?: string | null
          paid_at?: string | null
          recurring_bill_id: string
          reference_month: string
          status?: string
        }
        Update: {
          actual_amount?: number | null
          created_at?: string | null
          due_date?: string
          expected_amount?: number
          id?: string
          matched_expense_id?: string | null
          matched_transaction_id?: string | null
          notes?: string | null
          paid_at?: string | null
          recurring_bill_id?: string
          reference_month?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_bill_instances_recurring_bill_id_fkey"
            columns: ["recurring_bill_id"]
            isOneToOne: false
            referencedRelation: "recurring_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      naval_memory: {
        Row: {
          content: string
          priority: number
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          priority?: number
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          priority?: number
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      naval_principle_vectors: {
        Row: {
          created_at: string | null
          embedding: string
          id: string
          lens: string
          principle_idx: number
          source_id: string
          text: string
        }
        Insert: {
          created_at?: string | null
          embedding: string
          id?: string
          lens: string
          principle_idx: number
          source_id: string
          text: string
        }
        Update: {
          created_at?: string | null
          embedding?: string
          id?: string
          lens?: string
          principle_idx?: number
          source_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "naval_principle_vectors_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "naval_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      naval_sources: {
        Row: {
          active: boolean
          author: string | null
          id: string
          ingested_at: string | null
          lens: string
          principles: Json
          priority: number
          raw_content: string | null
          slug: string
          source_type: string
          source_url: string | null
          summary: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          author?: string | null
          id?: string
          ingested_at?: string | null
          lens: string
          principles?: Json
          priority?: number
          raw_content?: string | null
          slug: string
          source_type: string
          source_url?: string | null
          summary?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          author?: string | null
          id?: string
          ingested_at?: string | null
          lens?: string
          principles?: Json
          priority?: number
          raw_content?: string | null
          slug?: string
          source_type?: string
          source_url?: string | null
          summary?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      other_commissions: {
        Row: {
          amount: number
          commission_rate: number | null
          commission_value: number
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          notes: string | null
          reference_month: string
          source: string | null
        }
        Insert: {
          amount?: number
          commission_rate?: number | null
          commission_value?: number
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          notes?: string | null
          reference_month: string
          source?: string | null
        }
        Update: {
          amount?: number
          commission_rate?: number | null
          commission_value?: number
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          notes?: string | null
          reference_month?: string
          source?: string | null
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
          payment_type: string | null
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
          payment_type?: string | null
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
          payment_type?: string | null
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
      recurring_bill_manual_matches: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          recurring_bill_id: string
          reference_month: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          recurring_bill_id: string
          reference_month: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          recurring_bill_id?: string
          reference_month?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_bill_manual_matches_recurring_bill_id_fkey"
            columns: ["recurring_bill_id"]
            isOneToOne: false
            referencedRelation: "recurring_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_bills: {
        Row: {
          active: boolean
          alias: string | null
          amount: number
          auto_promoted: boolean
          category: string | null
          created_at: string | null
          due_day: number
          frequency: string
          id: string
          is_fixed: boolean
          linked_consortium_id: string | null
          linked_residencial_code: string | null
          name: string
          notes: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean
          alias?: string | null
          amount?: number
          auto_promoted?: boolean
          category?: string | null
          created_at?: string | null
          due_day: number
          frequency?: string
          id?: string
          is_fixed?: boolean
          linked_consortium_id?: string | null
          linked_residencial_code?: string | null
          name: string
          notes?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean
          alias?: string | null
          amount?: number
          auto_promoted?: boolean
          category?: string | null
          created_at?: string | null
          due_day?: number
          frequency?: string
          id?: string
          is_fixed?: boolean
          linked_consortium_id?: string | null
          linked_residencial_code?: string | null
          name?: string
          notes?: string | null
          updated_at?: string | null
          user_id?: string | null
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
          business_id: string | null
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
          business_id?: string | null
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
          business_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          received_at?: string | null
          reference_month?: string | null
          source?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenues_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
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
          status: string | null
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string | null
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string | null
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
      delete_investment: { Args: { p_id: string }; Returns: undefined }
      delete_user_by_admin: { Args: { p_user_id: string }; Returns: undefined }
      get_investments: {
        Args: never
        Returns: {
          bank: string
          cdi_percent: number
          current_amount: number
          id: string
          inclusion_date: string
          initial_amount: number
          is_cdi_linked: boolean
          maturity_date: string
          name: string
          notes: string
          product_code: string
          rate_percent: number
          rescue_amount: number
          type: string
          updated_at: string
        }[]
      }
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
      match_principles: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          lens: string
          principle_idx: number
          similarity: number
          source_author: string
          source_id: string
          source_summary: string
          source_title: string
          text: string
        }[]
      }
      request_manager_access:
        | { Args: { p_user_id: string }; Returns: undefined }
        | { Args: { p_role?: string; p_user_id: string }; Returns: undefined }
      upsert_investment: { Args: { p_data: Json }; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "kitnet_manager"
        | "financial"
        | "partner"
        | "commissions"
        | "wedding"
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
      app_role: [
        "admin",
        "kitnet_manager",
        "financial",
        "partner",
        "commissions",
        "wedding",
      ],
    },
  },
} as const
