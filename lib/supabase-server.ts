import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServerKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasServerSupabaseConfig = Boolean(supabaseUrl && supabaseServerKey);

export function createServerSupabaseClient() {
  return createClient(supabaseUrl ?? "https://example.supabase.co", supabaseServerKey ?? "missing-key", {
    auth: {
      persistSession: false
    }
  });
}
