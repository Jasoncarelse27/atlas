import { createClient } from "@supabase/supabase-js";

// Environment variables for Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing required environment variables");
}

// Create and export a single Supabase client instance
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? localStorage : undefined,
  },
});

// Dev-only: expose for console debugging
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).supabase = supabase;
  console.log('🔧 Supabase client exposed globally for DevTools testing');
}

// Health-check helper
export async function checkSupabaseHealth() {
  try {
    // Test connection with a simple query that doesn't require auth
    const { error } = await supabase.from('user_profiles').select('id').limit(1);
    if (error) {
      console.error("⚠️ Supabase health check failed:", error.message);
      return { ok: false, message: error.message };
    }
    // Connection healthy - only log occasionally in development
    if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) {
      console.log("✅ Supabase connection healthy.");
    }
    return { ok: true };
  } catch (err: any) {
    console.error("❌ Supabase health-check exception:", err.message);
    return { ok: false, message: err.message };
  }
}

// Export for backward compatibility
export default supabase;
