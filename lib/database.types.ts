import type { QuoteStatus } from "@/lib/quote-status";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      businesses: Table<
        {
          id: string;
          owner_id: string;
          name: string;
          email: string;
          phone: string;
          address: string;
          vat_number: string;
          logo_path: string | null;
          is_suspended: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          owner_id: string;
          name: string;
          email?: string;
          phone?: string;
          address?: string;
          vat_number?: string;
          logo_path?: string | null;
        }
      >;
      clients: Table<
        {
          id: string;
          business_id: string;
          name: string;
          email: string;
          phone: string;
          address: string;
          notes: string;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          business_id: string;
          name: string;
          email?: string;
          phone?: string;
          address?: string;
          notes?: string;
          archived_at?: string | null;
        }
      >;
      quotes: Table<
        {
          id: string;
          business_id: string;
          client_id: string | null;
          quote_number: string;
          description: string;
          hours: number;
          hourly_rate: number;
          call_out_fee: number;
          vat_rate: number;
          materials: Json;
          materials_markup: number;
          subtotal: number;
          vat_amount: number;
          total: number;
          status: QuoteStatus;
          follow_up_date: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          business_id: string;
          client_id?: string | null;
          quote_number: string;
          description: string;
          hours: number;
          hourly_rate: number;
          call_out_fee: number;
          vat_rate: number;
          materials: Json;
          materials_markup: number;
          subtotal: number;
          vat_amount: number;
          total: number;
          status?: QuoteStatus;
          follow_up_date?: string | null;
        }
      >;
      invoices: Table<
        {
          id: string;
          business_id: string;
          quote_id: string;
          invoice_number: string;
          status: "draft" | "sent";
          issued_on: string;
          due_date: string;
          deposit_required: number;
          subtotal: number;
          vat_amount: number;
          total: number;
          business_snapshot: Json;
          client_snapshot: Json | null;
          quote_snapshot: Json;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          business_id: string;
          quote_id: string;
          invoice_number: string;
          status?: "draft" | "sent";
          issued_on?: string;
          due_date: string;
          deposit_required?: number;
          subtotal: number;
          vat_amount: number;
          total: number;
          business_snapshot: Json;
          client_snapshot?: Json | null;
          quote_snapshot: Json;
        }
      >;
      invoice_payments: Table<
        {
          id: string;
          business_id: string;
          invoice_id: string;
          amount: number;
          paid_on: string;
          method: "cash" | "bank_transfer" | "card" | "other";
          note: string;
          created_at: string;
        },
        {
          id?: string;
          business_id: string;
          invoice_id: string;
          amount: number;
          paid_on?: string;
          method: "cash" | "bank_transfer" | "card" | "other";
          note?: string;
        }
      >;
      subscriptions: Table<
        {
          id: string;
          business_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          stripe_price_id: string | null;
          status: string;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          business_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_price_id?: string | null;
          status?: string;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
        }
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      current_business_id: { Args: Record<string, never>; Returns: string | null };
      has_active_subscription: { Args: Record<string, never>; Returns: boolean };
      is_platform_admin: { Args: Record<string, never>; Returns: boolean };
      set_business_suspension: {
        Args: { p_business_id: string; p_suspended: boolean };
        Returns: undefined;
      };
      create_invoice_from_accepted_quote: {
        Args: {
          p_quote_id: string;
          p_due_date: string;
          p_deposit_required: number;
        };
        Returns: string;
      };
      set_invoice_status: {
        Args: { p_invoice_id: string; p_status: "sent" };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
