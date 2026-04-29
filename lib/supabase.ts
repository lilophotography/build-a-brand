import { createClient } from "@supabase/supabase-js";

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          clerk_id: string | null;
          email: string | null;
          name: string | null;
          has_access: boolean;
          stripe_customer_id: string | null;
          created_at: string;
        };
        Insert: {
          clerk_id?: string | null;
          email?: string | null;
          name?: string | null;
          has_access?: boolean;
          stripe_customer_id?: string | null;
        };
        Update: {
          clerk_id?: string | null;
          email?: string | null;
          name?: string | null;
          has_access?: boolean;
          stripe_customer_id?: string | null;
        };
      };
      brand_progress: {
        Row: {
          id: string;
          user_id: string;
          tool: "vision" | "value" | "voice" | "visuals" | "visibility";
          completed: boolean;
          messages: { role: string; content: string }[];
          summary: string | null;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["brand_progress"]["Row"], "id" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["brand_progress"]["Insert"]>;
      };
    };
  };
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE) as any;
