import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { logger } from './logger';

// Environment variables for Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing required environment variables");
}

// Mobile-safe Supabase client configuration
const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Singleton pattern to prevent multiple client instances
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

export const supabase = (() => {
  if (!supabaseInstance) {
    supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? localStorage : undefined,
  },
  // Optimize realtime for chat messages
  realtime: {
    params: {
      eventsPerSecond: 10, // Increased from 2 to 10 for better chat performance
    },
  },
  global: {
    headers: {
      'X-Client-Info': 'atlas-mobile-safe',
    },
  },
    });
  }
  return supabaseInstance;
})();

// Dev-only: expose for console debugging (only if not already exposed)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  if (!(window as any).supabase) {
    (window as any).supabase = supabase;
  }
}

// Health-check helper with mobile fallback
export async function checkSupabaseHealth() {
  try {
    // On mobile, skip the health check to avoid WebSocket issues
    if (isMobile) {
      return { ok: true, mobile: true };
    }
    
    // Test connection with a simple query that doesn't require auth
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error) {
      return { ok: false, message: error.message };
    }
    // Connection healthy - only log occasionally in development
    if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) {
      logger.debug("✅ Supabase connection healthy.");
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

// Export for backward compatibility
export default supabase;
