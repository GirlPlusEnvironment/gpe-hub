import { createClient } from "@supabase/supabase-js";

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!rawSupabaseUrl) {
  throw new Error("VITE_SUPABASE_URL is missing. Add it to your environment variables before starting the app.");
}

if (!supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_ANON_KEY is missing. Add it to your environment variables before starting the app.");
}

export const supabaseUrl = rawSupabaseUrl.replace(/\/$/, "");
export const supabasePublicStorageUrl = `${supabaseUrl}/storage/v1/object/public`;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
